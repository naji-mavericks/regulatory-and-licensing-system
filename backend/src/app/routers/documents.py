import shutil
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_operator
from app.config import settings
from app.database.session import get_db
from app.models import Application, Document
from app.services.ai_stub import run_ai_verification

router = APIRouter(prefix="/documents", tags=["documents"])


def save_file(upload_dir: Path, file: UploadFile) -> Path:
    upload_dir.mkdir(parents=True, exist_ok=True)
    dest = upload_dir / f"{uuid.uuid4()}_{Path(file.filename).name}"
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    return dest


@router.post("/upload", status_code=status.HTTP_201_CREATED)
def upload_document(
    file: Annotated[UploadFile, File(...)],
    doc_type: Annotated[str, Form()],
    user: Annotated[dict, Depends(require_operator)],
    db: Annotated[Session, Depends(get_db)],
    application_id: Annotated[str | None, Form()] = None,
):
    # Get or create application
    if application_id:
        application = (
            db.query(Application)
            .filter(
                Application.id == uuid.UUID(application_id),
                Application.operator_id == uuid.UUID(user["sub"]),
            )
            .first()
        )
        if application is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found",
            )
    else:
        application = Application(operator_id=uuid.UUID(user["sub"]))
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


@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    document = db.query(Document).filter(Document.id == uuid.UUID(document_id)).first()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if user["role"] == "operator":
        application = (
            db.query(Application)
            .filter(
                Application.id == document.application_id,
                Application.operator_id == uuid.UUID(user["sub"]),
            )
            .first()
        )
        if application is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found",
            )

    file_path = Path(document.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on disk",
        )

    return FileResponse(
        path=str(file_path),
        filename=document.filename,
        media_type="application/octet-stream",
    )
