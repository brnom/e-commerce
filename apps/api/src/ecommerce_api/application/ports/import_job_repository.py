from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from ecommerce_api.domain.import_job import ImportJob, ImportJobSummary, ImportRowReport


class Absent:
    def __repr__(self) -> str:
        return 'ABSENT'


ABSENT = Absent()


@dataclass(frozen=True, slots=True)
class ProductUpsert:
    line: int
    sku: str
    name: str
    price: Decimal
    stock: int
    description: str | Absent | None = ABSENT
    weight_kg: Decimal | Absent | None = ABSENT
    category: str | Absent | None = ABSENT


@dataclass(frozen=True, slots=True)
class ImportPlan:
    file_name: str
    rejected: list[ImportRowReport]
    writes: list[ProductUpsert]


class ImportJobRepository(Protocol):
    async def commit(self, plan: ImportPlan) -> ImportJob: ...

    async def find_by_id(self, id: str) -> ImportJob | None: ...

    async def find_all(self) -> list[ImportJobSummary]: ...
