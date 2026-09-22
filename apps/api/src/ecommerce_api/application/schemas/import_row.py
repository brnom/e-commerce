import re
from collections.abc import Mapping
from typing import Final, Literal

from ecommerce_api.application.schemas.product import CreateProductInput

ImportColumn = Literal['name', 'sku', 'description', 'category', 'price', 'stock', 'weight_kg']

IMPORT_COLUMNS: Final[tuple[ImportColumn, ...]] = (
    'name',
    'sku',
    'description',
    'category',
    'price',
    'stock',
    'weight_kg',
)

REQUIRED_IMPORT_COLUMNS: Final[tuple[ImportColumn, ...]] = ('name', 'sku', 'price', 'stock')

ImportCells = Mapping[ImportColumn, str | None]

DECIMAL = re.compile(r'-?[0-9]+(\.[0-9]+)?')

_ABSENT = object()


def _text(cell: str | None) -> object:
    if cell is None or not cell.strip():
        return _ABSENT
    return cell


def _optional_text(cell: str | object | None) -> object:
    if cell is _ABSENT:
        return _ABSENT
    if cell is None or (isinstance(cell, str) and not cell.strip()):
        return None
    return cell


def _number(cell: str | None) -> object:
    if cell is None:
        return _ABSENT
    trimmed = cell.strip()
    if not trimmed:
        return _ABSENT
    return float(trimmed) if DECIMAL.fullmatch(trimmed) else trimmed


def _optional_number(cell: str | object | None) -> object:
    if cell is _ABSENT:
        return _ABSENT
    if cell is None or (isinstance(cell, str) and not cell.strip()):
        return None
    return _number(cell) if isinstance(cell, str) else cell


def prepare_import_row(cells: ImportCells) -> dict[str, object]:
    prepared: dict[str, object] = {
        'sku': _text(cells.get('sku')),
        'name': _text(cells.get('name')),
        'description': _optional_text(cells.get('description', _ABSENT)),
        'category': _optional_text(cells.get('category', _ABSENT)),
        'price': _number(cells.get('price')),
        'stock': _number(cells.get('stock')),
        'weightKg': _optional_number(cells.get('weight_kg', _ABSENT)),
    }
    return {key: value for key, value in prepared.items() if value is not _ABSENT}


def validate_import_row(cells: ImportCells) -> CreateProductInput:
    return CreateProductInput.model_validate(prepare_import_row(cells))
