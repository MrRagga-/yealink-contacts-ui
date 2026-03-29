from __future__ import annotations

import os

os.environ.setdefault("APP_SECRET_KEY", "test-secret-key")
os.environ.setdefault("ENCRYPTION_KEY", "S4aexYnjREGeQkSQIlPCXSQLgXUhY_GfJ1i1n1a34zg=")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_yealink_contacts.db")

import pytest
from fastapi.testclient import TestClient

from yealink_contacts.db.base import Base
from yealink_contacts.db.session import SessionLocal, engine
from yealink_contacts.main import app


@pytest.fixture(autouse=True)
def reset_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client
