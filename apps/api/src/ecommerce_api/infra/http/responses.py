from typing import Literal

from ecommerce_api.application.products.list_products import ProductPage as ProductPageResult
from ecommerce_api.domain.import_job import ImportJob, ImportJobSummary, ImportRowReport
from ecommerce_api.domain.order import Order, OrderLine, OrderSummary
from ecommerce_api.domain.product import Category, Product
from ecommerce_api.infra.http.serialization import Money, Timestamp, WireModel


class CategoryResponse(WireModel):
    id: str
    name: str

    @classmethod
    def of(cls, category: Category) -> CategoryResponse:
        return cls(id=category.id, name=category.name)


class ProductResponse(WireModel):
    id: str
    sku: str
    name: str
    description: str | None
    price: Money
    stock: int
    weight_kg: Money | None
    category: CategoryResponse | None
    created_at: Timestamp
    updated_at: Timestamp

    @classmethod
    def of(cls, product: Product) -> ProductResponse:
        return cls(
            id=product.id,
            sku=product.sku,
            name=product.name,
            description=product.description,
            price=product.price,
            stock=product.stock,
            weight_kg=product.weight_kg,
            category=CategoryResponse.of(product.category) if product.category else None,
            created_at=product.created_at,
            updated_at=product.updated_at,
        )


class ProductPage(WireModel):
    items: list[ProductResponse]
    total: int
    page: int
    limit: int

    @classmethod
    def of(cls, page: ProductPageResult) -> ProductPage:
        return cls(
            items=[ProductResponse.of(item) for item in page.items],
            total=page.total,
            page=page.page,
            limit=page.limit,
        )


class ImportIssueResponse(WireModel):
    path: str
    message: str


class ImportRowReportResponse(WireModel):
    line: int
    sku: str | None
    name: str | None
    outcome: Literal['created', 'updated', 'skipped', 'failed']
    issues: list[ImportIssueResponse]

    @classmethod
    def of(cls, row: ImportRowReport) -> ImportRowReportResponse:
        return cls(
            line=row.line,
            sku=row.sku,
            name=row.name,
            outcome=row.outcome,
            issues=[ImportIssueResponse(path=i.path, message=i.message) for i in row.issues],
        )


class ImportTotalsResponse(WireModel):
    rows: int
    created: int
    updated: int
    skipped: int
    failed: int


class ImportJobSummaryResponse(WireModel):
    id: str
    file_name: str
    created_at: Timestamp
    totals: ImportTotalsResponse

    @classmethod
    def of(cls, job: ImportJobSummary) -> ImportJobSummaryResponse:
        totals = job.totals
        return cls(
            id=job.id,
            file_name=job.file_name,
            created_at=job.created_at,
            totals=ImportTotalsResponse(
                rows=totals.rows,
                created=totals.created,
                updated=totals.updated,
                skipped=totals.skipped,
                failed=totals.failed,
            ),
        )


class ImportJobResponse(ImportJobSummaryResponse):
    rows: list[ImportRowReportResponse]

    @classmethod
    def of_job(cls, job: ImportJob) -> ImportJobResponse:
        summary = ImportJobSummaryResponse.of(job.summary())
        return cls(
            id=summary.id,
            file_name=summary.file_name,
            created_at=summary.created_at,
            totals=summary.totals,
            rows=[ImportRowReportResponse.of(row) for row in job.rows],
        )


class OrderCustomerResponse(WireModel):
    name: str
    email: str


class OrderLineResponse(WireModel):
    product_id: str
    sku: str
    name: str
    unit_price: Money
    quantity: int
    line_total: Money

    @classmethod
    def of(cls, line: OrderLine) -> OrderLineResponse:
        return cls(
            product_id=line.product_id,
            sku=line.sku,
            name=line.name,
            unit_price=line.unit_price,
            quantity=line.quantity,
            line_total=line.line_total,
        )


class OrderPaymentResponse(WireModel):
    card_last4: str
    reference: str | None
    decline_reason: str | None


OrderStatus = Literal['pending', 'paid', 'payment_failed']


class OrderSummaryResponse(WireModel):
    id: str
    status: OrderStatus
    customer: OrderCustomerResponse
    item_count: int
    total: Money
    created_at: Timestamp

    @classmethod
    def of(cls, order: OrderSummary) -> OrderSummaryResponse:
        return cls(
            id=order.id,
            status=order.status,
            customer=OrderCustomerResponse(name=order.customer.name, email=order.customer.email),
            item_count=order.item_count,
            total=order.total,
            created_at=order.created_at,
        )


class OrderResponse(OrderSummaryResponse):
    lines: list[OrderLineResponse]
    payment: OrderPaymentResponse
    updated_at: Timestamp

    @classmethod
    def of_order(cls, order: Order) -> OrderResponse:
        summary = OrderSummaryResponse.of(order.summary())
        return cls(
            id=summary.id,
            status=summary.status,
            customer=summary.customer,
            item_count=summary.item_count,
            total=summary.total,
            created_at=summary.created_at,
            lines=[OrderLineResponse.of(line) for line in order.lines],
            payment=OrderPaymentResponse(
                card_last4=order.payment.card_last4,
                reference=order.payment.reference,
                decline_reason=order.payment.decline_reason,
            ),
            updated_at=order.updated_at,
        )
