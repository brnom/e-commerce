FROM ghcr.io/astral-sh/uv:0.12 AS uv

FROM python:3.14-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app

FROM base AS build
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv
COPY apps/api/pyproject.toml apps/api/uv.lock apps/api/.python-version ./
RUN uv sync --locked --no-dev --no-install-project
COPY apps/api/src ./src
RUN uv sync --locked --no-dev --no-editable

FROM base AS runtime
RUN useradd --system --uid 10001 --no-create-home app
COPY --from=build /app/.venv /app/.venv
COPY apps/api/alembic.ini ./
COPY apps/api/migrations ./migrations
ENV PATH="/app/.venv/bin:$PATH"
ARG API_PORT=5001
EXPOSE $API_PORT
USER app
CMD ["sh", "-c", "alembic upgrade head && exec python -m ecommerce_api"]
