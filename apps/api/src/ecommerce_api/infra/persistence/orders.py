from typing import Any

from sqlalchemy import Row, func, select, update
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from ecommerce_api.application.ports.order_repository import (
    Approved,
    OrderDraft,
    OrderItemRequest,
    Settlement,
)
from ecommerce_api.domain.errors import UnavailableItem, UnavailableItemsError
from ecommerce_api.domain.order import (
    Order,
    OrderCustomer,
    OrderLine,
    OrderPayment,
    OrderSummary,
    PricedItem,
    compute_totals,
    line_total,
)
from ecommerce_api.infra.persistence.engine import new_id
from ecommerce_api.infra.persistence.tables import order, order_line, product

ITEM_COUNT = (
    select(func.coalesce(func.sum(order_line.c.quantity), 0))
    .where(order_line.c.orderId == order.c.id)
    .scalar_subquery()
    .label('item_count')
)


def to_summary(row: Row[Any]) -> OrderSummary:
    return OrderSummary(
        id=row.id,
        status=row.status,
        customer=OrderCustomer(name=row.customerName, email=row.customerEmail),
        item_count=row.item_count,
        total=row.total,
        created_at=row.createdAt,
    )


class SqlOrderRepository:
    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def reserve(self, draft: OrderDraft) -> Order:
        async with self._engine.begin() as connection:
            reserved: dict[str, Row[Any]] = {}
            problems: dict[str, UnavailableItem] = {}
            for item in sorted(draft.items, key=lambda candidate: candidate.product_id):
                decremented = await self._decrement_stock(connection, item)
                if decremented is not None:
                    reserved[item.product_id] = decremented
                else:
                    problems[item.product_id] = await self._describe_problem(connection, item)
            if problems:
                raise UnavailableItemsError(
                    [
                        problems[item.product_id]
                        for item in draft.items
                        if item.product_id in problems
                    ]
                )
            order_id = new_id()
            priced = [
                PricedItem(reserved[item.product_id].price, item.quantity) for item in draft.items
            ]
            await connection.execute(
                order.insert().values(
                    id=order_id,
                    status='pending',
                    customerName=draft.customer.name,
                    customerEmail=draft.customer.email,
                    total=compute_totals(priced).total,
                    cardLast4=draft.card_last4,
                    updatedAt=func.now(),
                )
            )
            await connection.execute(
                order_line.insert(),
                [
                    {
                        'id': new_id(),
                        'orderId': order_id,
                        'position': position,
                        'productId': item.product_id,
                        'sku': reserved[item.product_id].sku,
                        'name': reserved[item.product_id].name,
                        'unitPrice': reserved[item.product_id].price,
                        'quantity': item.quantity,
                        'lineTotal': line_total(
                            PricedItem(reserved[item.product_id].price, item.quantity)
                        ),
                    }
                    for position, item in enumerate(draft.items)
                ],
            )
            return await self._require(connection, order_id)

    async def settle(self, order_id: str, settlement: Settlement) -> Order:
        async with self._engine.begin() as connection:
            if isinstance(settlement, Approved):
                await connection.execute(
                    update(order)
                    .where(order.c.id == order_id)
                    .values(
                        status='paid', paymentReference=settlement.reference, updatedAt=func.now()
                    )
                )
            else:
                lines = await connection.execute(
                    select(order_line.c.productId, order_line.c.quantity)
                    .where(order_line.c.orderId == order_id)
                    .order_by(order_line.c.productId)
                )
                for line in lines.all():
                    await connection.execute(
                        update(product)
                        .where(product.c.id == line.productId)
                        .values(stock=product.c.stock + line.quantity, updatedAt=func.now())
                    )
                await connection.execute(
                    update(order)
                    .where(order.c.id == order_id)
                    .values(
                        status='payment_failed',
                        declineReason=settlement.reason,
                        updatedAt=func.now(),
                    )
                )
            return await self._require(connection, order_id)

    async def find_by_id(self, id: str) -> Order | None:
        async with self._engine.connect() as connection:
            return await self._find(connection, id)

    async def find_all(self) -> list[OrderSummary]:
        async with self._engine.connect() as connection:
            rows = await connection.execute(
                select(
                    order.c.id,
                    order.c.status,
                    order.c.customerName,
                    order.c.customerEmail,
                    order.c.total,
                    order.c.createdAt,
                    ITEM_COUNT,
                ).order_by(order.c.createdAt.desc(), order.c.id.desc())
            )
            return [to_summary(row) for row in rows]

    async def _decrement_stock(
        self, connection: AsyncConnection, item: OrderItemRequest
    ) -> Row[Any] | None:
        return (
            await connection.execute(
                update(product)
                .where(
                    product.c.id == item.product_id,
                    product.c.deletedAt.is_(None),
                    product.c.stock >= item.quantity,
                )
                .values(stock=product.c.stock - item.quantity, updatedAt=func.now())
                .returning(product.c.id, product.c.sku, product.c.name, product.c.price)
            )
        ).first()

    async def _describe_problem(
        self, connection: AsyncConnection, item: OrderItemRequest
    ) -> UnavailableItem:
        stock = (
            await connection.execute(
                select(product.c.stock).where(
                    product.c.id == item.product_id, product.c.deletedAt.is_(None)
                )
            )
        ).scalar_one_or_none()
        if stock is None:
            return UnavailableItem(item.product_id, item.quantity, 0, 'unavailable')
        return UnavailableItem(item.product_id, item.quantity, stock, 'insufficient_stock')

    async def _find(self, connection: AsyncConnection, id: str) -> Order | None:
        row = (await connection.execute(select(order, ITEM_COUNT).where(order.c.id == id))).first()
        if row is None:
            return None
        lines = await connection.execute(
            select(order_line).where(order_line.c.orderId == id).order_by(order_line.c.position)
        )
        summary = to_summary(row)
        return Order(
            id=summary.id,
            status=summary.status,
            customer=summary.customer,
            item_count=summary.item_count,
            total=summary.total,
            created_at=summary.created_at,
            lines=tuple(
                OrderLine(
                    product_id=line.productId,
                    sku=line.sku,
                    name=line.name,
                    unit_price=line.unitPrice,
                    quantity=line.quantity,
                    line_total=line.lineTotal,
                )
                for line in lines
            ),
            payment=OrderPayment(
                card_last4=row.cardLast4,
                reference=row.paymentReference,
                decline_reason=row.declineReason,
            ),
            updated_at=row.updatedAt,
        )

    async def _require(self, connection: AsyncConnection, id: str) -> Order:
        found = await self._find(connection, id)
        if found is None:
            raise LookupError(f'Order {id} vanished inside its own transaction')
        return found
