from ecommerce_api.application.ports.order_repository import (
    Declined,
    OrderDraft,
    OrderItemRequest,
    OrderRepository,
)
from ecommerce_api.application.ports.payment_gateway import (
    ChargeRequest,
    ChargeResult,
    PaymentGateway,
)
from ecommerce_api.application.schemas.order import PaymentCardInput, PlaceOrderInput
from ecommerce_api.domain.order import Order, OrderCustomer

PROVIDER_UNAVAILABLE = 'Payment provider unavailable'


class PlaceOrder:
    def __init__(self, orders: OrderRepository, payments: PaymentGateway) -> None:
        self._orders = orders
        self._payments = payments

    async def execute(self, data: PlaceOrderInput) -> Order:
        reserved = await self._orders.reserve(
            OrderDraft(
                customer=OrderCustomer(name=data.customer.name, email=data.customer.email),
                card_last4=data.card.card_number[-4:],
                items=[OrderItemRequest(item.product_id, item.quantity) for item in data.items],
            )
        )
        result = await self._charge(reserved, data.card)
        return await self._orders.settle(reserved.id, result)

    async def _charge(self, order: Order, card: PaymentCardInput) -> ChargeResult:
        try:
            return await self._payments.charge(
                ChargeRequest(order_id=order.id, amount=order.total, card=card)
            )
        except Exception:
            return Declined(reason=PROVIDER_UNAVAILABLE)
