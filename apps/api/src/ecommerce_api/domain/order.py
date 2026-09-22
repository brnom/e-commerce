from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Literal

OrderStatus = Literal['pending', 'paid', 'payment_failed']


@dataclass(frozen=True, slots=True)
class OrderCustomer:
    name: str
    email: str


@dataclass(frozen=True, slots=True)
class OrderPayment:
    card_last4: str
    reference: str | None
    decline_reason: str | None


@dataclass(frozen=True, slots=True)
class OrderLine:
    product_id: str
    sku: str
    name: str
    unit_price: Decimal
    quantity: int
    line_total: Decimal


@dataclass(frozen=True, slots=True)
class OrderSummary:
    id: str
    status: OrderStatus
    customer: OrderCustomer
    item_count: int
    total: Decimal
    created_at: datetime


@dataclass(frozen=True, slots=True)
class Order:
    id: str
    status: OrderStatus
    customer: OrderCustomer
    item_count: int
    total: Decimal
    created_at: datetime
    lines: tuple[OrderLine, ...]
    payment: OrderPayment
    updated_at: datetime

    def summary(self) -> OrderSummary:
        return OrderSummary(
            id=self.id,
            status=self.status,
            customer=self.customer,
            item_count=self.item_count,
            total=self.total,
            created_at=self.created_at,
        )


@dataclass(frozen=True, slots=True)
class PricedItem:
    unit_price: Decimal
    quantity: int


@dataclass(frozen=True, slots=True)
class OrderTotals:
    line_totals: tuple[Decimal, ...]
    total: Decimal
    item_count: int


def line_total(item: PricedItem) -> Decimal:
    return item.unit_price * item.quantity


def compute_totals(items: Sequence[PricedItem]) -> OrderTotals:
    line_totals = tuple(line_total(item) for item in items)
    return OrderTotals(
        line_totals=line_totals,
        total=sum(line_totals, Decimal(0)),
        item_count=sum(item.quantity for item in items),
    )
