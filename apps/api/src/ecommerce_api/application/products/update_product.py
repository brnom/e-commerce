from ecommerce_api.application.ports.category_repository import CategoryRepository
from ecommerce_api.application.ports.product_repository import ProductChanges, ProductRepository
from ecommerce_api.application.schemas.product import UpdateProductInput
from ecommerce_api.domain.errors import NotFoundError
from ecommerce_api.domain.product import Product, normalize_category_name, normalize_sku


class UpdateProduct:
    def __init__(self, products: ProductRepository, categories: CategoryRepository) -> None:
        self._products = products
        self._categories = categories

    async def execute(self, id: str, data: UpdateProductInput) -> Product:
        changes = ProductChanges()
        if data.sku is not None:
            changes['sku'] = normalize_sku(data.sku)
        if data.name is not None:
            changes['name'] = data.name
        if data.has('description'):
            changes['description'] = data.description
        if data.price is not None:
            changes['price'] = data.price
        if data.stock is not None:
            changes['stock'] = data.stock
        if data.has('weight_kg'):
            changes['weight_kg'] = data.weight_kg
        if data.has('category'):
            changes['category_id'] = await self._category_id(data.category)
        product = await self._products.update(id, changes)
        if product is None:
            raise NotFoundError('product', id)
        return product

    async def _category_id(self, category: str | None) -> str | None:
        if category is None:
            return None
        return (await self._categories.find_or_create(normalize_category_name(category))).id
