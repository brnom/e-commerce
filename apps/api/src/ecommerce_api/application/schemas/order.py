import re
from collections.abc import Callable
from datetime import datetime
from typing import Annotated, Final

from pydantic import AfterValidator, BeforeValidator, Field, ValidationInfo, WithJsonSchema

from ecommerce_api.application.schemas.rules import (
    InputModel,
    an_object,
    expected,
    fail,
    fail_if_any,
    is_uuid,
    number,
    text,
)

MAX_ORDER_ITEMS: Final = 50

EXPIRY = re.compile(r'(0[1-9]|1[0-2])/([0-9]{2})')
CARD_DIGITS = re.compile(r'[0-9]{13,19}')
SECURITY_CODE = re.compile(r'[0-9]{3,4}')
WHITESPACE = re.compile(r'\s+')
EMAIL = re.compile(
    r"(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}"
)

Clock = Callable[[], datetime]


def passes_luhn(digits: str) -> bool:
    total = 0
    for index, character in enumerate(reversed(digits)):
        digit = int(character)
        if index % 2 == 1:
            digit *= 2
            if digit > 9:
                digit -= 9
        total += digit
    return total % 10 == 0


def expiry_is_current_or_later(expiry: str, now: datetime) -> bool:
    match = EXPIRY.fullmatch(expiry)
    if match is None:
        return False
    month = int(match.group(1))
    year = 2000 + int(match.group(2))
    return year > now.year or (year == now.year and month >= now.month)


def product_id_rule(value: object) -> str:
    if not isinstance(value, str) or not is_uuid(value):
        fail(value, 'Product id must be a uuid')
    return value


def quantity_rule(value: object) -> int:
    return int(
        number(
            value,
            type_message='Quantity must be a number',
            integer_message='Quantity must be a whole number',
            minimum=1,
            min_message='Quantity must be at least 1',
        )
    )


def customer_name_rule(value: object) -> str:
    return text(
        value,
        type_message='Name is required',
        min_message='Name is required',
        max_length=100,
        max_message='Name must be at most 100 characters',
    )


def email_rule(value: object) -> str:
    trimmed = text(
        value,
        type_message='Email is required',
        max_length=254,
        max_message='Email must be at most 254 characters',
    )
    if EMAIL.fullmatch(trimmed) is None:
        fail(value, 'Enter a valid email address')
    return trimmed


def cardholder_name_rule(value: object) -> str:
    return text(
        value,
        type_message='Cardholder name is required',
        min_message='Cardholder name is required',
        max_length=100,
        max_message='Cardholder name must be at most 100 characters',
    )


def card_number_rule(value: object) -> str:
    if not isinstance(value, str):
        fail(value, 'Card number is required')
    digits = WHITESPACE.sub('', value)
    if CARD_DIGITS.fullmatch(digits) is None:
        fail(value, 'Card number must be 13 to 19 digits')
    if not passes_luhn(digits):
        fail(value, 'Card number is not valid')
    return digits


def expiry_rule(value: object, info: ValidationInfo) -> str:
    if not isinstance(value, str):
        fail(value, 'Expiry is required')
    trimmed = value.strip()
    if EXPIRY.fullmatch(trimmed) is None:
        fail(value, 'Expiry must be MM/YY')
    context = info.context if isinstance(info.context, dict) else {}
    clock: Clock = context.get('now', datetime.now)
    if not expiry_is_current_or_later(trimmed, clock()):
        fail(value, 'Card has expired')
    return trimmed


def cvc_rule(value: object) -> str:
    if not isinstance(value, str):
        fail(value, 'Security code is required')
    trimmed = value.strip()
    if SECURITY_CODE.fullmatch(trimmed) is None:
        fail(value, 'Security code must be 3 or 4 digits')
    return trimmed


def items_shape(value: object) -> object:
    if not isinstance(value, list):
        fail(value, expected('array', value))
    messages: list[str] = []
    if len(value) < 1:
        messages.append('The order must have at least one item')
    if len(value) > MAX_ORDER_ITEMS:
        messages.append(f'The order must have at most {MAX_ORDER_ITEMS} items')
    fail_if_any(value, messages)
    return value


class OrderItemInput(InputModel):
    product_id: Annotated[
        str, BeforeValidator(product_id_rule), WithJsonSchema({'type': 'string', 'format': 'uuid'})
    ]
    quantity: Annotated[
        int,
        BeforeValidator(quantity_rule),
        WithJsonSchema({'type': 'integer', 'minimum': 1}),
    ]


def no_repeated_product(items: list[OrderItemInput]) -> list[OrderItemInput]:
    if len({item.product_id for item in items}) != len(items):
        fail(items, 'Each product may appear only once')
    return items


class CheckoutCustomerInput(InputModel):
    name: Annotated[
        str,
        BeforeValidator(customer_name_rule),
        WithJsonSchema({'type': 'string', 'minLength': 1, 'maxLength': 100}),
    ]
    email: Annotated[
        str,
        BeforeValidator(email_rule),
        WithJsonSchema({'type': 'string', 'format': 'email', 'maxLength': 254}),
    ]


class PaymentCardInput(InputModel):
    cardholder_name: Annotated[
        str,
        BeforeValidator(cardholder_name_rule),
        WithJsonSchema({'type': 'string', 'minLength': 1, 'maxLength': 100}),
    ]
    card_number: Annotated[
        str,
        BeforeValidator(card_number_rule),
        WithJsonSchema({'type': 'string', 'description': '13 to 19 digits, spaces allowed'}),
    ]
    expiry: Annotated[
        str,
        BeforeValidator(expiry_rule),
        WithJsonSchema({'type': 'string', 'pattern': '^(0[1-9]|1[0-2])/\\d{2}$'}),
    ]
    cvc: Annotated[
        str, BeforeValidator(cvc_rule), WithJsonSchema({'type': 'string', 'pattern': '^\\d{3,4}$'})
    ]


class PlaceOrderInput(InputModel):
    items: Annotated[
        list[OrderItemInput],
        BeforeValidator(items_shape),
        AfterValidator(no_repeated_product),
        Field(min_length=1, max_length=MAX_ORDER_ITEMS),
    ]
    customer: Annotated[CheckoutCustomerInput, BeforeValidator(an_object)]
    card: Annotated[PaymentCardInput, BeforeValidator(an_object)]
