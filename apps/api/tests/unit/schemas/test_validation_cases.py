import json
from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from typing import Any, cast

import pytest
from pydantic import BaseModel, ValidationError

from ecommerce_api.application.schemas.import_row import ImportCells, validate_import_row
from ecommerce_api.application.schemas.order import PlaceOrderInput
from ecommerce_api.application.schemas.product import CreateProductInput
from ecommerce_api.application.schemas.rules import issues_of

CASES_DIRECTORY = Path(__file__).resolve().parents[5] / 'packages' / 'shared' / 'validation-cases'

Validator = Callable[[dict[str, Any], dict[str, Any]], BaseModel]


def deep_merge(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key, value in patch.items():
        current = merged.get(key)
        merged[key] = (
            deep_merge(current, value)
            if isinstance(current, dict) and isinstance(value, dict)
            else value
        )
    return merged


def validate_product(data: dict[str, Any], _: dict[str, Any]) -> BaseModel:
    return CreateProductInput.model_validate(data)


def validate_row(data: dict[str, Any], _: dict[str, Any]) -> BaseModel:
    return validate_import_row(cast(ImportCells, data))


def validate_order(data: dict[str, Any], case: dict[str, Any]) -> BaseModel:
    now = datetime.fromisoformat(case['now']) if 'now' in case else datetime.now()
    return PlaceOrderInput.model_validate(data, context={'now': lambda: now})


SUITES: dict[str, Validator] = {
    'product.json': validate_product,
    'import-row.json': validate_row,
    'order.json': validate_order,
}


def load_cases() -> list[Any]:
    parameters = []
    for file, validator in SUITES.items():
        content = json.loads((CASES_DIRECTORY / file).read_text(encoding='utf-8'))
        for case in content['cases']:
            data = case.get('input') or deep_merge(content['base'], case.get('patch', {}))
            parameters.append(pytest.param(validator, data, case, id=f'{file}: {case["name"]}'))
    return parameters


@pytest.mark.parametrize(('validator', 'data', 'case'), load_cases())
def test_matches_the_shared_validation_case(
    validator: Validator, data: dict[str, Any], case: dict[str, Any]
) -> None:
    try:
        validator(data, case)
        issues: list[dict[str, str]] = []
    except ValidationError as error:
        issues = [{'path': i.path, 'message': i.message} for i in issues_of(error)]

    assert issues == case['issues']
