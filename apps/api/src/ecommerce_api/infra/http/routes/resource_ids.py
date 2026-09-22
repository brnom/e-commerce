from typing import Annotated

from fastapi import Path

from ecommerce_api.application.schemas.rules import is_uuid
from ecommerce_api.domain.errors import NotFoundError


def checked(resource: str, id: str) -> str:
    if not is_uuid(id):
        raise NotFoundError(resource, id)
    return id


def product_id(id: Annotated[str, Path(description='The product id, a uuid v7')]) -> str:
    return checked('product', id)


def import_job_id(id: Annotated[str, Path(description='The job id, a uuid v7')]) -> str:
    return checked('import job', id)


def order_id(id: Annotated[str, Path(description='The order id, a uuid v7')]) -> str:
    return checked('order', id)
