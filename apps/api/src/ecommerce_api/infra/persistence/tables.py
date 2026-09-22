from typing import Any

from sqlalchemy import (
    TIMESTAMP,
    Column,
    ForeignKey,
    Integer,
    MetaData,
    Numeric,
    Table,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import CITEXT, ENUM, JSONB, UUID

metadata = MetaData()


def _timestamp(name: str, *, nullable: bool = False, default_now: bool = False) -> Column[Any]:
    return Column(
        name,
        TIMESTAMP(timezone=True),
        nullable=nullable,
        server_default=func.now() if default_now else None,
    )


def _money(name: str, *, nullable: bool = False) -> Column[Any]:
    return Column(name, Numeric(12, 2), nullable=nullable)


category = Table(
    'Category',
    metadata,
    Column('id', UUID(as_uuid=False), primary_key=True),
    Column('name', CITEXT, nullable=False, unique=True),
    _timestamp('createdAt', default_now=True),
)

product = Table(
    'Product',
    metadata,
    Column('id', UUID(as_uuid=False), primary_key=True),
    Column('sku', Text, nullable=False, unique=True),
    Column('name', Text, nullable=False),
    Column('description', Text),
    _money('price'),
    Column('stock', Integer, nullable=False),
    Column('weightKg', Numeric(8, 3)),
    Column('categoryId', UUID(as_uuid=False), ForeignKey('Category.id', ondelete='SET NULL')),
    _timestamp('deletedAt', nullable=True),
    _timestamp('createdAt', default_now=True),
    _timestamp('updatedAt'),
)

import_job = Table(
    'ImportJob',
    metadata,
    Column('id', UUID(as_uuid=False), primary_key=True),
    Column('fileName', Text, nullable=False),
    Column('totalRows', Integer, nullable=False),
    Column('createdCount', Integer, nullable=False),
    Column('updatedCount', Integer, nullable=False),
    Column('skippedCount', Integer, nullable=False),
    Column('failedCount', Integer, nullable=False),
    Column('rows', JSONB, nullable=False),
    _timestamp('createdAt', default_now=True),
)

order_status = ENUM('pending', 'paid', 'payment_failed', name='OrderStatus', create_type=False)

order = Table(
    'Order',
    metadata,
    Column('id', UUID(as_uuid=False), primary_key=True),
    Column('status', order_status, nullable=False),
    Column('customerName', Text, nullable=False),
    Column('customerEmail', Text, nullable=False),
    _money('total'),
    Column('cardLast4', Text, nullable=False),
    Column('paymentReference', Text),
    Column('declineReason', Text),
    _timestamp('createdAt', default_now=True),
    _timestamp('updatedAt'),
)

order_line = Table(
    'OrderLine',
    metadata,
    Column('id', UUID(as_uuid=False), primary_key=True),
    Column(
        'orderId', UUID(as_uuid=False), ForeignKey('Order.id', ondelete='CASCADE'), nullable=False
    ),
    Column('position', Integer, nullable=False),
    Column('productId', UUID(as_uuid=False), ForeignKey('Product.id'), nullable=False),
    Column('sku', Text, nullable=False),
    Column('name', Text, nullable=False),
    _money('unitPrice'),
    Column('quantity', Integer, nullable=False),
    _money('lineTotal'),
)
