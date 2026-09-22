import csv
import io
from dataclasses import dataclass

from ecommerce_api.application.schemas.import_row import (
    IMPORT_COLUMNS,
    REQUIRED_IMPORT_COLUMNS,
    ImportCells,
    ImportColumn,
)
from ecommerce_api.domain.errors import InvalidImportFileError


@dataclass(frozen=True, slots=True)
class ParsedRecord:
    line: int
    cells: ImportCells
    blank: bool


@dataclass(frozen=True, slots=True)
class ParsedCsv:
    columns: list[ImportColumn]
    records: list[ParsedRecord]


def _decode(content: bytes) -> str:
    try:
        return content.decode('utf-8-sig')
    except UnicodeDecodeError as error:
        raise InvalidImportFileError(
            f'The file is not valid CSV: it is not UTF-8 text ({error.reason})'
        ) from error


def _read_rows(text: str) -> list[tuple[int, list[str]]]:
    reader = csv.reader(io.StringIO(text, newline=''), strict=True)
    try:
        return [(reader.line_num, row) for row in reader]
    except csv.Error as error:
        raise InvalidImportFileError(f'The file is not valid CSV: {error}') from error


def parse_csv(content: bytes) -> ParsedCsv:
    rows = _read_rows(_decode(content))
    header = [name.strip().lower() for name in rows[0][1]] if rows else []
    positions: dict[ImportColumn, int] = {
        name: index for index, name in enumerate(header) if name in IMPORT_COLUMNS
    }
    columns: list[ImportColumn] = [name for name in header if name in IMPORT_COLUMNS]

    missing = [name for name in REQUIRED_IMPORT_COLUMNS if name not in positions]
    if missing:
        raise InvalidImportFileError(f'Missing required columns: {", ".join(missing)}', missing)
    if len(rows) < 2:
        raise InvalidImportFileError('The file has no data rows')

    records = []
    for last_line, row in rows[1:]:
        cells: dict[ImportColumn, str | None] = {}
        embedded_lines = 0
        for column, index in positions.items():
            value = row[index] if index < len(row) else ''
            cells[column] = value
            embedded_lines += value.count('\n')
        blank = all(not (value or '').strip() for value in cells.values())
        records.append(ParsedRecord(line=last_line - embedded_lines, cells=cells, blank=blank))
    return ParsedCsv(columns=columns, records=records)
