from typing import Protocol

from ecommerce_api.domain.product import Category


class CategoryRepository(Protocol):
    async def find_or_create(self, name: str) -> Category: ...

    async def find_all(self) -> list[Category]: ...
