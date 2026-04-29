# UC2: Officer Application Review & Feedback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add officer-facing application review UI and backend endpoints (feedback, status transitions, role-branching, auth hardening) as defined in the UC2 spec.

**Architecture:** Backend adds status_machine and notifications services, role-branches the two GET application endpoints, and adds two new officer-only endpoints; frontend extracts `ApplicationSections` from the existing operator detail page then builds OfficerLayout, OfficerApplicationListPage, OfficerApplicationDetailPage, and FeedbackPanel on top of it.

**Tech Stack:** FastAPI/SQLAlchemy (backend), React 19/TypeScript/Tailwind v4/Vitest (frontend), uv (Python), npm (Node)

---

## File Map

**Backend — create:**
- `backend/src/app/services/status_machine.py`
- `backend/src/app/services/notifications.py`
- `backend/tests/test_status_machine.py`
- `backend/tests/test_notifications.py`

**Backend — modify:**
- `backend/src/app/auth/schemas.py` — remove `role` from `LoginRequest`, add `role` to `TokenResponse`
- `backend/src/app/auth/router.py` — derive role from DB, return role in response
- `backend/src/app/routers/applications.py` — role-branch GET endpoints, add feedback + status endpoints, add notify call to resubmit
- `backend/tests/test_auth.py` — update all login calls
- `backend/tests/test_applications.py` — update all login calls, add officer tests
- `backend/tests/test_documents.py` — update login helper

**Frontend — create:**
- `frontend/src/lib/statusMachine.ts`
- `frontend/src/components/ApplicationSections.tsx`
- `frontend/src/components/ApplicationSections.test.tsx`
- `frontend/src/components/OfficerLayout.tsx`
- `frontend/src/components/OfficerLayout.test.tsx`
- `frontend/src/components/FeedbackPanel.tsx`
- `frontend/src/components/FeedbackPanel.test.tsx`
- `frontend/src/pages/OfficerApplicationListPage.tsx`
- `frontend/src/pages/OfficerApplicationListPage.test.tsx`
- `frontend/src/pages/OfficerApplicationDetailPage.tsx`
- `frontend/src/pages/OfficerApplicationDetailPage.test.tsx`

**Frontend — modify:**
- `frontend/src/components/StatusBadge.tsx` — add officer/operator display labels
- `frontend/src/components/StatusBadge.test.tsx`
- `frontend/src/pages/ApplicationDetailPage.tsx` — delegate to ApplicationSections
- `frontend/src/pages/ApplicationDetailPage.test.tsx` — no changes needed (behavior unchanged)
- `frontend/src/pages/LoginPage.tsx` — remove role dropdown, add password field
- `frontend/src/pages/LoginPage.test.tsx`
- `frontend/src/routes.tsx` — add officer routes

---

## Task 1: status_machine.py

**Files:**
- Create: `backend/src/app/services/status_machine.py`
- Create: `backend/tests/test_status_machine.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_status_machine.py
import pytest
from app.services.status_machine import transition, InvalidTransitionError


def test_valid_transition_application_received_to_under_review():
    assert transition("Application Received", "Under Review") == "Under Review"


def test_valid_transition_under_review_to_pending_resubmission():
    assert transition("Under Review", "Pending Pre-Site Resubmission") == "Pending Pre-Site Resubmission"


def test_valid_transition_under_review_to_pending_approval():
    assert transition("Under Review", "Pending Approval") == "Pending Approval"


def test_valid_transition_under_review_to_rejected():
    assert transition("Under Review", "Rejected") == "Rejected"


def test_valid_transition_pre_site_resubmitted_to_under_review():
    assert transition("Pre-Site Resubmitted", "Under Review") == "Under Review"


def test_valid_transition_pending_approval_to_approved():
    assert transition("Pending Approval", "Approved") == "Approved"


def test_valid_transition_pending_approval_to_rejected():
    assert transition("Pending Approval", "Rejected") == "Rejected"


def test_invalid_transition_raises_error():
    with pytest.raises(InvalidTransitionError) as exc_info:
        transition("Application Received", "Approved")
    assert "Application Received" in str(exc_info.value)
    assert "Approved" in str(exc_info.value)


def test_unknown_current_status_raises_error():
    with pytest.raises(InvalidTransitionError):
        transition("Unknown Status", "Under Review")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && uv run pytest tests/test_status_machine.py -v
```
Expected: `ModuleNotFoundError: No module named 'app.services.status_machine'`

- [ ] **Step 3: Create the implementation**

```python
# backend/src/app/services/status_machine.py
VALID_TRANSITIONS: dict[str, list[str]] = {
    "Application Received": ["Under Review"],
    "Under Review": ["Pending Pre-Site Resubmission", "Pending Approval", "Rejected"],
    "Pre-Site Resubmitted": ["Under Review"],
    "Pending Approval": ["Approved", "Rejected"],
}


class InvalidTransitionError(Exception):
    def __init__(self, current: str, new: str):
        self.current = current
        self.new = new
        super().__init__(f"Invalid status transition from '{current}' to '{new}'")


def transition(current: str, new: str) -> str:
    """Validate and return new_status. Raises InvalidTransitionError if invalid."""
    if new not in VALID_TRANSITIONS.get(current, []):
        raise InvalidTransitionError(current, new)
    return new
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/test_status_machine.py -v
```
Expected: 9 PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/src/app/services/status_machine.py backend/tests/test_status_machine.py
git commit -m "feat: add status machine service with transition validation"
```

---

## Task 2: notifications.py

**Files:**
- Create: `backend/src/app/services/notifications.py`
- Create: `backend/tests/test_notifications.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_notifications.py
import logging
from app.services.notifications import notify


def test_notify_operator_logs_message(caplog):
    with caplog.at_level(logging.INFO, logger="app.services.notifications"):
        notify("operator", "Application 123 updated to 'Under Review'.")
    assert "[NOTIFY → OPERATOR] Application 123 updated to 'Under Review'." in caplog.text


def test_notify_officer_logs_message(caplog):
    with caplog.at_level(logging.INFO, logger="app.services.notifications"):
        notify("officer", "Application 456 resubmitted (Round 2). Ready for review.")
    assert "[NOTIFY → OFFICER] Application 456 resubmitted (Round 2). Ready for review." in caplog.text
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && uv run pytest tests/test_notifications.py -v
```
Expected: `ModuleNotFoundError: No module named 'app.services.notifications'`

- [ ] **Step 3: Create the implementation**

```python
# backend/src/app/services/notifications.py
import logging

logger = logging.getLogger(__name__)


def notify(recipient_role: str, message: str) -> None:
    """Stub notification — logs to stdout. Swap transport here when real delivery is needed."""
    logger.info("[NOTIFY → %s] %s", recipient_role.upper(), message)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && uv run pytest tests/test_notifications.py -v
```
Expected: 2 PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/src/app/services/notifications.py backend/tests/test_notifications.py
git commit -m "feat: add notifications stub service"
```

---

## Task 3: Auth backend — derive role from DB, return role in response

**Files:**
- Modify: `backend/src/app/auth/schemas.py`
- Modify: `backend/src/app/auth/router.py`
- Modify: `backend/tests/test_auth.py`
- Modify: `backend/tests/test_applications.py`
- Modify: `backend/tests/test_documents.py`

**Context:** Currently `LoginRequest` accepts `{username, role}` and the handler queries by both. After this task it accepts `{username}` only and derives role from the DB. `TokenResponse` gains a `role` field. All test helpers that call `POST /auth/login` with a `role` field must be updated in the same commit to keep the suite green.

- [ ] **Step 1: Write new failing tests in test_auth.py**

Add these at the bottom of `backend/tests/test_auth.py`:

```python
def test_login_returns_role_in_response(client):
    response = client.post("/auth/login", json={"username": "alice"})
    assert response.status_code == 200
    assert response.json()["role"] == "operator"


def test_login_officer_role_derived_from_db(client):
    response = client.post("/auth/login", json={"username": "bob"})
    assert response.status_code == 200
    assert response.json()["role"] == "officer"


def test_login_unknown_user_returns_401(client):
    response = client.post("/auth/login", json={"username": "nobody"})
    assert response.status_code == 401
```

- [ ] **Step 2: Run new tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_auth.py::test_login_returns_role_in_response tests/test_auth.py::test_login_officer_role_derived_from_db -v
```
Expected: FAILED (422 Unprocessable Entity — role field missing from request)

- [ ] **Step 3: Update schemas.py**

Replace the entire file:

```python
# backend/src/app/auth/schemas.py
from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
```

- [ ] **Step 4: Update router.py**

Replace the `login` function (keep the `me` function unchanged):

```python
@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Annotated[Session, Depends(get_db)]):
    user = db.query(User).filter(User.username == request.username).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    token = create_token({"sub": str(user.id), "role": user.role, "username": user.username})
    return TokenResponse(access_token=token, role=user.role)
```

Note: `username` is added to the JWT payload so officer endpoints can read `user["username"]` for `created_by`.

- [ ] **Step 5: Update all login calls in test_auth.py**

Replace the entire file content:

```python
# backend/tests/test_auth.py
from uuid import UUID

from jose import jwt

from app.config import settings


def test_login_operator_returns_token(client):
    response = client.post("/auth/login", json={"username": "alice"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_officer_returns_token(client):
    response = client.post("/auth/login", json={"username": "bob"})
    assert response.status_code == 200


def test_login_unknown_user_rejected(client):
    response = client.post("/auth/login", json={"username": "nobody"})
    assert response.status_code == 401
    assert response.json()["detail"] == "User not found"


def test_token_sub_is_user_id_uuid(client):
    response = client.post("/auth/login", json={"username": "alice"})
    token = response.json()["access_token"]
    payload = jwt.decode(
        token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
    )
    UUID(payload["sub"])
    assert payload["role"] == "operator"


def test_me_returns_user_profile(client):
    login = client.post("/auth/login", json={"username": "alice"})
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
        "/auth/me", headers={"Authorization": "Bearer invalid.token.here"}
    )
    assert response.status_code == 401


def test_login_returns_role_in_response(client):
    response = client.post("/auth/login", json={"username": "alice"})
    assert response.status_code == 200
    assert response.json()["role"] == "operator"


def test_login_officer_role_derived_from_db(client):
    response = client.post("/auth/login", json={"username": "bob"})
    assert response.status_code == 200
    assert response.json()["role"] == "officer"


def test_login_unknown_user_returns_401(client):
    response = client.post("/auth/login", json={"username": "nobody"})
    assert response.status_code == 401
```

- [ ] **Step 6: Update get_operator_token helper in test_applications.py**

Find and replace the `get_operator_token` function and all other bare login calls in `backend/tests/test_applications.py`:

```python
def get_operator_token(client, db_session):
    login = client.post("/auth/login", json={"username": "alice"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}
```

Also find these two other login calls in the file and update them:
- `client.post("/auth/login", json={"username": "bob", "role": "officer"})` → `client.post("/auth/login", json={"username": "bob"})`
- `client.post("/auth/login", json={"username": "charlie", "role": "operator"})` → `client.post("/auth/login", json={"username": "charlie"})`

- [ ] **Step 7: Update get_operator_token in test_documents.py**

```python
def get_operator_token(client, db_session):
    """Helper: login as operator and return auth header."""
    login = client.post("/auth/login", json={"username": "alice"})
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

- [ ] **Step 8: Run full backend test suite**

```bash
cd backend && uv run pytest tests/ -v
```
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add backend/src/app/auth/schemas.py backend/src/app/auth/router.py \
        backend/tests/test_auth.py backend/tests/test_applications.py \
        backend/tests/test_documents.py
git commit -m "feat: derive role from DB on login, return role in response"
```

---

## Task 4: GET /applications role-branching (officer sees all + status filter)

**Files:**
- Modify: `backend/src/app/routers/applications.py`
- Modify: `backend/tests/test_applications.py`

- [ ] **Step 1: Add failing tests**

Add these helpers and tests at the bottom of `backend/tests/test_applications.py`:

```python
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
```

- [ ] **Step 2: Run new tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_applications.py::test_list_applications_officer_sees_all -v
```
Expected: FAILED (403 — officer hits `require_operator`)

- [ ] **Step 3: Update list_applications handler in applications.py**

Add these imports at the top of `backend/src/app/routers/applications.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.auth.dependencies import require_operator, require_officer, get_current_user
from app.models import Application, Document, FeedbackItem, Submission, User
```

Add `OFFICER_STATUS_MAP` after `OPERATOR_STATUS_MAP`:

```python
OFFICER_STATUS_MAP: dict[str, str] = {
    "Pending Approval": "Route to Approval",
}
```

Replace the `list_applications` function:

```python
@router.get("")
def list_applications(
    user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    status_filter: str | None = Query(default=None, alias="status"),
):
    if user["role"] == "operator":
        applications = (
            db.query(Application)
            .options(selectinload(Application.submissions))
            .filter(
                Application.operator_id == uuid.UUID(user["sub"]),
                Application.submissions.any(),
            )
            .order_by(Application.updated_at.desc())
            .all()
        )
        return [
            {
                "id": str(app.id),
                "status": OPERATOR_STATUS_MAP.get(app.status, app.status),
                "centre_name": (
                    app.submissions[-1].form_data.get("basic_details", {}).get("centre_name", "")
                    if app.submissions else ""
                ),
                "type_of_service": (
                    app.submissions[-1].form_data.get("operations", {}).get("type_of_service", "")
                    if app.submissions else ""
                ),
                "current_round": app.current_round,
                "updated_at": app.updated_at.isoformat(),
            }
            for app in applications
        ]

    # Officer branch
    from sqlalchemy.orm import joinedload
    query = (
        db.query(Application)
        .options(selectinload(Application.submissions), joinedload(Application.operator))
        .filter(Application.submissions.any())
    )
    if status_filter:
        query = query.filter(Application.status == status_filter)
    applications = query.order_by(Application.updated_at.desc()).all()
    return [
        {
            "id": str(app.id),
            "status": OFFICER_STATUS_MAP.get(app.status, app.status),
            "centre_name": (
                app.submissions[-1].form_data.get("basic_details", {}).get("centre_name", "")
                if app.submissions else ""
            ),
            "operator_name": app.operator.full_name,
            "type_of_service": (
                app.submissions[-1].form_data.get("operations", {}).get("type_of_service", "")
                if app.submissions else ""
            ),
            "current_round": app.current_round,
            "updated_at": app.updated_at.isoformat(),
        }
        for app in applications
    ]
```

- [ ] **Step 4: Run tests**

```bash
cd backend && uv run pytest tests/test_applications.py -v
```
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/app/routers/applications.py backend/tests/test_applications.py
git commit -m "feat: role-branch GET /applications — officer sees all with status filter"
```

---

## Task 5: GET /applications/{id} role-branching (officer sees full audit trail)

**Files:**
- Modify: `backend/src/app/routers/applications.py`
- Modify: `backend/tests/test_applications.py`

- [ ] **Step 1: Add failing tests**

```python
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
```

- [ ] **Step 2: Run new tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_applications.py::test_get_application_officer_returns_full_audit_trail -v
```
Expected: FAILED (403)

- [ ] **Step 3: Replace get_application handler**

```python
@router.get("/{application_id}")
def get_application(
    application_id: str,
    user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    if user["role"] == "operator":
        application = db.query(Application).filter(
            Application.id == uuid.UUID(application_id),
            Application.operator_id == uuid.UUID(user["sub"]),
        ).first()
        if application is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

        latest_sub = (
            db.query(Submission)
            .filter(Submission.application_id == application.id)
            .order_by(Submission.round_number.desc())
            .first()
        )
        latest_feedback = (
            db.query(FeedbackItem).filter(FeedbackItem.submission_id == latest_sub.id).all()
            if latest_sub else []
        )
        docs = (
            db.query(Document).filter(Document.submission_id == latest_sub.id).all()
            if latest_sub else []
        )
        return {
            "id": str(application.id),
            "status": OPERATOR_STATUS_MAP.get(application.status, application.status),
            "current_round": application.current_round,
            "latest_submission": {
                "id": str(latest_sub.id),
                "form_data": latest_sub.form_data,
                "documents": [
                    {"id": str(d.id), "doc_type": d.doc_type, "filename": d.filename,
                     "ai_status": d.ai_status, "ai_details": d.ai_details}
                    for d in docs
                ],
            } if latest_sub else None,
            "latest_feedback": [
                {"id": str(f.id), "target_type": f.target_type, "section": f.section,
                 "field_key": f.field_key,
                 "document_id": str(f.document_id) if f.document_id else None,
                 "comment": f.comment, "created_by": f.created_by,
                 "created_at": f.created_at.isoformat()}
                for f in latest_feedback
            ],
        }

    # Officer branch
    application = db.query(Application).filter(
        Application.id == uuid.UUID(application_id)
    ).first()
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    operator = db.query(User).filter(User.id == application.operator_id).first()
    submissions = (
        db.query(Submission)
        .options(selectinload(Submission.documents), selectinload(Submission.feedback_items))
        .filter(Submission.application_id == application.id)
        .order_by(Submission.round_number)
        .all()
    )
    return {
        "id": str(application.id),
        "status": OFFICER_STATUS_MAP.get(application.status, application.status),
        "current_round": application.current_round,
        "operator": {
            "id": str(operator.id),
            "full_name": operator.full_name,
            "email": operator.email,
            "phone": operator.phone,
        },
        "submissions": [
            {
                "id": str(sub.id),
                "round_number": sub.round_number,
                "submitted_at": sub.submitted_at.isoformat(),
                "form_data": sub.form_data,
                "documents": [
                    {"id": str(d.id), "doc_type": d.doc_type, "filename": d.filename,
                     "ai_status": d.ai_status, "ai_details": d.ai_details}
                    for d in sub.documents
                ],
                "feedback_items": [
                    {"id": str(f.id), "target_type": f.target_type, "section": f.section,
                     "field_key": f.field_key,
                     "document_id": str(f.document_id) if f.document_id else None,
                     "comment": f.comment, "created_by": f.created_by,
                     "created_at": f.created_at.isoformat()}
                    for f in sub.feedback_items
                ],
            }
            for sub in submissions
        ],
    }
```

- [ ] **Step 4: Run full test suite**

```bash
cd backend && uv run pytest tests/ -v
```
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/app/routers/applications.py backend/tests/test_applications.py
git commit -m "feat: role-branch GET /applications/{id} — officer gets full audit trail"
```

---

## Task 6: Add notify to resubmit + POST /applications/{id}/feedback

**Files:**
- Modify: `backend/src/app/routers/applications.py`
- Modify: `backend/tests/test_applications.py`

- [ ] **Step 1: Add failing tests for feedback endpoint**

```python
def test_feedback_happy_path_creates_items_and_transitions(client, db_session):
    headers_alice = get_operator_token(client, db_session)
    app_id = _submit_app(client, headers_alice)
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
```

- [ ] **Step 2: Run new tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_applications.py::test_feedback_happy_path_creates_items_and_transitions -v
```
Expected: FAILED (404 — route doesn't exist yet)

- [ ] **Step 3: Add imports and notify call to resubmit in applications.py**

Add to imports at top of `backend/src/app/routers/applications.py`:

```python
from app.services.notifications import notify
from app.services.status_machine import InvalidTransitionError, transition
```

In `resubmit_application`, just before the final `return` statement, add:

```python
    notify(
        "officer",
        f"Application {application.id} resubmitted (Round {new_round_number}). Ready for review.",
    )
```

- [ ] **Step 4: Add the feedback endpoint**

Add this new route to `backend/src/app/routers/applications.py` (after the resubmit route):

```python
@router.post("/{application_id}/feedback", status_code=status.HTTP_201_CREATED)
def submit_feedback(
    application_id: str,
    body: dict,
    user: Annotated[dict, Depends(require_officer)],
    db: Annotated[Session, Depends(get_db)],
):
    application = db.query(Application).filter(
        Application.id == uuid.UUID(application_id)
    ).first()
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    feedback_items_data = body.get("feedback_items", [])
    new_status = body.get("new_status")

    if not feedback_items_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="feedback_items must be non-empty")
    if not new_status:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="new_status is required")

    valid_sections = {"basic_details", "operations", "declarations"}
    for item in feedback_items_data:
        target_type = item.get("target_type")
        section = item.get("section")
        field_key = item.get("field_key")
        document_id = item.get("document_id")
        comment = item.get("comment", "")

        if target_type not in ("field", "document"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="target_type must be 'field' or 'document'")
        if not comment:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="comment must be non-empty")

        if target_type == "field":
            if not field_key:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="field_key required for field feedback")
            if document_id is not None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="document_id must be null for field feedback")
            if section not in valid_sections:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"section must be one of {valid_sections}")
        else:
            if not document_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="document_id required for document feedback")
            if field_key is not None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="field_key must be null for document feedback")
            if section != "documents":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="section must be 'documents' for document feedback")
            doc = db.query(Document).filter(
                Document.id == uuid.UUID(document_id),
                Document.application_id == application.id,
            ).first()
            if doc is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Document {document_id} not found in this application")

    try:
        transition(application.status, new_status)
    except InvalidTransitionError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    latest_sub = (
        db.query(Submission)
        .filter(Submission.application_id == application.id)
        .order_by(Submission.round_number.desc())
        .first()
    )
    if latest_sub is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No submission found")

    created_items = []
    for item in feedback_items_data:
        fi = FeedbackItem(
            submission_id=latest_sub.id,
            target_type=item["target_type"],
            section=item["section"],
            field_key=item.get("field_key"),
            document_id=uuid.UUID(item["document_id"]) if item.get("document_id") else None,
            comment=item["comment"],
            created_by=user.get("username", "officer"),
        )
        db.add(fi)
        created_items.append(fi)

    application.status = new_status
    db.commit()
    for fi in created_items:
        db.refresh(fi)

    notify("operator", f"Application {application.id} updated to '{new_status}'. Please log in to review officer feedback.")

    return {
        "application_id": str(application.id),
        "status": new_status,
        "feedback_items": [
            {
                "id": str(fi.id),
                "target_type": fi.target_type,
                "section": fi.section,
                "field_key": fi.field_key,
                "comment": fi.comment,
                "created_by": fi.created_by,
                "created_at": fi.created_at.isoformat(),
            }
            for fi in created_items
        ],
    }
```

- [ ] **Step 5: Run tests**

```bash
cd backend && uv run pytest tests/test_applications.py -v
```
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/app/routers/applications.py backend/tests/test_applications.py
git commit -m "feat: add POST /applications/{id}/feedback with validation and status transition"
```

---

## Task 7: PATCH /applications/{id}/status

**Files:**
- Modify: `backend/src/app/routers/applications.py`
- Modify: `backend/tests/test_applications.py`

- [ ] **Step 1: Add failing tests**

```python
def test_patch_status_valid_transition(client, db_session):
    headers_alice = get_operator_token(client, db_session)
    app_id = _submit_app(client, headers_alice)
    headers_bob = get_officer_token(client)

    response = client.patch(
        f"/applications/{app_id}/status",
        json={"new_status": "Under Review"},
        headers=headers_bob,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "Under Review"
    assert "updated_at" in data


def test_patch_status_invalid_transition_returns_409(client, db_session):
    headers_alice = get_operator_token(client, db_session)
    app_id = _submit_app(client, headers_alice)
    headers_bob = get_officer_token(client)

    response = client.patch(
        f"/applications/{app_id}/status",
        json={"new_status": "Approved"},  # invalid from "Application Received"
        headers=headers_bob,
    )
    assert response.status_code == 409


def test_patch_status_requires_officer_role(client, db_session):
    headers_alice = get_operator_token(client, db_session)
    app_id = _submit_app(client, headers_alice)

    response = client.patch(
        f"/applications/{app_id}/status",
        json={"new_status": "Under Review"},
        headers=headers_alice,
    )
    assert response.status_code == 403
```

- [ ] **Step 2: Run new tests to verify they fail**

```bash
cd backend && uv run pytest tests/test_applications.py::test_patch_status_valid_transition -v
```
Expected: FAILED (404 — route doesn't exist)

- [ ] **Step 3: Add the PATCH status endpoint**

Add after the feedback endpoint in `backend/src/app/routers/applications.py`:

```python
@router.patch("/{application_id}/status")
def update_status(
    application_id: str,
    body: dict,
    user: Annotated[dict, Depends(require_officer)],
    db: Annotated[Session, Depends(get_db)],
):
    application = db.query(Application).filter(
        Application.id == uuid.UUID(application_id)
    ).first()
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    new_status = body.get("new_status")
    if not new_status:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="new_status is required")

    try:
        transition(application.status, new_status)
    except InvalidTransitionError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    application.status = new_status
    db.commit()
    db.refresh(application)

    notify("operator", f"Application {application.id} status changed to '{new_status}'.")

    return {
        "id": str(application.id),
        "status": new_status,
        "updated_at": application.updated_at.isoformat(),
    }
```

- [ ] **Step 4: Run full backend test suite**

```bash
cd backend && uv run pytest tests/ -v
```
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/app/routers/applications.py backend/tests/test_applications.py
git commit -m "feat: add PATCH /applications/{id}/status for officer status transitions"
```

---

## Task 8: lib/statusMachine.ts

**Files:**
- Create: `frontend/src/lib/statusMachine.ts`

- [ ] **Step 1: Create the file**

```typescript
// frontend/src/lib/statusMachine.ts
export const VALID_TRANSITIONS: Record<string, string[]> = {
  "Application Received": ["Under Review"],
  "Under Review": ["Pending Pre-Site Resubmission", "Pending Approval", "Rejected"],
  "Pre-Site Resubmitted": ["Under Review"],
  "Pending Approval": ["Approved", "Rejected"],
}

export const OFFICER_STATUS_MAP: Record<string, string> = {
  "Pending Approval": "Route to Approval",
}

export function getOfficerLabel(internalStatus: string): string {
  return OFFICER_STATUS_MAP[internalStatus] ?? internalStatus
}

export function getValidNextStatuses(currentStatus: string): string[] {
  return VALID_TRANSITIONS[currentStatus] ?? []
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/statusMachine.ts
git commit -m "feat: add frontend status machine constants and helpers"
```

---

## Task 9: Extract ApplicationSections component

**Files:**
- Create: `frontend/src/components/ApplicationSections.tsx`
- Create: `frontend/src/components/ApplicationSections.test.tsx`
- Modify: `frontend/src/pages/ApplicationDetailPage.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/components/ApplicationSections.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ApplicationSections from './ApplicationSections'

const FORM_DATA = {
  basic_details: {
    centre_name: 'Sunshine Childcare',
    operator_company_name: 'EduCare Pte Ltd',
    uen: '2024XXXXXX',
    contact_person: 'Jane Tan',
    contact_email: 'jane@educare.sg',
    contact_phone: '+65 9123 4567',
  },
  operations: {
    centre_address: '123 Jurong East St',
    type_of_service: 'Childcare',
    proposed_capacity: 50,
  },
  declarations: { compliance_confirmed: true },
}

const DOCUMENTS = [
  { id: 'doc-1', doc_type: 'staff_qualification', filename: 'staff.pdf', ai_status: 'pass' },
  { id: 'doc-2', doc_type: 'fire_safety', filename: 'fire.pdf', ai_status: 'pass' },
  { id: 'doc-3', doc_type: 'floor_plan', filename: 'plan.pdf', ai_status: 'pass' },
]

describe('ApplicationSections', () => {
  it('renders field labels and values', () => {
    render(<ApplicationSections formData={FORM_DATA} documents={DOCUMENTS} />)
    expect(screen.getByText('Centre Name')).toBeInTheDocument()
    expect(screen.getByText('Sunshine Childcare')).toBeInTheDocument()
    expect(screen.getByText('UEN')).toBeInTheDocument()
    expect(screen.getByText('2024XXXXXX')).toBeInTheDocument()
  })

  it('renders document rows', () => {
    render(<ApplicationSections formData={FORM_DATA} documents={DOCUMENTS} />)
    expect(screen.getByText('Staff Qualification Certificate(s)')).toBeInTheDocument()
    expect(screen.getByText('Fire Safety Certificate')).toBeInTheDocument()
  })

  it('shows flagged indicator on field with feedback', () => {
    render(
      <ApplicationSections
        formData={FORM_DATA}
        documents={DOCUMENTS}
        feedbackByField={{ uen: [{ id: 'f-1', target_type: 'field', section: 'basic_details', field_key: 'uen', document_id: null, comment: 'Fix UEN', created_by: 'bob' }] }}
      />
    )
    expect(screen.getByText(/flagged/)).toBeInTheDocument()
    expect(screen.getByText('Fix UEN')).toBeInTheDocument()
  })

  it('shows changed badge when field differs from previous round', () => {
    const prevFormData = {
      ...FORM_DATA,
      basic_details: { ...FORM_DATA.basic_details, centre_name: 'Old Name' },
    }
    render(
      <ApplicationSections
        formData={FORM_DATA}
        documents={DOCUMENTS}
        previousFormData={prevFormData}
        previousDocuments={DOCUMENTS}
      />
    )
    expect(screen.getByText('changed')).toBeInTheDocument()
  })

  it('does not show changed badge when no previous data provided', () => {
    render(<ApplicationSections formData={FORM_DATA} documents={DOCUMENTS} />)
    expect(screen.queryByText('changed')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/ApplicationSections.test.tsx
```
Expected: FAILED (Cannot find module)

- [ ] **Step 3: Create ApplicationSections.tsx**

```typescript
// frontend/src/components/ApplicationSections.tsx
import React from 'react'
import {
  FIELD_LABELS,
  SECTION_LABELS,
  DOC_TYPE_LABELS,
  SECTION_ORDER,
  DOC_TYPE_ORDER,
  OPTIONAL_DOC_TYPES,
} from '../lib/formLabels'

interface Document {
  id: string
  doc_type: string
  filename: string
  ai_status: string
}

interface FeedbackItem {
  id: string
  target_type: string
  section: string
  field_key: string | null
  document_id: string | null
  comment: string
  created_by: string
}

interface ApplicationSectionsProps {
  formData: Record<string, Record<string, unknown>>
  documents: Document[]
  feedbackByField?: Record<string, FeedbackItem[]>
  feedbackBySection?: Record<string, FeedbackItem[]>
  feedbackByDocument?: Record<string, FeedbackItem[]>
  previousFormData?: Record<string, Record<string, unknown>>
  previousDocuments?: Document[]
}

export default function ApplicationSections({
  formData,
  documents,
  feedbackByField = {},
  feedbackBySection = {},
  feedbackByDocument = {},
  previousFormData,
  previousDocuments,
}: ApplicationSectionsProps) {
  const changedFields = React.useMemo(() => {
    if (!previousFormData) return new Set<string>()
    const changed = new Set<string>()
    for (const section of SECTION_ORDER) {
      const curr = formData[section] ?? {}
      const prev = previousFormData[section] ?? {}
      for (const key of Object.keys({ ...curr, ...prev })) {
        if (curr[key] !== prev[key]) changed.add(`${section}.${key}`)
      }
    }
    return changed
  }, [formData, previousFormData])

  const changedDocTypes = React.useMemo(() => {
    if (!previousDocuments) return new Set<string>()
    const prevByType = new Map(previousDocuments.map(d => [d.doc_type, d.id]))
    const changed = new Set<string>()
    for (const doc of documents) {
      if (prevByType.has(doc.doc_type) && prevByType.get(doc.doc_type) !== doc.id) {
        changed.add(doc.doc_type)
      }
    }
    return changed
  }, [documents, previousDocuments])

  return (
    <>
      {SECTION_ORDER.map(section => {
        const fields = formData[section]
        if (!fields) return null
        const sectionItems = feedbackBySection[section] ?? []
        const sectionLabel = SECTION_LABELS[section] ?? section
        return (
          <div key={section} className="border border-slate-200 rounded-lg p-4 mb-4">
            <h2 className="font-semibold text-sm mb-3">{sectionLabel}</h2>
            {sectionItems.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
                {sectionItems.map(f => (
                  <p key={f.id} className="text-xs text-amber-900">{f.comment}</p>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(fields).map(([key, value]) => {
                const isFullWidth = key === 'centre_address' || key === 'compliance_confirmed'
                const flaggedItems = feedbackByField[key] ?? []
                const isFlagged = flaggedItems.length > 0
                const isChanged = changedFields.has(`${section}.${key}`)
                const label = FIELD_LABELS[key] ?? key
                const displayValue = key === 'compliance_confirmed'
                  ? (value ? '✓ I confirm all information is accurate' : '✗ Not confirmed')
                  : String(value ?? '')
                return (
                  <div key={key} className={`flex flex-col gap-1 ${isFullWidth ? 'col-span-2' : ''}`}>
                    <span className="text-xs text-slate-600 flex items-center gap-1">
                      {label}
                      {isFlagged && <span className="text-amber-600 font-medium">⚑ flagged</span>}
                      {isChanged && <span className="text-indigo-600 font-medium text-xs px-1 bg-indigo-50 rounded">changed</span>}
                    </span>
                    <div className={`rounded-md px-3 py-1.5 text-sm ${
                      isFlagged
                        ? 'bg-amber-50 border-2 border-amber-400 text-slate-800'
                        : 'bg-slate-50 border border-slate-200 text-slate-800'
                    }`}>
                      {displayValue}
                    </div>
                    {flaggedItems.map(f => (
                      <div key={f.id} className="bg-amber-100 border-l-2 border-amber-400 rounded text-amber-900 text-xs px-2 py-1">
                        {f.comment}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="border border-slate-200 rounded-lg p-4 mb-4">
        <h2 className="font-semibold text-sm mb-3">Documents</h2>
        <div className="flex flex-col gap-2">
          {DOC_TYPE_ORDER.map(docType => {
            const doc = documents.find(d => d.doc_type === docType)
            const isOptional = OPTIONAL_DOC_TYPES.has(docType)
            const flaggedItems = doc ? (feedbackByDocument[doc.id] ?? []) : []
            const isFlagged = flaggedItems.length > 0
            const isChanged = changedDocTypes.has(docType)
            const label = DOC_TYPE_LABELS[docType] ?? docType
            return (
              <div key={docType}>
                <div className={`rounded-md border px-3 py-2 ${isFlagged ? 'bg-amber-50 border-2 border-amber-400' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">
                        {label}
                        {isOptional && <span className="text-xs text-slate-500 ml-1">(optional)</span>}
                        {isFlagged && <span className="text-xs text-amber-600 font-medium ml-1">⚑ flagged</span>}
                        {isChanged && <span className="text-xs text-indigo-600 font-medium ml-1 px-1 bg-indigo-50 rounded">changed</span>}
                      </span>
                      <p className="text-xs text-slate-600 mt-0.5">{doc ? doc.filename : 'Not submitted'}</p>
                    </div>
                    {doc ? (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${doc.ai_status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {doc.ai_status}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </div>
                </div>
                {flaggedItems.map(f => (
                  <div key={f.id} className="bg-amber-100 border-l-2 border-amber-400 rounded text-amber-900 text-xs px-2 py-1 mt-1">
                    {f.comment}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Run ApplicationSections tests**

```bash
cd frontend && npx vitest run src/components/ApplicationSections.test.tsx
```
Expected: 5 PASSED

- [ ] **Step 5: Refactor ApplicationDetailPage.tsx to use ApplicationSections**

Replace the entire file:

```typescript
// frontend/src/pages/ApplicationDetailPage.tsx
import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import StatusBadge from '../components/StatusBadge'
import ApplicationSections from '../components/ApplicationSections'

interface FeedbackItem {
  id: string
  target_type: string
  section: string
  field_key: string | null
  document_id: string | null
  comment: string
  created_by: string
}

interface Document {
  id: string
  doc_type: string
  filename: string
  ai_status: string
}

interface ApplicationDetail {
  id: string
  status: string
  current_round: number
  latest_submission: {
    form_data: Record<string, Record<string, unknown>>
    documents: Document[]
  } | null
  latest_feedback: FeedbackItem[]
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [app, setApp] = React.useState<ApplicationDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!id) return
    api.get(`/applications/${id}`)
      .then(res => setApp(res.data))
      .catch(() => setError('Failed to load application.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="p-6">Loading...</p>
  if (error) return <p className="p-6 text-red-500">{error}</p>
  if (!app) return <p className="p-6">Application not found.</p>

  const hasFeedback = app.latest_feedback.length > 0
  const needsResubmission = app.status === 'Pending Pre-Site Resubmission'
  const formData = app.latest_submission?.form_data ?? {}
  const documents = app.latest_submission?.documents ?? []

  const feedbackByField: Record<string, FeedbackItem[]> = {}
  const feedbackBySection: Record<string, FeedbackItem[]> = {}
  const feedbackByDocument: Record<string, FeedbackItem[]> = {}

  for (const item of app.latest_feedback) {
    if (item.target_type === 'document' && item.document_id) {
      feedbackByDocument[item.document_id] = [...(feedbackByDocument[item.document_id] ?? []), item]
    } else if (item.target_type === 'field' && item.field_key) {
      feedbackByField[item.field_key] = [...(feedbackByField[item.field_key] ?? []), item]
    } else if (item.target_type === 'field' && !item.field_key) {
      feedbackBySection[item.section] = [...(feedbackBySection[item.section] ?? []), item]
    }
  }

  const centreName = formData.basic_details?.centre_name as string | undefined

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Link to="/operator/applications" className="text-sm text-blue-600 underline mb-2 block">
        &larr; Back to applications
      </Link>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{centreName || 'Application'}</h1>
          <p className="text-sm text-slate-600 mt-1">Round {app.current_round}</p>
        </div>
        <StatusBadge status={app.status} />
      </div>

      {hasFeedback && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <p className="text-sm font-medium text-amber-800">
            Officer feedback received. Review the comments below and resubmit.
          </p>
          {needsResubmission && (
            <Link
              to={`/operator/applications/${app.id}/resubmit`}
              className="text-sm text-blue-600 underline ml-4 whitespace-nowrap"
            >
              Resubmit Application
            </Link>
          )}
        </div>
      )}

      {app.latest_submission && (
        <ApplicationSections
          formData={formData}
          documents={documents}
          feedbackByField={feedbackByField}
          feedbackBySection={feedbackBySection}
          feedbackByDocument={feedbackByDocument}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 6: Run full frontend test suite**

```bash
cd frontend && npx vitest run
```
Expected: All PASS (ApplicationDetailPage tests unchanged — same rendered output)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/ApplicationSections.tsx \
        frontend/src/components/ApplicationSections.test.tsx \
        frontend/src/pages/ApplicationDetailPage.tsx
git commit -m "refactor: extract ApplicationSections component from ApplicationDetailPage"
```

---

## Task 10: OfficerLayout + extend StatusBadge

**Files:**
- Create: `frontend/src/components/OfficerLayout.tsx`
- Create: `frontend/src/components/OfficerLayout.test.tsx`
- Modify: `frontend/src/components/StatusBadge.tsx`
- Modify: `frontend/src/components/StatusBadge.test.tsx`

- [ ] **Step 1: Write failing OfficerLayout test**

```typescript
// frontend/src/components/OfficerLayout.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import OfficerLayout from './OfficerLayout'

const renderWithRouter = (initialEntry = '/officer/applications') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/officer" element={<OfficerLayout />}>
          <Route path="applications" element={<div>Applications Page</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('OfficerLayout', () => {
  beforeEach(() => {
    const store: Record<string, string> = { role: 'officer', token: 'test-token' }
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value }),
      removeItem: vi.fn((key: string) => { delete store[key] }),
    })
  })

  it('renders the portal name', () => {
    renderWithRouter()
    expect(screen.getByText('Licensing Portal')).toBeInTheDocument()
  })

  it('renders Applications nav link', () => {
    renderWithRouter()
    const link = screen.getByRole('link', { name: /applications/i })
    expect(link).toHaveAttribute('href', '/officer/applications')
  })

  it('renders outlet content', () => {
    renderWithRouter()
    expect(screen.getByText('Applications Page')).toBeInTheDocument()
  })

  it('logout clears localStorage and navigates to /login', () => {
    renderWithRouter()
    fireEvent.click(screen.getByRole('button', { name: /logout/i }))
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('role')).toBeNull()
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/OfficerLayout.test.tsx
```
Expected: FAILED (Cannot find module)

- [ ] **Step 3: Create OfficerLayout.tsx**

```typescript
// frontend/src/components/OfficerLayout.tsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom'

export default function OfficerLayout() {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    navigate('/login')
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
      isActive
        ? 'bg-indigo-50 text-indigo-700 font-medium'
        : 'text-slate-600 hover:bg-slate-50'
    }`

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="px-4 py-5 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-800">Licensing Portal</span>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          <NavLink to="/officer/applications" className={navLinkClass}>
            Applications
          </NavLink>
        </nav>
        <div className="px-4 py-4 border-t border-slate-100 flex flex-col gap-2">
          <span className="text-xs text-slate-500">officer</span>
          <button
            onClick={handleLogout}
            className="text-left text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run OfficerLayout tests**

```bash
cd frontend && npx vitest run src/components/OfficerLayout.test.tsx
```
Expected: 4 PASSED

- [ ] **Step 5: Extend StatusBadge with all display labels**

Replace `frontend/src/components/StatusBadge.tsx`:

```typescript
const STATUS_CLASSES: Record<string, string> = {
  // Internal statuses
  'Application Received': 'bg-blue-50 text-blue-700',
  'Under Review': 'bg-blue-50 text-blue-700',
  'Pending Pre-Site Resubmission': 'bg-amber-50 text-amber-700',
  'Pre-Site Resubmitted': 'bg-purple-50 text-purple-700',
  'Pending Approval': 'bg-indigo-50 text-indigo-700',
  'Approved': 'bg-green-50 text-green-700',
  'Rejected': 'bg-red-50 text-red-700',
  // Operator-view labels
  'Submitted': 'bg-blue-50 text-blue-700',
  'Pending Site Visit': 'bg-amber-50 text-amber-700',
  'Pending Post-Site Clarification': 'bg-amber-50 text-amber-700',
  'Pending Post-Site Resubmission': 'bg-amber-50 text-amber-700',
  'Post-Site Resubmitted': 'bg-purple-50 text-purple-700',
  // Officer-view labels
  'Route to Approval': 'bg-indigo-50 text-indigo-700',
}

export default function StatusBadge({ status }: { status: string }) {
  const classes = STATUS_CLASSES[status] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${classes}`}>
      {status}
    </span>
  )
}
```

- [ ] **Step 6: Run full frontend suite**

```bash
cd frontend && npx vitest run
```
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/OfficerLayout.tsx \
        frontend/src/components/OfficerLayout.test.tsx \
        frontend/src/components/StatusBadge.tsx
git commit -m "feat: add OfficerLayout sidebar shell and extend StatusBadge labels"
```

---

## Task 11: LoginPage changes

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/pages/LoginPage.test.tsx`

- [ ] **Step 1: Update LoginPage tests**

Replace `frontend/src/pages/LoginPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import LoginPage from './LoginPage'

vi.mock('../lib/api', () => ({ api: { post: vi.fn() } }))
import { api } from '../lib/api'

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/operator" element={<div>Operator Home</div>} />
        <Route path="/officer" element={<div>Officer Home</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', {
      setItem: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
    })
  })

  it('renders username input', () => {
    renderPage()
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
  })

  it('renders password input', () => {
    renderPage()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('does not render role selector', () => {
    renderPage()
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument()
  })

  it('submit button is disabled when password is empty', () => {
    renderPage()
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'alice' } })
    expect(screen.getByRole('button', { name: /login/i })).toBeDisabled()
  })

  it('does not send role in API request', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { access_token: 'tok', role: 'operator' } })
    renderPage()
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'alice' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'any' } })
    fireEvent.click(screen.getByRole('button', { name: /login/i }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', { username: 'alice' })
    })
  })

  it('redirects to /officer for officer role', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { access_token: 'tok', role: 'officer' } })
    renderPage()
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'bob' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'any' } })
    fireEvent.click(screen.getByRole('button', { name: /login/i }))
    expect(await screen.findByText('Officer Home')).toBeInTheDocument()
  })

  it('redirects to /operator for operator role', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { access_token: 'tok', role: 'operator' } })
    renderPage()
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'alice' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'any' } })
    fireEvent.click(screen.getByRole('button', { name: /login/i }))
    expect(await screen.findByText('Operator Home')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/pages/LoginPage.test.tsx
```
Expected: Several FAILED (role selector still present, no password field)

- [ ] **Step 3: Replace LoginPage.tsx**

```typescript
// frontend/src/pages/LoginPage.tsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '../lib/api'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof schema>

export default function LoginPage() {
  const [loginError, setLoginError] = React.useState<string | null>(null)
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: LoginFormData) => {
    setLoginError(null)
    try {
      const response = await api.post('/auth/login', { username: data.username })
      localStorage.setItem('token', response.data.access_token)
      localStorage.setItem('role', response.data.role)
      navigate(response.data.role === 'officer' ? '/officer' : '/operator')
    } catch {
      setLoginError('Login failed. Please try again.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 w-80">
        <h1 className="text-2xl font-bold">Login</h1>
        <div className="flex flex-col gap-1">
          <label htmlFor="username">Username</label>
          <input id="username" className="border p-2 rounded" {...register('username')} />
          {errors.username && <p className="text-red-500 text-sm">{errors.username.message}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" className="border p-2 rounded" {...register('password')} />
          {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
        </div>
        {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
        <button type="submit" disabled={isSubmitting} className="bg-slate-900 text-white p-2 rounded">
          Login
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run LoginPage tests**

```bash
cd frontend && npx vitest run src/pages/LoginPage.test.tsx
```
Expected: All PASS

- [ ] **Step 5: Run full frontend suite**

```bash
cd frontend && npx vitest run
```
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/LoginPage.test.tsx
git commit -m "feat: remove role dropdown from login, add password field, redirect from API response"
```

---

## Task 12: OfficerApplicationListPage

**Files:**
- Create: `frontend/src/pages/OfficerApplicationListPage.tsx`
- Create: `frontend/src/pages/OfficerApplicationListPage.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// frontend/src/pages/OfficerApplicationListPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import OfficerApplicationListPage from './OfficerApplicationListPage'

vi.mock('../lib/api', () => ({ api: { get: vi.fn() } }))
import { api } from '../lib/api'

const APP = {
  id: 'app-1',
  status: 'Application Received',
  centre_name: 'Sunshine Childcare',
  operator_name: 'Alice Operator',
  type_of_service: 'Childcare',
  current_round: 1,
  updated_at: '2026-04-28T00:00:00Z',
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/officer/applications']}>
      <Routes>
        <Route path="/officer/applications" element={<OfficerApplicationListPage />} />
        <Route path="/officer/applications/:id" element={<div>Detail Page</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('OfficerApplicationListPage', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders application rows', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [APP] })
    renderPage()
    expect(await screen.findByText('Sunshine Childcare')).toBeInTheDocument()
    expect(screen.getByText('Alice Operator')).toBeInTheDocument()
    expect(screen.getByText('Application Received')).toBeInTheDocument()
  })

  it('shows empty state when no applications', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [] })
    renderPage()
    expect(await screen.findByText(/no applications matching/i)).toBeInTheDocument()
  })

  it('clicking a row navigates to detail page', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [APP] })
    renderPage()
    fireEvent.click(await screen.findByText('Sunshine Childcare'))
    expect(await screen.findByText('Detail Page')).toBeInTheDocument()
  })

  it('status filter sends correct query param', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    renderPage()
    await screen.findByText(/no applications matching/i)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Under Review' } })
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/applications', { params: { status: 'Under Review' } })
    })
  })

  it('all filter sends no status param', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    renderPage()
    await screen.findByText(/no applications matching/i)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/applications', { params: {} })
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/pages/OfficerApplicationListPage.test.tsx
```
Expected: FAILED (Cannot find module)

- [ ] **Step 3: Create OfficerApplicationListPage.tsx**

```typescript
// frontend/src/pages/OfficerApplicationListPage.tsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import StatusBadge from '../components/StatusBadge'

interface OfficerAppSummary {
  id: string
  status: string
  centre_name: string
  operator_name: string
  type_of_service: string
  current_round: number
  updated_at: string
}

const FILTER_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Application Received', value: 'Application Received' },
  { label: 'Under Review', value: 'Under Review' },
  { label: 'Pending Pre-Site Resubmission', value: 'Pending Pre-Site Resubmission' },
  { label: 'Pre-Site Resubmitted', value: 'Pre-Site Resubmitted' },
  { label: 'Route to Approval', value: 'Pending Approval' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Rejected', value: 'Rejected' },
]

export default function OfficerApplicationListPage() {
  const navigate = useNavigate()
  const [apps, setApps] = React.useState<OfficerAppSummary[]>([])
  const [loading, setLoading] = React.useState(true)
  const [statusFilter, setStatusFilter] = React.useState('')

  React.useEffect(() => {
    setLoading(true)
    const params = statusFilter ? { status: statusFilter } : {}
    api.get('/applications', { params })
      .then(res => setApps(res.data))
      .finally(() => setLoading(false))
  }, [statusFilter])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Applications</h1>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-1.5 text-sm"
        >
          {FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {loading && <p>Loading...</p>}

      {!loading && apps.length === 0 && (
        <p className="text-slate-500">No applications matching this filter.</p>
      )}

      {!loading && apps.length > 0 && (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
              <th className="py-2 pr-4">Centre Name</th>
              <th className="py-2 pr-4">Operator</th>
              <th className="py-2 pr-4">Service Type</th>
              <th className="py-2 pr-4">Round</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {apps.map(app => (
              <tr
                key={app.id}
                onClick={() => navigate(`/officer/applications/${app.id}`)}
                className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
              >
                <td className="py-3 pr-4 font-medium">{app.centre_name}</td>
                <td className="py-3 pr-4 text-slate-600">{app.operator_name}</td>
                <td className="py-3 pr-4 text-slate-600">{app.type_of_service}</td>
                <td className="py-3 pr-4 text-slate-600">{app.current_round}</td>
                <td className="py-3 pr-4"><StatusBadge status={app.status} /></td>
                <td className="py-3 text-slate-500">{new Date(app.updated_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd frontend && npx vitest run src/pages/OfficerApplicationListPage.test.tsx
```
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/OfficerApplicationListPage.tsx \
        frontend/src/pages/OfficerApplicationListPage.test.tsx
git commit -m "feat: add OfficerApplicationListPage with status filter"
```

---

## Task 13: FeedbackPanel

**Files:**
- Create: `frontend/src/components/FeedbackPanel.tsx`
- Create: `frontend/src/components/FeedbackPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// frontend/src/components/FeedbackPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FeedbackPanel from './FeedbackPanel'

vi.mock('../lib/api', () => ({ api: { post: vi.fn() } }))
import { api } from '../lib/api'

const DOCS = [
  { id: 'doc-1', doc_type: 'staff_qualification', filename: 'staff.pdf', ai_status: 'pass' },
]

const renderPanel = (onSuccess = vi.fn()) =>
  render(
    <MemoryRouter>
      <FeedbackPanel
        applicationId="app-1"
        currentStatus="Application Received"
        documents={DOCS}
        onSuccess={onSuccess}
      />
    </MemoryRouter>
  )

describe('FeedbackPanel', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('submit button is disabled when comment is empty', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: /submit feedback/i })).toBeDisabled()
  })

  it('submit button is disabled when status not selected even with comment', () => {
    renderPanel()
    fireEvent.change(screen.getByPlaceholderText(/enter feedback comment/i), {
      target: { value: 'Fix this field' },
    })
    expect(screen.getByRole('button', { name: /submit feedback/i })).toBeDisabled()
  })

  it('submit button is enabled when comment and status both provided', async () => {
    renderPanel()
    fireEvent.change(screen.getByPlaceholderText(/enter feedback comment/i), {
      target: { value: 'Fix this field' },
    })
    const statusSelect = screen.getAllByRole('combobox').find(el =>
      el.querySelector('option[value="Under Review"]') !== null ||
      Array.from(el.querySelectorAll('option')).some(o => o.value === 'Under Review')
    )
    // Select the status setter (last combobox)
    const comboboxes = screen.getAllByRole('combobox')
    fireEvent.change(comboboxes[comboboxes.length - 1], { target: { value: 'Under Review' } })
    expect(screen.getByRole('button', { name: /submit feedback/i })).not.toBeDisabled()
  })

  it('calls API with correct payload and calls onSuccess', async () => {
    const onSuccess = vi.fn()
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { application_id: 'app-1', status: 'Under Review', feedback_items: [] },
    })
    renderPanel(onSuccess)

    fireEvent.change(screen.getByPlaceholderText(/enter feedback comment/i), {
      target: { value: 'Fix the UEN field' },
    })
    const comboboxes = screen.getAllByRole('combobox')
    fireEvent.change(comboboxes[comboboxes.length - 1], { target: { value: 'Under Review' } })
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/applications/app-1/feedback',
        expect.objectContaining({ new_status: 'Under Review' })
      )
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('preserves draft and shows error on API failure', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({
      response: { data: { detail: 'Invalid status transition' } },
    })
    renderPanel()

    fireEvent.change(screen.getByPlaceholderText(/enter feedback comment/i), {
      target: { value: 'My comment' },
    })
    const comboboxes = screen.getAllByRole('combobox')
    fireEvent.change(comboboxes[comboboxes.length - 1], { target: { value: 'Under Review' } })
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))

    expect(await screen.findByText(/invalid status transition/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/enter feedback comment/i)).toHaveValue('My comment')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/components/FeedbackPanel.test.tsx
```
Expected: FAILED (Cannot find module)

- [ ] **Step 3: Create FeedbackPanel.tsx**

```typescript
// frontend/src/components/FeedbackPanel.tsx
import React from 'react'
import { api } from '../lib/api'
import { getValidNextStatuses, getOfficerLabel } from '../lib/statusMachine'

interface Document {
  id: string
  doc_type: string
  filename: string
  ai_status: string
}

interface FeedbackItemDraft {
  targetType: 'field' | 'document'
  section: string
  fieldKey: string
  documentId: string
  comment: string
}

interface FeedbackPanelProps {
  applicationId: string
  currentStatus: string
  documents: Document[]
  onSuccess: () => void
}

const FIELD_SECTIONS = ['basic_details', 'operations', 'declarations']
const SECTION_LABELS: Record<string, string> = {
  basic_details: 'Basic Details',
  operations: 'Operations',
  declarations: 'Declarations',
}
const FIELDS_BY_SECTION: Record<string, string[]> = {
  basic_details: ['centre_name', 'operator_company_name', 'uen', 'contact_person', 'contact_email', 'contact_phone'],
  operations: ['centre_address', 'type_of_service', 'proposed_capacity'],
  declarations: ['compliance_confirmed'],
}
const FIELD_LABELS: Record<string, string> = {
  centre_name: 'Centre Name', operator_company_name: 'Operator / Company Name',
  uen: 'UEN', contact_person: 'Contact Person', contact_email: 'Contact Email',
  contact_phone: 'Contact Phone', centre_address: 'Centre Address',
  type_of_service: 'Type of Service', proposed_capacity: 'Proposed Capacity',
  compliance_confirmed: 'Compliance Declaration',
}
const COMMENT_TEMPLATES = [
  'Please provide a clearer copy of this document.',
  'This field contains incorrect or inconsistent information.',
  'The document appears to be expired or invalid.',
  'The information provided does not match supporting documents.',
  'Additional supporting evidence is required for this item.',
]

const emptyDraft = (): FeedbackItemDraft => ({
  targetType: 'field', section: 'basic_details', fieldKey: 'centre_name', documentId: '', comment: '',
})

function FeedbackItemRow({
  item, documents, onChange,
}: { item: FeedbackItemDraft; documents: Document[]; onChange: (u: Partial<FeedbackItemDraft>) => void }) {
  const [showTemplates, setShowTemplates] = React.useState(false)
  const fields = item.targetType === 'field' ? FIELDS_BY_SECTION[item.section] ?? [] : []

  return (
    <div className="border border-slate-100 rounded-md p-3 flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs text-slate-600">Type</label>
          <select
            value={item.targetType}
            onChange={e => {
              const t = e.target.value as 'field' | 'document'
              onChange({ targetType: t, section: t === 'field' ? 'basic_details' : 'documents', fieldKey: t === 'field' ? 'centre_name' : '', documentId: '' })
            }}
            className="border border-slate-200 rounded-md px-2 py-1 text-sm"
          >
            <option value="field">Form Field</option>
            <option value="document">Document</option>
          </select>
        </div>
        {item.targetType === 'field' && (
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs text-slate-600">Section</label>
            <select
              value={item.section}
              onChange={e => onChange({ section: e.target.value, fieldKey: FIELDS_BY_SECTION[e.target.value]?.[0] ?? '' })}
              className="border border-slate-200 rounded-md px-2 py-1 text-sm"
            >
              {FIELD_SECTIONS.map(s => <option key={s} value={s}>{SECTION_LABELS[s]}</option>)}
            </select>
          </div>
        )}
      </div>
      {item.targetType === 'field' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-600">Field</label>
          <select value={item.fieldKey} onChange={e => onChange({ fieldKey: e.target.value })}
            className="border border-slate-200 rounded-md px-2 py-1 text-sm">
            {fields.map(f => <option key={f} value={f}>{FIELD_LABELS[f] ?? f}</option>)}
          </select>
        </div>
      )}
      {item.targetType === 'document' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-600">Document</label>
          <select value={item.documentId} onChange={e => onChange({ documentId: e.target.value })}
            className="border border-slate-200 rounded-md px-2 py-1 text-sm">
            <option value="">— Select document —</option>
            {documents.map(d => <option key={d.id} value={d.id}>{d.doc_type}: {d.filename}</option>)}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-600">Comment</label>
          <button type="button" onClick={() => setShowTemplates(t => !t)}
            className="text-xs text-blue-600 underline">Insert template</button>
        </div>
        {showTemplates && (
          <div className="border border-slate-100 rounded-md shadow-sm bg-white">
            {COMMENT_TEMPLATES.map(t => (
              <button key={t} type="button"
                className="block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50"
                onClick={() => { onChange({ comment: t }); setShowTemplates(false) }}>{t}</button>
            ))}
          </div>
        )}
        <textarea value={item.comment} onChange={e => onChange({ comment: e.target.value })}
          className="border border-slate-200 rounded-md px-3 py-1.5 text-sm resize-none"
          rows={2} placeholder="Enter feedback comment..." />
      </div>
    </div>
  )
}

export default function FeedbackPanel({ applicationId, currentStatus, documents, onSuccess }: FeedbackPanelProps) {
  const [items, setItems] = React.useState<FeedbackItemDraft[]>([emptyDraft()])
  const [newStatus, setNewStatus] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const validNextStatuses = getValidNextStatuses(currentStatus)
  const canSubmit = items.some(i => i.comment.trim()) && newStatus !== '' && !submitting

  const updateItem = (index: number, update: Partial<FeedbackItemDraft>) =>
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...update } : item))

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const feedbackItems = items.filter(i => i.comment.trim()).map(i => ({
        target_type: i.targetType,
        section: i.section,
        field_key: i.targetType === 'field' ? i.fieldKey : null,
        document_id: i.targetType === 'document' ? i.documentId : null,
        comment: i.comment,
      }))
      await api.post(`/applications/${applicationId}/feedback`, { feedback_items: feedbackItems, new_status: newStatus })
      setItems([emptyDraft()])
      setNewStatus('')
      onSuccess()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Failed to submit feedback.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4 flex flex-col gap-4">
      <h2 className="font-semibold text-sm">Officer Feedback</h2>
      {items.map((item, index) => (
        <FeedbackItemRow key={index} item={item} documents={documents} onChange={u => updateItem(index, u)} />
      ))}
      <button type="button" onClick={() => setItems(prev => [...prev, emptyDraft()])}
        className="text-sm text-blue-600 underline text-left">+ Add another item</button>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-600">Set Status</label>
        <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-1.5 text-sm">
          <option value="">— Select next status —</option>
          {validNextStatuses.map(s => <option key={s} value={s}>{getOfficerLabel(s)}</option>)}
        </select>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="button" onClick={handleSubmit} disabled={!canSubmit}
        className="bg-slate-900 text-white py-2 px-4 rounded-md text-sm disabled:opacity-50">
        Submit Feedback
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd frontend && npx vitest run src/components/FeedbackPanel.test.tsx
```
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/FeedbackPanel.tsx frontend/src/components/FeedbackPanel.test.tsx
git commit -m "feat: add FeedbackPanel component with item drafts, templates, and status setter"
```

---

## Task 14: OfficerApplicationDetailPage

**Files:**
- Create: `frontend/src/pages/OfficerApplicationDetailPage.tsx`
- Create: `frontend/src/pages/OfficerApplicationDetailPage.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// frontend/src/pages/OfficerApplicationDetailPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import OfficerApplicationDetailPage from './OfficerApplicationDetailPage'

vi.mock('../lib/api', () => ({ api: { get: vi.fn() } }))
import { api } from '../lib/api'

const makeApp = (rounds: number) => ({
  id: 'app-1',
  status: 'Application Received',
  current_round: rounds,
  operator: { id: 'op-1', full_name: 'Alice Operator', email: 'alice@test.com', phone: '+65 1111 1111' },
  submissions: Array.from({ length: rounds }, (_, i) => ({
    id: `sub-${i + 1}`,
    round_number: i + 1,
    submitted_at: '2026-04-28T00:00:00Z',
    form_data: {
      basic_details: {
        centre_name: i === 0 ? 'Original Name' : 'Updated Name',
        operator_company_name: 'Co', uen: '123', contact_person: 'Alice',
        contact_email: 'alice@test.com', contact_phone: '123',
      },
      operations: { centre_address: 'Addr', type_of_service: 'Childcare', proposed_capacity: 30 },
      declarations: { compliance_confirmed: true },
    },
    documents: [
      { id: `doc-s-${i + 1}`, doc_type: 'staff_qualification', filename: 'staff.pdf', ai_status: 'pass', ai_details: null },
      { id: `doc-f-${i + 1}`, doc_type: 'fire_safety', filename: 'fire.pdf', ai_status: 'pass', ai_details: null },
      { id: `doc-p-${i + 1}`, doc_type: 'floor_plan', filename: 'plan.pdf', ai_status: 'pass', ai_details: null },
    ],
    feedback_items: [],
  })),
})

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/officer/applications/app-1']}>
      <Routes>
        <Route path="/officer/applications/:id" element={<OfficerApplicationDetailPage />} />
        <Route path="/officer/applications" element={<div>List Page</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('OfficerApplicationDetailPage', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows centre name and operator info', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: makeApp(1) })
    renderPage()
    expect(await screen.findByRole('heading', { name: /original name/i })).toBeInTheDocument()
    expect(screen.getByText(/alice operator/i)).toBeInTheDocument()
  })

  it('shows round tabs', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: makeApp(2) })
    renderPage()
    expect(await screen.findByRole('button', { name: /round 1/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /round 2/i })).toBeInTheDocument()
  })

  it('hides changes tab on round 1 (only one submission)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: makeApp(1) })
    renderPage()
    await screen.findByRole('heading', { name: /original name/i })
    expect(screen.queryByText(/changes \(/i)).not.toBeInTheDocument()
  })

  it('shows changes tab on round 2+ and clicking shows before→after', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: makeApp(2) })
    renderPage()
    // By default latest (round 2) is selected
    const changesTab = await screen.findByText(/changes \(/i)
    fireEvent.click(changesTab)
    // "Original Name" should appear as old value (strikethrough)
    expect(screen.getByText('Original Name')).toBeInTheDocument()
    expect(screen.getByText('Updated Name')).toBeInTheDocument()
  })

  it('renders FeedbackPanel', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: makeApp(1) })
    renderPage()
    expect(await screen.findByText(/officer feedback/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit feedback/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/pages/OfficerApplicationDetailPage.test.tsx
```
Expected: FAILED (Cannot find module)

- [ ] **Step 3: Create OfficerApplicationDetailPage.tsx**

```typescript
// frontend/src/pages/OfficerApplicationDetailPage.tsx
import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import StatusBadge from '../components/StatusBadge'
import ApplicationSections from '../components/ApplicationSections'
import FeedbackPanel from '../components/FeedbackPanel'

interface DocumentData {
  id: string; doc_type: string; filename: string; ai_status: string; ai_details: unknown
}
interface FeedbackItemData {
  id: string; target_type: string; section: string; field_key: string | null
  document_id: string | null; comment: string; created_by: string
}
interface SubmissionData {
  id: string; round_number: number; submitted_at: string
  form_data: Record<string, Record<string, unknown>>
  documents: DocumentData[]; feedback_items: FeedbackItemData[]
}
interface OfficerApp {
  id: string; status: string; current_round: number
  operator: { id: string; full_name: string; email: string; phone: string }
  submissions: SubmissionData[]
}

function computeChangesCount(curr: SubmissionData, prev: SubmissionData): number {
  let count = 0
  for (const section of ['basic_details', 'operations', 'declarations']) {
    const c = curr.form_data[section] ?? {}
    const p = prev.form_data[section] ?? {}
    for (const key of Object.keys({ ...c, ...p })) {
      if (c[key] !== p[key]) count++
    }
  }
  const prevByType = new Map(prev.documents.map(d => [d.doc_type, d.id]))
  for (const doc of curr.documents) {
    if (prevByType.has(doc.doc_type) && prevByType.get(doc.doc_type) !== doc.id) count++
  }
  return count
}

function ChangesView({ current, previous }: { current: SubmissionData; previous: SubmissionData }) {
  const fieldChanges: { label: string; oldVal: unknown; newVal: unknown }[] = []
  for (const section of ['basic_details', 'operations', 'declarations']) {
    const c = current.form_data[section] ?? {}
    const p = previous.form_data[section] ?? {}
    for (const key of Object.keys({ ...c, ...p })) {
      if (c[key] !== p[key]) fieldChanges.push({ label: `${section} / ${key}`, oldVal: p[key], newVal: c[key] })
    }
  }
  const docChanges = current.documents.filter(doc => {
    const prev = previous.documents.find(d => d.doc_type === doc.doc_type)
    return prev && prev.id !== doc.id
  })
  return (
    <div className="flex flex-col gap-3">
      {fieldChanges.map(({ label, oldVal, newVal }) => (
        <div key={label} className="border border-slate-200 rounded-md p-3">
          <p className="text-xs text-slate-500 mb-1">{label}</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="line-through text-slate-400">{String(oldVal ?? '')}</span>
            <span>→</span>
            <span className="text-slate-800">{String(newVal ?? '')}</span>
          </div>
        </div>
      ))}
      {docChanges.map(doc => (
        <div key={doc.id} className="border border-slate-200 rounded-md p-3">
          <p className="text-xs text-slate-500 mb-1">document / {doc.doc_type}</p>
          <div className="flex items-center gap-2 text-sm">
            <span>Re-uploaded</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${doc.ai_status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {doc.ai_status}
            </span>
          </div>
        </div>
      ))}
      {fieldChanges.length === 0 && docChanges.length === 0 && (
        <p className="text-sm text-slate-500">No changes detected.</p>
      )}
    </div>
  )
}

function SubmissionContent({ submission, previousSubmission }: { submission: SubmissionData; previousSubmission?: SubmissionData }) {
  const [activeTab, setActiveTab] = React.useState<'changes' | 'full'>('full')
  const hasChanges = previousSubmission !== undefined
  const changesCount = hasChanges ? computeChangesCount(submission, previousSubmission) : 0

  return (
    <div>
      {hasChanges && (
        <div className="flex gap-0 mb-4 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('changes')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'changes' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600'}`}
          >
            Changes ({changesCount})
          </button>
          <button
            onClick={() => setActiveTab('full')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'full' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600'}`}
          >
            Full Submission
          </button>
        </div>
      )}
      {hasChanges && activeTab === 'changes' && (
        <ChangesView current={submission} previous={previousSubmission!} />
      )}
      {(!hasChanges || activeTab === 'full') && (
        <ApplicationSections
          formData={submission.form_data}
          documents={submission.documents}
          previousFormData={previousSubmission?.form_data}
          previousDocuments={previousSubmission?.documents}
        />
      )}
    </div>
  )
}

export default function OfficerApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [app, setApp] = React.useState<OfficerApp | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedRoundIndex, setSelectedRoundIndex] = React.useState(0)

  const loadApp = React.useCallback(() => {
    if (!id) return
    setLoading(true)
    api.get(`/applications/${id}`)
      .then(res => {
        setApp(res.data)
        setSelectedRoundIndex(res.data.submissions.length - 1)
      })
      .catch(() => setError('Failed to load application.'))
      .finally(() => setLoading(false))
  }, [id])

  React.useEffect(() => { loadApp() }, [loadApp])

  if (loading) return <p className="p-6">Loading...</p>
  if (error) return <p className="p-6 text-red-500">{error}</p>
  if (!app) return <p className="p-6">Application not found.</p>

  const selectedSubmission = app.submissions[selectedRoundIndex]
  const previousSubmission = selectedRoundIndex > 0 ? app.submissions[selectedRoundIndex - 1] : undefined
  const latestSubmission = app.submissions[app.submissions.length - 1]
  const centreName = latestSubmission?.form_data.basic_details?.centre_name as string | undefined

  return (
    <div className="flex gap-6 p-6 min-h-screen">
      <div className="flex-1 min-w-0">
        <Link to="/officer/applications" className="text-sm text-blue-600 underline mb-2 block">
          &larr; Back to applications
        </Link>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{centreName || 'Application'}</h1>
            <p className="text-sm text-slate-600 mt-1">
              Round {app.current_round} · {app.operator.full_name} · {app.operator.email}
            </p>
          </div>
          <StatusBadge status={app.status} />
        </div>

        {app.submissions.length > 1 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {app.submissions.map((sub, idx) => (
              <button
                key={sub.id}
                onClick={() => setSelectedRoundIndex(idx)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                  idx === selectedRoundIndex ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Round {sub.round_number}
              </button>
            ))}
          </div>
        )}

        {selectedSubmission && (
          <SubmissionContent submission={selectedSubmission} previousSubmission={previousSubmission} />
        )}
      </div>

      <div className="w-80 shrink-0" style={{ position: 'sticky', top: '1rem', alignSelf: 'flex-start' }}>
        <FeedbackPanel
          applicationId={app.id}
          currentStatus={app.status}
          documents={latestSubmission?.documents ?? []}
          onSuccess={loadApp}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd frontend && npx vitest run src/pages/OfficerApplicationDetailPage.test.tsx
```
Expected: All PASS

- [ ] **Step 5: Run full frontend suite**

```bash
cd frontend && npx vitest run
```
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/OfficerApplicationDetailPage.tsx \
        frontend/src/pages/OfficerApplicationDetailPage.test.tsx
git commit -m "feat: add OfficerApplicationDetailPage with submission tabs, diff view, and FeedbackPanel"
```

---

## Task 15: Add officer routes to routes.tsx

**Files:**
- Modify: `frontend/src/routes.tsx`

- [ ] **Step 1: Update routes.tsx**

```typescript
// frontend/src/routes.tsx
import { createBrowserRouter } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import OperatorLayout from './components/OperatorLayout'
import OfficerLayout from './components/OfficerLayout'
import ApplicationListPage from './pages/ApplicationListPage'
import SubmitApplicationPage from './pages/SubmitApplicationPage'
import ApplicationDetailPage from './pages/ApplicationDetailPage'
import ResubmissionPage from './pages/ResubmissionPage'
import OfficerApplicationListPage from './pages/OfficerApplicationListPage'
import OfficerApplicationDetailPage from './pages/OfficerApplicationDetailPage'

export const router = createBrowserRouter([
  { path: '/', element: <LoginPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/operator',
    element: <OperatorLayout />,
    children: [
      { index: true, element: <ApplicationListPage /> },
      { path: 'applications', element: <ApplicationListPage /> },
      { path: 'applications/:id', element: <ApplicationDetailPage /> },
      { path: 'applications/:id/resubmit', element: <ResubmissionPage /> },
      { path: 'apply', element: <SubmitApplicationPage /> },
    ],
  },
  {
    path: '/officer',
    element: <OfficerLayout />,
    children: [
      { index: true, element: <OfficerApplicationListPage /> },
      { path: 'applications', element: <OfficerApplicationListPage /> },
      { path: 'applications/:id', element: <OfficerApplicationDetailPage /> },
    ],
  },
])
```

- [ ] **Step 2: Run full frontend suite**

```bash
cd frontend && npx vitest run
```
Expected: All PASS

- [ ] **Step 3: Run frontend lint and build**

```bash
cd frontend && npm run lint && npm run build
```
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes.tsx
git commit -m "feat: add officer routes under OfficerLayout"
```

---

## Task 16: Final verification

- [ ] **Step 1: Run full backend test suite**

```bash
cd backend && uv run pytest tests/ -v
```
Expected: All PASS

- [ ] **Step 2: Run backend lint**

```bash
cd backend && uv run ruff check src/ tests/
```
Expected: No errors

- [ ] **Step 3: Run full frontend test suite**

```bash
cd frontend && npx vitest run
```
Expected: All PASS

- [ ] **Step 4: Run frontend lint + build**

```bash
cd frontend && npm run lint && npm run build
```
Expected: No errors
