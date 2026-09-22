from ecommerce_api.application.ports.order_repository import OrderRepository
from ecommerce_api.domain.errors import NotFoundError
from ecommerce_api.domain.order import Order


class GetOrder:
    def __init__(self, orders: OrderRepository) -> None:
        self._orders = orders

    async def execute(self, id: str) -> Order:
        order = await self._orders.find_by_id(id)
        if order is None:
            raise NotFoundError('order', id)
        return order
