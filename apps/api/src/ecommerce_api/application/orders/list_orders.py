from ecommerce_api.application.ports.order_repository import OrderRepository
from ecommerce_api.domain.order import OrderSummary


class ListOrders:
    def __init__(self, orders: OrderRepository) -> None:
        self._orders = orders

    async def execute(self) -> list[OrderSummary]:
        return await self._orders.find_all()
