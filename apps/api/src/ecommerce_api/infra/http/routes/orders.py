from typing import Annotated

from fastapi import APIRouter, Depends

from ecommerce_api.application.schemas.order import PlaceOrderInput
from ecommerce_api.infra.http.container import Container, container
from ecommerce_api.infra.http.errors import (
    UNAVAILABLE_ITEMS,
    VALIDATION_FAILURE,
    error_responses,
    resource_not_found,
)
from ecommerce_api.infra.http.responses import OrderResponse, OrderSummaryResponse
from ecommerce_api.infra.http.routes.resource_ids import order_id

router = APIRouter(tags=['Orders'])

Services = Annotated[Container, Depends(container)]


@router.post(
    '/orders',
    status_code=201,
    summary='Place an order, reserving stock and charging the card',
    responses=error_responses(VALIDATION_FAILURE, UNAVAILABLE_ITEMS),
)
async def place_order(body: PlaceOrderInput, services: Services) -> OrderResponse:
    return OrderResponse.of_order(await services.place_order.execute(body))


@router.get('/orders', summary='List order summaries, newest first')
async def list_orders(services: Services) -> list[OrderSummaryResponse]:
    return [OrderSummaryResponse.of(order) for order in await services.list_orders.execute()]


@router.get(
    '/orders/{id}',
    summary='Get one order with its lines, total and payment',
    responses=error_responses(resource_not_found('order')),
)
async def get_order(id: Annotated[str, Depends(order_id)], services: Services) -> OrderResponse:
    return OrderResponse.of_order(await services.get_order.execute(id))
