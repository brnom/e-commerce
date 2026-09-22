from httpx import ASGITransport, AsyncClient

from ecommerce_api.application.ports.config import Config
from ecommerce_api.infra.http.app import create_app


async def test_reports_ok_when_the_database_responds(api: AsyncClient) -> None:
    response = await api.get('/health')

    assert response.status_code == 200
    assert response.json() == {
        'status': 'ok',
        'info': {'database': {'status': 'up'}},
        'error': {},
        'details': {'database': {'status': 'up'}},
    }


async def test_reports_error_with_503_when_the_database_is_unreachable() -> None:
    unreachable = 'postgresql://app:app@127.0.0.1:1/ecommerce'
    app = create_app(Config(port=0, database_url=unreachable, web_origin='http://localhost:3005'))
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        response = await client.get('/health')

    assert response.status_code == 503
    assert response.json()['status'] == 'error'
    assert response.json()['error']['database']['status'] == 'down'
