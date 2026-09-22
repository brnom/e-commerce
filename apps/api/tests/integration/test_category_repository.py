from sqlalchemy.ext.asyncio import AsyncEngine

from ecommerce_api.domain.product import Category
from ecommerce_api.infra.persistence.categories import SqlCategoryRepository


async def test_creates_a_category_the_first_time_a_name_is_seen(engine: AsyncEngine) -> None:
    repository = SqlCategoryRepository(engine)

    category = await repository.find_or_create('Footwear')

    assert category.name == 'Footwear'
    assert await repository.find_all() == [category]


async def test_reuses_an_existing_category_regardless_of_case_and_keeps_the_original_spelling(
    engine: AsyncEngine,
) -> None:
    repository = SqlCategoryRepository(engine)
    first = await repository.find_or_create('Electronics')

    second = await repository.find_or_create('electronics')

    assert second == first
    assert await repository.find_all() == [Category(id=first.id, name='Electronics')]


async def test_lists_categories_ordered_by_name(engine: AsyncEngine) -> None:
    repository = SqlCategoryRepository(engine)
    for name in ('Toys', 'Accessories', 'Food & Beverage'):
        await repository.find_or_create(name)

    assert [category.name for category in await repository.find_all()] == [
        'Accessories',
        'Food & Beverage',
        'Toys',
    ]
