from ecommerce_api.application.ports.import_job_repository import ImportJobRepository
from ecommerce_api.domain.errors import NotFoundError
from ecommerce_api.domain.import_job import ImportJob


class GetImportJob:
    def __init__(self, imports: ImportJobRepository) -> None:
        self._imports = imports

    async def execute(self, id: str) -> ImportJob:
        job = await self._imports.find_by_id(id)
        if job is None:
            raise NotFoundError('import', id)
        return job
