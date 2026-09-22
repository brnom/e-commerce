from collections.abc import Mapping
from typing import Annotated
from urllib.parse import urlsplit

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, ValidationError

from ecommerce_api.application.ports.config import Config


class ConfigError(Exception):
    pass


def http_url(value: str) -> str:
    parts = urlsplit(value)
    if parts.scheme not in {'http', 'https'} or not parts.netloc:
        raise ValueError('must be an http or https URL')
    return value


class Environment(BaseModel):
    model_config = ConfigDict(extra='ignore', frozen=True)

    DATABASE_URL: Annotated[str, Field(min_length=1)]
    API_PORT: Annotated[int, Field(gt=0)] = 5001
    WEB_ORIGIN: Annotated[str, AfterValidator(http_url)] = 'http://localhost:3005'


def load_config(environ: Mapping[str, str]) -> Config:
    try:
        environment = Environment.model_validate(dict(environ))
    except ValidationError as error:
        names = dict.fromkeys(str(detail['loc'][0]) for detail in error.errors())
        raise ConfigError(f'Invalid environment configuration: {", ".join(names)}') from error
    return Config(
        port=environment.API_PORT,
        database_url=environment.DATABASE_URL,
        web_origin=environment.WEB_ORIGIN,
    )
