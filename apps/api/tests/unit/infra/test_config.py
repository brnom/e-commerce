import pytest

from ecommerce_api.application.ports.config import Config
from ecommerce_api.infra.config import ConfigError, load_config


def test_maps_validated_environment_variables_onto_the_config_port() -> None:
    config = load_config(
        {
            'DATABASE_URL': 'postgresql://app:app@db:5432/app',
            'API_PORT': '4000',
            'WEB_ORIGIN': 'http://web.test',
        }
    )

    assert config == Config(
        port=4000, database_url='postgresql://app:app@db:5432/app', web_origin='http://web.test'
    )


def test_applies_defaults() -> None:
    config = load_config({'DATABASE_URL': 'postgresql://app:app@db:5432/app'})

    assert (config.port, config.web_origin) == (5001, 'http://localhost:3005')


def test_fails_naming_the_missing_variable() -> None:
    with pytest.raises(ConfigError, match='DATABASE_URL'):
        load_config({})


def test_fails_naming_every_malformed_variable() -> None:
    with pytest.raises(ConfigError) as caught:
        load_config({'DATABASE_URL': 'x', 'API_PORT': 'port', 'WEB_ORIGIN': 'not a url'})

    assert str(caught.value) == 'Invalid environment configuration: API_PORT, WEB_ORIGIN'
