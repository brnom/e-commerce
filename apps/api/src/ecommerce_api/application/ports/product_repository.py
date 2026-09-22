from dataclasses import dataclass
from decimal import Decimal
from typing import Literal, Protocol, TypedDict

from ecommerce_api.application.schemas.product import ProductSortField
from ecommerce_api.domain.product import Product


@dataclass(frozen=True, slots=True)
class NewProduct:
    sku: str
    name: str
    description: str | None
    price: Decimal
    stock: int
    weight_kg: Decimal | None
    category_id: str | None


class ProductChanges(TypedDict, total=False):
    sku: str
    name: str
    description: str | None
    price: Decimal
    stock: int
    weight_kg: Decimal | None
    category_id: str | None


@dataclass(frozen=True, slots=True)
class ProductSearch:
    sort: ProductSortField
    order: Literal['asc', 'desc']
    page: int
    limit: int
    q: str | None = None
    category_id: str | None = None


@dataclass(frozen=True, slots=True)
class ProductSearchResult:
    items: list[Product]
    total: int


class ProductRepository(Protocol):
    async def create(self, data: NewProduct) -> Product: ...

    async def find_by_id(self, id: str) -> Product | None: ...

    async def update(self, id: str, changes: ProductChanges) -> Product | None: ...

    async def soft_delete(self, id: str) -> bool: ...

    async def search(self, query: ProductSearch) -> ProductSearchResult: ...
