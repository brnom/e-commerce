from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

ImportOutcome = Literal['created', 'updated', 'skipped', 'failed']


@dataclass(frozen=True, slots=True)
class ImportIssue:
    path: str
    message: str


@dataclass(frozen=True, slots=True)
class ImportRowReport:
    line: int
    sku: str | None
    name: str | None
    outcome: ImportOutcome
    issues: tuple[ImportIssue, ...] = ()


@dataclass(frozen=True, slots=True)
class ImportTotals:
    rows: int
    created: int
    updated: int
    skipped: int
    failed: int


@dataclass(frozen=True, slots=True)
class ImportJobSummary:
    id: str
    file_name: str
    created_at: datetime
    totals: ImportTotals


@dataclass(frozen=True, slots=True)
class ImportJob:
    id: str
    file_name: str
    created_at: datetime
    totals: ImportTotals
    rows: tuple[ImportRowReport, ...]

    def summary(self) -> ImportJobSummary:
        return ImportJobSummary(
            id=self.id, file_name=self.file_name, created_at=self.created_at, totals=self.totals
        )


def count_outcomes(rows: Sequence[ImportRowReport]) -> ImportTotals:
    def count(outcome: ImportOutcome) -> int:
        return sum(1 for row in rows if row.outcome == outcome)

    return ImportTotals(
        rows=len(rows),
        created=count('created'),
        updated=count('updated'),
        skipped=count('skipped'),
        failed=count('failed'),
    )
