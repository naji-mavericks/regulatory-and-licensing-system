import io
import uuid

from app.models import Application


def get_operator_token(client, db_session):
    login = client.post("/auth/login", json={"username": "alice"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def upload_doc(client, headers, filename, doc_type, application_id=None):
    """Helper: upload a document and return the response data."""
    data = {"doc_type": doc_type}
    if application_id:
        data["application_id"] = application_id
    response = client.post(
        "/documents/upload",
        files={
            "file": (filename, io.BytesIO(b"content"), "application/pdf")
        },
        data=data,
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def _set_app_status(db_session, app_id: str, status: str):
    """Helper: directly set an application's status in the DB."""
    app = db_session.query(Application).filter(
        Application.id == uuid.UUID(app_id)
    ).first()
    app.status = status
    db_session.commit()


def test_submit_application_creates_submission(client, db_session):
    headers = get_operator_token(client, db_session)
    doc1 = upload_doc(client, headers, "staff_cert.pdf", "staff_qualification")
    app_id = doc1["application_id"]
    doc2 = upload_doc(client, headers, "fire_safety.pdf", "fire_safety", app_id)
    doc3 = upload_doc(client, headers, "floor_plan.pdf", "floor_plan", app_id)

    form_data = {
        "basic_details": {
            "centre_name": "Sunshine Childcare",
            "operator_company_name": "EduCare Pte Ltd",
            "uen": "2024XXXXXX",
            "contact_person": "Jane Tan",
            "contact_email": "jane@educare.sg",
            "contact_phone": "+65 9123 4567",
        },
        "operations": {
            "centre_address": "123 Jurong East St 21",
            "type_of_service": "Childcare",
            "proposed_capacity": 50,
        },
        "declarations": {
            "compliance_confirmed": True,
        },
    }

    response = client.post(
        "/applications",
        json={
            "application_id": app_id,
            "form_data": form_data,
            "document_ids": [doc1["id"], doc2["id"], doc3["id"]],
        },
        headers=headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "Submitted"  # operator-facing label
    assert data["round_number"] == 1
    assert data["latest_submission"]["form_data"] == form_data
    assert len(data["latest_submission"]["documents"]) == 3


def test_submit_rejects_missing_doc_type(client, db_session):
    headers = get_operator_token(client, db_session)
    doc1 = upload_doc(client, headers, "staff_cert.pdf", "staff_qualification")
    # missing fire_safety and floor_plan

    response = client.post(
        "/applications",
        json={
            "application_id": doc1["application_id"],
            "form_data": {
                "basic_details": {"centre_name": "Test"},
                "operations": {
                    "centre_address": "Addr",
                    "type_of_service": "Childcare",
                    "proposed_capacity": 10,
                },
                "declarations": {"compliance_confirmed": True},
            },
            "document_ids": [doc1["id"]],
        },
        headers=headers,
    )
    assert response.status_code == 400
    assert "required" in response.json()["detail"].lower()


def test_submit_rejects_missing_fields(client, db_session):
    headers = get_operator_token(client, db_session)
    doc1 = upload_doc(client, headers, "staff_cert.pdf", "staff_qualification")
    app_id = doc1["application_id"]
    doc2 = upload_doc(client, headers, "fire_safety.pdf", "fire_safety", app_id)
    doc3 = upload_doc(client, headers, "floor_plan.pdf", "floor_plan", app_id)

    response = client.post(
        "/applications",
        json={
            "application_id": doc1["application_id"],
            "form_data": {
                "basic_details": {"centre_name": ""},  # incomplete
                "operations": {},
                "declarations": {"compliance_confirmed": False},
            },
            "document_ids": [doc1["id"], doc2["id"], doc3["id"]],
        },
        headers=headers,
    )
    assert response.status_code == 400


def test_submit_requires_operator_role(client, db_session):
    login = client.post("/auth/login", json={"username": "bob"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post("/applications", json={}, headers=headers)
    assert response.status_code == 403


def test_list_applications_returns_only_own(client, db_session):
    """Operator only sees their own applications."""
    headers = get_operator_token(client, db_session)
    doc1 = upload_doc(client, headers, "staff_cert.pdf", "staff_qualification")
    app_id = doc1["application_id"]
    doc2 = upload_doc(client, headers, "fire_safety.pdf", "fire_safety", app_id)
    doc3 = upload_doc(client, headers, "floor_plan.pdf", "floor_plan", app_id)

    client.post(
        "/applications",
        json={
            "application_id": doc1["application_id"],
            "form_data": {
                "basic_details": {
                    "centre_name": "Test",
                    "operator_company_name": "Co",
                    "uen": "123",
                    "contact_person": "A",
                    "contact_email": "a@b.com",
                    "contact_phone": "123",
                },
                "operations": {
                    "centre_address": "Addr",
                    "type_of_service": "Childcare",
                    "proposed_capacity": 10,
                },
                "declarations": {"compliance_confirmed": True},
            },
            "document_ids": [doc1["id"], doc2["id"], doc3["id"]],
        },
        headers=headers,
    )

    response = client.get("/applications", headers=headers)
    assert response.status_code == 200
    apps = response.json()
    assert len(apps) >= 1
    for app in apps:
        assert app["centre_name"] == "Test"


def test_get_application_returns_operator_label(client, db_session):
    """After submit, GET returns operator-facing status."""
    headers = get_operator_token(client, db_session)
    doc1 = upload_doc(client, headers, "staff_cert.pdf", "staff_qualification")
    app_id = doc1["application_id"]
    doc2 = upload_doc(client, headers, "fire_safety.pdf", "fire_safety", app_id)
    doc3 = upload_doc(client, headers, "floor_plan.pdf", "floor_plan", app_id)

    client.post(
        "/applications",
        json={
            "application_id": app_id,
            "form_data": _make_form(),
            "document_ids": [doc1["id"], doc2["id"], doc3["id"]],
        },
        headers=headers,
    )

    response = client.get(f"/applications/{app_id}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "Submitted"
    assert data["current_round"] == 1
    assert "latest_submission" in data
    assert data["latest_submission"]["form_data"] is not None


def test_get_application_blocks_other_operator(client, db_session):
    """Operator A cannot see Operator B's application."""
    headers_a = get_operator_token(client, db_session)  # alice
    doc1 = upload_doc(client, headers_a, "staff_cert.pdf", "staff_qualification")
    app_id = doc1["application_id"]
    doc2 = upload_doc(client, headers_a, "fire_safety.pdf", "fire_safety", app_id)
    doc3 = upload_doc(client, headers_a, "floor_plan.pdf", "floor_plan", app_id)

    submit_resp = client.post(
        "/applications",
        json={
            "application_id": app_id,
            "form_data": _make_form(),
            "document_ids": [doc1["id"], doc2["id"], doc3["id"]],
        },
        headers=headers_a,
    )
    app_id = submit_resp.json()["id"]

    # Login as charlie (second operator) and try to access alice's application
    login = client.post("/auth/login", json={"username": "charlie"})
    headers_c = {"Authorization": f"Bearer {login.json()['access_token']}"}

    # Charlie should get 404 when trying to access alice's application
    response = client.get(f"/applications/{app_id}", headers=headers_c)
    assert response.status_code == 404


def test_get_submission_history(client, db_session):
    headers = get_operator_token(client, db_session)
    doc1 = upload_doc(client, headers, "staff_cert.pdf", "staff_qualification")
    app_id = doc1["application_id"]
    doc2 = upload_doc(client, headers, "fire_safety.pdf", "fire_safety", app_id)
    doc3 = upload_doc(client, headers, "floor_plan.pdf", "floor_plan", app_id)

    client.post(
        "/applications",
        json={
            "application_id": app_id,
            "form_data": _make_form(),
            "document_ids": [doc1["id"], doc2["id"], doc3["id"]],
        },
        headers=headers,
    )

    response = client.get(f"/applications/{app_id}/submissions", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["round_number"] == 1
    assert data[0]["form_data"] is not None
    assert len(data[0]["documents"]) == 3


def _make_form(centre_name="Test"):
    return {
        "basic_details": {
            "centre_name": centre_name,
            "operator_company_name": "Co",
            "uen": "123",
            "contact_person": "A",
            "contact_email": "a@b.com",
            "contact_phone": "123",
        },
        "operations": {
            "centre_address": "Addr",
            "type_of_service": "Childcare",
            "proposed_capacity": 10,
        },
        "declarations": {"compliance_confirmed": True},
    }


def test_resubmit_creates_new_round(client, db_session):
    headers = get_operator_token(client, db_session)
    doc1 = upload_doc(client, headers, "staff_cert.pdf", "staff_qualification")
    app_id = doc1["application_id"]
    doc2 = upload_doc(client, headers, "fire_safety.pdf", "fire_safety", app_id)
    doc3 = upload_doc(client, headers, "floor_plan.pdf", "floor_plan", app_id)

    client.post(
        "/applications",
        json={
            "application_id": app_id,
            "form_data": _make_form("Sunshine"),
            "document_ids": [doc1["id"], doc2["id"], doc3["id"]],
        },
        headers=headers,
    )
    _set_app_status(db_session, app_id, "Pending Pre-Site Resubmission")

    new_doc = upload_doc(
        client, headers, "new_fire_safety.pdf", "fire_safety", app_id
    )
    response = client.post(
        f"/applications/{app_id}/resubmit",
        json={
            "form_data": {"basic_details": {"centre_name": "New Name"}},
            "document_ids": [new_doc["id"]],
        },
        headers=headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "Pre-Site Resubmitted"
    assert data["round_number"] == 2

    detail = client.get(f"/applications/{app_id}", headers=headers)
    form = detail.json()["latest_submission"]["form_data"]
    assert form["basic_details"]["centre_name"] == "New Name"
    assert form["basic_details"]["uen"] == "123"

    history = client.get(
        f"/applications/{app_id}/submissions", headers=headers
    )
    assert len(history.json()) == 2


def test_resubmit_carries_forward_unflagged_docs(client, db_session):
    headers = get_operator_token(client, db_session)
    doc1 = upload_doc(client, headers, "staff_cert.pdf", "staff_qualification")
    app_id = doc1["application_id"]
    doc2 = upload_doc(client, headers, "fire_safety.pdf", "fire_safety", app_id)
    doc3 = upload_doc(client, headers, "floor_plan.pdf", "floor_plan", app_id)

    client.post(
        "/applications",
        json={
            "application_id": app_id,
            "form_data": _make_form(),
            "document_ids": [doc1["id"], doc2["id"], doc3["id"]],
        },
        headers=headers,
    )
    _set_app_status(db_session, app_id, "Pending Pre-Site Resubmission")

    new_fire = upload_doc(
        client, headers, "new_fire_safety.pdf", "fire_safety", app_id
    )
    client.post(
        f"/applications/{app_id}/resubmit",
        json={"form_data": {}, "document_ids": [new_fire["id"]]},
        headers=headers,
    )

    history = client.get(
        f"/applications/{app_id}/submissions", headers=headers
    )
    rounds = history.json()
    round2_docs = rounds[1]["documents"]
    assert len(round2_docs) == 3
    doc_types = {d["doc_type"] for d in round2_docs}
    assert doc_types == {"staff_qualification", "fire_safety", "floor_plan"}
    fire_doc = [
        d for d in round2_docs if d["doc_type"] == "fire_safety"
    ][0]
    assert fire_doc["filename"] == "new_fire_safety.pdf"


def get_officer_token(client):
    login = client.post("/auth/login", json={"username": "bob"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _submit_app(client, headers, centre_name="Test Centre"):
    """Upload 3 required docs and submit; return application id."""
    doc1 = upload_doc(client, headers, "staff_cert.pdf", "staff_qualification")
    app_id = doc1["application_id"]
    doc2 = upload_doc(client, headers, "fire_safety.pdf", "fire_safety", app_id)
    doc3 = upload_doc(client, headers, "floor_plan.pdf", "floor_plan", app_id)
    resp = client.post(
        "/applications",
        json={
            "application_id": app_id,
            "form_data": _make_form(centre_name),
            "document_ids": [doc1["id"], doc2["id"], doc3["id"]],
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def test_list_applications_officer_sees_all(client, db_session):
    headers_alice = get_operator_token(client, db_session)
    _submit_app(client, headers_alice)
    headers_bob = get_officer_token(client)
    response = client.get("/applications", headers=headers_bob)
    assert response.status_code == 200
    apps = response.json()
    assert len(apps) >= 1
    assert "operator_name" in apps[0]


def test_list_applications_officer_status_filter_match(client, db_session):
    headers_alice = get_operator_token(client, db_session)
    _submit_app(client, headers_alice)
    headers_bob = get_officer_token(client)
    response = client.get("/applications?status=Application Received", headers=headers_bob)
    assert response.status_code == 200
    assert len(response.json()) >= 1


def test_list_applications_officer_status_filter_no_match(client, db_session):
    headers_alice = get_operator_token(client, db_session)
    _submit_app(client, headers_alice)
    headers_bob = get_officer_token(client)
    response = client.get("/applications?status=Approved", headers=headers_bob)
    assert response.status_code == 200
    assert response.json() == []


def test_get_application_officer_returns_full_audit_trail(client, db_session):
    headers_alice = get_operator_token(client, db_session)
    app_id = _submit_app(client, headers_alice)
    headers_bob = get_officer_token(client)
    response = client.get(f"/applications/{app_id}", headers=headers_bob)
    assert response.status_code == 200
    data = response.json()
    assert "submissions" in data
    assert len(data["submissions"]) == 1
    assert data["submissions"][0]["round_number"] == 1
    assert "form_data" in data["submissions"][0]
    assert "documents" in data["submissions"][0]
    assert "feedback_items" in data["submissions"][0]


def test_get_application_officer_includes_operator_block(client, db_session):
    headers_alice = get_operator_token(client, db_session)
    app_id = _submit_app(client, headers_alice)
    headers_bob = get_officer_token(client)
    response = client.get(f"/applications/{app_id}", headers=headers_bob)
    assert response.status_code == 200
    data = response.json()
    assert "operator" in data
    assert data["operator"]["full_name"] == "Alice Operator"
    assert data["operator"]["email"] == "alice@test.com"


def test_get_application_officer_not_filtered_by_ownership(client, db_session):
    """Officer can access any application regardless of operator."""
    headers_alice = get_operator_token(client, db_session)
    app_id = _submit_app(client, headers_alice)
    # Charlie (another operator) cannot see it, but bob (officer) can
    headers_bob = get_officer_token(client)
    response = client.get(f"/applications/{app_id}", headers=headers_bob)
    assert response.status_code == 200


def test_feedback_happy_path_creates_items_and_transitions(client, db_session):
    headers_alice = get_operator_token(client, db_session)
    app_id = _submit_app(client, headers_alice)
    # Transition to Under Review first (valid from Application Received)
    _set_app_status(db_session, app_id, "Under Review")
    headers_bob = get_officer_token(client)

    response = client.post(
        f"/applications/{app_id}/feedback",
        json={
            "feedback_items": [
                {
                    "target_type": "field",
                    "section": "basic_details",
                    "field_key": "uen",
                    "document_id": None,
                    "comment": "Please provide correct UEN.",
                }
            ],
            "new_status": "Pending Pre-Site Resubmission",
        },
        headers=headers_bob,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "Pending Pre-Site Resubmission"
    assert len(data["feedback_items"]) == 1
    assert data["feedback_items"][0]["field_key"] == "uen"
    assert data["feedback_items"][0]["created_by"] == "bob"

    # Verify application status updated
    detail = client.get(f"/applications/{app_id}", headers=headers_bob)
    assert detail.json()["status"] == "Pending Pre-Site Resubmission"


def test_feedback_empty_items_returns_400(client, db_session):
    headers_alice = get_operator_token(client, db_session)
    app_id = _submit_app(client, headers_alice)
    _set_app_status(db_session, app_id, "Under Review")
    headers_bob = get_officer_token(client)

    response = client.post(
        f"/applications/{app_id}/feedback",
        json={"feedback_items": [], "new_status": "Pending Pre-Site Resubmission"},
        headers=headers_bob,
    )
    assert response.status_code == 400


def test_feedback_invalid_transition_returns_409(client, db_session):
    headers_alice = get_operator_token(client, db_session)
    app_id = _submit_app(client, headers_alice)
    headers_bob = get_officer_token(client)

    response = client.post(
        f"/applications/{app_id}/feedback",
        json={
            "feedback_items": [
                {"target_type": "field", "section": "basic_details",
                 "field_key": "uen", "document_id": None, "comment": "Fix UEN."}
            ],
            "new_status": "Approved",  # invalid from "Application Received"
        },
        headers=headers_bob,
    )
    assert response.status_code == 409
    assert "Invalid status transition" in response.json()["detail"]


def test_feedback_requires_officer_role(client, db_session):
    headers_alice = get_operator_token(client, db_session)
    app_id = _submit_app(client, headers_alice)

    response = client.post(
        f"/applications/{app_id}/feedback",
        json={"feedback_items": [], "new_status": "Under Review"},
        headers=headers_alice,
    )
    assert response.status_code == 403
