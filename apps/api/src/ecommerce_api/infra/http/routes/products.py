from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response

from ecommerce_api.application.schemas.product import (
    CreateProductInput,
    ListProductsQuery,
    UpdateProductInput,
)
from ecommerce_api.infra.http.container import Container, container
from ecommerce_api.infra.http.errors import (
    SKU_CONFLICT,
    VALIDATION_FAILURE,
    error_responses,
    resource_not_found,
)
from ecommerce_api.infra.http.responses import CategoryResponse, ProductPage, ProductResponse
from ecommerce_api.infra.http.routes.resource_ids import product_id

router = APIRouter(tags=['Products'])

Services = Annotated[Container, Depends(container)]
ProductId = Annotated[str, Depends(product_id)]

NOT_FOUND = resource_not_found('product')


@router.post(
    '/products',
    status_code=201,
    summary='Create a product',
    responses=error_responses(VALIDATION_FAILURE, SKU_CONFLICT),
)
async def create_product(body: CreateProductInput, services: Services) -> ProductResponse:
    return ProductResponse.of(await services.create_product.execute(body))


@router.get(
    '/products',
    summary='List products, filtered, sorted and paginated',
    responses=error_responses(VALIDATION_FAILURE),
)
async def list_products(
    query: Annotated[ListProductsQuery, Query()], services: Services
) -> ProductPage:
    return ProductPage.of(await services.list_products.execute(query))


@router.get('/products/{id}', summary='Get one product', responses=error_responses(NOT_FOUND))
async def get_product(id: ProductId, services: Services) -> ProductResponse:
    return ProductResponse.of(await services.get_product.execute(id))


@router.patch(
    '/products/{id}',
    summary='Update part of a product',
    responses=error_responses(VALIDATION_FAILURE, NOT_FOUND, SKU_CONFLICT),
)
async def update_product(
    id: ProductId, body: UpdateProductInput, services: Services
) -> ProductResponse:
    return ProductResponse.of(await services.update_product.execute(id, body))


@router.delete(
    '/products/{id}',
    status_code=204,
    summary='Soft delete a product',
    response_class=Response,
    responses={204: {'description': 'The product was deleted'}, **error_responses(NOT_FOUND)},
)
async def delete_product(id: ProductId, services: Services) -> Response:
    await services.delete_product.execute(id)
    return Response(status_code=204)


@router.get('/categories', summary='List every category, ordered by name', tags=['Categories'])
async def list_categories(services: Services) -> list[CategoryResponse]:
    return [CategoryResponse.of(item) for item in await services.list_categories.execute()]
