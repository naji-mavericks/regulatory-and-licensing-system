import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database.base import Base
from app.database.session import get_db
from app.models import User
from app.main import app

TEST_DATABASE_URL = "sqlite:///./test.db"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    db = TestSessionLocal()
    db.add(User(username="alice", role="operator", full_name="Alice Operator", email="alice@test.com", phone="+65 1111 1111"))
    db.add(User(username="bob", role="officer", full_name="Bob Officer", email="bob@test.com", phone="+65 2222 2222"))
    db.add(User(username="charlie", role="operator", full_name="Charlie Operator", email="charlie@test.com", phone="+65 3333 3333"))
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    return TestClient(app)
