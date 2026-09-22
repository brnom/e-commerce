from typing import Any

import pytest

from ecommerce_api.application.products.delete_product import DeleteProduct
from ecommerce_api.application.products.get_product import GetProduct
from ecommerce_api.application.products.list_categories import ListCategories
from ecommerce_api.application.products.list_products import ListProducts, ProductPage
from ecommerce_api.application.schemas.product import ListProductsQuery
from ecommerce_api.domain.errors import ConflictError, NotFoundError
from ecommerce_api.domain.product import Category
from tests.unit.application.conftest import Catalog
from tests.unit.fakes.categories import InMemoryCategoryRepository
from tests.unit.fakes.products import InMemoryProductRepository

INPUT: dict[str, Any] = {'sku': 'RS-001', 'name': 'Running Shoes', 'price': 89.99, 'stock': 150}


async def test_creates_a_product_and_resolves_its_category_by_name(
    catalog: Catalog, categories: InMemoryCategoryRepository
) -> None:
    product = await catalog.create(**INPUT, category='Footwear')

    assert product.category == Category(id='category-1', name='Footwear')
    assert product.description is None
    assert product.weight_kg is None
    assert await ListCategories(categories).execute() == [
        Category(id='category-1', name='Footwear')
    ]


async def test_normalizes_the_sku_before_persisting(catalog: Catalog) -> None:
    product = await catalog.create(**{**INPUT, 'sku': ' rs-001 '})

    assert product.sku == 'RS-001'


async def test_propagates_a_sku_conflict_from_the_repository(catalog: Catalog) -> None:
    await catalog.create(**INPUT)

    with pytest.raises(ConflictError):
        await catalog.create(**{**INPUT, 'name': 'Other'})


async def test_clears_the_category_when_updated_with_null(catalog: Catalog) -> None:
    created = await catalog.create(**INPUT, category='Footwear')

    updated = await catalog.update(created.id, category=None)

    assert updated.category is None


async def test_keeps_the_category_when_the_update_omits_it(catalog: Catalog) -> None:
    created = await catalog.create(**INPUT, category='Footwear')

    updated = await catalog.update(created.id, stock=12)

    assert updated.stock == 12
    assert updated.category is not None
    assert updated.category.name == 'Footwear'
    assert updated.name == 'Running Shoes'


async def test_reuses_an_existing_category_on_update_regardless_of_case(
    catalog: Catalog, categories: InMemoryCategoryRepository
) -> None:
    await catalog.create(**INPUT, category='Electronics')
    created = await catalog.create(**{**INPUT, 'sku': 'WM-042', 'name': 'Mouse'})

    updated = await catalog.update(created.id, category='electronics')

    assert updated.category is not None
    assert updated.category.name == 'Electronics'
    assert len(categories.rows) == 1


async def test_raises_not_found_when_updating_an_unknown_id(catalog: Catalog) -> None:
    with pytest.raises(NotFoundError):
        await catalog.update('missing', stock=1)


async def test_raises_not_found_when_deleting_an_unknown_id(
    products: InMemoryProductRepository,
) -> None:
    with pytest.raises(NotFoundError):
        await DeleteProduct(products).execute('missing')


async def test_hides_a_deleted_product_from_get_and_list(
    catalog: Catalog, products: InMemoryProductRepository
) -> None:
    created = await catalog.create(**INPUT)

    await DeleteProduct(products).execute(created.id)

    with pytest.raises(NotFoundError):
        await GetProduct(products).execute(created.id)
    page = await ListProducts(products).execute(ListProductsQuery())
    assert page == ProductPage(items=[], total=0, page=1, limit=20)


async def test_passes_filters_through_to_the_repository_and_echoes_the_page(
    catalog: Catalog, products: InMemoryProductRepository
) -> None:
    await catalog.create(**INPUT, category='Footwear')
    await catalog.create(**{**INPUT, 'sku': 'WM-042', 'name': 'Wireless Mouse'})

    page = await ListProducts(products).execute(
        ListProductsQuery(q='mouse', sort='name', order='asc', page=1, limit=10)
    )

    assert [item.sku for item in page.items] == ['WM-042']
    assert (page.total, page.page, page.limit) == (1, 1, 10)
