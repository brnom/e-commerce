from typing import Any

import pytest

from ecommerce_api.application.products.create_product import CreateProduct
from ecommerce_api.application.products.update_product import UpdateProduct
from ecommerce_api.application.schemas.product import CreateProductInput, UpdateProductInput
from ecommerce_api.domain.product import Product
from tests.unit.fakes.categories import InMemoryCategoryRepository
from tests.unit.fakes.imports import InMemoryImportJobRepository
from tests.unit.fakes.orders import FakePaymentGateway, InMemoryOrderRepository
from tests.unit.fakes.products import InMemoryProductRepository


@pytest.fixture
def categories() -> InMemoryCategoryRepository:
    return InMemoryCategoryRepository()


@pytest.fixture
def products(categories: InMemoryCategoryRepository) -> InMemoryProductRepository:
    return InMemoryProductRepository(lambda: categories.rows)


@pytest.fixture
def imports(
    products: InMemoryProductRepository, categories: InMemoryCategoryRepository
) -> InMemoryImportJobRepository:
    return InMemoryImportJobRepository(products, categories)


@pytest.fixture
def orders(products: InMemoryProductRepository) -> InMemoryOrderRepository:
    return InMemoryOrderRepository(products)


@pytest.fixture
def gateway() -> FakePaymentGateway:
    return FakePaymentGateway()


class Catalog:
    def __init__(
        self, products: InMemoryProductRepository, categories: InMemoryCategoryRepository
    ) -> None:
        self._create = CreateProduct(products, categories)
        self._update = UpdateProduct(products, categories)

    async def create(self, **data: Any) -> Product:
        return await self._create.execute(CreateProductInput.model_validate(data))

    async def update(self, id: str, **data: Any) -> Product:
        return await self._update.execute(id, UpdateProductInput.model_validate(data))


@pytest.fixture
def catalog(products: InMemoryProductRepository, categories: InMemoryCategoryRepository) -> Catalog:
    return Catalog(products, categories)
