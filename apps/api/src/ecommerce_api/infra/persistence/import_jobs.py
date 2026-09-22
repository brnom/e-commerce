from typing import Any

from sqlalchemy import Row, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from ecommerce_api.application.ports.import_job_repository import (
    Absent,
    ImportPlan,
    ProductUpsert,
)
from ecommerce_api.domain.import_job import (
    ImportIssue,
    ImportJob,
    ImportJobSummary,
    ImportOutcome,
    ImportRowReport,
    ImportTotals,
    count_outcomes,
)
from ecommerce_api.infra.persistence.categories import find_or_create_category
from ecommerce_api.infra.persistence.engine import new_id
from ecommerce_api.infra.persistence.tables import import_job, product

SUMMARY_COLUMNS = (
    import_job.c.id,
    import_job.c.fileName,
    import_job.c.createdAt,
    import_job.c.totalRows,
    import_job.c.createdCount,
    import_job.c.updatedCount,
    import_job.c.skippedCount,
    import_job.c.failedCount,
)


def to_summary(row: Row[Any]) -> ImportJobSummary:
    return ImportJobSummary(
        id=row.id,
        file_name=row.fileName,
        created_at=row.createdAt,
        totals=ImportTotals(
            rows=row.totalRows,
            created=row.createdCount,
            updated=row.updatedCount,
            skipped=row.skippedCount,
            failed=row.failedCount,
        ),
    )


def row_to_json(report: ImportRowReport) -> dict[str, object]:
    return {
        'line': report.line,
        'sku': report.sku,
        'name': report.name,
        'outcome': report.outcome,
        'issues': [{'path': issue.path, 'message': issue.message} for issue in report.issues],
    }


def row_from_json(data: dict[str, Any]) -> ImportRowReport:
    return ImportRowReport(
        line=data['line'],
        sku=data['sku'],
        name=data['name'],
        outcome=data['outcome'],
        issues=tuple(ImportIssue(issue['path'], issue['message']) for issue in data['issues']),
    )


class SqlImportJobRepository:
    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def commit(self, plan: ImportPlan) -> ImportJob:
        async with self._engine.begin() as connection:
            existing = await self._existing_skus(connection, [write.sku for write in plan.writes])
            written = []
            for write in plan.writes:
                await self._upsert_product(connection, write)
                outcome: ImportOutcome = 'updated' if write.sku in existing else 'created'
                written.append(ImportRowReport(write.line, write.sku, write.name, outcome))
            rows = tuple(sorted([*plan.rejected, *written], key=lambda row: row.line))
            totals = count_outcomes(rows)
            job = (
                await connection.execute(
                    import_job.insert()
                    .values(
                        id=new_id(),
                        fileName=plan.file_name,
                        totalRows=totals.rows,
                        createdCount=totals.created,
                        updatedCount=totals.updated,
                        skippedCount=totals.skipped,
                        failedCount=totals.failed,
                        rows=[row_to_json(row) for row in rows],
                    )
                    .returning(*SUMMARY_COLUMNS)
                )
            ).one()
            summary = to_summary(job)
        return ImportJob(
            id=summary.id,
            file_name=summary.file_name,
            created_at=summary.created_at,
            totals=summary.totals,
            rows=rows,
        )

    async def find_by_id(self, id: str) -> ImportJob | None:
        async with self._engine.connect() as connection:
            row = (
                await connection.execute(
                    select(*SUMMARY_COLUMNS, import_job.c.rows).where(import_job.c.id == id)
                )
            ).first()
        if row is None:
            return None
        summary = to_summary(row)
        return ImportJob(
            id=summary.id,
            file_name=summary.file_name,
            created_at=summary.created_at,
            totals=summary.totals,
            rows=tuple(row_from_json(entry) for entry in row.rows),
        )

    async def find_all(self) -> list[ImportJobSummary]:
        async with self._engine.connect() as connection:
            rows = await connection.execute(
                select(*SUMMARY_COLUMNS).order_by(
                    import_job.c.createdAt.desc(), import_job.c.id.desc()
                )
            )
            return [to_summary(row) for row in rows]

    async def _existing_skus(self, connection: AsyncConnection, skus: list[str]) -> set[str]:
        if not skus:
            return set()
        rows = await connection.execute(select(product.c.sku).where(product.c.sku.in_(skus)))
        return {row.sku for row in rows}

    async def _upsert_product(self, connection: AsyncConnection, write: ProductUpsert) -> None:
        category_id: str | Absent | None = write.category
        if isinstance(write.category, str):
            category_id = (await find_or_create_category(connection, write.category)).id
        optional = {
            'description': write.description,
            'weightKg': write.weight_kg,
            'categoryId': category_id,
        }
        statement = insert(product).values(
            id=new_id(),
            sku=write.sku,
            name=write.name,
            price=write.price,
            stock=write.stock,
            updatedAt=func.now(),
            **{
                column: None if isinstance(value, Absent) else value
                for column, value in optional.items()
            },
        )
        present = [column for column, value in optional.items() if not isinstance(value, Absent)]
        await connection.execute(
            statement.on_conflict_do_update(
                index_elements=[product.c.sku],
                set_={
                    'name': statement.excluded.name,
                    'price': statement.excluded.price,
                    'stock': statement.excluded.stock,
                    **{column: statement.excluded[column] for column in present},
                    'deletedAt': None,
                    'updatedAt': func.now(),
                },
            )
        )
