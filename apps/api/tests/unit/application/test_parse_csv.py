from pathlib import Path

import pytest

from ecommerce_api.application.imports.parse_csv import parse_csv
from ecommerce_api.domain.errors import InvalidImportFileError

HEADER = 'name,sku,description,category,price,stock,weight_kg\n'

SAMPLE = Path(__file__).resolve().parents[5] / 'data' / 'e-commerce_input.csv'


def parse(text: str) -> object:
    return parse_csv(text.encode())


def test_keeps_commas_inside_quoted_cells() -> None:
    records = parse_csv(
        (
            f'{HEADER}Coffee,CB-010,"Single origin, medium roast, 1kg bag",'
            'Food & Beverage,18.75,500,1.0\n'
        ).encode()
    ).records

    assert len(records) == 1
    assert records[0].cells['description'] == 'Single origin, medium roast, 1kg bag'
    assert records[0].line == 2


def test_matches_headers_case_insensitively_and_ignores_unknown_columns() -> None:
    parsed = parse_csv(b'SKU,Name , Price,Stock,Weight_kg,Supplier\nrs-1,Shoes,1,2,0.5,Acme\n')

    assert parsed.columns == ['sku', 'name', 'price', 'stock', 'weight_kg']
    assert parsed.records[0].cells == {
        'sku': 'rs-1',
        'name': 'Shoes',
        'price': '1',
        'stock': '2',
        'weight_kg': '0.5',
    }
    assert 'description' not in parsed.records[0].cells


def test_tolerates_a_byte_order_mark() -> None:
    parsed = parse_csv(f'﻿{HEADER}A,B,,,1,1,\n'.encode())

    assert parsed.columns[0] == 'name'


def test_lists_every_missing_required_column() -> None:
    with pytest.raises(InvalidImportFileError) as caught:
        parse('name,description,category\nA,B,C\n')

    assert caught.value == InvalidImportFileError(
        'Missing required columns: sku, price, stock', ['sku', 'price', 'stock']
    )


def test_rejects_an_unterminated_quote() -> None:
    with pytest.raises(InvalidImportFileError):
        parse(f'{HEADER}"Shoes,RS-1,,,1,1,\n')


def test_rejects_a_file_without_data_rows() -> None:
    with pytest.raises(InvalidImportFileError) as caught:
        parse(HEADER)

    assert caught.value == InvalidImportFileError('The file has no data rows')
    with pytest.raises(InvalidImportFileError):
        parse('')


def test_rejects_a_file_that_is_not_utf8() -> None:
    with pytest.raises(InvalidImportFileError):
        parse_csv(HEADER.encode() + b'Caf\xe9,CF-1,,,1,1,\n')


def test_keeps_blank_lines_as_blank_records_with_their_line_number() -> None:
    records = parse_csv(f'{HEADER},,,,,,\n\nShoes,RS-1,,,1,1,\n'.encode()).records

    assert [(record.line, record.blank) for record in records] == [
        (2, True),
        (3, True),
        (4, False),
    ]


def test_reads_a_short_line_as_blank_cells() -> None:
    records = parse_csv(f'{HEADER}Shoes,RS-1\n'.encode()).records

    assert records[0].cells['name'] == 'Shoes'
    assert records[0].cells['sku'] == 'RS-1'
    assert records[0].cells['price'] == ''
    assert records[0].cells['stock'] == ''


def test_numbers_a_record_by_the_line_it_starts_on() -> None:
    records = parse_csv(
        f'{HEADER}Shoes,RS-1,"two\nlines",,1,1,\nHat,HT-1,,,1,1,\n'.encode()
    ).records

    assert [record.line for record in records] == [2, 4]


def test_parses_the_sample_file_into_97_records() -> None:
    records = parse_csv(SAMPLE.read_bytes()).records

    assert len(records) == 97
    assert [record.line for record in records if record.blank] == [62, 63]
