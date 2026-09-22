from dataclasses import dataclass

from ecommerce_api.application.ports.product_repository import ProductRepository, ProductSearch
from ecommerce_api.application.schemas.product import ListProductsQuery
from ecommerce_api.domain.product import Product


@dataclass(frozen=True, slots=True)
class ProductPage:
    items: list[Product]
    total: int
    page: int
    limit: int


class ListProducts:
    def __init__(self, products: ProductRepository) -> None:
        self._products = products

    async def execute(self, query: ListProductsQuery) -> ProductPage:
        result = await self._products.search(
            ProductSearch(
                q=query.q or None,
                category_id=query.category,
                sort=query.sort,
                order=query.order,
                page=query.page,
                limit=query.limit,
            )
        )
        return ProductPage(
            items=result.items, total=result.total, page=query.page, limit=query.limit
        )
