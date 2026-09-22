import secrets
from dataclasses import dataclass
from typing import Literal

from ecommerce_api.application.ports.order_repository import Approved, Declined
from ecommerce_api.application.ports.payment_gateway import ChargeRequest, ChargeResult


@dataclass(frozen=True, slots=True)
class TestCard:
    id: Literal['approved', 'declined', 'insufficient_funds']
    number: str
    decline_reason: str | None = None


TEST_CARDS = (
    TestCard(id='approved', number='4242424242424242'),
    TestCard(id='declined', number='4000000000000002', decline_reason='Your card was declined'),
    TestCard(
        id='insufficient_funds',
        number='4000000000009995',
        decline_reason='Your card has insufficient funds',
    ),
)

DECLINES = {card.number: card.decline_reason for card in TEST_CARDS if card.decline_reason}


class FakePaymentGateway:
    async def charge(self, request: ChargeRequest) -> ChargeResult:
        reason = DECLINES.get(request.card.card_number)
        if reason is not None:
            return Declined(reason=reason)
        return Approved(reference=f'fake_{secrets.token_hex(8)}')
