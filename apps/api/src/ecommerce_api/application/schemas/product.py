from decimal import Decimal
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, BeforeValidator, ConfigDict, Field, WithJsonSchema

from ecommerce_api.application.schemas.rules import (
    InputModel,
    is_uuid,
    nullable,
    number,
    text,
    to_decimal,
)

MAX_PRICE = 9_999_999_999.99
MAX_WEIGHT = 99_999.999


def sku_rule(value: object) -> str:
    return text(
        value,
        type_message='SKU is required',
        min_message='SKU is required',
        max_length=64,
        max_message='SKU must be at most 64 characters',
    ).upper()


def name_rule(value: object) -> str:
    return text(
        value,
        type_message='Name is required',
        min_message='Name is required',
        max_length=200,
        max_message='Name must be at most 200 characters',
    )


def description_rule(value: object) -> str:
    return text(value, max_length=2000, max_message='Description must be at most 2000 characters')


def price_rule(value: object) -> Decimal:
    return to_decimal(
        number(
            value,
            type_message='Price must be a number',
            minimum=0,
            min_message='Price must be zero or more',
            maximum=MAX_PRICE,
            max_message='Price is too large',
            places=2,
            places_message='Price allows at most two decimal places',
        )
    )


def stock_rule(value: object) -> int:
    return int(
        number(
            value,
            type_message='Stock must be a number',
            integer_message='Stock must be a whole number',
            minimum=0,
            min_message='Stock must be zero or more',
        )
    )


def weight_rule(value: object) -> Decimal:
    return to_decimal(
        number(
            value,
            type_message='Weight must be a number',
            minimum=0,
            min_message='Weight must be zero or more',
            maximum=MAX_WEIGHT,
            max_message='Weight is too large',
            places=3,
            places_message='Weight allows at most three decimal places',
        )
    )


def category_rule(value: object) -> str:
    return text(
        value,
        min_message='Category name must not be blank',
        max_length=100,
        max_message='Category name must be at most 100 characters',
    )


Sku = Annotated[
    str,
    BeforeValidator(sku_rule),
    WithJsonSchema({'type': 'string', 'minLength': 1, 'maxLength': 64}),
]
Name = Annotated[
    str,
    BeforeValidator(name_rule),
    WithJsonSchema({'type': 'string', 'minLength': 1, 'maxLength': 200}),
]
Description = Annotated[
    str | None,
    BeforeValidator(nullable(description_rule)),
    WithJsonSchema({'type': ['string', 'null'], 'maxLength': 2000}),
]
Price = Annotated[
    Decimal,
    BeforeValidator(price_rule),
    WithJsonSchema({'type': 'number', 'minimum': 0, 'maximum': MAX_PRICE}),
]
Stock = Annotated[
    int,
    BeforeValidator(stock_rule),
    WithJsonSchema({'type': 'integer', 'minimum': 0}),
]
WeightKg = Annotated[
    Decimal | None,
    BeforeValidator(nullable(weight_rule)),
    WithJsonSchema({'type': ['number', 'null'], 'minimum': 0, 'maximum': MAX_WEIGHT}),
]
CategoryName = Annotated[
    str | None,
    BeforeValidator(nullable(category_rule)),
    WithJsonSchema({'type': ['string', 'null'], 'minLength': 1, 'maxLength': 100}),
]


class CreateProductInput(InputModel):
    sku: Sku
    name: Name
    description: Description = None
    price: Price
    stock: Stock
    weight_kg: WeightKg = None
    category: CategoryName = None


class UpdateProductInput(InputModel):
    sku: Annotated[
        str | None,
        BeforeValidator(sku_rule),
        WithJsonSchema({'type': 'string', 'minLength': 1, 'maxLength': 64}),
    ] = None
    name: Annotated[
        str | None,
        BeforeValidator(name_rule),
        WithJsonSchema({'type': 'string', 'minLength': 1, 'maxLength': 200}),
    ] = None
    description: Description = None
    price: Annotated[
        Decimal | None,
        BeforeValidator(price_rule),
        WithJsonSchema({'type': 'number', 'minimum': 0, 'maximum': MAX_PRICE}),
    ] = None
    stock: Annotated[
        int | None,
        BeforeValidator(stock_rule),
        WithJsonSchema({'type': 'integer', 'minimum': 0}),
    ] = None
    weight_kg: WeightKg = None
    category: CategoryName = None

    def has(self, field: str) -> bool:
        return field in self.model_fields_set


ProductSortField = Literal['name', 'price', 'stock', 'createdAt']


def blank_to_none(value: str | None) -> str | None:
    return value.strip() if value is not None else None


def uuid_or_none(value: str | None) -> str | None:
    if value is not None and not is_uuid(value):
        raise ValueError('Invalid UUID')
    return value


class ListProductsQuery(BaseModel):
    model_config = ConfigDict(extra='ignore', frozen=True)

    q: Annotated[str | None, AfterValidator(blank_to_none), Field(max_length=200)] = None
    category: Annotated[str | None, AfterValidator(uuid_or_none)] = None
    sort: ProductSortField = 'createdAt'
    order: Literal['asc', 'desc'] = 'desc'
    page: Annotated[int, Field(ge=1)] = 1
    limit: Annotated[int, Field(ge=1, le=100)] = 20
