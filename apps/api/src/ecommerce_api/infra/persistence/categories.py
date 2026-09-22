from sqlalchemy import cast, select
from sqlalchemy.dialects.postgresql import CITEXT, insert
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from ecommerce_api.domain.product import Category
from ecommerce_api.infra.persistence.engine import new_id
from ecommerce_api.infra.persistence.tables import category


async def find_or_create_category(connection: AsyncConnection, name: str) -> Category:
    inserted = (
        await connection.execute(
            insert(category)
            .values(id=new_id(), name=name)
            .on_conflict_do_nothing(index_elements=[category.c.name])
            .returning(category.c.id, category.c.name)
        )
    ).first()
    if inserted is not None:
        return Category(id=inserted.id, name=inserted.name)
    existing = (
        await connection.execute(
            select(category.c.id, category.c.name).where(category.c.name == cast(name, CITEXT))
        )
    ).one()
    return Category(id=existing.id, name=existing.name)


class SqlCategoryRepository:
    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def find_or_create(self, name: str) -> Category:
        async with self._engine.begin() as connection:
            return await find_or_create_category(connection, name)

    async def find_all(self) -> list[Category]:
        async with self._engine.connect() as connection:
            rows = await connection.execute(
                select(category.c.id, category.c.name).order_by(category.c.name)
            )
            return [Category(id=row.id, name=row.name) for row in rows]
