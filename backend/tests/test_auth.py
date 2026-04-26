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


def test_invalid_role_rejected(client):
    response = client.post("/auth/login", json={"username": "alice", "role": "admin"})
    assert response.status_code == 422


def test_token_contains_sub_and_role(client):
    response = client.post(
        "/auth/login", json={"username": "alice", "role": "operator"}
    )
    token = response.json()["access_token"]
    payload = jwt.decode(
        token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
    )
    assert payload["sub"] == "alice"
    assert payload["role"] == "operator"


def test_me_returns_current_user(client):
    login = client.post("/auth/login", json={"username": "alice", "role": "operator"})
    token = login.json()["access_token"]
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["sub"] == "alice"
    assert data["role"] == "operator"


def test_me_rejects_missing_token(client):
    response = client.get("/auth/me")
    assert response.status_code == 403


def test_me_rejects_invalid_token(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer bad-token"})
    assert response.status_code == 401
