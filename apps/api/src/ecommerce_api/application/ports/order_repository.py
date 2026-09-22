from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal, Protocol

from ecommerce_api.domain.order import Order, OrderCustomer, OrderSummary


@dataclass(frozen=True, slots=True)
class OrderItemRequest:
    product_id: str
    quantity: int


@dataclass(frozen=True, slots=True)
class OrderDraft:
    customer: OrderCustomer
    card_last4: str
    items: Sequence[OrderItemRequest]


@dataclass(frozen=True, slots=True)
class Approved:
    reference: str
    outcome: Literal['approved'] = 'approved'


@dataclass(frozen=True, slots=True)
class Declined:
    reason: str
    outcome: Literal['declined'] = 'declined'


Settlement = Approved | Declined


class OrderRepository(Protocol):
    async def reserve(self, draft: OrderDraft) -> Order: ...

    async def settle(self, order_id: str, settlement: Settlement) -> Order: ...

    async def find_by_id(self, id: str) -> Order | None: ...

    async def find_all(self) -> list[OrderSummary]: ...
