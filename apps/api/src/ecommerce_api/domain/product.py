from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal


@dataclass(frozen=True, slots=True)
class Category:
    id: str
    name: str


@dataclass(frozen=True, slots=True)
class Product:
    id: str
    sku: str
    name: str
    description: str | None
    price: Decimal
    stock: int
    weight_kg: Decimal | None
    category: Category | None
    created_at: datetime
    updated_at: datetime


def normalize_sku(sku: str) -> str:
    return sku.strip().upper()


def normalize_category_name(name: str) -> str:
    return name.strip()
