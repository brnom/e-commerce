from decimal import Decimal

import pytest

from ecommerce_api.application.orders.get_order import GetOrder
from ecommerce_api.application.orders.list_orders import ListOrders
from ecommerce_api.application.orders.place_order import PROVIDER_UNAVAILABLE, PlaceOrder
from ecommerce_api.application.ports.order_repository import Declined
from ecommerce_api.application.products.delete_product import DeleteProduct
from ecommerce_api.application.schemas.order import (
    CheckoutCustomerInput,
    OrderItemInput,
    PaymentCardInput,
    PlaceOrderInput,
)
from ecommerce_api.domain.errors import NotFoundError, UnavailableItem, UnavailableItemsError
from ecommerce_api.domain.order import OrderCustomer, OrderPayment, OrderSummary
from tests.unit.application.conftest import Catalog
from tests.unit.fakes.orders import FakePaymentGateway, InMemoryOrderRepository
from tests.unit.fakes.products import InMemoryProductRepository

CARD = {
    'cardholderName': 'Ada Lovelace',
    'cardNumber': '4242424242424242',
    'expiry': '12/99',
    'cvc': '123',
}

CUSTOMER = {'name': 'Ada Lovelace', 'email': 'ada@example.com'}

MISSING = '019968c2-4d6e-7c2a-9d1e-0a1b2c3d4e5f'


def request(*items: tuple[str, int]) -> PlaceOrderInput:
    return PlaceOrderInput.model_construct(
        items=[
            OrderItemInput.model_construct(product_id=product_id, quantity=quantity)
            for product_id, quantity in items
        ],
        customer=CheckoutCustomerInput.model_validate(CUSTOMER),
        card=PaymentCardInput.model_validate(CARD),
    )


class Shop:
    def __init__(self, shoes: str, mouse: str) -> None:
        self.shoes = shoes
        self.mouse = mouse


@pytest.fixture
async def shop(catalog: Catalog) -> Shop:
    shoes = await catalog.create(sku='RS-001', name='Running Shoes', price=89.99, stock=5)
    mouse = await catalog.create(sku='WM-042', name='Wireless Mouse', price=19.99, stock=10)
    return Shop(shoes.id, mouse.id)


@pytest.fixture
def place_order(orders: InMemoryOrderRepository, gateway: FakePaymentGateway) -> PlaceOrder:
    return PlaceOrder(orders, gateway)


async def stock_of(products: InMemoryProductRepository, id: str) -> int:
    product = await products.find_by_id(id)
    assert product is not None
    return product.stock


async def test_reserves_stock_charges_the_total_and_records_a_paid_order(
    shop: Shop,
    place_order: PlaceOrder,
    gateway: FakePaymentGateway,
    products: InMemoryProductRepository,
) -> None:
    order = await place_order.execute(request((shop.shoes, 2), (shop.mouse, 3)))

    assert order.status == 'paid'
    assert [
        (line.sku, line.unit_price, line.quantity, line.line_total) for line in order.lines
    ] == [
        ('RS-001', Decimal('89.99'), 2, Decimal('179.98')),
        ('WM-042', Decimal('19.99'), 3, Decimal('59.97')),
    ]
    assert order.total == Decimal('239.95')
    assert order.item_count == 5
    assert order.payment == OrderPayment(
        card_last4='4242', reference='fake_ref', decline_reason=None
    )
    assert order.customer == OrderCustomer(**CUSTOMER)
    assert [
        (charge.order_id, charge.amount, charge.card.card_number) for charge in gateway.charges
    ] == [(order.id, Decimal('239.95'), '4242424242424242')]
    assert await stock_of(products, shop.shoes) == 3
    assert await stock_of(products, shop.mouse) == 7


async def test_restores_stock_and_records_the_reason_when_the_payment_is_declined(
    shop: Shop,
    place_order: PlaceOrder,
    gateway: FakePaymentGateway,
    products: InMemoryProductRepository,
) -> None:
    gateway.next = Declined(reason='Your card was declined')

    order = await place_order.execute(request((shop.shoes, 2)))

    assert order.status == 'payment_failed'
    assert order.payment == OrderPayment(
        card_last4='4242', reference=None, decline_reason='Your card was declined'
    )
    assert await stock_of(products, shop.shoes) == 5


async def test_settles_as_failed_when_the_provider_raises(
    shop: Shop,
    place_order: PlaceOrder,
    gateway: FakePaymentGateway,
    products: InMemoryProductRepository,
) -> None:
    gateway.next = ConnectionResetError('connection reset')

    order = await place_order.execute(request((shop.shoes, 1)))

    assert order.status == 'payment_failed'
    assert order.payment.decline_reason == PROVIDER_UNAVAILABLE
    assert await stock_of(products, shop.shoes) == 5


async def test_rejects_the_whole_order_when_one_item_is_short_listing_every_problem(
    shop: Shop,
    catalog: Catalog,
    place_order: PlaceOrder,
    gateway: FakePaymentGateway,
    products: InMemoryProductRepository,
    orders: InMemoryOrderRepository,
) -> None:
    deleted = (await catalog.create(sku='LW-019', name='Lamp', price=10, stock=1)).id
    await DeleteProduct(products).execute(deleted)

    with pytest.raises(UnavailableItemsError) as caught:
        await place_order.execute(
            request((shop.shoes, 2), (shop.mouse, 11), (deleted, 1), (MISSING, 1))
        )

    assert caught.value.items == (
        UnavailableItem(shop.mouse, 11, 10, 'insufficient_stock'),
        UnavailableItem(deleted, 1, 0, 'unavailable'),
        UnavailableItem(MISSING, 1, 0, 'unavailable'),
    )
    assert await stock_of(products, shop.shoes) == 5
    assert await stock_of(products, shop.mouse) == 10
    assert gateway.charges == []
    assert await ListOrders(orders).execute() == []


async def test_keeps_the_price_at_the_time_of_purchase(
    shop: Shop, catalog: Catalog, place_order: PlaceOrder, orders: InMemoryOrderRepository
) -> None:
    order = await place_order.execute(request((shop.mouse, 3)))
    await catalog.update(shop.mouse, price=25)

    stored = await GetOrder(orders).execute(order.id)

    assert (stored.lines[0].unit_price, stored.lines[0].line_total) == (
        Decimal('19.99'),
        Decimal('59.97'),
    )
    assert stored.total == Decimal('59.97')


async def test_lists_orders_newest_first_as_summaries(
    shop: Shop, place_order: PlaceOrder, orders: InMemoryOrderRepository
) -> None:
    first = await place_order.execute(request((shop.shoes, 1)))
    second = await place_order.execute(request((shop.mouse, 2)))

    summaries = await ListOrders(orders).execute()

    assert [summary.id for summary in summaries] == [second.id, first.id]
    assert summaries[0] == OrderSummary(
        id=second.id,
        status='paid',
        customer=OrderCustomer(**CUSTOMER),
        item_count=2,
        total=Decimal('39.98'),
        created_at=second.created_at,
    )


async def test_reports_an_unknown_order_as_not_found(orders: InMemoryOrderRepository) -> None:
    with pytest.raises(NotFoundError):
        await GetOrder(orders).execute('missing')
