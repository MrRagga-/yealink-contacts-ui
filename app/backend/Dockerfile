FROM python:3.14-slim

ARG APP_VERSION=0.1.0
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /srv/app

COPY --from=ghcr.io/astral-sh/uv:0.11.1 /uv /uvx /bin/

RUN groupadd --system app && useradd --system --gid app --create-home app

COPY app/backend/.python-version /srv/app/.python-version
COPY app/backend/README.md /srv/app/README.md
COPY app/backend/pyproject.toml /srv/app/pyproject.toml
COPY app/backend/uv.lock /srv/app/uv.lock
COPY app/backend/src /srv/app/src
COPY app/backend/alembic.ini /srv/app/alembic.ini
COPY app/backend/alembic /srv/app/alembic

RUN uv sync --locked --no-dev --no-editable

LABEL org.opencontainers.image.title="Yealink Contacts Sync Backend" \
      org.opencontainers.image.version=$APP_VERSION \
      org.opencontainers.image.licenses="Apache-2.0"

USER app
EXPOSE 8000

CMD ["uv", "run", "uvicorn", "yealink_contacts.main:app", "--host", "0.0.0.0", "--port", "8000"]
