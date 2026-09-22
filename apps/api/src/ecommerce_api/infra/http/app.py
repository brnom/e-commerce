from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from ecommerce_api.application.ports.config import Config
from ecommerce_api.application.ports.payment_gateway import PaymentGateway
from ecommerce_api.infra.http.container import build_container
from ecommerce_api.infra.http.errors import register_error_handlers
from ecommerce_api.infra.http.routes import health, imports, orders, products

UNUSED_FASTAPI_SCHEMAS = ('HTTPValidationError', 'ValidationError')


class EcommerceApi(FastAPI):
    def openapi(self) -> dict[str, Any]:
        if self.openapi_schema is None:
            document = get_openapi(
                title=self.title,
                version=self.version,
                description=self.description,
                routes=self.routes,
            )
            for operations in document['paths'].values():
                for operation in operations.values():
                    operation.get('responses', {}).pop('422', None)
            schemas = document.get('components', {}).get('schemas', {})
            for name in UNUSED_FASTAPI_SCHEMAS:
                schemas.pop(name, None)
            self.openapi_schema = document
        return self.openapi_schema


def create_app(config: Config, payments: PaymentGateway | None = None) -> FastAPI:
    services = build_container(config, payments)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        await services.engine.dispose()

    app = EcommerceApi(
        title='E-commerce API',
        version='1.0.0',
        description='Product catalog, CSV import and orders with a simulated payment provider.',
        docs_url='/docs',
        openapi_url='/docs/json',
        redoc_url=None,
        separate_input_output_schemas=False,
        lifespan=lifespan,
    )
    app.state.container = services
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[config.web_origin],
        allow_methods=['*'],
        allow_headers=['*'],
    )
    register_error_handlers(app)
    for module in (health, products, imports, orders):
        app.include_router(module.router)
    return app
