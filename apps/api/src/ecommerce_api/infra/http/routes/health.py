import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import text

from ecommerce_api.infra.http.container import Container, container

router = APIRouter(tags=['Health'])

CHECK_TIMEOUT_SECONDS = 3


class Indicator(BaseModel):
    model_config = ConfigDict(extra='allow')

    status: str


class HealthReport(BaseModel):
    status: str
    info: dict[str, Indicator] | None = None
    error: dict[str, Indicator] | None = None
    details: dict[str, Indicator]


async def database_is_up(services: Container) -> bool:
    try:
        async with asyncio.timeout(CHECK_TIMEOUT_SECONDS), services.engine.connect() as connection:
            await connection.execute(text('SELECT 1'))
    except Exception:
        return False
    return True


@router.get(
    '/health',
    summary='Liveness plus a database check',
    response_model=HealthReport,
    responses={503: {'model': HealthReport, 'description': 'At least one check is down'}},
)
async def health(services: Annotated[Container, Depends(container)]) -> JSONResponse:
    if await database_is_up(services):
        up = {'database': {'status': 'up'}}
        return JSONResponse({'status': 'ok', 'info': up, 'error': {}, 'details': up})
    down = {'database': {'status': 'down', 'message': 'database query failed'}}
    return JSONResponse(
        {'status': 'error', 'info': {}, 'error': down, 'details': down}, status_code=503
    )
