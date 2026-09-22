from dataclasses import dataclass
from typing import cast

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncEngine

from ecommerce_api.application.imports.get_import_job import GetImportJob
from ecommerce_api.application.imports.import_products import ImportProducts
from ecommerce_api.application.imports.list_import_jobs import ListImportJobs
from ecommerce_api.application.orders.get_order import GetOrder
from ecommerce_api.application.orders.list_orders import ListOrders
from ecommerce_api.application.orders.place_order import PlaceOrder
from ecommerce_api.application.ports.config import Config
from ecommerce_api.application.ports.payment_gateway import PaymentGateway
from ecommerce_api.application.products.create_product import CreateProduct
from ecommerce_api.application.products.delete_product import DeleteProduct
from ecommerce_api.application.products.get_product import GetProduct
from ecommerce_api.application.products.list_categories import ListCategories
from ecommerce_api.application.products.list_products import ListProducts
from ecommerce_api.application.products.update_product import UpdateProduct
from ecommerce_api.infra.payments.fake_gateway import FakePaymentGateway
from ecommerce_api.infra.persistence.categories import SqlCategoryRepository
from ecommerce_api.infra.persistence.engine import create_engine
from ecommerce_api.infra.persistence.import_jobs import SqlImportJobRepository
from ecommerce_api.infra.persistence.orders import SqlOrderRepository
from ecommerce_api.infra.persistence.products import SqlProductRepository


@dataclass(frozen=True, slots=True)
class Container:
    engine: AsyncEngine
    create_product: CreateProduct
    get_product: GetProduct
    update_product: UpdateProduct
    delete_product: DeleteProduct
    list_products: ListProducts
    list_categories: ListCategories
    import_products: ImportProducts
    list_import_jobs: ListImportJobs
    get_import_job: GetImportJob
    place_order: PlaceOrder
    list_orders: ListOrders
    get_order: GetOrder


def build_container(config: Config, payments: PaymentGateway | None = None) -> Container:
    engine = create_engine(config.database_url)
    products = SqlProductRepository(engine)
    categories = SqlCategoryRepository(engine)
    imports = SqlImportJobRepository(engine)
    orders = SqlOrderRepository(engine)
    return Container(
        engine=engine,
        create_product=CreateProduct(products, categories),
        get_product=GetProduct(products),
        update_product=UpdateProduct(products, categories),
        delete_product=DeleteProduct(products),
        list_products=ListProducts(products),
        list_categories=ListCategories(categories),
        import_products=ImportProducts(imports),
        list_import_jobs=ListImportJobs(imports),
        get_import_job=GetImportJob(imports),
        place_order=PlaceOrder(orders, payments or FakePaymentGateway()),
        list_orders=ListOrders(orders),
        get_order=GetOrder(orders),
    )


def container(request: Request) -> Container:
    return cast(Container, request.app.state.container)
