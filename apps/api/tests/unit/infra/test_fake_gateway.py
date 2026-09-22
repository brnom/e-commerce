import re
from decimal import Decimal

from ecommerce_api.application.ports.order_repository import Approved, Declined
from ecommerce_api.application.ports.payment_gateway import ChargeRequest
from ecommerce_api.application.schemas.order import PaymentCardInput
from ecommerce_api.infra.payments.fake_gateway import FakePaymentGateway

gateway = FakePaymentGateway()


def charge(card_number: str) -> ChargeRequest:
    card = PaymentCardInput.model_validate(
        {
            'cardholderName': 'Ada Lovelace',
            'cardNumber': card_number,
            'expiry': '12/99',
            'cvc': '123',
        }
    )
    return ChargeRequest(order_id='order-1', amount=Decimal('59.97'), card=card)


async def test_approves_any_other_valid_card_with_a_reference() -> None:
    result = await gateway.charge(charge('4242424242424242'))

    assert isinstance(result, Approved)
    assert re.fullmatch(r'fake_[0-9a-f]{16}', result.reference)


async def test_declines_the_generic_decline_card() -> None:
    assert await gateway.charge(charge('4000000000000002')) == Declined(
        reason='Your card was declined'
    )


async def test_declines_the_insufficient_funds_card() -> None:
    assert await gateway.charge(charge('4000 0000 0000 9995')) == Declined(
        reason='Your card has insufficient funds'
    )
