from ecommerce_api.application.ports.category_repository import CategoryRepository
from ecommerce_api.application.ports.product_repository import NewProduct, ProductRepository
from ecommerce_api.application.schemas.product import CreateProductInput
from ecommerce_api.domain.product import Product, normalize_category_name, normalize_sku


class CreateProduct:
    def __init__(self, products: ProductRepository, categories: CategoryRepository) -> None:
        self._products = products
        self._categories = categories

    async def execute(self, data: CreateProductInput) -> Product:
        category = (
            await self._categories.find_or_create(normalize_category_name(data.category))
            if data.category
            else None
        )
        return await self._products.create(
            NewProduct(
                sku=normalize_sku(data.sku),
                name=data.name,
                description=data.description,
                price=data.price,
                stock=data.stock,
                weight_kg=data.weight_kg,
                category_id=category.id if category else None,
            )
        )
