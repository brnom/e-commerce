from dataclasses import dataclass

from pydantic import ValidationError

from ecommerce_api.application.imports.parse_csv import parse_csv
from ecommerce_api.application.ports.import_job_repository import (
    ABSENT,
    ImportJobRepository,
    ImportPlan,
    ProductUpsert,
)
from ecommerce_api.application.schemas.import_row import validate_import_row
from ecommerce_api.application.schemas.rules import issues_of
from ecommerce_api.domain.errors import InvalidImportFileError
from ecommerce_api.domain.import_job import ImportIssue, ImportJob, ImportRowReport

MAX_IMPORT_ROWS = 5000


@dataclass(frozen=True, slots=True)
class ImportFile:
    file_name: str
    content: bytes


def _cell_or_none(value: str | None) -> str | None:
    trimmed = (value or '').strip()
    return trimmed or None


class ImportProducts:
    def __init__(self, imports: ImportJobRepository) -> None:
        self._imports = imports

    async def execute(self, file: ImportFile) -> ImportJob:
        records = parse_csv(file.content).records
        if len(records) > MAX_IMPORT_ROWS:
            raise InvalidImportFileError(f'The file has more than {MAX_IMPORT_ROWS} data rows')

        rejected: list[ImportRowReport] = []
        writes: list[ProductUpsert] = []
        seen: dict[str, int] = {}

        for record in records:
            sku = _cell_or_none(record.cells.get('sku'))
            name = _cell_or_none(record.cells.get('name'))
            if record.blank:
                rejected.append(ImportRowReport(record.line, sku, name, 'skipped'))
                continue
            try:
                row = validate_import_row(record.cells)
            except ValidationError as error:
                issues = tuple(issues_of(error))
                rejected.append(ImportRowReport(record.line, sku, name, 'failed', issues))
                continue
            first_line = seen.get(row.sku)
            if first_line is not None:
                duplicate = ImportIssue(path='sku', message=f'Duplicate of line {first_line}')
                rejected.append(
                    ImportRowReport(record.line, row.sku, row.name, 'failed', (duplicate,))
                )
                continue
            seen[row.sku] = record.line
            present = row.model_fields_set
            writes.append(
                ProductUpsert(
                    line=record.line,
                    sku=row.sku,
                    name=row.name,
                    price=row.price,
                    stock=row.stock,
                    description=row.description if 'description' in present else ABSENT,
                    weight_kg=row.weight_kg if 'weight_kg' in present else ABSENT,
                    category=row.category if 'category' in present else ABSENT,
                )
            )

        return await self._imports.commit(
            ImportPlan(file_name=file.file_name, rejected=rejected, writes=writes)
        )
