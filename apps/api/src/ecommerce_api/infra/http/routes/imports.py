from typing import Annotated

from fastapi import APIRouter, Depends, Request

from ecommerce_api.application.imports.import_products import ImportFile
from ecommerce_api.domain.errors import InvalidImportFileError
from ecommerce_api.infra.http.container import Container, container
from ecommerce_api.infra.http.errors import (
    INVALID_IMPORT_FILE,
    UPLOAD_TOO_LARGE,
    error_responses,
    resource_not_found,
)
from ecommerce_api.infra.http.responses import ImportJobResponse, ImportJobSummaryResponse
from ecommerce_api.infra.http.routes.resource_ids import import_job_id
from ecommerce_api.infra.http.upload import MAX_IMPORT_FILE_BYTES, receive_file

router = APIRouter(tags=['Imports'])

Services = Annotated[Container, Depends(container)]

UPLOAD_BODY = {
    'required': True,
    'description': f'The CSV file, at most {MAX_IMPORT_FILE_BYTES // 1024 // 1024} MB',
    'content': {
        'multipart/form-data': {
            'schema': {
                'type': 'object',
                'required': ['file'],
                'properties': {'file': {'type': 'string', 'format': 'binary'}},
            }
        }
    },
}


@router.post(
    '/imports',
    status_code=201,
    summary='Import products from a CSV file, upserting by SKU',
    responses=error_responses(INVALID_IMPORT_FILE, UPLOAD_TOO_LARGE),
    openapi_extra={'requestBody': UPLOAD_BODY},
)
async def upload(request: Request, services: Services) -> ImportJobResponse:
    file = await receive_file(request, 'file')
    if file is None:
        raise InvalidImportFileError('A CSV file is required in the "file" field')
    job = await services.import_products.execute(
        ImportFile(file_name=file.file_name, content=file.content)
    )
    return ImportJobResponse.of_job(job)


@router.get('/imports', summary='List import jobs, newest first, without their row reports')
async def list_jobs(services: Services) -> list[ImportJobSummaryResponse]:
    return [ImportJobSummaryResponse.of(job) for job in await services.list_import_jobs.execute()]


@router.get(
    '/imports/{id}',
    summary='Get one import job with the full per-row report',
    responses=error_responses(resource_not_found('import job')),
)
async def get_job(
    id: Annotated[str, Depends(import_job_id)], services: Services
) -> ImportJobResponse:
    return ImportJobResponse.of_job(await services.get_import_job.execute(id))
