FROM python:3.14-slim

ARG APP_VERSION=0.1.0
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv/app

RUN groupadd --system app && useradd --system --gid app --create-home app

COPY app/backend/pyproject.toml /srv/app/pyproject.toml
COPY app/backend/src /srv/app/src
COPY app/backend/alembic.ini /srv/app/alembic.ini
COPY app/backend/alembic /srv/app/alembic

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

LABEL org.opencontainers.image.title="Yealink Contacts Sync Backend" \
      org.opencontainers.image.version=$APP_VERSION \
      org.opencontainers.image.licenses="Apache-2.0"

USER app
EXPOSE 8000

CMD ["uvicorn", "yealink_contacts.main:app", "--host", "0.0.0.0", "--port", "8000"]
