from decimal import Decimal
from typing import Any

import pytest
from pydantic import ValidationError

from ecommerce_api.application.schemas.product import (
    CreateProductInput,
    ListProductsQuery,
    UpdateProductInput,
)
from ecommerce_api.application.schemas.rules import issues_of

VALID: dict[str, Any] = {'sku': 'RS-001', 'name': 'Running Shoes', 'price': 89.99, 'stock': 150}


def failing_paths(model: type[CreateProductInput | ListProductsQuery], data: Any) -> list[str]:
    try:
        model.model_validate(data)
    except ValidationError as error:
        return [issue.path for issue in issues_of(error)]
    return []


def test_rejects_a_blank_name() -> None:
    assert failing_paths(CreateProductInput, {**VALID, 'name': '   '}) == ['name']


def test_rejects_a_price_with_a_currency_symbol() -> None:
    assert failing_paths(CreateProductInput, {**VALID, 'price': '$29.99'}) == ['price']


def test_rejects_negative_stock() -> None:
    assert failing_paths(CreateProductInput, {**VALID, 'stock': -5}) == ['stock']


def test_rejects_a_price_with_more_than_two_decimal_places() -> None:
    assert failing_paths(CreateProductInput, {**VALID, 'price': 29.999}) == ['price']


def test_accepts_a_zero_price_and_a_missing_weight() -> None:
    product = CreateProductInput.model_validate({**VALID, 'price': 0})

    assert product.price == Decimal(0)
    assert product.weight_kg is None
    assert 'weight_kg' not in product.model_fields_set


def test_converts_prices_to_exact_decimals() -> None:
    assert CreateProductInput.model_validate(VALID).price == Decimal('89.99')


def test_normalizes_the_sku_by_trimming_and_upper_casing() -> None:
    assert CreateProductInput.model_validate({**VALID, 'sku': ' rs-001 '}).sku == 'RS-001'


def test_reports_every_invalid_field_together() -> None:
    assert failing_paths(CreateProductInput, {**VALID, 'name': '', 'stock': -1}) == [
        'name',
        'stock',
    ]


def test_update_accepts_a_partial_body_and_a_null_category() -> None:
    update = UpdateProductInput.model_validate({'stock': 12, 'category': None})

    assert update.model_fields_set == {'stock', 'category'}
    assert update.stock == 12
    assert update.category is None


def test_update_rejects_a_null_sku() -> None:
    with pytest.raises(ValidationError) as caught:
        UpdateProductInput.model_validate({'sku': None})

    assert [issue.message for issue in issues_of(caught.value)] == ['SKU is required']


def test_list_query_applies_defaults() -> None:
    assert ListProductsQuery.model_validate({}) == ListProductsQuery(
        sort='createdAt', order='desc', page=1, limit=20
    )


def test_list_query_coerces_numeric_query_strings() -> None:
    query = ListProductsQuery.model_validate({'page': '3', 'limit': '50'})

    assert (query.page, query.limit) == (3, 50)


def test_list_query_rejects_a_limit_above_100() -> None:
    assert failing_paths(ListProductsQuery, {'limit': '500'}) == ['limit']


def test_list_query_rejects_a_category_that_is_not_a_uuid() -> None:
    assert failing_paths(ListProductsQuery, {'category': 'shoes'}) == ['category']
