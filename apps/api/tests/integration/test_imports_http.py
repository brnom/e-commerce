import re
from pathlib import Path
from typing import Any

from httpx import AsyncClient, Response

SAMPLE = Path(__file__).resolve().parents[4] / 'data' / 'e-commerce_input.csv'

HEADER = 'name,sku,description,category,price,stock,weight_kg\n'


async def upload(api: AsyncClient, content: bytes, file_name: str = 'upload.csv') -> Response:
    return await api.post('/imports', files={'file': (file_name, content, 'text/csv')})


async def upload_sample(api: AsyncClient) -> Response:
    return await upload(api, SAMPLE.read_bytes(), SAMPLE.name)


def lines_with(body: dict[str, Any], outcome: str) -> list[int]:
    return [row['line'] for row in body['rows'] if row['outcome'] == outcome]


def issues_of(body: dict[str, Any], line: int) -> list[dict[str, str]]:
    return next(row['issues'] for row in body['rows'] if row['line'] == line)


async def test_imports_the_sample_file_and_reports_every_row(api: AsyncClient) -> None:
    response = await upload_sample(api)

    assert response.status_code == 201
    body = response.json()
    assert body['fileName'] == 'e-commerce_input.csv'
    assert body['totals'] == {'rows': 97, 'created': 87, 'updated': 0, 'skipped': 2, 'failed': 8}
    assert re.fullmatch(r'[0-9a-f-]{36}', body['id'])
    assert len(body['rows']) == 97
    assert lines_with(body, 'skipped') == [62, 63]
    assert lines_with(body, 'failed') == [4, 7, 16, 25, 36, 41, 56, 89]
    assert issues_of(body, 4) == [{'path': 'price', 'message': 'Price must be a number'}]
    assert issues_of(body, 16) == [{'path': 'stock', 'message': 'Stock must be zero or more'}]
    assert issues_of(body, 36) == [{'path': 'sku', 'message': 'Duplicate of line 2'}]
    assert issues_of(body, 89) == [{'path': 'sku', 'message': 'Duplicate of line 11'}]

    assert (await api.get('/products', params={'limit': 100})).json()['total'] == 87
    names = [category['name'] for category in (await api.get('/categories')).json()]
    assert 'Food & Beverage' in names


async def test_updates_instead_of_duplicating_when_the_same_file_is_imported_again(
    api: AsyncClient,
) -> None:
    await upload_sample(api)

    response = await upload_sample(api)

    assert response.status_code == 201
    assert response.json()['totals'] == {
        'rows': 97,
        'created': 0,
        'updated': 87,
        'skipped': 2,
        'failed': 8,
    }
    assert (await api.get('/products', params={'limit': 100})).json()['total'] == 87


async def test_restores_a_deleted_product_whose_sku_is_in_the_file(api: AsyncClient) -> None:
    created = await api.post(
        '/products', json={'sku': 'WM-042', 'name': 'Mouse', 'price': 1, 'stock': 1}
    )
    path = f'/products/{created.json()["id"]}'
    await api.delete(path)
    assert (await api.get(path)).status_code == 404

    response = await upload(
        api, f'{HEADER}Wireless Mouse,WM-042,,Electronics,29.99,75,0.12\n'.encode()
    )

    assert response.json()['rows'][0]['outcome'] == 'updated'
    detail = await api.get(path)
    assert detail.status_code == 200
    assert {key: detail.json()[key] for key in ('name', 'price', 'stock')} == {
        'name': 'Wireless Mouse',
        'price': 29.99,
        'stock': 75,
    }


async def test_lists_jobs_newest_first_without_rows_and_fetches_one_by_id(
    api: AsyncClient,
) -> None:
    first = await upload(api, f'{HEADER}A,A-1,,,1,1,\n'.encode(), 'first.csv')
    second = await upload(api, f'{HEADER}B,B-1,,,1,1,\n'.encode(), 'second.csv')

    listed = await api.get('/imports')
    assert listed.status_code == 200
    assert [job['fileName'] for job in listed.json()] == ['second.csv', 'first.csv']
    assert 'rows' not in listed.json()[0]

    detail = await api.get(f'/imports/{first.json()["id"]}')
    assert detail.status_code == 200
    assert detail.json() == first.json()
    assert second.json()['totals']['created'] == 1


async def test_responds_404_for_an_unknown_or_malformed_job_id(api: AsyncClient) -> None:
    assert (await api.get('/imports/019972f0-0000-7000-8000-000000000000')).status_code == 404
    assert (await api.get('/imports/not-a-uuid')).status_code == 404


async def test_rejects_a_file_with_missing_columns_and_records_nothing(api: AsyncClient) -> None:
    response = await upload(api, b'name,description\nA,B\n')

    assert response.status_code == 400
    assert response.json() == {
        'message': 'Missing required columns: sku, price, stock',
        'missingColumns': ['sku', 'price', 'stock'],
    }
    assert (await api.get('/imports')).json() == []


async def test_rejects_a_file_without_data_rows(api: AsyncClient) -> None:
    response = await upload(api, HEADER.encode())

    assert response.status_code == 400
    assert response.json()['message'] == 'The file has no data rows'


async def test_rejects_a_request_without_a_file(api: AsyncClient) -> None:
    response = await api.post('/imports', data={'name': 'x'}, files={'other': ('x.csv', b'a')})

    assert response.status_code == 400
    assert response.json() == {
        'message': 'A CSV file is required in the "file" field',
        'missingColumns': [],
    }


async def test_rejects_a_file_larger_than_2_mb(api: AsyncClient) -> None:
    response = await upload(api, (HEADER + 'A,A-1,,,1,1,\n' * 200_000).encode())

    assert response.status_code == 413
    assert response.json() == {
        'message': 'File too large',
        'error': 'Payload Too Large',
        'statusCode': 413,
    }


async def test_rejects_a_file_with_more_than_5000_data_rows(api: AsyncClient) -> None:
    lines = '\n'.join(f'P{index},S-{index},,,1,1,' for index in range(5001))

    response = await upload(api, f'{HEADER}{lines}\n'.encode())

    assert response.status_code == 400
    assert response.json()['message'] == 'The file has more than 5000 data rows'
