import os
import sys

import uvicorn

from ecommerce_api.infra.config import ConfigError, load_config
from ecommerce_api.infra.http.app import create_app

HOST = '0.0.0.0'


def app_from_environment() -> object:
    return create_app(load_config(os.environ))


def main(arguments: list[str]) -> int:
    try:
        config = load_config(os.environ)
    except ConfigError as error:
        print(error, file=sys.stderr)
        return 1
    if '--reload' in arguments:
        uvicorn.run(
            'ecommerce_api.__main__:app_from_environment',
            factory=True,
            host=HOST,
            port=config.port,
            reload=True,
            reload_dirs=[os.path.dirname(__file__)],
        )
    else:
        uvicorn.run(create_app(config), host=HOST, port=config.port)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
