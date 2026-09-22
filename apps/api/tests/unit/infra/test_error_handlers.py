import json
from typing import Any

import pytest
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from ecommerce_api.domain.errors import (
    ConflictError,
    DomainValidationError,
    NotFoundError,
    UnavailableItem,
    UnavailableItemsError,
)
from ecommerce_api.infra.http import errors

REQUEST = Request({'type': 'http'})


def body_of(response: JSONResponse) -> Any:
    return json.loads(bytes(response.body))


async def test_maps_not_found_to_404() -> None:
    response = await errors.not_found(REQUEST, NotFoundError('product', 'abc'))

    assert response.status_code == 404
    assert body_of(response) == {'message': 'No product with id "abc"', 'resource': 'product'}


async def test_maps_conflict_to_409_naming_the_field_and_value() -> None:
    response = await errors.conflict(REQUEST, ConflictError('sku', 'RS-001'))

    assert response.status_code == 409
    assert body_of(response) == {
        'message': 'sku "RS-001" is already taken',
        'field': 'sku',
        'value': 'RS-001',
    }


async def test_maps_unavailable_items_to_409_listing_every_item() -> None:
    items = [
        UnavailableItem('p1', 3, 1, 'insufficient_stock'),
        UnavailableItem('p2', 1, 0, 'unavailable'),
    ]

    response = await errors.unavailable_items(REQUEST, UnavailableItemsError(items))

    assert response.status_code == 409
    assert body_of(response) == {
        'message': 'Some items are not available in the requested quantity',
        'items': [
            {'productId': 'p1', 'requested': 3, 'available': 1, 'reason': 'insufficient_stock'},
            {'productId': 'p2', 'requested': 1, 'available': 0, 'reason': 'unavailable'},
        ],
    }


async def test_maps_a_domain_validation_error_to_400_with_an_issues_list() -> None:
    response = await errors.domain_validation_failed(
        REQUEST, DomainValidationError('stock', 'must not be negative')
    )

    assert response.status_code == 400
    assert body_of(response) == {
        'message': 'Validation failed',
        'issues': [{'path': 'stock', 'message': 'must not be negative'}],
    }


@pytest.mark.parametrize(
    ('detail', 'issue'),
    [
        (
            {'type': 'rule', 'loc': ('body', 'items', 0, 'quantity'), 'msg': 'Too many'},
            {'path': 'items.0.quantity', 'message': 'Too many'},
        ),
        (
            {'type': 'less_than_equal', 'loc': ('query', 'limit'), 'msg': 'Too big'},
            {'path': 'limit', 'message': 'Too big'},
        ),
        (
            {'type': 'missing', 'loc': ('body',), 'msg': 'Field required'},
            {'path': '', 'message': 'Invalid input: expected object, received undefined'},
        ),
    ],
)
async def test_turns_request_validation_errors_into_a_400_issues_list(
    detail: dict[str, Any], issue: dict[str, str]
) -> None:
    response = await errors.request_validation_failed(REQUEST, RequestValidationError([detail]))

    assert response.status_code == 400
    assert body_of(response) == {'message': 'Validation failed', 'issues': [issue]}
