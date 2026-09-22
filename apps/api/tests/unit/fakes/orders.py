import dataclasses
from datetime import UTC, datetime

from ecommerce_api.application.ports.order_repository import Approved, OrderDraft, Settlement
from ecommerce_api.application.ports.payment_gateway import ChargeRequest, ChargeResult
from ecommerce_api.domain.errors import UnavailableItem, UnavailableItemsError
from ecommerce_api.domain.order import (
    Order,
    OrderLine,
    OrderPayment,
    OrderSummary,
    PricedItem,
    compute_totals,
    line_total,
)
from tests.unit.fakes.products import InMemoryProductRepository


class InMemoryOrderRepository:
    def __init__(self, products: InMemoryProductRepository) -> None:
        self.rows: list[Order] = []
        self._products = products

    async def reserve(self, draft: OrderDraft) -> Order:
        problems: list[UnavailableItem] = []
        lines: list[OrderLine] = []
        for item in draft.items:
            product = next(
                (row for row in self._products.active() if row.id == item.product_id), None
            )
            if product is None:
                problems.append(UnavailableItem(item.product_id, item.quantity, 0, 'unavailable'))
            elif product.stock < item.quantity:
                problems.append(
                    UnavailableItem(
                        item.product_id, item.quantity, product.stock, 'insufficient_stock'
                    )
                )
            else:
                lines.append(
                    OrderLine(
                        product_id=product.id,
                        sku=product.sku,
                        name=product.name,
                        unit_price=product.price,
                        quantity=item.quantity,
                        line_total=line_total(PricedItem(product.price, item.quantity)),
                    )
                )
        if problems:
            raise UnavailableItemsError(problems)
        for line in lines:
            self._adjust_stock(line.product_id, -line.quantity)
        totals = compute_totals([PricedItem(line.unit_price, line.quantity) for line in lines])
        now = datetime.now(UTC)
        order = Order(
            id=f'order-{len(self.rows) + 1}',
            status='pending',
            customer=draft.customer,
            item_count=totals.item_count,
            total=totals.total,
            created_at=now,
            lines=tuple(lines),
            payment=OrderPayment(card_last4=draft.card_last4, reference=None, decline_reason=None),
            updated_at=now,
        )
        self.rows.append(order)
        return order

    async def settle(self, order_id: str, settlement: Settlement) -> Order:
        index, order = next(
            (index, row) for index, row in enumerate(self.rows) if row.id == order_id
        )
        if isinstance(settlement, Approved):
            payment = dataclasses.replace(order.payment, reference=settlement.reference)
            settled = dataclasses.replace(order, status='paid', payment=payment)
        else:
            payment = dataclasses.replace(order.payment, decline_reason=settlement.reason)
            settled = dataclasses.replace(order, status='payment_failed', payment=payment)
            for line in order.lines:
                self._adjust_stock(line.product_id, line.quantity)
        settled = dataclasses.replace(settled, updated_at=datetime.now(UTC))
        self.rows[index] = settled
        return settled

    async def find_by_id(self, id: str) -> Order | None:
        return next((row for row in self.rows if row.id == id), None)

    async def find_all(self) -> list[OrderSummary]:
        return [row.summary() for row in reversed(self.rows)]

    def _adjust_stock(self, product_id: str, delta: int) -> None:
        for row in self._products.rows:
            if row.id == product_id:
                row.stock += delta


class FakePaymentGateway:
    def __init__(self) -> None:
        self.charges: list[ChargeRequest] = []
        self.next: ChargeResult | Exception = Approved(reference='fake_ref')

    async def charge(self, request: ChargeRequest) -> ChargeResult:
        self.charges.append(request)
        if isinstance(self.next, Exception):
            raise self.next
        return self.next
