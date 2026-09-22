import json
import re
from typing import Any

import pytest
from httpx import AsyncClient


@pytest.fixture
async def document(api: AsyncClient) -> dict[str, Any]:
    response = await api.get('/docs/json')
    assert response.status_code == 200
    return dict(response.json())


def json_body(response: dict[str, Any]) -> Any:
    return response['content']['application/json']['schema']


def ref(name: str) -> dict[str, str]:
    return {'$ref': f'#/components/schemas/{name}'}


async def test_serves_the_swagger_ui(api: AsyncClient) -> None:
    response = await api.get('/docs')

    assert response.status_code == 200
    assert 'text/html' in response.headers['content-type']
    assert 'swagger-ui' in response.text


def test_documents_every_route(document: dict[str, Any]) -> None:
    assert sorted(document['paths']) == [
        '/categories',
        '/health',
        '/imports',
        '/imports/{id}',
        '/orders',
        '/orders/{id}',
        '/products',
        '/products/{id}',
    ]


def test_takes_request_bodies_from_the_input_models(document: dict[str, Any]) -> None:
    body = document['paths']['/products']['post']['requestBody']

    assert json_body(body) == ref('CreateProductInput')
    assert document['components']['schemas']['CreateProductInput']['required'] == [
        'sku',
        'name',
        'price',
        'stock',
    ]


def test_expands_the_product_list_query_into_parameters(document: dict[str, Any]) -> None:
    parameters = document['paths']['/products']['get']['parameters']

    assert [parameter['name'] for parameter in parameters] == [
        'q',
        'category',
        'sort',
        'order',
        'page',
        'limit',
    ]
    assert all(parameter['in'] == 'query' for parameter in parameters)


def test_documents_responses_with_the_response_models(document: dict[str, Any]) -> None:
    assert json_body(document['paths']['/products']['get']['responses']['200']) == ref(
        'ProductPage'
    )
    orders = json_body(document['paths']['/orders']['get']['responses']['200'])
    assert (orders['type'], orders['items']) == ('array', ref('OrderSummaryResponse'))


@pytest.mark.parametrize(
    ('path', 'method', 'status', 'schema'),
    [
        ('/products', 'post', '400', 'ValidationErrorBody'),
        ('/products', 'post', '409', 'ConflictErrorBody'),
        ('/orders', 'post', '409', 'UnavailableItemsErrorBody'),
        ('/products/{id}', 'get', '404', 'NotFoundErrorBody'),
        ('/imports', 'post', '400', 'InvalidImportFileErrorBody'),
        ('/imports', 'post', '413', 'UploadTooLargeErrorBody'),
    ],
)
def test_documents_the_error_bodies_the_handlers_answer_with(
    document: dict[str, Any], path: str, method: str, status: str, schema: str
) -> None:
    assert json_body(document['paths'][path][method]['responses'][status]) == ref(schema)


def test_drops_the_unused_422_response(document: dict[str, Any]) -> None:
    for operations in document['paths'].values():
        for operation in operations.values():
            assert '422' not in operation['responses']


def test_documents_the_csv_upload_as_multipart_with_a_binary_file_field(
    document: dict[str, Any],
) -> None:
    body = document['paths']['/imports']['post']['requestBody']

    assert body['required'] is True
    schema = body['content']['multipart/form-data']['schema']
    assert schema['properties']['file'] == {'type': 'string', 'format': 'binary'}


def test_names_every_schema_it_references(document: dict[str, Any]) -> None:
    named = set(document['components']['schemas'])
    references = re.findall(r'#/components/schemas/([A-Za-z]+)', json.dumps(document))

    assert references
    assert set(references) <= named


def test_uses_camel_case_property_names(document: dict[str, Any]) -> None:
    product = document['components']['schemas']['ProductResponse']['properties']

    assert {'weightKg', 'createdAt', 'updatedAt'} <= set(product)
