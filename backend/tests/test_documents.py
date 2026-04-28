import io
from uuid import UUID


def get_operator_token(client, db_session):
    """Helper: login as operator and return auth header."""
    login = client.post("/auth/login", json={"username": "alice", "role": "operator"})
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_upload_document_returns_ai_pass(client, db_session):
    headers = get_operator_token(client, db_session)
    file_content = io.BytesIO(b"fake pdf content")
    response = client.post(
        "/documents/upload",
        files={"file": ("fire_safety_cert.pdf", file_content, "application/pdf")},
        data={"doc_type": "fire_safety"},
        headers=headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["doc_type"] == "fire_safety"
    assert data["filename"] == "fire_safety_cert.pdf"
    assert data["ai_status"] == "pass"
    assert data["ai_details"]["confidence"] == 0.95
    assert "id" in data
    assert "application_id" in data


def test_upload_document_returns_ai_fail(client, db_session):
    headers = get_operator_token(client, db_session)
    file_content = io.BytesIO(b"expired cert")
    response = client.post(
        "/documents/upload",
        files={"file": ("fail-fire_safety.pdf", file_content, "application/pdf")},
        data={"doc_type": "fire_safety"},
        headers=headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["ai_status"] == "fail"
    assert "invalid" in data["ai_details"]["reason"].lower()


def test_upload_rejects_missing_auth(client, db_session):
    file_content = io.BytesIO(b"content")
    response = client.post(
        "/documents/upload",
        files={"file": ("test.pdf", file_content, "application/pdf")},
        data={"doc_type": "fire_safety"},
    )
    assert response.status_code == 403


def test_uploaded_file_saved_to_disk(client, db_session, tmp_path):
    """Document file is written to upload_dir."""
    pass  # tested after upload_dir is configurable


def test_first_upload_creates_application_row(client, db_session):
    headers = get_operator_token(client, db_session)
    file_content = io.BytesIO(b"content")
    response = client.post(
        "/documents/upload",
        files={"file": ("test.pdf", file_content, "application/pdf")},
        data={"doc_type": "fire_safety"},
        headers=headers,
    )
    assert response.status_code == 201
    app_id = response.json()["application_id"]
    UUID(app_id)  # valid UUID
