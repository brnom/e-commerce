import json
from typing import Any

import pytest
from httpx import AsyncClient, Response

CARD = {
    'cardholderName': 'Ada Lovelace',
    'cardNumber': '4242 4242 4242 4242',
    'expiry': '12/99',
    'cvc': '123',
}

CUSTOMER = {'name': 'Ada Lovelace', 'email': 'ada@example.com'}

MISSING = '019968c2-4d6e-7c2a-9d1e-0a1b2c3d4e5f'


async def create_product(api: AsyncClient, sku: str, price: float, stock: int) -> str:
    response = await api.post(
        '/products', json={'sku': sku, 'name': f'Product {sku}', 'price': price, 'stock': stock}
    )
    assert response.status_code == 201
    return str(response.json()['id'])


async def stock_of(api: AsyncClient, id: str) -> int:
    return int((await api.get(f'/products/{id}')).json()['stock'])


async def place(api: AsyncClient, items: list[tuple[str, int]], **overrides: Any) -> Response:
    body = {
        'items': [{'productId': product, 'quantity': quantity} for product, quantity in items],
        'customer': CUSTOMER,
        'card': CARD,
        **overrides,
    }
    return await api.post('/orders', json=body)


def paths(response: Response) -> list[str]:
    return [issue['path'] for issue in response.json()['issues']]


async def test_places_a_paid_order_decrementing_stock_and_keeping_only_the_last_four_digits(
    api: AsyncClient,
) -> None:
    shoes = await create_product(api, 'RS-001', 89.99, 5)
    mouse = await create_product(api, 'WM-042', 19.99, 10)

    response = await place(api, [(shoes, 2), (mouse, 3)])

    assert response.status_code == 201
    body = response.json()
    assert (body['status'], body['customer'], body['itemCount'], body['total']) == (
        'paid',
        CUSTOMER,
        5,
        239.95,
    )
    assert body['payment']['cardLast4'] == '4242'
    assert body['payment']['declineReason'] is None
    assert body['payment']['reference'].startswith('fake_')
    assert [
        (line['productId'], line['sku'], line['unitPrice'], line['quantity'], line['lineTotal'])
        for line in body['lines']
    ] == [(shoes, 'RS-001', 89.99, 2, 179.98), (mouse, 'WM-042', 19.99, 3, 59.97)]
    serialized = json.dumps(body)
    assert '4242424242424242' not in serialized
    assert '12/99' not in serialized
    assert '"cvc"' not in serialized
    assert await stock_of(api, shoes) == 3
    assert await stock_of(api, mouse) == 7


@pytest.mark.parametrize(
    ('card_number', 'reason'),
    [
        ('4000 0000 0000 0002', 'Your card was declined'),
        ('4000 0000 0000 9995', 'Your card has insufficient funds'),
    ],
)
async def test_records_a_declined_payment_and_restores_the_stock(
    api: AsyncClient, card_number: str, reason: str
) -> None:
    shoes = await create_product(api, 'RS-001', 89.99, 5)

    response = await place(api, [(shoes, 2)], card={**CARD, 'cardNumber': card_number})

    assert response.status_code == 201
    assert response.json()['status'] == 'payment_failed'
    assert response.json()['payment'] == {
        'cardLast4': card_number[-4:],
        'reference': None,
        'declineReason': reason,
    }
    assert await stock_of(api, shoes) == 5
    stored = await api.get(f'/orders/{response.json()["id"]}')
    assert stored.json()['status'] == 'payment_failed'


async def test_rejects_the_whole_order_when_one_item_is_short(api: AsyncClient) -> None:
    shoes = await create_product(api, 'RS-001', 89.99, 10)
    mouse = await create_product(api, 'WM-042', 19.99, 1)

    response = await place(api, [(shoes, 2), (mouse, 3)])

    assert response.status_code == 409
    assert response.json() == {
        'message': 'Some items are not available in the requested quantity',
        'items': [
            {'productId': mouse, 'requested': 3, 'available': 1, 'reason': 'insufficient_stock'}
        ],
    }
    assert await stock_of(api, shoes) == 10
    assert (await api.get('/orders')).json() == []


async def test_rejects_deleted_and_unknown_products_as_unavailable(api: AsyncClient) -> None:
    deleted = await create_product(api, 'LW-019', 10, 1)
    await api.delete(f'/products/{deleted}')

    response = await place(api, [(deleted, 1), (MISSING, 2)])

    assert response.status_code == 409
    assert response.json()['items'] == [
        {'productId': deleted, 'requested': 1, 'available': 0, 'reason': 'unavailable'},
        {'productId': MISSING, 'requested': 2, 'available': 0, 'reason': 'unavailable'},
    ]


async def test_validates_the_request_and_reports_every_failing_field(api: AsyncClient) -> None:
    shoes = await create_product(api, 'RS-001', 89.99, 5)

    luhn = await place(api, [(shoes, 1)], card={**CARD, 'cardNumber': '4242 4242 4242 4241'})
    assert luhn.status_code == 400
    assert paths(luhn) == ['card.cardNumber']

    expired = await place(api, [(shoes, 1)], card={**CARD, 'expiry': '01/20'})
    assert paths(expired) == ['card.expiry']

    zero = await place(api, [(shoes, 0)])
    assert paths(zero) == ['items.0.quantity']

    duplicate = await place(api, [(shoes, 1), (shoes, 2)])
    assert paths(duplicate) == ['items']

    combined = await place(
        api,
        [(shoes, 1)],
        customer={'name': ' ', 'email': 'ada@example.com'},
        card={**CARD, 'cvc': '12'},
    )
    assert paths(combined) == ['customer.name', 'card.cvc']

    assert await stock_of(api, shoes) == 5
    assert (await api.get('/orders')).json() == []


async def test_keeps_the_purchase_price_after_the_product_changes_and_outlives_its_deletion(
    api: AsyncClient,
) -> None:
    mouse = await create_product(api, 'WM-042', 19.99, 10)
    placed = await place(api, [(mouse, 3)])
    await api.patch(f'/products/{mouse}', json={'price': 25})
    await api.delete(f'/products/{mouse}')

    response = await api.get(f'/orders/{placed.json()["id"]}')

    assert response.status_code == 200
    line = response.json()['lines'][0]
    assert (line['sku'], line['name'], line['unitPrice'], line['lineTotal']) == (
        'WM-042',
        'Product WM-042',
        19.99,
        59.97,
    )
    assert response.json()['total'] == 59.97


async def test_lists_orders_newest_first_as_summaries_without_lines(api: AsyncClient) -> None:
    shoes = await create_product(api, 'RS-001', 89.99, 10)
    first = await place(api, [(shoes, 1)])
    second = await place(api, [(shoes, 2)])

    response = await api.get('/orders')

    assert response.status_code == 200
    assert [order['id'] for order in response.json()] == [second.json()['id'], first.json()['id']]
    assert response.json()[0] == {
        'id': second.json()['id'],
        'status': 'paid',
        'customer': CUSTOMER,
        'itemCount': 2,
        'total': 179.98,
        'createdAt': second.json()['createdAt'],
    }


async def test_responds_404_for_an_unknown_or_malformed_order_id(api: AsyncClient) -> None:
    assert (await api.get(f'/orders/{MISSING}')).status_code == 404
    assert (await api.get('/orders/not-a-uuid')).status_code == 404
