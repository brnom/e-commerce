from decimal import Decimal

import pytest
from pydantic import ValidationError

from ecommerce_api.application.schemas.import_row import ImportCells, validate_import_row
from ecommerce_api.application.schemas.rules import issues_of

VALID: ImportCells = {'name': 'Running Shoes', 'sku': 'rs-001', 'price': '89.99', 'stock': '150'}


def failing_paths(cells: ImportCells) -> list[str]:
    try:
        validate_import_row(cells)
    except ValidationError as error:
        return [issue.path for issue in issues_of(error)]
    return []


def test_coerces_numeric_cells_and_normalizes_the_sku() -> None:
    row = validate_import_row({**VALID, 'weight_kg': '0.35'})

    assert (row.sku, row.price, row.stock, row.weight_kg) == (
        'RS-001',
        Decimal('89.99'),
        150,
        Decimal('0.35'),
    )


@pytest.mark.parametrize('price', ['$29.99', 'free', '1,000', ''])
def test_rejects_a_price_that_is_not_a_plain_decimal(price: str) -> None:
    assert failing_paths({**VALID, 'price': price}) == ['price']


def test_rejects_negative_stock() -> None:
    assert failing_paths({**VALID, 'stock': '-5'}) == ['stock']


@pytest.mark.parametrize('name', ['', '   '])
def test_rejects_a_blank_or_whitespace_name(name: str) -> None:
    assert failing_paths({**VALID, 'name': name}) == ['name']


def test_reports_every_failing_field_of_a_row() -> None:
    assert failing_paths({**VALID, 'name': '', 'stock': '-5'}) == ['name', 'stock']


def test_reads_blank_optional_cells_as_null() -> None:
    row = validate_import_row({**VALID, 'description': '', 'category': ' ', 'weight_kg': ''})

    assert (row.description, row.category, row.weight_kg) == (None, None, None)
    assert {'description', 'category', 'weight_kg'} <= row.model_fields_set


def test_keeps_absent_optional_columns_unset() -> None:
    row = validate_import_row(VALID)

    assert row.model_fields_set.isdisjoint({'description', 'category', 'weight_kg'})


def test_keeps_commas_inside_text_cells() -> None:
    row = validate_import_row({**VALID, 'description': 'Single origin, medium roast'})

    assert row.description == 'Single origin, medium roast'
