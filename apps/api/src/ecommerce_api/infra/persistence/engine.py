import uuid
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

DRIVER_SCHEME = 'postgresql+psycopg'

UNSUPPORTED_QUERY_OPTIONS = frozenset({'schema'})


def sync_url(database_url: str) -> str:
    parts = urlsplit(database_url)
    query = [
        (key, value)
        for key, value in parse_qsl(parts.query)
        if key not in UNSUPPORTED_QUERY_OPTIONS
    ]
    return urlunsplit(parts._replace(scheme=DRIVER_SCHEME, query=urlencode(query)))


def create_engine(database_url: str) -> AsyncEngine:
    return create_async_engine(sync_url(database_url), pool_pre_ping=True)


def new_id() -> str:
    return str(uuid.uuid7())
