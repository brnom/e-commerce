import math
import re
from collections.abc import Callable
from decimal import Decimal
from enum import Enum
from typing import Any, ClassVar, NoReturn

from pydantic import BaseModel, ConfigDict, ValidationError, model_validator
from pydantic.alias_generators import to_camel
from pydantic_core import InitErrorDetails, PydanticCustomError

from ecommerce_api.domain.import_job import ImportIssue


class Missing(Enum):
    MISSING = 'missing'


MISSING = Missing.MISSING

UUID_PATTERN = re.compile(
    r'([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}'
    r'|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)'
)


def is_uuid(value: str) -> bool:
    return UUID_PATTERN.fullmatch(value) is not None


def received(value: object) -> str:
    if value is MISSING:
        return 'undefined'
    if value is None:
        return 'null'
    if isinstance(value, bool):
        return 'boolean'
    if isinstance(value, int | float):
        return 'number'
    if isinstance(value, str):
        return 'string'
    if isinstance(value, list):
        return 'array'
    return 'object'


def expected(kind: str, value: object) -> str:
    return f'Invalid input: expected {kind}, received {received(value)}'


def fail(value: object, *messages: str) -> NoReturn:
    raise ValidationError.from_exception_data(
        'Validation failed',
        [
            InitErrorDetails(type=PydanticCustomError('rule', message), loc=(), input=value)
            for message in messages
        ],
    )


def fail_if_any(value: object, messages: list[str]) -> None:
    if messages:
        fail(value, *messages)


def text(
    value: object,
    *,
    type_message: str | None = None,
    min_message: str | None = None,
    max_length: int,
    max_message: str,
) -> str:
    if not isinstance(value, str):
        fail(value, type_message or expected('string', value))
    trimmed = value.strip()
    messages: list[str] = []
    if min_message is not None and not trimmed:
        messages.append(min_message)
    if len(trimmed) > max_length:
        messages.append(max_message)
    fail_if_any(value, messages)
    return trimmed


def has_places(value: float, places: int) -> bool:
    factor = float(10**places)
    return math.floor(value * factor + 0.5) / factor == value


def number(
    value: object,
    *,
    type_message: str,
    integer_message: str | None = None,
    minimum: float,
    min_message: str,
    maximum: float | None = None,
    max_message: str | None = None,
    places: int | None = None,
    places_message: str | None = None,
) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float) or not math.isfinite(value):
        fail(value, type_message)
    messages: list[str] = []
    if integer_message is not None and not float(value).is_integer():
        messages.append(integer_message)
    if value < minimum:
        messages.append(min_message)
    if maximum is not None and max_message is not None and value > maximum:
        messages.append(max_message)
    if places is not None and places_message is not None and not has_places(value, places):
        messages.append(places_message)
    fail_if_any(value, messages)
    return value


def to_decimal(value: float) -> Decimal:
    return Decimal(int(value)) if float(value).is_integer() else Decimal(repr(float(value)))


def nullable[T](rule: Callable[[object], T]) -> Callable[[object], T | None]:
    def validate(value: object) -> T | None:
        return None if value is None else rule(value)

    return validate


def an_object(value: object) -> object:
    if not isinstance(value, dict):
        fail(value, expected('object', value))
    return value


class InputModel(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(
        alias_generator=to_camel,
        validate_by_alias=True,
        validate_by_name=True,
        extra='ignore',
        frozen=True,
    )

    @model_validator(mode='before')
    @classmethod
    def mark_missing_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            fail(data, expected('object', data))
        absent = {
            field.alias or name: MISSING
            for name, field in cls.model_fields.items()
            if field.is_required() and (field.alias or name) not in data and name not in data
        }
        return {**absent, **data}


def issues_of(error: ValidationError, drop_prefix: tuple[str, ...] = ()) -> list[ImportIssue]:
    issues: list[ImportIssue] = []
    for detail in error.errors(include_url=False):
        location = list(detail['loc'])
        if location and location[0] in drop_prefix:
            location = location[1:]
        issues.append(
            ImportIssue(path='.'.join(str(part) for part in location), message=detail['msg'])
        )
    return issues
