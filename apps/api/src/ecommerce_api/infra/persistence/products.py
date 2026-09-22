from collections.abc import Awaitable, Callable
from typing import Any

from sqlalchemy import ColumnElement, Row, Select, and_, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from ecommerce_api.application.ports.product_repository import (
    NewProduct,
    ProductChanges,
    ProductSearch,
    ProductSearchResult,
)
from ecommerce_api.domain.errors import ConflictError
from ecommerce_api.domain.product import Category, Product
from ecommerce_api.infra.persistence.engine import new_id
from ecommerce_api.infra.persistence.tables import category, product

UNIQUE_VIOLATION = '23505'
SKU_CONSTRAINT = 'Product_sku_key'

CHANGE_COLUMNS = {
    'sku': product.c.sku,
    'name': product.c.name,
    'description': product.c.description,
    'price': product.c.price,
    'stock': product.c.stock,
    'weight_kg': product.c.weightKg,
    'category_id': product.c.categoryId,
}

SORT_COLUMNS = {
    'name': product.c.name,
    'price': product.c.price,
    'stock': product.c.stock,
    'createdAt': product.c.createdAt,
}


def product_select() -> Select[Any]:
    return select(
        product.c.id,
        product.c.sku,
        product.c.name,
        product.c.description,
        product.c.price,
        product.c.stock,
        product.c.weightKg,
        product.c.createdAt,
        product.c.updatedAt,
        category.c.id.label('category_id'),
        category.c.name.label('category_name'),
    ).select_from(product.outerjoin(category, product.c.categoryId == category.c.id))


def to_product(row: Row[Any]) -> Product:
    return Product(
        id=row.id,
        sku=row.sku,
        name=row.name,
        description=row.description,
        price=row.price,
        stock=row.stock,
        weight_kg=row.weightKg,
        category=Category(id=row.category_id, name=row.category_name)
        if row.category_id is not None
        else None,
        created_at=row.createdAt,
        updated_at=row.updatedAt,
    )


def escape_like(term: str) -> str:
    return term.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')


def is_sku_conflict(error: IntegrityError) -> bool:
    cause = error.orig
    diagnostic = getattr(cause, 'diag', None)
    return (
        getattr(cause, 'sqlstate', None) == UNIQUE_VIOLATION
        and getattr(diagnostic, 'constraint_name', None) == SKU_CONSTRAINT
    )


async def translating_conflicts[T](sku: str | None, operation: Callable[[], Awaitable[T]]) -> T:
    try:
        return await operation()
    except IntegrityError as error:
        if sku is not None and is_sku_conflict(error):
            raise ConflictError('sku', sku) from error
        raise


class SqlProductRepository:
    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def create(self, data: NewProduct) -> Product:
        async def insert() -> Product:
            async with self._engine.begin() as connection:
                id = new_id()
                await connection.execute(
                    product.insert().values(
                        id=id,
                        sku=data.sku,
                        name=data.name,
                        description=data.description,
                        price=data.price,
                        stock=data.stock,
                        weightKg=data.weight_kg,
                        categoryId=data.category_id,
                        updatedAt=func.now(),
                    )
                )
                return await self._require(connection, id)

        return await translating_conflicts(data.sku, insert)

    async def find_by_id(self, id: str) -> Product | None:
        async with self._engine.connect() as connection:
            return await self._find(connection, id)

    async def update(self, id: str, changes: ProductChanges) -> Product | None:
        values: dict[str, object] = {
            CHANGE_COLUMNS[field].key: value for field, value in changes.items()
        }

        async def apply() -> Product | None:
            async with self._engine.begin() as connection:
                updated = (
                    await connection.execute(
                        update(product)
                        .where(product.c.id == id, product.c.deletedAt.is_(None))
                        .values(**values, updatedAt=func.now())
                        .returning(product.c.id)
                    )
                ).first()
                return await self._require(connection, id) if updated is not None else None

        return await translating_conflicts(changes.get('sku'), apply)

    async def soft_delete(self, id: str) -> bool:
        async with self._engine.begin() as connection:
            result = await connection.execute(
                update(product)
                .where(product.c.id == id, product.c.deletedAt.is_(None))
                .values(deletedAt=func.now())
                .returning(product.c.id)
            )
            return result.first() is not None

    async def search(self, query: ProductSearch) -> ProductSearchResult:
        conditions: list[ColumnElement[bool]] = [product.c.deletedAt.is_(None)]
        if query.category_id:
            conditions.append(product.c.categoryId == query.category_id)
        if query.q:
            pattern = f'%{escape_like(query.q)}%'
            conditions.append(
                or_(
                    product.c.name.ilike(pattern, escape='\\'),
                    product.c.description.ilike(pattern, escape='\\'),
                )
            )
        where = and_(*conditions)
        sort = SORT_COLUMNS[query.sort]
        async with self._engine.begin() as connection:
            rows = await connection.execute(
                product_select()
                .where(where)
                .order_by(sort.asc() if query.order == 'asc' else sort.desc(), product.c.id.asc())
                .offset((query.page - 1) * query.limit)
                .limit(query.limit)
            )
            items = [to_product(row) for row in rows]
            total = (
                await connection.execute(select(func.count()).select_from(product).where(where))
            ).scalar_one()
        return ProductSearchResult(items=items, total=total)

    async def _find(self, connection: AsyncConnection, id: str) -> Product | None:
        row = (
            await connection.execute(
                product_select().where(product.c.id == id, product.c.deletedAt.is_(None))
            )
        ).first()
        return to_product(row) if row is not None else None

    async def _require(self, connection: AsyncConnection, id: str) -> Product:
        found = await self._find(connection, id)
        if found is None:
            raise LookupError(f'Product {id} vanished inside its own transaction')
        return found
