from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, ClassVar

from pydantic import BaseModel, ConfigDict, PlainSerializer, WithJsonSchema
from pydantic.alias_generators import to_camel


def js_number(value: Decimal) -> int | float:
    return int(value) if value == value.to_integral_value() else float(value)


def iso_timestamp(value: datetime) -> str:
    utc = value.astimezone(UTC)
    return f'{utc:%Y-%m-%dT%H:%M:%S}.{utc.microsecond // 1000:03d}Z'


Money = Annotated[
    Decimal,
    PlainSerializer(js_number, return_type=int | float),
    WithJsonSchema({'type': 'number'}),
]

Timestamp = Annotated[
    datetime,
    PlainSerializer(iso_timestamp, return_type=str),
    WithJsonSchema({'type': 'string', 'format': 'date-time'}),
]


class WireModel(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(
        alias_generator=to_camel,
        validate_by_alias=True,
        validate_by_name=True,
        serialize_by_alias=True,
        frozen=True,
    )
