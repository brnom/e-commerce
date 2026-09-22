from ecommerce_api.application.ports.import_job_repository import ImportJobRepository
from ecommerce_api.domain.import_job import ImportJobSummary


class ListImportJobs:
    def __init__(self, imports: ImportJobRepository) -> None:
        self._imports = imports

    async def execute(self) -> list[ImportJobSummary]:
        return await self._imports.find_all()
