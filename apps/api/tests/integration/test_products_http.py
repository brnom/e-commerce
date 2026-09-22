import re
from typing import Any

from httpx import AsyncClient, Response

VALID: dict[str, Any] = {
    'sku': 'rs-001',
    'name': 'Running Shoes',
    'description': 'Lightweight running shoes',
    'price': 89.99,
    'stock': 150,
    'weightKg': 0.35,
    'category': 'Footwear',
}


async def create(api: AsyncClient, body: dict[str, Any] = VALID) -> Response:
    return await api.post('/products', json=body)


async def test_creates_a_product_with_a_generated_id_and_a_normalized_sku(api: AsyncClient) -> None:
    response = await create(api)

    assert response.status_code == 201
    body = response.json()
    assert {
        key: body[key] for key in ('sku', 'name', 'description', 'price', 'stock', 'weightKg')
    } == {
        'sku': 'RS-001',
        'name': 'Running Shoes',
        'description': 'Lightweight running shoes',
        'price': 89.99,
        'stock': 150,
        'weightKg': 0.35,
    }
    assert body['category']['name'] == 'Footwear'
    assert re.fullmatch(r'[0-9a-f-]{36}', body['id'])
    assert re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z', body['createdAt'])


async def test_reports_every_invalid_field_together_with_400(api: AsyncClient) -> None:
    response = await create(api, {**VALID, 'name': '   ', 'price': '$29.99', 'stock': -5})

    assert response.status_code == 400
    assert response.json() == {
        'message': 'Validation failed',
        'issues': [
            {'path': 'name', 'message': 'Name is required'},
            {'path': 'price', 'message': 'Price must be a number'},
            {'path': 'stock', 'message': 'Stock must be zero or more'},
        ],
    }


async def test_rejects_a_body_that_is_not_json(api: AsyncClient) -> None:
    response = await api.post(
        '/products', content='{"sku":', headers={'content-type': 'application/json'}
    )

    assert response.status_code == 400
    assert response.json()['issues'][0]['path'] == ''


async def test_accepts_a_zero_price_without_a_weight(api: AsyncClient) -> None:
    response = await create(api, {'sku': 'MB-001', 'name': 'Mystery Box', 'price': 0, 'stock': 1})

    assert response.status_code == 201
    body = response.json()
    assert (body['price'], body['weightKg'], body['category']) == (0, None, None)


async def test_answers_409_naming_the_sku_on_a_duplicate(api: AsyncClient) -> None:
    await create(api)

    response = await create(api, {**VALID, 'sku': 'RS-001', 'name': 'Other'})

    assert response.status_code == 409
    assert response.json() == {
        'message': 'sku "RS-001" is already taken',
        'field': 'sku',
        'value': 'RS-001',
    }
    assert (await api.get('/products')).json()['total'] == 1


async def test_reuses_an_existing_category_regardless_of_case(api: AsyncClient) -> None:
    await create(api)
    await create(api, {**VALID, 'sku': 'HB-002', 'category': ' footwear '})

    categories = await api.get('/categories')

    assert categories.status_code == 200
    assert [category['name'] for category in categories.json()] == ['Footwear']


async def test_updates_partially_and_leaves_the_other_fields_intact(api: AsyncClient) -> None:
    created = (await create(api)).json()

    response = await api.patch(f'/products/{created["id"]}', json={'stock': 12})

    assert response.status_code == 200
    updated = response.json()
    assert {**created, 'stock': 12, 'updatedAt': updated['updatedAt']} == updated


async def test_clears_the_category_with_null(api: AsyncClient) -> None:
    created = (await create(api)).json()

    response = await api.patch(f'/products/{created["id"]}', json={'category': None})

    assert response.json()['category'] is None


async def test_answers_404_for_an_unknown_or_malformed_id(api: AsyncClient) -> None:
    assert (await api.get('/products/01a0c40d-90c3-750a-af78-7d4aa60d284e')).status_code == 404
    malformed = await api.get('/products/not-a-uuid')
    assert malformed.status_code == 404
    assert malformed.json() == {'message': 'No product with id "not-a-uuid"', 'resource': 'product'}
    assert (await api.patch('/products/not-a-uuid', json={'stock': 1})).status_code == 404


async def test_soft_deletes_and_keeps_the_sku_reserved(api: AsyncClient) -> None:
    created = (await create(api)).json()
    path = f'/products/{created["id"]}'

    deleted = await api.delete(path)
    assert deleted.status_code == 204
    assert deleted.content == b''

    assert (await api.get(path)).status_code == 404
    assert (await api.patch(path, json={'stock': 1})).status_code == 404
    assert (await api.delete(path)).status_code == 404
    assert (await api.get('/products')).json()['items'] == []
    assert (await create(api)).status_code == 409


async def test_lists_with_the_page_shape_and_applies_q_sort_and_pagination(
    api: AsyncClient,
) -> None:
    await create(api)
    await create(api, {**VALID, 'sku': 'WM-042', 'name': 'Wireless Mouse', 'price': 29.99})
    await create(api, {**VALID, 'sku': 'CB-010', 'name': 'Coffee Beans', 'price': 18.75})

    page = await api.get('/products', params={'sort': 'price', 'order': 'asc', 'limit': 2})
    search = await api.get('/products', params={'q': 'MOUSE'})

    assert page.status_code == 200
    assert {key: page.json()[key] for key in ('total', 'page', 'limit')} == {
        'total': 3,
        'page': 1,
        'limit': 2,
    }
    assert [item['price'] for item in page.json()['items']] == [18.75, 29.99]
    assert [item['sku'] for item in search.json()['items']] == ['WM-042']


async def test_rejects_an_invalid_query_with_400(api: AsyncClient) -> None:
    response = await api.get('/products', params={'limit': 500})

    assert response.status_code == 400
    assert response.json()['issues'][0]['path'] == 'limit'


async def test_allows_the_web_origin_through_cors(api: AsyncClient) -> None:
    allowed = await api.options(
        '/products',
        headers={'origin': 'http://localhost:3005', 'access-control-request-method': 'POST'},
    )
    other = await api.get('/products', headers={'origin': 'http://evil.test'})

    assert allowed.headers['access-control-allow-origin'] == 'http://localhost:3005'
    assert 'access-control-allow-origin' not in other.headers
