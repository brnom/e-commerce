from ecommerce_api.application.ports.product_repository import ProductRepository
from ecommerce_api.domain.errors import NotFoundError


class DeleteProduct:
    def __init__(self, products: ProductRepository) -> None:
        self._products = products

    async def execute(self, id: str) -> None:
        if not await self._products.soft_delete(id):
            raise NotFoundError('product', id)
