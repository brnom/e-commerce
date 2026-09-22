from decimal import Decimal

import pytest

from ecommerce_api.application.imports.get_import_job import GetImportJob
from ecommerce_api.application.imports.import_products import (
    MAX_IMPORT_ROWS,
    ImportFile,
    ImportProducts,
)
from ecommerce_api.application.imports.list_import_jobs import ListImportJobs
from ecommerce_api.application.products.delete_product import DeleteProduct
from ecommerce_api.application.products.get_product import GetProduct
from ecommerce_api.domain.errors import InvalidImportFileError, NotFoundError
from ecommerce_api.domain.import_job import ImportIssue, ImportTotals
from tests.unit.application.conftest import Catalog
from tests.unit.fakes.categories import InMemoryCategoryRepository
from tests.unit.fakes.imports import InMemoryImportJobRepository
from tests.unit.fakes.products import InMemoryProductRepository

HEADER = 'name,sku,description,category,price,stock,weight_kg\n'


def csv(*lines: str) -> ImportFile:
    return ImportFile(file_name='products.csv', content=(HEADER + '\n'.join(lines) + '\n').encode())


@pytest.fixture
def import_products(imports: InMemoryImportJobRepository) -> ImportProducts:
    return ImportProducts(imports)


async def test_creates_updates_skips_and_fails_rows_in_one_file(
    catalog: Catalog,
    import_products: ImportProducts,
    products: InMemoryProductRepository,
    categories: InMemoryCategoryRepository,
) -> None:
    await catalog.create(sku='CB-010', name='Coffee', price=18.75, stock=500)

    job = await import_products.execute(
        csv(
            'Running Shoes,rs-001,Lightweight,Footwear,89.99,150,0.35',
            'Coffee Beans,CB-010,"Single origin, medium roast",Food & Beverage,19.50,400,1.0',
            'Wireless Mouse,WM-042,,Electronics,$29.99,75,0.12',
            ',,,,,,',
            ',HD-099,Headphones,Electronics,149.99,30,0.25',
        )
    )

    assert job.totals == ImportTotals(rows=5, created=1, updated=1, skipped=1, failed=2)
    assert [(row.line, row.outcome) for row in job.rows] == [
        (2, 'created'),
        (3, 'updated'),
        (4, 'failed'),
        (5, 'skipped'),
        (6, 'failed'),
    ]
    assert (job.rows[2].sku, job.rows[2].name, job.rows[2].issues) == (
        'WM-042',
        'Wireless Mouse',
        (ImportIssue('price', 'Price must be a number'),),
    )
    assert (job.rows[4].sku, job.rows[4].name, job.rows[4].issues) == (
        'HD-099',
        None,
        (ImportIssue('name', 'Name is required'),),
    )
    assert [(row.sku, row.price) for row in products.rows] == [
        ('CB-010', Decimal('19.5')),
        ('RS-001', Decimal('89.99')),
    ]
    assert products.rows[0].description == 'Single origin, medium roast'
    assert [category.name for category in categories.rows] == ['Footwear', 'Food & Beverage']


async def test_reports_every_failing_field_of_a_row(import_products: ImportProducts) -> None:
    job = await import_products.execute(csv('   ,WS-001,,,5.00,-5,'))

    assert [issue.path for issue in job.rows[0].issues] == ['name', 'stock']


async def test_keeps_the_first_occurrence_of_a_duplicated_sku_and_fails_the_later_ones(
    import_products: ImportProducts, products: InMemoryProductRepository
) -> None:
    job = await import_products.execute(
        csv(
            'Speaker,BS-021,,,59.99,110,0.8',
            'Hat,HT-001,,,9.99,10,',
            'Speaker,bs-021,Same sku,,49.99,200,0.75',
            'Speaker,BS-021,Again,,39.99,5,',
        )
    )

    assert job.totals == ImportTotals(rows=4, created=2, updated=0, skipped=0, failed=2)
    assert job.rows[2].issues == (ImportIssue('sku', 'Duplicate of line 2'),)
    assert job.rows[3].issues == (ImportIssue('sku', 'Duplicate of line 2'),)
    speaker = products.by_sku('BS-021')
    assert speaker is not None
    assert speaker.price == Decimal('59.99')


async def test_restores_a_deleted_product_with_a_matching_sku(
    catalog: Catalog, import_products: ImportProducts, products: InMemoryProductRepository
) -> None:
    product = await catalog.create(sku='WM-042', name='Mouse', price=29.99, stock=1)
    await DeleteProduct(products).execute(product.id)

    job = await import_products.execute(csv('Wireless Mouse,WM-042,,,24.99,75,0.12'))

    assert job.rows[0].outcome == 'updated'
    restored = await GetProduct(products).execute(product.id)
    assert (restored.name, restored.price) == ('Wireless Mouse', Decimal('24.99'))


async def test_leaves_fields_whose_column_is_absent_untouched_and_clears_blank_cells(
    catalog: Catalog, import_products: ImportProducts, products: InMemoryProductRepository
) -> None:
    await catalog.create(
        sku='RS-001',
        name='Shoes',
        description='Old description',
        price=1,
        stock=1,
        weightKg=0.5,
        category='Footwear',
    )

    await import_products.execute(
        ImportFile(
            file_name='partial.csv',
            content=b'sku,name,price,stock,category\nRS-001,Shoes v2,2,3,\n',
        )
    )

    row = products.rows[0]
    assert (row.name, row.price, row.stock) == ('Shoes v2', Decimal(2), 3)
    assert (row.description, row.weight_kg, row.category_id) == (
        'Old description',
        Decimal('0.5'),
        None,
    )


async def test_rejects_a_file_with_a_missing_column_before_writing_anything(
    import_products: ImportProducts, imports: InMemoryImportJobRepository
) -> None:
    with pytest.raises(InvalidImportFileError) as caught:
        await import_products.execute(ImportFile(file_name='x.csv', content=b'name,sku\nA,B\n'))

    assert caught.value == InvalidImportFileError(
        'Missing required columns: price, stock', ['price', 'stock']
    )
    assert imports.jobs == []


async def test_rejects_a_file_with_too_many_rows(
    import_products: ImportProducts, products: InMemoryProductRepository
) -> None:
    lines = [f'P{index},SKU-{index},,,1,1,' for index in range(MAX_IMPORT_ROWS + 1)]

    with pytest.raises(InvalidImportFileError):
        await import_products.execute(csv(*lines))
    assert products.rows == []


async def test_lists_jobs_newest_first_without_rows_and_fetches_one_by_id(
    import_products: ImportProducts, imports: InMemoryImportJobRepository
) -> None:
    first = await import_products.execute(csv('A,A-1,,,1,1,'))
    second = await import_products.execute(csv('B,B-1,,,1,1,'))

    listed = await ListImportJobs(imports).execute()
    assert [job.id for job in listed] == [second.id, first.id]
    assert not hasattr(listed[0], 'rows')

    assert await GetImportJob(imports).execute(first.id) == first
    with pytest.raises(NotFoundError):
        await GetImportJob(imports).execute('missing')
