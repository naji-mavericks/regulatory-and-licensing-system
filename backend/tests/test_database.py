def test_base_has_metadata():
    from app.database.base import Base

    assert hasattr(Base, "metadata")


def test_get_db_is_callable():
    from app.database.session import get_db

    assert callable(get_db)


def test_session_local_exists():
    from app.database.session import SessionLocal

    assert SessionLocal is not None
