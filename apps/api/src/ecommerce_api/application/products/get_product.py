from ecommerce_api.application.ports.product_repository import ProductRepository
from ecommerce_api.domain.errors import NotFoundError
from ecommerce_api.domain.product import Product


class GetProduct:
    def __init__(self, products: ProductRepository) -> None:
        self._products = products

    async def execute(self, id: str) -> Product:
        product = await self._products.find_by_id(id)
        if product is None:
            raise NotFoundError('product', id)
        return product
