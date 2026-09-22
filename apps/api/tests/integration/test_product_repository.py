import dataclasses
from decimal import Decimal
from typing import Any

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from ecommerce_api.application.ports.product_repository import NewProduct, ProductSearch
from ecommerce_api.domain.errors import ConflictError
from ecommerce_api.infra.persistence.categories import SqlCategoryRepository
from ecommerce_api.infra.persistence.products import SqlProductRepository

BASE = NewProduct(
    sku='RS-001',
    name='Running Shoes',
    description='Lightweight running shoes for daily training',
    price=Decimal('89.99'),
    stock=150,
    weight_kg=Decimal('0.35'),
    category_id=None,
)

DEFAULT_SEARCH = ProductSearch(sort='createdAt', order='desc', page=1, limit=20)


def variant(**changes: Any) -> NewProduct:
    return dataclasses.replace(BASE, **changes)


@pytest.fixture
def products(engine: AsyncEngine) -> SqlProductRepository:
    return SqlProductRepository(engine)


@pytest.fixture
def categories(engine: AsyncEngine) -> SqlCategoryRepository:
    return SqlCategoryRepository(engine)


async def test_round_trips_decimals_and_resolves_the_category(
    products: SqlProductRepository, categories: SqlCategoryRepository
) -> None:
    footwear = await categories.find_or_create('Footwear')

    created = await products.create(variant(category_id=footwear.id))
    found = await products.find_by_id(created.id)

    assert found == created
    assert created.price == Decimal('89.99')
    assert created.weight_kg == Decimal('0.35')
    assert created.category == footwear


async def test_stores_a_null_weight_and_description(products: SqlProductRepository) -> None:
    created = await products.create(variant(description=None, weight_kg=None))

    assert created.description is None
    assert created.weight_kg is None


async def test_rejects_a_duplicate_sku_with_a_conflict_error(
    products: SqlProductRepository,
) -> None:
    await products.create(BASE)

    with pytest.raises(ConflictError) as caught:
        await products.create(variant(name='Other'))

    assert caught.value == ConflictError('sku', 'RS-001')
    assert (await products.search(DEFAULT_SEARCH)).total == 1


async def test_rejects_taking_another_products_sku(products: SqlProductRepository) -> None:
    await products.create(BASE)
    other = await products.create(variant(sku='CB-010', name='Coffee'))

    with pytest.raises(ConflictError):
        await products.update(other.id, {'sku': 'RS-001'})
    found = await products.find_by_id(other.id)
    assert found is not None
    assert found.sku == 'CB-010'


async def test_accepts_an_update_that_keeps_the_products_own_sku(
    products: SqlProductRepository,
) -> None:
    created = await products.create(BASE)

    updated = await products.update(created.id, {'sku': 'RS-001', 'stock': 3})

    assert updated is not None
    assert updated.stock == 3


async def test_returns_none_when_updating_an_unknown_id(products: SqlProductRepository) -> None:
    assert await products.update('00000000-0000-7000-8000-000000000000', {'stock': 1}) is None


async def test_soft_delete_hides_the_product_but_keeps_the_sku_reserved(
    products: SqlProductRepository,
) -> None:
    created = await products.create(BASE)

    assert await products.soft_delete(created.id) is True

    assert await products.find_by_id(created.id) is None
    assert (await products.search(DEFAULT_SEARCH)).items == []
    assert await products.update(created.id, {'stock': 1}) is None
    with pytest.raises(ConflictError):
        await products.create(BASE)


async def test_reports_false_on_a_second_delete(products: SqlProductRepository) -> None:
    created = await products.create(BASE)
    await products.soft_delete(created.id)

    assert await products.soft_delete(created.id) is False


async def test_matches_name_or_description_case_insensitively(
    products: SqlProductRepository,
) -> None:
    await products.create(BASE)
    await products.create(
        variant(
            sku='WM-042',
            name='Wireless Mouse',
            description='Ergonomic wireless mouse with USB receiver',
        )
    )

    result = await products.search(dataclasses.replace(DEFAULT_SEARCH, q='MOUSE'))

    assert [item.name for item in result.items] == ['Wireless Mouse']
    assert result.total == 1


async def test_treats_wildcard_characters_literally(products: SqlProductRepository) -> None:
    await products.create(variant(sku='CT-001', name='100% Cotton Tee'))
    await products.create(variant(sku='CS-002', name='Cotton Socks'))
    await products.create(variant(sku='US-003', name='under_score'))

    percent = await products.search(dataclasses.replace(DEFAULT_SEARCH, q='100%'))
    underscore = await products.search(dataclasses.replace(DEFAULT_SEARCH, q='r_s'))

    assert [item.name for item in percent.items] == ['100% Cotton Tee']
    assert [item.name for item in underscore.items] == ['under_score']


async def test_combines_the_category_filter_with_the_text_search(
    products: SqlProductRepository, categories: SqlCategoryRepository
) -> None:
    footwear = await categories.find_or_create('Footwear')
    electronics = await categories.find_or_create('Electronics')
    await products.create(variant(category_id=footwear.id))
    await products.create(
        variant(sku='HB-002', name='Hiking Boots', description=None, category_id=footwear.id)
    )
    await products.create(variant(sku='RW-003', name='Running Watch', category_id=electronics.id))

    result = await products.search(
        dataclasses.replace(DEFAULT_SEARCH, q='running', category_id=footwear.id)
    )

    assert [item.name for item in result.items] == ['Running Shoes']


async def test_counts_the_full_total_beyond_the_requested_page(
    products: SqlProductRepository,
) -> None:
    for index in range(45):
        await products.create(variant(sku=f'SKU-{index}', name=f'Product {index}'))

    result = await products.search(dataclasses.replace(DEFAULT_SEARCH, page=3, limit=20))

    assert len(result.items) == 5
    assert result.total == 45


async def test_sorts_by_price_ascending(products: SqlProductRepository) -> None:
    await products.create(variant(sku='A', price=Decimal('18.75')))
    await products.create(variant(sku='B', price=Decimal('89.99')))
    await products.create(variant(sku='C', price=Decimal(0)))

    result = await products.search(dataclasses.replace(DEFAULT_SEARCH, sort='price', order='asc'))

    assert [item.price for item in result.items] == [Decimal(0), Decimal('18.75'), Decimal('89.99')]
