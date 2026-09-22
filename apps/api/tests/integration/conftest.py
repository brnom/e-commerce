import os
from collections.abc import AsyncIterator
from urllib.parse import urlsplit, urlunsplit

import psycopg
import pytest
from alembic import command
from alembic.config import Config as AlembicConfig
from httpx import ASGITransport, AsyncClient
from psycopg import sql
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from ecommerce_api.application.ports.config import Config
from ecommerce_api.infra.http.app import create_app
from ecommerce_api.infra.persistence.engine import create_engine

API_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

TABLES = ('"OrderLine"', '"Order"', '"Product"', '"Category"', '"ImportJob"')


def test_database_url() -> str:
    return os.environ.get('TEST_DATABASE_URL', 'postgresql://app:app@localhost:5432/ecommerce_test')


def recreate_database(url: str) -> None:
    parts = urlsplit(url)
    name = sql.Identifier(parts.path.lstrip('/'))
    maintenance = urlunsplit(parts._replace(path='/postgres', query=''))
    with psycopg.connect(maintenance, autocommit=True) as connection:
        connection.execute(sql.SQL('DROP DATABASE IF EXISTS {} WITH (FORCE)').format(name))
        connection.execute(sql.SQL('CREATE DATABASE {}').format(name))


def migrate(url: str) -> None:
    config = AlembicConfig(os.path.join(API_ROOT, 'alembic.ini'))
    config.attributes['database_url'] = url
    command.upgrade(config, 'head')


@pytest.fixture(scope='session')
def database_url() -> str:
    url = test_database_url()
    recreate_database(url)
    migrate(url)
    return url


@pytest.fixture(scope='session')
async def engine(database_url: str) -> AsyncIterator[AsyncEngine]:
    engine = create_engine(database_url)
    yield engine
    await engine.dispose()


@pytest.fixture(autouse=True)
async def reset_database(engine: AsyncEngine) -> None:
    async with engine.begin() as connection:
        await connection.execute(text(f'TRUNCATE TABLE {", ".join(TABLES)} CASCADE'))


@pytest.fixture
async def api(database_url: str) -> AsyncIterator[AsyncClient]:
    app = create_app(Config(port=0, database_url=database_url, web_origin='http://localhost:3005'))
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        yield client
    await app.state.container.engine.dispose()
