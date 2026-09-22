from ecommerce_api.application.ports.category_repository import CategoryRepository
from ecommerce_api.domain.product import Category


class ListCategories:
    def __init__(self, categories: CategoryRepository) -> None:
        self._categories = categories

    async def execute(self) -> list[Category]:
        return await self._categories.find_all()
