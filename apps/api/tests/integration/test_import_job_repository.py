from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from ecommerce_api.application.ports.import_job_repository import ImportPlan, ProductUpsert
from ecommerce_api.application.ports.product_repository import NewProduct, ProductSearch
from ecommerce_api.domain.import_job import ImportIssue, ImportRowReport, ImportTotals
from ecommerce_api.infra.persistence.categories import SqlCategoryRepository
from ecommerce_api.infra.persistence.import_jobs import SqlImportJobRepository
from ecommerce_api.infra.persistence.products import SqlProductRepository

SHOES = ProductUpsert(
    line=2,
    sku='RS-001',
    name='Running Shoes',
    description='Lightweight',
    price=Decimal('89.99'),
    stock=150,
    weight_kg=Decimal('0.35'),
    category='Footwear',
)


def new_product(
    *,
    sku: str = 'RS-001',
    name: str = 'Shoes',
    description: str | None = None,
    price: Decimal = Decimal(1),
    stock: int = 1,
    weight_kg: Decimal | None = None,
    category_id: str | None = None,
) -> NewProduct:
    return NewProduct(
        sku=sku,
        name=name,
        description=description,
        price=price,
        stock=stock,
        weight_kg=weight_kg,
        category_id=category_id,
    )


@pytest.fixture
def imports(engine: AsyncEngine) -> SqlImportJobRepository:
    return SqlImportJobRepository(engine)


@pytest.fixture
def products(engine: AsyncEngine) -> SqlProductRepository:
    return SqlProductRepository(engine)


@pytest.fixture
def categories(engine: AsyncEngine) -> SqlCategoryRepository:
    return SqlCategoryRepository(engine)


async def test_creates_new_skus_updates_known_ones_and_records_the_job(
    imports: SqlImportJobRepository,
    products: SqlProductRepository,
    categories: SqlCategoryRepository,
) -> None:
    footwear = await categories.find_or_create('Footwear')
    existing = await products.create(
        new_product(
            sku='CB-010', name='Coffee', price=Decimal('18.75'), stock=500, category_id=footwear.id
        )
    )

    job = await imports.commit(
        ImportPlan(
            file_name='products.csv',
            rejected=[
                ImportRowReport(
                    3,
                    'WM-042',
                    'Mouse',
                    'failed',
                    (ImportIssue('price', 'Price must be a number'),),
                )
            ],
            writes=[
                SHOES,
                ProductUpsert(
                    line=4,
                    sku='CB-010',
                    name='Coffee Beans',
                    price=Decimal('19.5'),
                    stock=400,
                    category='Food & Beverage',
                ),
            ],
        )
    )

    assert job.totals == ImportTotals(rows=3, created=1, updated=1, skipped=0, failed=1)
    assert [(row.line, row.outcome) for row in job.rows] == [
        (2, 'created'),
        (3, 'failed'),
        (4, 'updated'),
    ]
    coffee = await products.find_by_id(existing.id)
    assert coffee is not None
    assert (coffee.name, coffee.price, coffee.stock) == ('Coffee Beans', Decimal('19.50'), 400)
    assert coffee.category is not None
    assert coffee.category.name == 'Food & Beverage'
    assert [category.name for category in await categories.find_all()] == [
        'Food & Beverage',
        'Footwear',
    ]
    assert await imports.find_by_id(job.id) == job


async def test_restores_a_deleted_product_and_keeps_fields_whose_column_is_absent(
    imports: SqlImportJobRepository, products: SqlProductRepository
) -> None:
    created = await products.create(
        new_product(name='Old Shoes', description='Old description', weight_kg=Decimal('0.5'))
    )
    await products.soft_delete(created.id)

    await imports.commit(
        ImportPlan(
            file_name='restore.csv',
            rejected=[],
            writes=[
                ProductUpsert(line=2, sku='RS-001', name='Shoes v2', price=Decimal(2), stock=3)
            ],
        )
    )

    restored = await products.find_by_id(created.id)
    assert restored is not None
    assert (restored.name, restored.price, restored.stock) == ('Shoes v2', Decimal(2), 3)
    assert (restored.description, restored.weight_kg) == ('Old description', Decimal('0.5'))


async def test_clears_blank_optional_cells_on_update(
    imports: SqlImportJobRepository,
    products: SqlProductRepository,
    categories: SqlCategoryRepository,
) -> None:
    footwear = await categories.find_or_create('Footwear')
    created = await products.create(
        new_product(description='Old', weight_kg=Decimal('0.5'), category_id=footwear.id)
    )

    await imports.commit(
        ImportPlan(
            file_name='clear.csv',
            rejected=[],
            writes=[
                ProductUpsert(
                    line=2,
                    sku='RS-001',
                    name='Shoes',
                    price=Decimal(1),
                    stock=1,
                    description=None,
                    weight_kg=None,
                    category=None,
                )
            ],
        )
    )

    cleared = await products.find_by_id(created.id)
    assert cleared is not None
    assert (cleared.description, cleared.weight_kg, cleared.category) == (None, None, None)


async def test_writes_nothing_when_one_write_fails(
    imports: SqlImportJobRepository, products: SqlProductRepository
) -> None:
    with pytest.raises(Exception, match='numeric field overflow'):
        await imports.commit(
            ImportPlan(
                file_name='broken.csv',
                rejected=[],
                writes=[
                    SHOES,
                    ProductUpsert(line=3, sku='HT-001', name='Hat', price=Decimal('1e11'), stock=1),
                ],
            )
        )

    search = ProductSearch(sort='createdAt', order='desc', page=1, limit=20)
    assert (await products.search(search)).total == 0
    assert await imports.find_all() == []


async def test_lists_jobs_newest_first_without_rows(imports: SqlImportJobRepository) -> None:
    first = await imports.commit(ImportPlan(file_name='a.csv', rejected=[], writes=[SHOES]))
    second = await imports.commit(ImportPlan(file_name='b.csv', rejected=[], writes=[SHOES]))

    listed = await imports.find_all()

    assert [job.id for job in listed] == [second.id, first.id]
    assert not hasattr(listed[0], 'rows')
    assert listed[1].totals == ImportTotals(rows=1, created=1, updated=0, skipped=0, failed=0)
    assert listed[0].totals.updated == 1
