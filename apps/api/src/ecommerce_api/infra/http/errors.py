from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from ecommerce_api.domain.errors import (
    ConflictError,
    DomainValidationError,
    InvalidImportFileError,
    NotFoundError,
    UnavailableItemsError,
)
from ecommerce_api.infra.http.serialization import WireModel

REQUEST_PARTS = frozenset({'body', 'query', 'path'})


class Issue(WireModel):
    path: str
    message: str


class ValidationErrorBody(WireModel):
    message: str
    issues: list[Issue]


class NotFoundErrorBody(WireModel):
    message: str
    resource: str


class ConflictErrorBody(WireModel):
    message: str
    field: str
    value: str


class UnavailableItemBody(WireModel):
    product_id: str
    requested: int
    available: int
    reason: Literal['insufficient_stock', 'unavailable']


class UnavailableItemsErrorBody(WireModel):
    message: str
    items: list[UnavailableItemBody]


class InvalidImportFileErrorBody(WireModel):
    message: str
    missing_columns: list[str]


class UploadTooLargeErrorBody(WireModel):
    message: str
    error: str
    status_code: Literal[413]


class UploadTooLargeError(Exception):
    pass


def respond(status: int, body: WireModel) -> JSONResponse:
    return JSONResponse(status_code=status, content=body.model_dump(mode='json'))


def issue_from(detail: dict[str, object]) -> Issue:
    location = list(detail['loc']) if isinstance(detail['loc'], tuple | list) else []
    if location and location[0] in REQUEST_PARTS:
        location = location[1:]
    if detail.get('type') == 'json_invalid':
        return Issue(path='', message='The request body is not valid JSON')
    if detail.get('type') == 'missing' and not location:
        return Issue(path='', message='Invalid input: expected object, received undefined')
    return Issue(path='.'.join(str(part) for part in location), message=str(detail['msg']))


async def request_validation_failed(_: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, RequestValidationError)
    issues = [issue_from(dict(detail)) for detail in error.errors()]
    return respond(400, ValidationErrorBody(message='Validation failed', issues=issues))


async def domain_validation_failed(_: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, DomainValidationError)
    issue = Issue(path=error.field, message=error.message)
    return respond(400, ValidationErrorBody(message='Validation failed', issues=[issue]))


async def not_found(_: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, NotFoundError)
    return respond(404, NotFoundErrorBody(message=error.message, resource=error.resource))


async def conflict(_: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, ConflictError)
    body = ConflictErrorBody(message=error.message, field=error.field, value=error.value)
    return respond(409, body)


async def unavailable_items(_: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, UnavailableItemsError)
    items = [
        UnavailableItemBody(
            product_id=item.product_id,
            requested=item.requested,
            available=item.available,
            reason=item.reason,
        )
        for item in error.items
    ]
    return respond(409, UnavailableItemsErrorBody(message=error.message, items=items))


async def invalid_import_file(_: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, InvalidImportFileError)
    body = InvalidImportFileErrorBody(
        message=error.message, missing_columns=list(error.missing_columns)
    )
    return respond(400, body)


async def upload_too_large(_: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, UploadTooLargeError)
    body = UploadTooLargeErrorBody(
        message='File too large', error='Payload Too Large', status_code=413
    )
    return respond(413, body)


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(RequestValidationError, request_validation_failed)
    app.add_exception_handler(DomainValidationError, domain_validation_failed)
    app.add_exception_handler(NotFoundError, not_found)
    app.add_exception_handler(ConflictError, conflict)
    app.add_exception_handler(UnavailableItemsError, unavailable_items)
    app.add_exception_handler(InvalidImportFileError, invalid_import_file)
    app.add_exception_handler(UploadTooLargeError, upload_too_large)


def error_responses(
    *entries: tuple[int, type[WireModel], str],
) -> dict[int | str, dict[str, object]]:
    return {
        status: {'model': model, 'description': description}
        for status, model, description in entries
    }


VALIDATION_FAILURE = (400, ValidationErrorBody, 'One entry per failing field')
SKU_CONFLICT = (409, ConflictErrorBody, 'The SKU is taken, including by a deleted product')
UNAVAILABLE_ITEMS = (409, UnavailableItemsErrorBody, 'Some items are short or unavailable')
INVALID_IMPORT_FILE = (400, InvalidImportFileErrorBody, 'The file is not an acceptable CSV')
UPLOAD_TOO_LARGE = (413, UploadTooLargeErrorBody, 'The file is larger than 2 MB')


def resource_not_found(resource: str) -> tuple[int, type[WireModel], str]:
    return (404, NotFoundErrorBody, f'No {resource} with that id')
