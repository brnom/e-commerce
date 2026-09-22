import os

from alembic import context
from sqlalchemy import create_engine

from ecommerce_api.infra.persistence.engine import sync_url


def database_url() -> str:
    configured = context.config.attributes.get('database_url') or os.environ.get('DATABASE_URL')
    if not configured:
        raise SystemExit('Invalid environment configuration: DATABASE_URL')
    return sync_url(configured)


def run_migrations() -> None:
    engine = create_engine(database_url())
    with engine.connect() as connection:
        context.configure(connection=connection, transaction_per_migration=True)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


run_migrations()
