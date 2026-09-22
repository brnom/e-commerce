from decimal import Decimal

from ecommerce_api.domain.order import OrderTotals, PricedItem, compute_totals, line_total


def test_multiplies_to_the_cent_without_floating_point_drift() -> None:
    assert line_total(PricedItem(Decimal('19.99'), 3)) == Decimal('59.97')
    assert compute_totals([PricedItem(Decimal('19.99'), 3)]) == OrderTotals(
        line_totals=(Decimal('59.97'),), total=Decimal('59.97'), item_count=3
    )


def test_sums_several_lines_and_counts_every_unit() -> None:
    totals = compute_totals(
        [
            PricedItem(Decimal('0.1'), 3),
            PricedItem(Decimal('0.2'), 1),
            PricedItem(Decimal('1234.56'), 2),
        ]
    )

    assert totals.line_totals == (Decimal('0.3'), Decimal('0.2'), Decimal('2469.12'))
    assert totals.total == Decimal('2469.62')
    assert totals.item_count == 6


def test_accepts_a_zero_priced_line() -> None:
    assert compute_totals([PricedItem(Decimal(0), 5)]) == OrderTotals(
        line_totals=(Decimal(0),), total=Decimal(0), item_count=5
    )
