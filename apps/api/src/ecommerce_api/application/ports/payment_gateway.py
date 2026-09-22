from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from ecommerce_api.application.ports.order_repository import Settlement
from ecommerce_api.application.schemas.order import PaymentCardInput


@dataclass(frozen=True, slots=True)
class ChargeRequest:
    order_id: str
    amount: Decimal
    card: PaymentCardInput


ChargeResult = Settlement


class PaymentGateway(Protocol):
    async def charge(self, request: ChargeRequest) -> ChargeResult: ...
