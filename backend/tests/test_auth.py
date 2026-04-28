from uuid import UUID

from jose import jwt

from app.config import settings


def test_login_operator_returns_token(client):
    response = client.post(
        "/auth/login", json={"username": "alice", "role": "operator"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_officer_returns_token(client):
    response = client.post("/auth/login", json={"username": "bob", "role": "officer"})
    assert response.status_code == 200


def test_login_unknown_user_rejected(client):
    response = client.post(
        "/auth/login", json={"username": "nobody", "role": "operator"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "User not found"


def test_token_sub_is_user_id_uuid(client):
    response = client.post(
        "/auth/login", json={"username": "alice", "role": "operator"}
    )
    token = response.json()["access_token"]
    payload = jwt.decode(
        token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
    )
    UUID(payload["sub"])  # must be a valid UUID, not a username string
    assert payload["role"] == "operator"


def test_me_returns_user_profile(client):
    login = client.post("/auth/login", json={"username": "alice", "role": "operator"})
    token = login.json()["access_token"]
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "alice"
    assert data["full_name"] == "Alice Operator"
    assert data["role"] == "operator"


def test_me_rejects_missing_token(client):
    response = client.get("/auth/me")
    assert response.status_code == 403


def test_me_rejects_invalid_token(client):
    response = client.get(
        "/auth/me", headers={"Authorization": "Bearer this.is.not.a.valid.token"}
    )
    assert response.status_code in (401, 403)
