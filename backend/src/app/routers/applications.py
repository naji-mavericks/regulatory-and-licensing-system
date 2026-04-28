import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

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

BASIC_DETAILS_FIELDS = {
    "centre_name",
    "operator_company_name",
    "uen",
    "contact_person",
    "contact_email",
    "contact_phone",
}
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


@router.post("", status_code=status.HTTP_201_CREATED)
def submit_application(
    body: dict,
    user: Annotated[dict, Depends(require_operator)],
    db: Annotated[Session, Depends(get_db)],
):
    application_id = body.get("application_id")
    form_data = body.get("form_data", {})
    document_ids = body.get("document_ids", [])

    if not application_id or not form_data or not document_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="application_id, form_data, and document_ids are required",
        )

    # Verify application belongs to operator
    application = db.query(Application).filter(
        Application.id == uuid.UUID(application_id),
        Application.operator_id == uuid.UUID(user["sub"]),
    ).first()
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    # Validate form data
    errors = validate_form_data(form_data)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="; ".join(errors),
        )

    # Verify all required doc types present
    doc_uuids = [uuid.UUID(d) for d in document_ids]
    docs = db.query(Document).filter(Document.id.in_(doc_uuids)).all()
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
                app.submissions[0].form_data
                .get("basic_details", {})
                .get("centre_name", "")
                if app.submissions else ""
            ),
            "type_of_service": (
                app.submissions[0].form_data
                .get("operations", {})
                .get("type_of_service", "")
                if app.submissions else ""
            ),
            "current_round": app.current_round,
            "updated_at": app.updated_at.isoformat(),
        }
        for app in applications
    ]
