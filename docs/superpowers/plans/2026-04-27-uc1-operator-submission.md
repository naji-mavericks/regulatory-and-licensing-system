# UC1: Operator Application Submission & Resubmission — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full operator workflow: submit a multi-section childcare application with document uploads and AI verification, view application status and history, and resubmit flagged sections in response to officer feedback.

**Architecture:** All models in a single `models.py` (interdependent: users, applications, submissions, documents, feedback_items). Application endpoints in `routers/applications.py`, document upload + AI stub in `routers/documents.py`. Frontend pages in `pages/`, reusable components in `components/`. Backend returns operator-mapped status labels in all API responses.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2, Alembic, pytest — React 19, TypeScript 6, React Router 7, React Hook Form + Zod, shadcn/base-ui, vitest, @testing-library/react

---

## File Map

```
backend/
  src/app/
    models.py                          # NEW — all 5 models
    routers/
      __init__.py                      # NEW — empty
      applications.py                  # NEW — submit, list, detail, history, resubmit
      documents.py                     # NEW — upload + AI stub
    services/
      __init__.py                      # NEW — empty
      ai_stub.py                       # NEW — AI verification stub
    auth/
      router.py                        # MODIFY — look up user in DB
      dependencies.py                  # MODIFY — add get_db to Depends
    main.py                            # MODIFY — register new routers
    config.py                          # MODIFY — add upload_dir setting
  alembic/
    env.py                             # MODIFY — import models
    versions/                          # migration auto-generated
  tests/
    conftest.py                        # MODIFY — add db session fixture
    test_auth.py                       # MODIFY — users table changes
    test_documents.py                  # NEW
    test_applications.py               # NEW

frontend/
  src/
    routes.tsx                         # MODIFY — add operator routes
    pages/
      ApplicationListPage.tsx          # NEW
      SubmitApplicationPage.tsx        # NEW
      ApplicationDetailPage.tsx        # NEW
      ResubmissionPage.tsx             # NEW
    components/
      ProgressIndicator.tsx            # NEW
      DocumentUploader.tsx             # NEW
      FeedbackSummary.tsx              # NEW
```

---

### Task 1: Users table + seed data + update auth login (Issue #7 part 1)

**Files:**
- Create: `backend/src/app/models.py`
- Modify: `backend/src/app/auth/router.py`
- Modify: `backend/src/app/auth/dependencies.py`
- Modify: `backend/alembic/env.py` (uncomment model import)
- Modify: `backend/tests/test_auth.py`
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Write failing auth test for DB-backed login**

```python
# backend/tests/test_auth.py — replace existing file contents

from uuid import UUID

from jose import jwt

from app.config import settings

def test_login_operator_returns_token(client, db_session):
    response = client.post(
        "/auth/login", json={"username": "alice", "role": "operator"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_officer_returns_token(client, db_session):
    response = client.post("/auth/login", json={"username": "bob", "role": "officer"})
    assert response.status_code == 200


def test_login_unknown_user_rejected(client, db_session):
    response = client.post(
        "/auth/login", json={"username": "nobody", "role": "operator"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "User not found"


def test_token_sub_is_user_id_uuid(client, db_session):
    response = client.post(
        "/auth/login", json={"username": "alice", "role": "operator"}
    )
    token = response.json()["access_token"]
    payload = jwt.decode(
        token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
    )
    UUID(payload["sub"])  # must be a valid UUID, not a username string
    assert payload["role"] == "operator"


def test_me_returns_user_profile(client, db_session):
    login = client.post("/auth/login", json={"username": "alice", "role": "operator"})
    token = login.json()["access_token"]
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "alice"
    assert data["full_name"] == "Alice Operator"
    assert data["role"] == "operator"
```

- [ ] **Step 2: Add test database fixtures to conftest.py**

```python
# backend/tests/conftest.py

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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_auth.py -v`
Expected: FAIL — User model not defined yet, login doesn't look up DB

- [ ] **Step 4: Create models.py with User model**

```python
# backend/src/app/models.py

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy import JSON, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)  # "operator" or "officer"
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    applications: Mapped[list["Application"]] = relationship(back_populates="operator")
```

- [ ] **Step 5: Update auth login to look up user in DB**

```python
# backend/src/app/auth/router.py

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import create_token, get_current_user
from app.auth.schemas import LoginRequest, TokenResponse
from app.database.session import get_db
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Annotated[Session, Depends(get_db)]):
    user = db.query(User).filter(
        User.username == request.username,
        User.role == request.role,
    ).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    token = create_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token)


@router.get("/me")
def me(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    return user
```

- [ ] **Step 6: Update /me to return full user profile**

```python
# backend/src/app/auth/router.py — replace the /me endpoint

@router.get("/me")
def me(
    user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    db_user = db.query(User).filter(User.id == user["sub"]).first()
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    return {
        "id": str(db_user.id),
        "username": db_user.username,
        "role": db_user.role,
        "full_name": db_user.full_name,
        "email": db_user.email,
        "phone": db_user.phone,
    }
```

- [ ] **Step 7: Update alembic/env.py to import models**

```python
# backend/alembic/env.py — uncomment and update the model import line

from app.models import User  # replaces the placeholder comment
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_auth.py -v`
Expected: all 7 tests PASS

- [ ] **Step 9: Commit**

```bash
git add backend/src/app/models.py backend/src/app/auth/router.py backend/alembic/env.py backend/tests/conftest.py backend/tests/test_auth.py
git commit -m "feat: add User model, update auth login to use DB lookup"
```

---

### Task 2: Applications, Submissions, Documents, FeedbackItems models + migration (Issue #7 part 2)

**Files:**
- Modify: `backend/src/app/models.py` — add remaining models
- Modify: `backend/alembic/env.py` — update model imports
- Create: alembic migration (auto-generated)

- [ ] **Step 1: Add remaining models to models.py**

Add these classes to `backend/src/app/models.py` after the `User` class:

```python
class Application(Base):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    operator_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="Application Received")
    current_round: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    operator: Mapped["User"] = relationship(back_populates="applications")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="application", order_by="Submission.round_number")
    documents: Mapped[list["Document"]] = relationship(back_populates="application", foreign_keys="Document.application_id")


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("applications.id"), nullable=False)
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    form_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    application: Mapped["Application"] = relationship(back_populates="submissions")
    documents: Mapped[list["Document"]] = relationship(back_populates="submission", foreign_keys="Document.submission_id")
    feedback_items: Mapped[list["FeedbackItem"]] = relationship(back_populates="submission")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("applications.id"), nullable=False)
    submission_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("submissions.id"), nullable=True)
    doc_type: Mapped[str] = mapped_column(String, nullable=False)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    ai_status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    ai_details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    application: Mapped["Application"] = relationship(back_populates="documents", foreign_keys=[application_id])
    submission: Mapped["Submission | None"] = relationship(back_populates="documents", foreign_keys=[submission_id])


class FeedbackItem(Base):
    __tablename__ = "feedback_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    submission_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("submissions.id"), nullable=False)
    target_type: Mapped[str] = mapped_column(String, nullable=False)  # "field" or "document"
    section: Mapped[str] = mapped_column(String, nullable=False)
    field_key: Mapped[str | None] = mapped_column(String, nullable=True)
    document_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("documents.id"), nullable=True)
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    submission: Mapped["Submission"] = relationship(back_populates="feedback_items")
```

- [ ] **Step 2: Update alembic/env.py model imports**

```python
# backend/alembic/env.py — replace the single import

from app.models import Application, Document, FeedbackItem, Submission, User
```

- [ ] **Step 3: Generate and run migration**

Run: `cd backend && uv run alembic revision --autogenerate -m "add users applications submissions documents feedback_items"`
Expected: creates a migration file in `alembic/versions/`

Run: `cd backend && uv run alembic upgrade head`
Expected: tables created in the database

- [ ] **Step 4: Run existing tests to verify nothing broken**

Run: `cd backend && uv run pytest tests/ -v`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/app/models.py backend/alembic/env.py backend/alembic/versions/
git commit -m "feat: add Application, Submission, Document, FeedbackItem models"
```

---

### Task 3: Document upload endpoint + AI verification stub (Issue #8 part 1)

**Files:**
- Create: `backend/src/app/services/__init__.py`
- Create: `backend/src/app/services/ai_stub.py`
- Create: `backend/src/app/routers/__init__.py`
- Create: `backend/src/app/routers/documents.py`
- Modify: `backend/src/app/config.py`
- Modify: `backend/src/app/main.py`
- Create: `backend/tests/test_documents.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_documents.py

import io
from pathlib import Path
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_documents.py -v`
Expected: FAIL — endpoint not found (404)

- [ ] **Step 3: Add upload_dir to config**

```python
# backend/src/app/config.py — add upload_dir

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/regulatory"
    jwt_secret: str = "dev-secret-change-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 60
    upload_dir: str = "./uploads"

    model_config = {"env_file": ".env"}


settings = Settings()
```

- [ ] **Step 4: Create AI stub service**

```python
# backend/src/app/services/ai_stub.py

def run_ai_verification(filename: str, doc_type: str) -> tuple[str, dict]:
    """Stub AI verification. Returns (ai_status, ai_details)."""
    if f"fail-{doc_type}" in filename.lower():
        return "fail", {"reason": "Document appears invalid/expired"}
    return "pass", {"confidence": 0.95}
```

- [ ] **Step 5: Create document upload router**

```python
# backend/src/app/routers/documents.py

import shutil
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_operator
from app.config import settings
from app.database.session import get_db
from app.models import Application, Document
from app.services.ai_stub import run_ai_verification

router = APIRouter(prefix="/documents", tags=["documents"])


def save_file(upload_dir: Path, file: UploadFile) -> Path:
    upload_dir.mkdir(parents=True, exist_ok=True)
    dest = upload_dir / f"{uuid.uuid4()}_{file.filename}"
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    return dest


@router.post("/upload")
def upload_document(
    file: Annotated[UploadFile, File(...)],
    doc_type: Annotated[str, Form()],
    application_id: Annotated[str | None, Form()] = None,
    user: Annotated[dict, Depends(require_operator)],
    db: Annotated[Session, Depends(get_db)],
):
    # Get or create application
    if application_id:
        application = db.query(Application).filter(
            Application.id == application_id,
            Application.operator_id == user["sub"],
        ).first()
        if application is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    else:
        application = Application(operator_id=user["sub"])
        db.add(application)
        db.commit()
        db.refresh(application)

    # Save file to disk
    upload_dir = Path(settings.upload_dir)
    file_path = save_file(upload_dir, file)

    # Run AI verification
    ai_status, ai_details = run_ai_verification(file.filename, doc_type)

    # Create document record
    document = Document(
        application_id=application.id,
        doc_type=doc_type,
        filename=file.filename,
        file_path=str(file_path),
        ai_status=ai_status,
        ai_details=ai_details,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    return {
        "id": str(document.id),
        "application_id": str(application.id),
        "doc_type": document.doc_type,
        "filename": document.filename,
        "ai_status": document.ai_status,
        "ai_details": document.ai_details,
    }
```

- [ ] **Step 6: Register router in main.py**

```python
# backend/src/app/main.py — add imports and router registration

from fastapi import FastAPI

from app.auth.router import router as auth_router
from app.routers.documents import router as documents_router

app = FastAPI(title="Regulatory and Licensing System")

app.include_router(auth_router)
app.include_router(documents_router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_documents.py -v`
Expected: 5 tests PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/app/services/ backend/src/app/routers/ backend/src/app/config.py backend/src/app/main.py backend/tests/test_documents.py
git commit -m "feat: add document upload endpoint with AI verification stub"
```

---

### Task 4: Submit application endpoint (Issue #8 part 2)

**Files:**
- Create: `backend/src/app/routers/applications.py`
- Modify: `backend/src/app/main.py`
- Modify: `backend/tests/test_applications.py` (add tests)

- [ ] **Step 1: Write failing tests for submit**

```python
# backend/tests/test_applications.py

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
            "form_data": {"basic_details": {"centre_name": "Test"}, "operations": {"centre_address": "Addr", "type_of_service": "Childcare", "proposed_capacity": 10}, "declarations": {"compliance_confirmed": True}},
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
                "basic_details": {"centre_name": "Test", "operator_company_name": "Co", "uen": "123", "contact_person": "A", "contact_email": "a@b.com", "contact_phone": "123"},
                "operations": {"centre_address": "Addr", "type_of_service": "Childcare", "proposed_capacity": 10},
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
```

- [ ] **Step 2: Create application router with submit endpoint**

```python
# backend/src/app/routers/applications.py

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_operator
from app.database.session import get_db
from app.models import Application, Document, Submission

router = APIRouter(prefix="/applications", tags=["applications"])

OPERATOR_STATUS_MAP = {
    "Application Received": "Submitted",
    "Under Review": "Under Review",
    "Pending Pre-Site Resubmission": "Pending Pre-Site Resubmission",
    "Pre-Site Resubmitted": "Pre-Site Resubmitted",
}

REQUIRED_DOC_TYPES = {"staff_qualification", "fire_safety", "floor_plan"}

BASIC_DETAILS_FIELDS = {"centre_name", "operator_company_name", "uen", "contact_person", "contact_email", "contact_phone"}
OPERATIONS_FIELDS = {"centre_address", "type_of_service", "proposed_capacity"}


def validate_form_data(form_data: dict) -> list[str]:
    errors = []
    bd = form_data.get("basic_details", {})
    for field in BASIC_DETAILS_FIELDS:
        if not bd.get(field):
            errors.append(f"basic_details.{field} is required")
    ops = form_data.get("operations", {})
    for field in OPERATIONS_FIELDS:
        if not ops.get(field):
            errors.append(f"operations.{field} is required")
    decl = form_data.get("declarations", {})
    if not decl.get("compliance_confirmed"):
        errors.append("declarations.compliance_confirmed must be true")
    return errors


@router.post("")
def submit_application(
    body: dict,
    user: Annotated[dict, Depends(require_operator)],
    db: Annotated[Session, Depends(get_db)],
):
    application_id = body.get("application_id")
    form_data = body.get("form_data", {})
    document_ids = body.get("document_ids", [])

    if not application_id or not form_data or not document_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="application_id, form_data, and document_ids are required")

    # Verify application belongs to operator
    application = db.query(Application).filter(
        Application.id == application_id,
        Application.operator_id == user["sub"],
    ).first()
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    # Validate form data
    errors = validate_form_data(form_data)
    if errors:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="; ".join(errors))

    # Verify all required doc types present
    docs = db.query(Document).filter(Document.id.in_(document_ids)).all()
    doc_types_present = {d.doc_type for d in docs}
    missing = REQUIRED_DOC_TYPES - doc_types_present
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required document types: {', '.join(missing)}",
        )

    # Create submission
    submission = Submission(
        application_id=application.id,
        round_number=application.current_round,
        form_data=form_data,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # Link documents to submission
    for doc in docs:
        doc.submission_id = submission.id
    db.commit()

    # Refresh to include documents
    db.refresh(submission)

    return {
        "id": str(application.id),
        "status": OPERATOR_STATUS_MAP.get(application.status, application.status),
        "round_number": submission.round_number,
        "latest_submission": {
            "id": str(submission.id),
            "form_data": submission.form_data,
            "documents": [
                {
                    "id": str(d.id),
                    "doc_type": d.doc_type,
                    "filename": d.filename,
                    "ai_status": d.ai_status,
                    "ai_details": d.ai_details,
                }
                for d in docs
            ],
        },
    }


@router.get("")
def list_applications(
    user: Annotated[dict, Depends(require_operator)],
    db: Annotated[Session, Depends(get_db)],
):
    applications = (
        db.query(Application)
        .filter(Application.operator_id == user["sub"])
        .order_by(Application.updated_at.desc())
        .all()
    )
    return [
        {
            "id": str(app.id),
            "status": OPERATOR_STATUS_MAP.get(app.status, app.status),
            "centre_name": app.submissions[0].form_data.get("basic_details", {}).get("centre_name", "") if app.submissions else "",
            "type_of_service": app.submissions[0].form_data.get("operations", {}).get("type_of_service", "") if app.submissions else "",
            "current_round": app.current_round,
            "updated_at": app.updated_at.isoformat(),
        }
        for app in applications
    ]
```

- [ ] **Step 3: Register applications router in main.py**

```python
# backend/src/app/main.py

from fastapi import FastAPI

from app.auth.router import router as auth_router
from app.routers.documents import router as documents_router
from app.routers.applications import router as applications_router

app = FastAPI(title="Regulatory and Licensing System")

app.include_router(auth_router)
app.include_router(documents_router)
app.include_router(applications_router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Run tests**

Run: `cd backend && uv run pytest tests/test_applications.py -v`
Expected: all tests PASS

- [ ] **Step 5: Run all tests**

Run: `cd backend && uv run pytest tests/ -v`
Expected: all tests PASS (no regressions)

- [ ] **Step 6: Commit**

```bash
git add backend/src/app/routers/applications.py backend/src/app/main.py backend/tests/test_applications.py
git commit -m "feat: add submit application and list applications endpoints"
```

---

### Task 5: Get application detail + submission history endpoints (Issues #9, #13)

**Files:**
- Modify: `backend/src/app/routers/applications.py`
- Modify: `backend/tests/test_applications.py`

- [ ] **Step 1: Write failing tests for detail + history**

```python
# backend/tests/test_applications.py — add these tests

def test_get_application_returns_operator_label(client, db_session):
    """After submit, GET returns operator-facing status."""
    headers = get_operator_token(client, db_session)
    doc1 = upload_doc(client, headers, "staff_cert.pdf", "staff_qualification")
    doc2 = upload_doc(client, headers, "fire_safety.pdf", "fire_safety")
    doc3 = upload_doc(client, headers, "floor_plan.pdf", "floor_plan")
    app_id = doc1["application_id"]

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
    doc2 = upload_doc(client, headers_a, "fire_safety.pdf", "fire_safety")
    doc3 = upload_doc(client, headers_a, "floor_plan.pdf", "floor_plan")

    submit_resp = client.post(
        "/applications",
        json={
            "application_id": doc1["application_id"],
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
    doc2 = upload_doc(client, headers, "fire_safety.pdf", "fire_safety")
    doc3 = upload_doc(client, headers, "floor_plan.pdf", "floor_plan")

    client.post(
        "/applications",
        json={
            "application_id": doc1["application_id"],
            "form_data": {
                "basic_details": {"centre_name": "Test", "operator_company_name": "Co", "uen": "123", "contact_person": "A", "contact_email": "a@b.com", "contact_phone": "123"},
                "operations": {"centre_address": "Addr", "type_of_service": "Childcare", "proposed_capacity": 10},
                "declarations": {"compliance_confirmed": True},
            },
            "document_ids": [doc1["id"], doc2["id"], doc3["id"]],
        },
        headers=headers,
    )

    response = client.get(f"/applications/{doc1['application_id']}/submissions", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["round_number"] == 1
    assert data[0]["form_data"] is not None
    assert len(data[0]["documents"]) == 3
```

- [ ] **Step 2: Add detail + history endpoints to applications router**

```python
# backend/src/app/routers/applications.py — add below existing endpoints


@router.get("/{application_id}")
def get_application(
    application_id: str,
    user: Annotated[dict, Depends(require_operator)],
    db: Annotated[Session, Depends(get_db)],
):
    application = db.query(Application).filter(
        Application.id == application_id,
        Application.operator_id == user["sub"],
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
        db.query(FeedbackItem)
        .filter(FeedbackItem.submission_id == latest_sub.id)
        .all()
        if latest_sub
        else []
    )

    docs = (
        db.query(Document)
        .filter(Document.submission_id == latest_sub.id)
        .all()
        if latest_sub
        else []
    )

    return {
        "id": str(application.id),
        "status": OPERATOR_STATUS_MAP.get(application.status, application.status),
        "current_round": application.current_round,
        "latest_submission": {
            "id": str(latest_sub.id),
            "form_data": latest_sub.form_data,
            "documents": [
                {
                    "id": str(d.id),
                    "doc_type": d.doc_type,
                    "filename": d.filename,
                    "ai_status": d.ai_status,
                    "ai_details": d.ai_details,
                }
                for d in docs
            ],
        } if latest_sub else None,
        "latest_feedback": [
            {
                "id": str(f.id),
                "target_type": f.target_type,
                "section": f.section,
                "field_key": f.field_key,
                "document_id": str(f.document_id) if f.document_id else None,
                "comment": f.comment,
                "created_by": f.created_by,
                "created_at": f.created_at.isoformat(),
            }
            for f in latest_feedback
        ],
    }


@router.get("/{application_id}/submissions")
def get_submissions(
    application_id: str,
    user: Annotated[dict, Depends(require_operator)],
    db: Annotated[Session, Depends(get_db)],
):
    application = db.query(Application).filter(
        Application.id == application_id,
        Application.operator_id == user["sub"],
    ).first()
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    submissions = (
        db.query(Submission)
        .filter(Submission.application_id == application.id)
        .order_by(Submission.round_number)
        .all()
    )

    return [
        {
            "id": str(sub.id),
            "round_number": sub.round_number,
            "submitted_at": sub.submitted_at.isoformat(),
            "form_data": sub.form_data,
            "documents": [
                {
                    "id": str(d.id),
                    "doc_type": d.doc_type,
                    "filename": d.filename,
                    "ai_status": d.ai_status,
                    "ai_details": d.ai_details,
                }
                for d in sub.documents
            ],
            "feedback_items": [
                {
                    "id": str(f.id),
                    "target_type": f.target_type,
                    "section": f.section,
                    "field_key": f.field_key,
                    "document_id": str(f.document_id) if f.document_id else None,
                    "comment": f.comment,
                    "created_by": f.created_by,
                    "created_at": f.created_at.isoformat(),
                }
                for f in sub.feedback_items
            ],
        }
        for sub in submissions
    ]
```

Update the imports at the top of `applications.py` to include `FeedbackItem`:

```python
from app.models import Application, Document, FeedbackItem, Submission
```

- [ ] **Step 3: Run tests**

Run: `cd backend && uv run pytest tests/test_applications.py -v`
Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/app/routers/applications.py backend/tests/test_applications.py
git commit -m "feat: add get application detail and submission history endpoints"
```

---

### Task 6: Resubmit endpoint (Issue #12)

**Files:**
- Modify: `backend/src/app/routers/applications.py`
- Modify: `backend/tests/test_applications.py`

- [ ] **Step 1: Write failing test for resubmit**

```python
# backend/tests/test_applications.py — add these tests

def test_resubmit_creates_new_round(client, db_session):
    headers = get_operator_token(client, db_session)
    doc1 = upload_doc(client, headers, "staff_cert.pdf", "staff_qualification")
    doc2 = upload_doc(client, headers, "fire_safety.pdf", "fire_safety")
    doc3 = upload_doc(client, headers, "floor_plan.pdf", "floor_plan")
    app_id = doc1["application_id"]

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
    new_doc = upload_doc(client, headers, "new_fire_safety.pdf", "fire_safety")
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
    doc2 = upload_doc(client, headers, "fire_safety.pdf", "fire_safety")
    doc3 = upload_doc(client, headers, "floor_plan.pdf", "floor_plan")
    app_id = doc1["application_id"]

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
    new_fire = upload_doc(client, headers, "new_fire_safety.pdf", "fire_safety")
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
```

- [ ] **Step 2: Add resubmit endpoint**

```python
# backend/src/app/routers/applications.py — add resubmit endpoint


@router.post("/{application_id}/resubmit")
def resubmit_application(
    application_id: str,
    body: dict,
    user: Annotated[dict, Depends(require_operator)],
    db: Annotated[Session, Depends(get_db)],
):
    application = db.query(Application).filter(
        Application.id == application_id,
        Application.operator_id == user["sub"],
    ).first()
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    previous_submission = (
        db.query(Submission)
        .filter(Submission.application_id == application.id)
        .order_by(Submission.round_number.desc())
        .first()
    )
    if previous_submission is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No previous submission to resubmit")

    partial_form_data = body.get("form_data", {})
    new_document_ids = body.get("document_ids", [])

    # Merge form_data: start from previous, overlay new values
    merged_form = {**previous_submission.form_data}
    for section, fields in partial_form_data.items():
        if section not in merged_form:
            merged_form[section] = {}
        if isinstance(fields, dict):
            merged_form[section] = {**merged_form[section], **fields}

    # Create new submission round
    new_round_number = application.current_round + 1
    new_submission = Submission(
        application_id=application.id,
        round_number=new_round_number,
        form_data=merged_form,
    )
    db.add(new_submission)
    db.commit()
    db.refresh(new_submission)

    # Handle documents: carry forward unflagged, replace flagged
    new_docs_requested = db.query(Document).filter(Document.id.in_(new_document_ids)).all()
    new_doc_types = {d.doc_type for d in new_docs_requested}

    for prev_doc in previous_submission.documents:
        if prev_doc.doc_type not in new_doc_types:
            # Carry forward: create a new reference (not a new file)
            carried = Document(
                application_id=application.id,
                submission_id=new_submission.id,
                doc_type=prev_doc.doc_type,
                filename=prev_doc.filename,
                file_path=prev_doc.file_path,
                ai_status=prev_doc.ai_status,
                ai_details=prev_doc.ai_details,
            )
            db.add(carried)

    # Attach new documents to the new submission
    for doc in new_docs_requested:
        doc.submission_id = new_submission.id

    # Update application
    application.current_round = new_round_number
    application.status = "Pre-Site Resubmitted"
    db.commit()
    db.refresh(new_submission)

    return {
        "id": str(application.id),
        "status": OPERATOR_STATUS_MAP.get(application.status, application.status),
        "round_number": new_submission.round_number,
        "latest_submission": {
            "id": str(new_submission.id),
            "form_data": new_submission.form_data,
            "documents": [
                {
                    "id": str(d.id),
                    "doc_type": d.doc_type,
                    "filename": d.filename,
                    "ai_status": d.ai_status,
                    "ai_details": d.ai_details,
                }
                for d in new_submission.documents
            ],
        },
    }
```

- [ ] **Step 3: Run tests**

Run: `cd backend && uv run pytest tests/test_applications.py -v`
Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/app/routers/applications.py backend/tests/test_applications.py
git commit -m "feat: add resubmit endpoint with form_data merge and document carry-forward"
```

---

### Task 7: Frontend — routes and ApplicationListPage (Issues #24)

**Files:**
- Modify: `frontend/src/routes.tsx`
- Create: `frontend/src/pages/ApplicationListPage.tsx`
- Create: `frontend/src/pages/ApplicationListPage.test.tsx`

- [ ] **Step 1: Write failing test for ApplicationListPage**

```tsx
// frontend/src/pages/ApplicationListPage.test.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ApplicationListPage from './ApplicationListPage'

// Mock the api module
vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

import { api } from '../lib/api'

describe('ApplicationListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when no applications', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [] })
    render(
      <MemoryRouter>
        <ApplicationListPage />
      </MemoryRouter>
    )
    expect(screen.getByText(/no applications/i)).toBeInTheDocument()
  })

  it('renders application cards', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [
        {
          id: 'app-1',
          status: 'Submitted',
          centre_name: 'Sunshine Childcare',
          type_of_service: 'Childcare',
          current_round: 1,
          updated_at: '2026-04-27T00:00:00Z',
        },
      ],
    })
    render(
      <MemoryRouter>
        <ApplicationListPage />
      </MemoryRouter>
    )
    expect(await screen.findByText('Sunshine Childcare')).toBeInTheDocument()
    expect(screen.getByText('Submitted')).toBeInTheDocument()
  })

  it('has a new application button linking to /operator/apply', () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [] })
    render(
      <MemoryRouter>
        <ApplicationListPage />
      </MemoryRouter>
    )
    const link = screen.getByRole('link', { name: /new application/i })
    expect(link).toHaveAttribute('href', '/operator/apply')
  })
})
```

- [ ] **Step 2: Implement ApplicationListPage**

```tsx
// frontend/src/pages/ApplicationListPage.tsx

import React from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

interface ApplicationSummary {
  id: string
  status: string
  centre_name: string
  type_of_service: string
  current_round: number
  updated_at: string
}

export default function ApplicationListPage() {
  const [apps, setApps] = React.useState<ApplicationSummary[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    api.get('/applications')
      .then(res => setApps(res.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Applications</h1>
        <Link
          to="/operator/apply"
          className="bg-slate-900 text-white px-4 py-2 rounded text-sm"
        >
          New Application
        </Link>
      </div>

      {loading && <p className="text-slate-500">Loading...</p>}

      {!loading && apps.length === 0 && (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-slate-500 mb-4">No applications yet</p>
          <Link to="/operator/apply" className="text-blue-600 underline">
            Start your first application
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {apps.map(app => (
          <Link
            key={app.id}
            to={`/operator/applications/${app.id}`}
            className="border rounded-lg p-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{app.centre_name}</h2>
                <p className="text-sm text-slate-500">{app.type_of_service}</p>
              </div>
              <span className="text-sm bg-slate-100 px-2 py-1 rounded">
                {app.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Round {app.current_round} &middot; Updated {new Date(app.updated_at).toLocaleDateString()}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update routes**

```tsx
// frontend/src/routes.tsx

import { createBrowserRouter } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import ApplicationListPage from './pages/ApplicationListPage'

export const router = createBrowserRouter([
  { path: '/', element: <LoginPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/operator', element: <ApplicationListPage /> },
  { path: '/operator/applications', element: <ApplicationListPage /> },
])
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes.tsx frontend/src/pages/ApplicationListPage.tsx frontend/src/pages/ApplicationListPage.test.tsx
git commit -m "feat: add operator application list page"
```

---

### Task 8: Frontend — SubmitApplicationPage with DocumentUploader (Issue #10)

**Files:**
- Create: `frontend/src/components/DocumentUploader.tsx`
- Create: `frontend/src/components/ProgressIndicator.tsx`
- Create: `frontend/src/pages/SubmitApplicationPage.tsx`
- Modify: `frontend/src/routes.tsx`

- [ ] **Step 1: Create DocumentUploader component**

```tsx
// frontend/src/components/DocumentUploader.tsx

import React from 'react'
import { api } from '../lib/api'

interface UploadedDoc {
  id: string
  doc_type: string
  filename: string
  ai_status: string
  ai_details: Record<string, unknown> | null
}

interface Props {
  docType: string
  label: string
  required?: boolean
  applicationId: string | null
  onApplicationId: (id: string) => void
  onUpload: (doc: UploadedDoc) => void
}

export default function DocumentUploader({
  docType,
  label,
  required = true,
  applicationId,
  onApplicationId,
  onUpload,
}: Props) {
  const [uploaded, setUploaded] = React.useState<UploadedDoc | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('doc_type', docType)
    if (applicationId) {
      formData.append('application_id', applicationId)
    }

    try {
      const response = await api.post('/documents/upload', formData)
      const doc = response.data as UploadedDoc
      setUploaded(doc)
      onUpload(doc)
      if (!applicationId && response.data.application_id) {
        onApplicationId(response.data.application_id)
      }
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
        {uploaded && (
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              uploaded.ai_status === 'pass'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {uploaded.ai_status === 'pass' ? '✓ Pass' : '✗ Issues found'}
          </span>
        )}
        {uploading && (
          <span className="text-xs text-slate-500">Verifying...</span>
        )}
      </div>

      {uploaded ? (
        <div>
          <p className="text-xs text-slate-500">{uploaded.filename}</p>
          {uploaded.ai_status === 'fail' && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-blue-600 underline mt-1"
            >
              Re-upload
            </button>
          )}
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-slate-300 rounded p-6 text-center cursor-pointer hover:border-slate-400"
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="text-sm text-slate-500">
            Click or drag to upload
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFile}
        accept=".pdf,.jpg,.jpeg,.png"
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Create ProgressIndicator component**

```tsx
// frontend/src/components/ProgressIndicator.tsx

interface Props {
  sections: { name: string; complete: boolean }[]
}

export default function ProgressIndicator({ sections }: Props) {
  const completeCount = sections.filter(s => s.complete).length

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium">
          Progress: {completeCount}/{sections.length}
        </span>
        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${(completeCount / sections.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {sections.map(s => (
          <span
            key={s.name}
            className={`text-xs px-2 py-1 rounded ${
              s.complete
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {s.complete ? '✓' : '○'} {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create SubmitApplicationPage**

```tsx
// frontend/src/pages/SubmitApplicationPage.tsx

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '../lib/api'
import DocumentUploader from '../components/DocumentUploader'
import ProgressIndicator from '../components/ProgressIndicator'

const formSchema = z.object({
  basic_details: z.object({
    centre_name: z.string().min(1, 'Required'),
    operator_company_name: z.string().min(1, 'Required'),
    uen: z.string().min(1, 'Required'),
    contact_person: z.string().min(1, 'Required'),
    contact_email: z.string().email(),
    contact_phone: z.string().min(1, 'Required'),
  }),
  operations: z.object({
    centre_address: z.string().min(1, 'Required'),
    type_of_service: z.enum(['Student Care', 'Childcare']),
    proposed_capacity: z.number({ coerce: true }).min(1),
  }),
  declarations: z.object({
    compliance_confirmed: z.literal(true, {
      errorMap: () => ({ message: 'You must confirm the declaration' }),
    }),
  }),
})

type FormData = z.infer<typeof formSchema>

interface UploadedDoc {
  id: string
  doc_type: string
  filename: string
  ai_status: string
  ai_details: Record<string, unknown> | null
}

export default function SubmitApplicationPage() {
  const navigate = useNavigate()
  const [applicationId, setApplicationId] = React.useState<string | null>(null)
  const [uploadedDocs, setUploadedDocs] = React.useState<UploadedDoc[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      basic_details: { centre_name: '', operator_company_name: '', uen: '', contact_person: '', contact_email: '', contact_phone: '' },
      operations: { centre_address: '', type_of_service: 'Childcare', proposed_capacity: undefined },
      declarations: { compliance_confirmed: undefined },
    },
  })

  const watchedValues = watch()

  const sections = [
    {
      name: 'Basic Details',
      complete: Object.values(watchedValues.basic_details).every(v => v !== '' && v !== undefined),
    },
    {
      name: 'Operations',
      complete: Object.values(watchedValues.operations).every(v => v !== '' && v !== undefined),
    },
    {
      name: 'Documents',
      complete: ['staff_qualification', 'fire_safety', 'floor_plan'].every(
        dt => uploadedDocs.some(d => d.doc_type === dt && d.ai_status === 'pass')
      ),
    },
    {
      name: 'Declarations',
      complete: watchedValues.declarations.compliance_confirmed === true,
    },
  ]

  const canSubmit = sections.every(s => s.complete)

  const handleDocUpload = (doc: UploadedDoc) => {
    setUploadedDocs(prev => {
      const filtered = prev.filter(d => d.doc_type !== doc.doc_type)
      return [...filtered, doc]
    })
  }

  const onSubmit = async (data: FormData) => {
    if (!applicationId) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const response = await api.post('/applications', {
        application_id: applicationId,
        form_data: data,
        document_ids: uploadedDocs.map(d => d.id),
      })
      navigate(`/operator/applications/${response.data.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Submission failed'
      setSubmitError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">New Application</h1>

      <ProgressIndicator sections={sections} />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* Basic Details */}
        <fieldset className="border rounded-lg p-4">
          <legend className="font-semibold px-1">Basic Details</legend>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm">Centre Name</label>
              <input className="border rounded p-2 text-sm" {...register('basic_details.centre_name')} />
              {errors.basic_details?.centre_name && <p className="text-xs text-red-500">{errors.basic_details.centre_name.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm">Operator / Company Name</label>
              <input className="border rounded p-2 text-sm" {...register('basic_details.operator_company_name')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm">UEN</label>
              <input className="border rounded p-2 text-sm" {...register('basic_details.uen')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm">Contact Person</label>
              <input className="border rounded p-2 text-sm" {...register('basic_details.contact_person')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm">Contact Email</label>
              <input className="border rounded p-2 text-sm" type="email" {...register('basic_details.contact_email')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm">Contact Phone</label>
              <input className="border rounded p-2 text-sm" {...register('basic_details.contact_phone')} />
            </div>
          </div>
        </fieldset>

        {/* Operations */}
        <fieldset className="border rounded-lg p-4">
          <legend className="font-semibold px-1">Operations</legend>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-sm">Centre Address</label>
              <input className="border rounded p-2 text-sm" {...register('operations.centre_address')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm">Type of Service</label>
              <select className="border rounded p-2 text-sm" {...register('operations.type_of_service')}>
                <option value="Childcare">Childcare</option>
                <option value="Student Care">Student Care</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm">Proposed Capacity</label>
              <input className="border rounded p-2 text-sm" type="number" {...register('operations.proposed_capacity', { valueAsNumber: true })} />
            </div>
          </div>
        </fieldset>

        {/* Document Uploads */}
        <fieldset className="border rounded-lg p-4">
          <legend className="font-semibold px-1">Documents</legend>
          <div className="flex flex-col gap-3">
            <DocumentUploader
              docType="staff_qualification"
              label="Staff Qualification Certificate(s)"
              applicationId={applicationId}
              onApplicationId={setApplicationId}
              onUpload={handleDocUpload}
            />
            <DocumentUploader
              docType="fire_safety"
              label="Fire Safety Certificate"
              applicationId={applicationId}
              onApplicationId={setApplicationId}
              onUpload={handleDocUpload}
            />
            <DocumentUploader
              docType="floor_plan"
              label="Floor Plan of Premises"
              applicationId={applicationId}
              onApplicationId={setApplicationId}
              onUpload={handleDocUpload}
            />
            <DocumentUploader
              docType="insurance"
              label="Insurance Certificate"
              required={false}
              applicationId={applicationId}
              onApplicationId={setApplicationId}
              onUpload={handleDocUpload}
            />
          </div>
        </fieldset>

        {/* Declarations */}
        <fieldset className="border rounded-lg p-4">
          <legend className="font-semibold px-1">Declarations</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('declarations.compliance_confirmed')} />
            I confirm all information is accurate
          </label>
          {errors.declarations?.compliance_confirmed && (
            <p className="text-xs text-red-500 mt-1">{errors.declarations.compliance_confirmed.message}</p>
          )}
        </fieldset>

        {submitError && <p className="text-sm text-red-500">{submitError}</p>}

        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="bg-slate-900 text-white p-3 rounded disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Application'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Write SubmitApplicationPage smoke test**

```tsx
// frontend/src/pages/SubmitApplicationPage.test.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SubmitApplicationPage from './SubmitApplicationPage'

vi.mock('../lib/api', () => ({ api: { post: vi.fn() } }))

describe('SubmitApplicationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all form sections', () => {
    render(
      <MemoryRouter>
        <SubmitApplicationPage />
      </MemoryRouter>
    )
    expect(screen.getByText('Basic Details')).toBeInTheDocument()
    expect(screen.getByText('Operations')).toBeInTheDocument()
    expect(screen.getByText('Documents')).toBeInTheDocument()
    expect(screen.getByText('Declarations')).toBeInTheDocument()
  })

  it('renders submit button disabled by default', () => {
    render(
      <MemoryRouter>
        <SubmitApplicationPage />
      </MemoryRouter>
    )
    const btn = screen.getByRole('button', { name: /submit application/i })
    expect(btn).toBeDisabled()
  })

  it('shows progress indicator', () => {
    render(
      <MemoryRouter>
        <SubmitApplicationPage />
      </MemoryRouter>
    )
    expect(screen.getByText(/progress/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Add route**

```tsx
// frontend/src/routes.tsx — add the submit route

import SubmitApplicationPage from './pages/SubmitApplicationPage'

export const router = createBrowserRouter([
  { path: '/', element: <LoginPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/operator', element: <ApplicationListPage /> },
  { path: '/operator/applications', element: <ApplicationListPage /> },
  { path: '/operator/apply', element: <SubmitApplicationPage /> },
])
```

- [ ] **Step 6: Run tests**

Run: `cd frontend && npx vitest run`
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/DocumentUploader.tsx frontend/src/components/ProgressIndicator.tsx frontend/src/pages/SubmitApplicationPage.tsx frontend/src/pages/SubmitApplicationPage.test.tsx frontend/src/routes.tsx
git commit -m "feat: add submit application form with document upload and progress indicator"
```

---

### Task 9: Frontend — ApplicationDetailPage (Issue #11)

**Files:**
- Create: `frontend/src/pages/ApplicationDetailPage.tsx`
- Modify: `frontend/src/routes.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// frontend/src/pages/ApplicationDetailPage.test.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ApplicationDetailPage from './ApplicationDetailPage'

vi.mock('../lib/api', () => ({ api: { get: vi.fn() } }))

import { api } from '../lib/api'

describe('ApplicationDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows status and round number', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/submissions')) return Promise.resolve({ data: [] })
      return Promise.resolve({
        data: {
          id: 'app-1',
          status: 'Submitted',
          current_round: 1,
          latest_submission: {
            form_data: {
              basic_details: { centre_name: 'Test Centre', operator_company_name: 'Co', uen: '123', contact_person: 'A', contact_email: 'a@b.com', contact_phone: '123' },
              operations: { centre_address: 'Addr', type_of_service: 'Childcare', proposed_capacity: 10 },
              declarations: { compliance_confirmed: true },
            },
            documents: [],
          },
          latest_feedback: [],
        },
      })
    })

    render(
      <MemoryRouter initialEntries={['/operator/applications/app-1']}>
        <Routes>
          <Route path="/operator/applications/:id" element={<ApplicationDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Submitted')).toBeInTheDocument()
    expect(screen.getByText('Test Centre')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Implement ApplicationDetailPage**

```tsx
// frontend/src/pages/ApplicationDetailPage.tsx

import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'

interface ApplicationDetail {
  id: string
  status: string
  current_round: number
  latest_submission: {
    form_data: Record<string, Record<string, unknown>>
    documents: Array<{
      id: string
      doc_type: string
      filename: string
      ai_status: string
    }>
  } | null
  latest_feedback: Array<{
    id: string
    target_type: string
    section: string
    field_key: string | null
    comment: string
    created_by: string
  }>
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [app, setApp] = React.useState<ApplicationDetail | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!id) return
    api.get(`/applications/${id}`).then(res => {
      setApp(res.data)
      setLoading(false)
    })
  }, [id])

  if (loading) return <p className="p-6">Loading...</p>
  if (!app) return <p className="p-6">Application not found.</p>

  const needsResubmission = app.status === 'Pending Pre-Site Resubmission'

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/operator/applications" className="text-sm text-blue-600 underline mb-1 block">
            &larr; Back to applications
          </Link>
          <h1 className="text-2xl font-bold">
            {app.latest_submission?.form_data?.basic_details?.centre_name as string || 'Application'}
          </h1>
        </div>
        <span className="text-sm bg-slate-100 px-3 py-1 rounded">{app.status}</span>
      </div>

      {needsResubmission && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-amber-800">
            Officer feedback received. Review comments and resubmit.
          </p>
          <Link
            to={`/operator/applications/${app.id}/resubmit`}
            className="text-sm text-blue-600 underline mt-1 inline-block"
          >
            Resubmit Application
          </Link>
        </div>
      )}

      {app.latest_feedback.length > 0 && (
        <div className="border rounded-lg p-4 mb-6">
          <h2 className="font-semibold mb-3">Officer Feedback</h2>
          <div className="flex flex-col gap-2">
            {app.latest_feedback.map(f => (
              <div key={f.id} className="bg-slate-50 rounded p-3">
                <p className="text-xs text-slate-500 mb-1">
                  {f.section}{f.field_key ? ` → ${f.field_key}` : ''}
                </p>
                <p className="text-sm">{f.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {app.latest_submission && (
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold mb-3">Submission (Round {app.current_round})</h2>
          <pre className="text-xs bg-slate-50 p-3 rounded overflow-auto max-h-96">
            {JSON.stringify(app.latest_submission.form_data, null, 2)}
          </pre>
          {app.latest_submission.documents.length > 0 && (
            <div className="mt-3">
              <h3 className="text-sm font-medium mb-2">Documents</h3>
              <ul className="text-sm text-slate-600">
                {app.latest_submission.documents.map(d => (
                  <li key={d.id} className="flex items-center gap-2">
                    <span>{d.filename}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${d.ai_status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {d.ai_status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add route**

```tsx
// frontend/src/routes.tsx — add the detail route

import ApplicationDetailPage from './pages/ApplicationDetailPage'

export const router = createBrowserRouter([
  { path: '/', element: <LoginPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/operator', element: <ApplicationListPage /> },
  { path: '/operator/applications', element: <ApplicationListPage /> },
  { path: '/operator/apply', element: <SubmitApplicationPage /> },
  { path: '/operator/applications/:id', element: <ApplicationDetailPage /> },
])
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ApplicationDetailPage.tsx frontend/src/pages/ApplicationDetailPage.test.tsx frontend/src/routes.tsx
git commit -m "feat: add application detail page with feedback display"
```

---

### Task 10: Frontend — ResubmissionPage (Issue #14)

**Files:**
- Create: `frontend/src/components/FeedbackSummary.tsx`
- Create: `frontend/src/pages/ResubmissionPage.tsx`
- Modify: `frontend/src/routes.tsx`

- [ ] **Step 1: Create FeedbackSummary component**

```tsx
// frontend/src/components/FeedbackSummary.tsx

interface FeedbackItem {
  id: string
  target_type: string
  section: string
  field_key: string | null
  document_id: string | null
  comment: string
  created_by: string
}

interface Props {
  feedback: FeedbackItem[]
}

export default function FeedbackSummary({ feedback }: Props) {
  if (feedback.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <h2 className="font-semibold text-amber-900 mb-3">Officer Feedback</h2>
      <div className="flex flex-col gap-2">
        {feedback.map(f => (
          <div key={f.id} className="bg-white rounded p-3 border border-amber-100">
            <p className="text-xs text-slate-500 mb-1">
              {f.section}{f.field_key ? ` → ${f.field_key}` : ''}{f.document_id ? ' → Document' : ''}
            </p>
            <p className="text-sm">{f.comment}</p>
            <p className="text-xs text-slate-400 mt-1">— {f.created_by}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create ResubmissionPage**

```tsx
// frontend/src/pages/ResubmissionPage.tsx

import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { api } from '../lib/api'
import FeedbackSummary from '../components/FeedbackSummary'
import DocumentUploader from '../components/DocumentUploader'

interface FeedbackItem {
  id: string
  target_type: string
  section: string
  field_key: string | null
  document_id: string | null
  comment: string
  created_by: string
}

interface UploadedDoc {
  id: string
  doc_type: string
  filename: string
  ai_status: string
}

interface SubmissionRound {
  round_number: number
  submitted_at: string
  form_data: Record<string, Record<string, unknown>>
  documents: UploadedDoc[]
  feedback_items: FeedbackItem[]
}

const FIELD_LABELS: Record<string, string> = {
  centre_name: 'Centre Name',
  operator_company_name: 'Operator / Company Name',
  uen: 'UEN',
  contact_person: 'Contact Person',
  contact_email: 'Contact Email',
  contact_phone: 'Contact Phone',
  centre_address: 'Centre Address',
  type_of_service: 'Type of Service',
  proposed_capacity: 'Proposed Capacity',
}

const SECTION_LABELS: Record<string, string> = {
  basic_details: 'Basic Details',
  operations: 'Operations',
  documents: 'Documents',
  declarations: 'Declarations',
}

export default function ResubmissionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [app, setApp] = React.useState<{
    latest_feedback: FeedbackItem[]
    latest_submission: { form_data: Record<string, Record<string, unknown>> } | null
  } | null>(null)
  const [submissions, setSubmissions] = React.useState<SubmissionRound[]>([])
  const [loading, setLoading] = React.useState(true)
  const [uploadedDocs, setUploadedDocs] = React.useState<UploadedDoc[]>([])
  const [submitting, setSubmitting] = React.useState(false)

  const { register, handleSubmit, getValues } = useForm()

  React.useEffect(() => {
    if (!id) return
    Promise.all([
      api.get(`/applications/${id}`),
      api.get(`/applications/${id}/submissions`),
    ]).then(([appRes, subsRes]) => {
      setApp(appRes.data)
      setSubmissions(subsRes.data)
      setLoading(false)
    })
  }, [id])

  if (loading) return <p className="p-6">Loading...</p>
  if (!app) return <p className="p-6">Application not found.</p>

  const feedback = app.latest_feedback
  const latestFormData = app.latest_submission?.form_data || {}

  // Determine which fields are flagged
  const flaggedFields = new Set<string>()
  const flaggedDocs = new Set<string>()
  for (const f of feedback) {
    if (f.target_type === 'field' && f.field_key) {
      flaggedFields.add(f.field_key)
    }
    if (f.target_type === 'field' && !f.field_key) {
      // whole section flagged — add all its fields
      const sectionFields = latestFormData[f.section]
      if (sectionFields) {
        Object.keys(sectionFields).forEach(k => flaggedFields.add(k))
      }
    }
    if (f.target_type === 'document' && f.document_id) {
      flaggedDocs.add(f.document_id)
    }
  }

  const isFieldEditable = (fieldKey: string) => flaggedFields.has(fieldKey)

  const onSubmit = async () => {
    if (!id) return
    setSubmitting(true)
    try {
      // getValues() returns all registered field values
      const allValues = getValues() as Record<string, string>

      // Build partial form_data with only flagged fields
      const formValues: Record<string, Record<string, unknown>> = {}
      for (const fieldKey of flaggedFields) {
        const newValue = allValues[fieldKey]
        if (newValue === undefined) continue
        for (const [section, fields] of Object.entries(latestFormData)) {
          if (fieldKey in fields) {
            if (!formValues[section]) formValues[section] = {}
            formValues[section][fieldKey] = newValue
          }
        }
      }

      const response = await api.post(`/applications/${id}/resubmit`, {
        form_data: formValues,
        document_ids: uploadedDocs.map(d => d.id),
      })
      navigate(`/operator/applications/${response.data.id}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Resubmit Application</h1>

      <FeedbackSummary feedback={feedback} />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* Form sections — only flagged fields are editable */}
        {Object.entries(latestFormData).map(([section, fields]) => {
          if (section === 'declarations') return null
          const sectionLabel = SECTION_LABELS[section] || section

          return (
            <fieldset key={section} className="border rounded-lg p-4">
              <legend className="font-semibold px-1">{sectionLabel}</legend>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(fields).map(([key, value]) => {
                  const editable = isFieldEditable(key)
                  const label = FIELD_LABELS[key] || key

                  return (
                    <div key={key} className="flex flex-col gap-1">
                      <label className="text-sm flex items-center gap-1">
                        {label}
                        {editable && <span className="text-xs text-amber-600">(flagged)</span>}
                      </label>
                      <input
                        className={`border rounded p-2 text-sm ${editable ? 'border-amber-400 bg-amber-50' : 'bg-slate-50 text-slate-500'}`}
                        defaultValue={String(value ?? '')}
                        readOnly={!editable}
                        {...(editable ? register(key) : {})}
                      />
                    </div>
                  )
                })}
              </div>
            </fieldset>
          )
        })}

        {/* Documents — only flagged docs show re-upload */}
        <fieldset className="border rounded-lg p-4">
          <legend className="font-semibold px-1">Documents</legend>
          <div className="flex flex-col gap-3">
            {['staff_qualification', 'fire_safety', 'floor_plan', 'insurance'].map(docType => {
              const latestDoc = submissions[submissions.length - 1]?.documents?.find(d => d.doc_type === docType)
              const isFlagged = latestDoc ? flaggedDocs.has(latestDoc.id) : false

              if (isFlagged) {
                return (
                  <DocumentUploader
                    key={docType}
                    docType={docType}
                    label={docType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    applicationId={id!}
                    onApplicationId={() => {}}
                    onUpload={doc => setUploadedDocs(prev => [...prev.filter(d => d.doc_type !== doc.doc_type), doc])}
                  />
                )
              }

              return (
                <div key={docType} className="border rounded p-3 bg-slate-50">
                  <span className="text-sm text-slate-500">{latestDoc?.filename || 'No document'}</span>
                  <span className="text-xs text-slate-400 ml-2">(unchanged)</span>
                </div>
              )
            })}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={submitting}
          className="bg-slate-900 text-white p-3 rounded disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Resubmit Application'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Write ResubmissionPage smoke test**

```tsx
// frontend/src/pages/ResubmissionPage.test.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ResubmissionPage from './ResubmissionPage'

vi.mock('../lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))

import { api } from '../lib/api'

describe('ResubmissionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows feedback summary when feedback exists', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/submissions')) {
        return Promise.resolve({
          data: [{
            round_number: 1,
            submitted_at: '2026-04-27T00:00:00Z',
            form_data: {
              basic_details: { centre_name: 'Test', operator_company_name: 'Co', uen: '123', contact_person: 'A', contact_email: 'a@b.com', contact_phone: '123' },
              operations: { centre_address: 'Addr', type_of_service: 'Childcare', proposed_capacity: 10 },
            },
            documents: [],
            feedback_items: [],
          }],
        })
      }
      return Promise.resolve({
        data: {
          id: 'app-1',
          status: 'Pending Pre-Site Resubmission',
          current_round: 1,
          latest_submission: {
            form_data: {
              basic_details: { centre_name: 'Test', operator_company_name: 'Co', uen: '123', contact_person: 'A', contact_email: 'a@b.com', contact_phone: '123' },
              operations: { centre_address: 'Addr', type_of_service: 'Childcare', proposed_capacity: 10 },
            },
            documents: [],
          },
          latest_feedback: [
            { id: 'fb-1', target_type: 'field', section: 'basic_details', field_key: 'centre_name', document_id: null, comment: 'Please provide the registered name', created_by: 'bob' },
          ],
        },
      })
    })

    render(
      <MemoryRouter initialEntries={['/operator/applications/app-1/resubmit']}>
        <Routes>
          <Route path="/operator/applications/:id/resubmit" element={<ResubmissionPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Officer Feedback')).toBeInTheDocument()
    expect(screen.getByText('Please provide the registered name')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Add route**

```tsx
// frontend/src/routes.tsx — add the resubmit route

import ResubmissionPage from './pages/ResubmissionPage'

// add to routes array:
{ path: '/operator/applications/:id/resubmit', element: <ResubmissionPage /> },
```

- [ ] **Step 5: Run tests**

Run: `cd frontend && npx vitest run`
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/FeedbackSummary.tsx frontend/src/pages/ResubmissionPage.tsx frontend/src/pages/ResubmissionPage.test.tsx frontend/src/routes.tsx
git commit -m "feat: add resubmission page with locked sections and document carry-forward"
```

---

### Task 11: Integration verification

**Files:** None (verification only)

- [ ] **Step 1: Start all services**

Run: `docker compose up -d`
Expected: db, api, frontend all healthy

- [ ] **Step 2: Run migrations**

Run: `cd backend && uv run alembic upgrade head`
Expected: all tables created

- [ ] **Step 3: run back end tests**

Run: `cd backend && uv run pytest tests/ -v`
Expected: all tests PASS

- [ ] **Step 4: Run frontend tests**

Run: `cd frontend && npx vitest run`
Expected: all tests PASS

- [ ] **Step 5: Run linters**

Run: `cd backend && uv run ruff check src/ tests/`
Expected: no errors

Run: `cd frontend && npm run lint`
Expected: no warnings (max-warnings 0)

- [ ] **Step 6: Commit if changes**

```bash
git status
# commit any fixes made during verification
```
