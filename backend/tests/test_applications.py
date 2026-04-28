def get_operator_token(client, db_session):
    login = client.post("/auth/login", json={"username": "alice", "role": "operator"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def upload_doc(client, headers, filename, doc_type, application_id=None):
    """Helper: upload a document and return the response data."""
    import io
    data = {"doc_type": doc_type}
    if application_id:
        data["application_id"] = application_id
    response = client.post(
        "/documents/upload",
        files={"file": (filename, io.BytesIO(b"content"), "application/pdf")},
        data=data,
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


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
    login = client.post("/auth/login", json={"username": "bob", "role": "officer"})
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
            "form_data": {
                "basic_details": {"centre_name": "Test", "operator_company_name": "Co", "uen": "123", "contact_person": "A", "contact_email": "a@b.com", "contact_phone": "123"},
                "operations": {"centre_address": "Addr", "type_of_service": "Childcare", "proposed_capacity": 10},
                "declarations": {"compliance_confirmed": True},
            },
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
            "form_data": {
                "basic_details": {"centre_name": "Test", "operator_company_name": "Co", "uen": "123", "contact_person": "A", "contact_email": "a@b.com", "contact_phone": "123"},
                "operations": {"centre_address": "Addr", "type_of_service": "Childcare", "proposed_capacity": 10},
                "declarations": {"compliance_confirmed": True},
            },
            "document_ids": [doc1["id"], doc2["id"], doc3["id"]],
        },
        headers=headers_a,
    )
    app_id = submit_resp.json()["id"]

    # Login as charlie (second operator) and try to access alice's application
    login = client.post("/auth/login", json={"username": "charlie", "role": "operator"})
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
            "form_data": {
                "basic_details": {"centre_name": "Test", "operator_company_name": "Co", "uen": "123", "contact_person": "A", "contact_email": "a@b.com", "contact_phone": "123"},
                "operations": {"centre_address": "Addr", "type_of_service": "Childcare", "proposed_capacity": 10},
                "declarations": {"compliance_confirmed": True},
            },
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


def test_resubmit_creates_new_round(client, db_session):
    headers = get_operator_token(client, db_session)
    doc1 = upload_doc(client, headers, "staff_cert.pdf", "staff_qualification")
    app_id = doc1["application_id"]
    doc2 = upload_doc(client, headers, "fire_safety.pdf", "fire_safety", app_id)
    doc3 = upload_doc(client, headers, "floor_plan.pdf", "floor_plan", app_id)

    form_data = {
        "basic_details": {"centre_name": "Sunshine", "operator_company_name": "Co", "uen": "123", "contact_person": "A", "contact_email": "a@b.com", "contact_phone": "123"},
        "operations": {"centre_address": "Addr", "type_of_service": "Childcare", "proposed_capacity": 10},
        "declarations": {"compliance_confirmed": True},
    }
    client.post(
        "/applications",
        json={"application_id": app_id, "form_data": form_data, "document_ids": [doc1["id"], doc2["id"], doc3["id"]]},
        headers=headers,
    )

    # Simulate resubmit with changed centre_name
    new_doc = upload_doc(client, headers, "new_fire_safety.pdf", "fire_safety", app_id)
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

    # Verify merged form_data
    detail = client.get(f"/applications/{app_id}", headers=headers)
    form = detail.json()["latest_submission"]["form_data"]
    assert form["basic_details"]["centre_name"] == "New Name"  # updated
    assert form["basic_details"]["uen"] == "123"  # carried forward

    # Verify history has 2 rounds
    history = client.get(f"/applications/{app_id}/submissions", headers=headers)
    assert len(history.json()) == 2


def test_resubmit_carries_forward_unflagged_docs(client, db_session):
    headers = get_operator_token(client, db_session)
    doc1 = upload_doc(client, headers, "staff_cert.pdf", "staff_qualification")
    app_id = doc1["application_id"]
    doc2 = upload_doc(client, headers, "fire_safety.pdf", "fire_safety", app_id)
    doc3 = upload_doc(client, headers, "floor_plan.pdf", "floor_plan", app_id)

    form_data = {
        "basic_details": {"centre_name": "Test", "operator_company_name": "Co", "uen": "123", "contact_person": "A", "contact_email": "a@b.com", "contact_phone": "123"},
        "operations": {"centre_address": "Addr", "type_of_service": "Childcare", "proposed_capacity": 10},
        "declarations": {"compliance_confirmed": True},
    }
    client.post(
        "/applications",
        json={"application_id": app_id, "form_data": form_data, "document_ids": [doc1["id"], doc2["id"], doc3["id"]]},
        headers=headers,
    )

    # Resubmit replacing only fire_safety
    new_fire = upload_doc(client, headers, "new_fire_safety.pdf", "fire_safety", app_id)
    client.post(
        f"/applications/{app_id}/resubmit",
        json={"form_data": {}, "document_ids": [new_fire["id"]]},
        headers=headers,
    )

    history = client.get(f"/applications/{app_id}/submissions", headers=headers)
    rounds = history.json()
    round2_docs = rounds[1]["documents"]
    # Round 2 should have all 3 docs: new fire_safety + carried forward staff_qual and floor_plan
    assert len(round2_docs) == 3
    doc_types = {d["doc_type"] for d in round2_docs}
    assert doc_types == {"staff_qualification", "fire_safety", "floor_plan"}
    # The fire_safety in round 2 should be the new one
    fire_doc = [d for d in round2_docs if d["doc_type"] == "fire_safety"][0]
    assert fire_doc["filename"] == "new_fire_safety.pdf"
