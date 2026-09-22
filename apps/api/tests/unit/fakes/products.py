from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal

from ecommerce_api.application.ports.product_repository import (
    NewProduct,
    ProductChanges,
    ProductSearch,
    ProductSearchResult,
)
from ecommerce_api.domain.errors import ConflictError
from ecommerce_api.domain.product import Category, Product


@dataclass
class ProductRow:
    id: str
    sku: str
    name: str
    description: str | None
    price: Decimal
    stock: int
    weight_kg: Decimal | None
    category_id: str | None
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime


class InMemoryProductRepository:
    def __init__(self, categories: Callable[[], list[Category]]) -> None:
        self.rows: list[ProductRow] = []
        self._categories = categories

    async def create(self, data: NewProduct) -> Product:
        self._assert_sku_free(data.sku)
        now = datetime.now(UTC)
        row = ProductRow(
            id=f'product-{len(self.rows) + 1}',
            sku=data.sku,
            name=data.name,
            description=data.description,
            price=data.price,
            stock=data.stock,
            weight_kg=data.weight_kg,
            category_id=data.category_id,
            deleted_at=None,
            created_at=now,
            updated_at=now,
        )
        self.rows.append(row)
        return self._to_product(row)

    async def find_by_id(self, id: str) -> Product | None:
        row = self._active_row(id)
        return self._to_product(row) if row else None

    async def update(self, id: str, changes: ProductChanges) -> Product | None:
        row = self._active_row(id)
        if row is None:
            return None
        sku = changes.get('sku')
        if sku is not None and sku != row.sku:
            self._assert_sku_free(sku)
        for field, value in changes.items():
            setattr(row, field, value)
        row.updated_at = datetime.now(UTC)
        return self._to_product(row)

    async def soft_delete(self, id: str) -> bool:
        row = self._active_row(id)
        if row is None:
            return False
        row.deleted_at = datetime.now(UTC)
        return True

    async def search(self, query: ProductSearch) -> ProductSearchResult:
        needle = query.q.lower() if query.q else None
        matches = [
            row
            for row in self.active()
            if (
                needle is None
                or needle in row.name.lower()
                or (row.description is not None and needle in row.description.lower())
            )
            and (query.category_id is None or row.category_id == query.category_id)
        ]
        start = (query.page - 1) * query.limit
        page = matches[start : start + query.limit]
        return ProductSearchResult(
            items=[self._to_product(row) for row in page], total=len(matches)
        )

    def active(self) -> list[ProductRow]:
        return [row for row in self.rows if row.deleted_at is None]

    def by_sku(self, sku: str) -> ProductRow | None:
        return next((row for row in self.rows if row.sku == sku), None)

    def _active_row(self, id: str) -> ProductRow | None:
        return next((row for row in self.active() if row.id == id), None)

    def _assert_sku_free(self, sku: str) -> None:
        if self.by_sku(sku) is not None:
            raise ConflictError('sku', sku)

    def _to_product(self, row: ProductRow) -> Product:
        category = next(
            (candidate for candidate in self._categories() if candidate.id == row.category_id),
            None,
        )
        return Product(
            id=row.id,
            sku=row.sku,
            name=row.name,
            description=row.description,
            price=row.price,
            stock=row.stock,
            weight_kg=row.weight_kg,
            category=category,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
