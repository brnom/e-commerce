from datetime import datetime
from typing import Any

import pytest
from pydantic import ValidationError

from ecommerce_api.application.schemas.order import PlaceOrderInput, passes_luhn
from ecommerce_api.application.schemas.rules import issues_of

PRODUCT_A = '019968c2-4d6e-7c2a-9d1e-0a1b2c3d4e5f'
PRODUCT_B = '019968c2-4d6e-7c2a-9d1e-0a1b2c3d4e60'

CARD: dict[str, Any] = {
    'cardholderName': 'Ada Lovelace',
    'cardNumber': '4242 4242 4242 4242',
    'expiry': '12/99',
    'cvc': '123',
}

VALID: dict[str, Any] = {
    'items': [{'productId': PRODUCT_A, 'quantity': 2}],
    'customer': {'name': 'Ada Lovelace', 'email': 'ada@example.com'},
    'card': CARD,
}


def with_card(**card: str) -> dict[str, Any]:
    return {**VALID, 'card': {**CARD, **card}}


def failing_paths(data: dict[str, Any], now: datetime | None = None) -> list[str]:
    context = {'now': lambda: now} if now else None
    try:
        PlaceOrderInput.model_validate(data, context=context)
    except ValidationError as error:
        return [issue.path for issue in issues_of(error)]
    return []


def test_luhn_accepts_the_well_known_test_numbers() -> None:
    assert passes_luhn('4242424242424242')
    assert passes_luhn('4000000000000002')
    assert passes_luhn('4000000000009995')


def test_luhn_rejects_a_number_off_by_one_digit() -> None:
    assert not passes_luhn('4242424242424241')


def test_accepts_a_valid_order_and_strips_spaces_from_the_card_number() -> None:
    order = PlaceOrderInput.model_validate(VALID)

    assert order.card.card_number == '4242424242424242'
    assert [(item.product_id, item.quantity) for item in order.items] == [(PRODUCT_A, 2)]


def test_rejects_a_card_number_failing_the_luhn_check() -> None:
    assert failing_paths(with_card(cardNumber='4242 4242 4242 4241')) == ['card.cardNumber']


def test_rejects_a_card_number_that_is_too_short() -> None:
    assert failing_paths(with_card(cardNumber='1234')) == ['card.cardNumber']


def test_rejects_an_expired_card() -> None:
    assert failing_paths(with_card(expiry='01/20')) == ['card.expiry']


def test_accepts_the_current_month_and_rejects_the_previous_one() -> None:
    now = datetime(2026, 9, 21)

    assert failing_paths(with_card(expiry='09/26'), now) == []
    assert failing_paths(with_card(expiry='08/26'), now) == ['card.expiry']


@pytest.mark.parametrize('expiry', ['13/30', '2030-12'])
def test_rejects_a_malformed_expiry(expiry: str) -> None:
    assert failing_paths(with_card(expiry=expiry)) == ['card.expiry']


def test_rejects_a_security_code_that_is_not_3_or_4_digits() -> None:
    assert failing_paths(with_card(cvc='12')) == ['card.cvc']


def test_rejects_a_zero_quantity() -> None:
    order = {**VALID, 'items': [{'productId': PRODUCT_A, 'quantity': 0}]}

    assert failing_paths(order) == ['items.0.quantity']


def test_accepts_any_positive_quantity_because_stock_bounds_it() -> None:
    order = {**VALID, 'items': [{'productId': PRODUCT_A, 'quantity': 100_000}]}

    assert failing_paths(order) == []


def test_rejects_an_empty_order_and_one_with_too_many_items() -> None:
    many = [
        {'productId': f'019968c2-4d6e-7c2a-9d1e-{index:012d}', 'quantity': 1} for index in range(51)
    ]

    assert failing_paths({**VALID, 'items': []}) == ['items']
    assert failing_paths({**VALID, 'items': many}) == ['items']


def test_rejects_the_same_product_twice() -> None:
    repeated = {
        **VALID,
        'items': [
            {'productId': PRODUCT_A, 'quantity': 1},
            {'productId': PRODUCT_B, 'quantity': 1},
            {'productId': PRODUCT_A, 'quantity': 3},
        ],
    }

    assert failing_paths(repeated) == ['items']


def test_rejects_an_invalid_email() -> None:
    order = {**VALID, 'customer': {**VALID['customer'], 'email': 'not-an-email'}}

    assert failing_paths(order) == ['customer.email']


def test_reports_every_failing_field_together() -> None:
    order = {**with_card(cvc='12'), 'customer': {'name': '  ', 'email': 'ada@example.com'}}

    assert failing_paths(order) == ['customer.name', 'card.cvc']
