def get_operator_token(client, db_session):
    login = client.post("/auth/login", json={"username": "alice", "role": "operator"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def upload_doc(client, headers, filename, doc_type):
    """Helper: upload a document and return the response data."""
    import io
    response = client.post(
        "/documents/upload",
        files={"file": (filename, io.BytesIO(b"content"), "application/pdf")},
        data={"doc_type": doc_type},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_submit_application_creates_submission(client, db_session):
    headers = get_operator_token(client, db_session)
    doc1 = upload_doc(client, headers, "staff_cert.pdf", "staff_qualification")
    doc2 = upload_doc(client, headers, "fire_safety.pdf", "fire_safety")
    doc3 = upload_doc(client, headers, "floor_plan.pdf", "floor_plan")
    app_id = doc1["application_id"]

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
    doc2 = upload_doc(client, headers, "fire_safety.pdf", "fire_safety")
    doc3 = upload_doc(client, headers, "floor_plan.pdf", "floor_plan")

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
    login = client.post("/auth/login", json={"username": "bob", "role": "officer"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post("/applications", json={}, headers=headers)
    assert response.status_code == 403


def test_list_applications_returns_only_own(client, db_session):
    """Operator only sees their own applications."""
    headers = get_operator_token(client, db_session)
    doc1 = upload_doc(client, headers, "staff_cert.pdf", "staff_qualification")
    doc2 = upload_doc(client, headers, "fire_safety.pdf", "fire_safety")
    doc3 = upload_doc(client, headers, "floor_plan.pdf", "floor_plan")

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
