import asyncio
from decimal import Decimal
from typing import Literal

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from ecommerce_api.application.ports.order_repository import (
    Approved,
    Declined,
    OrderDraft,
    OrderItemRequest,
)
from ecommerce_api.application.ports.product_repository import NewProduct
from ecommerce_api.domain.errors import UnavailableItem, UnavailableItemsError
from ecommerce_api.domain.order import OrderCustomer, OrderPayment, OrderSummary
from ecommerce_api.domain.product import Product
from ecommerce_api.infra.persistence.orders import SqlOrderRepository
from ecommerce_api.infra.persistence.products import SqlProductRepository

CUSTOMER = OrderCustomer(name='Ada Lovelace', email='ada@example.com')

MISSING = '019968c2-4d6e-7c2a-9d1e-0a1b2c3d4e5f'


def new_product(sku: str, price: str, stock: int) -> NewProduct:
    return NewProduct(
        sku=sku,
        name=f'Product {sku}',
        description=None,
        price=Decimal(price),
        stock=stock,
        weight_kg=None,
        category_id=None,
    )


def draft(*items: tuple[Product | str, int], card_last4: str = '4242') -> OrderDraft:
    return OrderDraft(
        customer=CUSTOMER,
        card_last4=card_last4,
        items=[
            OrderItemRequest(item if isinstance(item, str) else item.id, quantity)
            for item, quantity in items
        ],
    )


@pytest.fixture
def orders(engine: AsyncEngine) -> SqlOrderRepository:
    return SqlOrderRepository(engine)


@pytest.fixture
def products(engine: AsyncEngine) -> SqlProductRepository:
    return SqlProductRepository(engine)


async def stock_of(products: SqlProductRepository, product: Product) -> int:
    found = await products.find_by_id(product.id)
    assert found is not None
    return found.stock


async def test_reserves_every_line_snapshots_the_catalog_and_totals_to_the_cent(
    orders: SqlOrderRepository, products: SqlProductRepository
) -> None:
    shoes = await products.create(new_product('RS-001', '89.99', 5))
    mouse = await products.create(new_product('WM-042', '19.99', 10))

    order = await orders.reserve(draft((mouse, 3), (shoes, 2)))

    assert order.status == 'pending'
    assert [line.sku for line in order.lines] == ['WM-042', 'RS-001']
    assert (order.lines[0].unit_price, order.lines[0].quantity, order.lines[0].line_total) == (
        Decimal('19.99'),
        3,
        Decimal('59.97'),
    )
    assert order.total == Decimal('239.95')
    assert order.item_count == 5
    assert order.payment == OrderPayment(card_last4='4242', reference=None, decline_reason=None)
    assert await stock_of(products, shoes) == 3
    assert await stock_of(products, mouse) == 7


async def test_rolls_back_every_decrement_when_one_item_is_short(
    orders: SqlOrderRepository, products: SqlProductRepository
) -> None:
    shoes = await products.create(new_product('RS-001', '89.99', 10))
    mouse = await products.create(new_product('WM-042', '19.99', 1))
    deleted = await products.create(new_product('LW-019', '10', 1))
    await products.soft_delete(deleted.id)

    with pytest.raises(UnavailableItemsError) as caught:
        await orders.reserve(draft((shoes, 2), (mouse, 3), (deleted, 1), (MISSING, 1)))

    assert caught.value.items == (
        UnavailableItem(mouse.id, 3, 1, 'insufficient_stock'),
        UnavailableItem(deleted.id, 1, 0, 'unavailable'),
        UnavailableItem(MISSING, 1, 0, 'unavailable'),
    )
    assert await stock_of(products, shoes) == 10
    assert await stock_of(products, mouse) == 1
    assert await orders.find_all() == []


async def test_settles_as_paid_with_the_reference(
    orders: SqlOrderRepository, products: SqlProductRepository
) -> None:
    shoes = await products.create(new_product('RS-001', '89.99', 5))
    reserved = await orders.reserve(draft((shoes, 2)))

    order = await orders.settle(reserved.id, Approved(reference='fake_1'))

    assert order.status == 'paid'
    assert order.payment == OrderPayment(card_last4='4242', reference='fake_1', decline_reason=None)
    assert await stock_of(products, shoes) == 3


async def test_restores_stock_when_settled_as_declined(
    orders: SqlOrderRepository, products: SqlProductRepository
) -> None:
    shoes = await products.create(new_product('RS-001', '89.99', 5))
    mouse = await products.create(new_product('WM-042', '19.99', 10))
    reserved = await orders.reserve(draft((shoes, 2), (mouse, 4), card_last4='0002'))
    assert await stock_of(products, shoes) == 3

    order = await orders.settle(reserved.id, Declined(reason='Your card was declined'))

    assert order.status == 'payment_failed'
    assert order.payment == OrderPayment(
        card_last4='0002', reference=None, decline_reason='Your card was declined'
    )
    assert await stock_of(products, shoes) == 5
    assert await stock_of(products, mouse) == 10


async def test_never_oversells_under_concurrent_reservations(
    orders: SqlOrderRepository, products: SqlProductRepository
) -> None:
    shoes = await products.create(new_product('RS-001', '89.99', 1))

    async def attempt() -> Literal['reserved', 'rejected']:
        try:
            await orders.reserve(draft((shoes, 1)))
        except UnavailableItemsError:
            return 'rejected'
        return 'reserved'

    outcomes = await asyncio.gather(attempt(), attempt(), attempt())

    assert sorted(outcomes) == ['rejected', 'rejected', 'reserved']
    assert await stock_of(products, shoes) == 0
    assert len(await orders.find_all()) == 1


async def test_lists_summaries_newest_first_with_the_item_count(
    orders: SqlOrderRepository, products: SqlProductRepository
) -> None:
    shoes = await products.create(new_product('RS-001', '89.99', 10))
    first = await orders.reserve(draft((shoes, 1)))
    second = await orders.reserve(draft((shoes, 3)))

    summaries = await orders.find_all()

    assert [summary.id for summary in summaries] == [second.id, first.id]
    assert summaries[0] == OrderSummary(
        id=second.id,
        status='pending',
        customer=CUSTOMER,
        item_count=3,
        total=Decimal('269.97'),
        created_at=second.created_at,
    )
    assert await orders.find_by_id(MISSING) is None
