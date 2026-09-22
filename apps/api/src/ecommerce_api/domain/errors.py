import json
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

UnavailableReason = Literal['insufficient_stock', 'unavailable']


@dataclass(frozen=True, slots=True)
class UnavailableItem:
    product_id: str
    requested: int
    available: int
    reason: UnavailableReason


def _quoted(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


class DomainValidationError(Exception):
    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.field = field
        self.message = message


class NotFoundError(Exception):
    def __init__(self, resource: str, id: str) -> None:
        self.message = f'No {resource} with id {_quoted(id)}'
        super().__init__(self.message)
        self.resource = resource
        self.id = id


class ConflictError(Exception):
    def __init__(self, field: str, value: str) -> None:
        self.message = f'{field} {_quoted(value)} is already taken'
        super().__init__(self.message)
        self.field = field
        self.value = value

    def __eq__(self, other: object) -> bool:
        return (
            isinstance(other, ConflictError)
            and other.field == self.field
            and other.value == self.value
        )

    def __hash__(self) -> int:
        return hash((self.field, self.value))


class UnavailableItemsError(Exception):
    message = 'Some items are not available in the requested quantity'

    def __init__(self, items: Sequence[UnavailableItem]) -> None:
        super().__init__(self.message)
        self.items = tuple(items)


class InvalidImportFileError(Exception):
    def __init__(self, message: str, missing_columns: Sequence[str] = ()) -> None:
        super().__init__(message)
        self.message = message
        self.missing_columns = tuple(missing_columns)

    def __eq__(self, other: object) -> bool:
        return (
            isinstance(other, InvalidImportFileError)
            and other.message == self.message
            and other.missing_columns == self.missing_columns
        )

    def __hash__(self) -> int:
        return hash((self.message, self.missing_columns))
