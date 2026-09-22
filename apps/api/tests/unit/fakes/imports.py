from datetime import UTC, datetime

from ecommerce_api.application.ports.import_job_repository import Absent, ImportPlan
from ecommerce_api.domain.import_job import (
    ImportJob,
    ImportJobSummary,
    ImportRowReport,
    count_outcomes,
)
from tests.unit.fakes.categories import InMemoryCategoryRepository
from tests.unit.fakes.products import InMemoryProductRepository, ProductRow


class InMemoryImportJobRepository:
    def __init__(
        self, products: InMemoryProductRepository, categories: InMemoryCategoryRepository
    ) -> None:
        self.jobs: list[ImportJob] = []
        self._products = products
        self._categories = categories

    async def commit(self, plan: ImportPlan) -> ImportJob:
        written: list[ImportRowReport] = []
        for write in plan.writes:
            category_id: str | Absent | None = write.category
            if isinstance(write.category, str):
                category_id = (await self._categories.find_or_create(write.category)).id
            existing = self._products.by_sku(write.sku)
            now = datetime.now(UTC)
            if existing is not None:
                existing.name = write.name
                existing.price = write.price
                existing.stock = write.stock
                if not isinstance(write.description, Absent):
                    existing.description = write.description
                if not isinstance(write.weight_kg, Absent):
                    existing.weight_kg = write.weight_kg
                if not isinstance(category_id, Absent):
                    existing.category_id = category_id
                existing.deleted_at = None
                existing.updated_at = now
            else:
                self._products.rows.append(
                    ProductRow(
                        id=f'product-{len(self._products.rows) + 1}',
                        sku=write.sku,
                        name=write.name,
                        description=None
                        if isinstance(write.description, Absent)
                        else write.description,
                        price=write.price,
                        stock=write.stock,
                        weight_kg=None if isinstance(write.weight_kg, Absent) else write.weight_kg,
                        category_id=None if isinstance(category_id, Absent) else category_id,
                        deleted_at=None,
                        created_at=now,
                        updated_at=now,
                    )
                )
            written.append(
                ImportRowReport(
                    write.line, write.sku, write.name, 'updated' if existing else 'created'
                )
            )
        rows = tuple(sorted([*plan.rejected, *written], key=lambda row: row.line))
        job = ImportJob(
            id=f'import-{len(self.jobs) + 1}',
            file_name=plan.file_name,
            created_at=datetime.now(UTC),
            totals=count_outcomes(rows),
            rows=rows,
        )
        self.jobs.append(job)
        return job

    async def find_by_id(self, id: str) -> ImportJob | None:
        return next((job for job in self.jobs if job.id == id), None)

    async def find_all(self) -> list[ImportJobSummary]:
        return [job.summary() for job in reversed(self.jobs)]
