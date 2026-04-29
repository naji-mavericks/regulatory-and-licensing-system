import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload, selectinload

from app.auth.dependencies import get_current_user, require_officer, require_operator
from app.database.session import get_db
from app.models import Application, Document, FeedbackItem, Submission, User
from app.services.notifications import notify
from app.services.status_machine import InvalidTransitionError, transition

router = APIRouter(prefix="/applications", tags=["applications"])

OPERATOR_STATUS_MAP = {
    "Application Received": "Submitted",
    "Under Review": "Under Review",
    "Pending Pre-Site Resubmission": "Pending Pre-Site Resubmission",
    "Pre-Site Resubmitted": "Pre-Site Resubmitted",
}

OFFICER_STATUS_MAP: dict[str, str] = {
    "Pending Approval": "Route to Approval",
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

    # Verify all required doc types present (scoped to this application)
    doc_uuids = [uuid.UUID(d) for d in document_ids]
    docs = db.query(Document).filter(
        Document.id.in_(doc_uuids),
        Document.application_id == application.id,
    ).all()
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

    # Link documents to submission and mark application as received
    for doc in docs:
        doc.submission_id = submission.id
    application.status = "Application Received"
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
                    app.submissions[-1]
                    .form_data.get("basic_details", {})
                    .get("centre_name", "")
                    if app.submissions else ""
                ),
                "type_of_service": (
                    app.submissions[-1]
                    .form_data.get("operations", {})
                    .get("type_of_service", "")
                    if app.submissions else ""
                ),
                "current_round": app.current_round,
                "updated_at": app.updated_at.isoformat(),
            }
            for app in applications
        ]

    # Officer branch
    query = (
        db.query(Application)
        .options(
            selectinload(Application.submissions),
            joinedload(Application.operator),
        )
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
                app.submissions[-1]
                .form_data.get("basic_details", {})
                .get("centre_name", "")
                if app.submissions else ""
            ),
            "operator_name": app.operator.full_name,
            "type_of_service": (
                app.submissions[-1]
                .form_data.get("operations", {})
                .get("type_of_service", "")
                if app.submissions else ""
            ),
            "current_round": app.current_round,
            "updated_at": app.updated_at.isoformat(),
        }
        for app in applications
    ]


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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found",
            )

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

    # Officer branch
    application = db.query(Application).filter(
        Application.id == uuid.UUID(application_id)
    ).first()
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    operator = db.query(User).filter(User.id == application.operator_id).first()
    submissions = (
        db.query(Submission)
        .options(
            selectinload(Submission.documents),
            selectinload(Submission.feedback_items),
        )
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
                        "document_id": (
                            str(f.document_id) if f.document_id else None
                        ),
                        "comment": f.comment,
                        "created_by": f.created_by,
                        "created_at": f.created_at.isoformat(),
                    }
                    for f in sub.feedback_items
                ],
            }
            for sub in submissions
        ],
    }


@router.get("/{application_id}/submissions")
def get_submissions(
    application_id: str,
    user: Annotated[dict, Depends(require_operator)],
    db: Annotated[Session, Depends(get_db)],
):
    application = db.query(Application).filter(
        Application.id == uuid.UUID(application_id),
        Application.operator_id == uuid.UUID(user["sub"]),
    ).first()
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    submissions = (
        db.query(Submission)
        .options(
            selectinload(Submission.documents),
            selectinload(Submission.feedback_items),
        )
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


@router.post("/{application_id}/resubmit", status_code=status.HTTP_201_CREATED)
def resubmit_application(
    application_id: str,
    body: dict,
    user: Annotated[dict, Depends(require_operator)],
    db: Annotated[Session, Depends(get_db)],
):
    application = db.query(Application).filter(
        Application.id == uuid.UUID(application_id),
        Application.operator_id == uuid.UUID(user["sub"]),
    ).first()
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    if application.status != "Pending Pre-Site Resubmission":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Application is not in a state that allows resubmission",
        )

    previous_submission = (
        db.query(Submission)
        .filter(Submission.application_id == application.id)
        .order_by(Submission.round_number.desc())
        .first()
    )
    if previous_submission is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No previous submission to resubmit",
        )

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
    new_doc_uuids = [uuid.UUID(d) for d in new_document_ids]
    new_docs_requested = (
        db.query(Document)
        .filter(
            Document.id.in_(new_doc_uuids),
            Document.application_id == application.id,
        )
        .all()
    )
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

    notify(
        "officer",
        f"Application {application.id} resubmitted"
        f" (Round {new_round_number}). Ready for review.",
    )

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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    feedback_items_data = body.get("feedback_items", [])
    new_status = body.get("new_status")

    if not feedback_items_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="feedback_items must be non-empty",
        )
    if not new_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="new_status is required",
        )

    valid_sections = {"basic_details", "operations", "declarations"}
    for item in feedback_items_data:
        target_type = item.get("target_type")
        section = item.get("section")
        field_key = item.get("field_key")
        document_id = item.get("document_id")
        comment = item.get("comment", "")

        if target_type not in ("field", "document"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="target_type must be 'field' or 'document'",
            )
        if not comment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="comment must be non-empty",
            )

        if target_type == "field":
            if not field_key:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="field_key required for field feedback",
                )
            if document_id is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="document_id must be null for field feedback",
                )
            if section not in valid_sections:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"section must be one of {valid_sections}",
                )
        else:
            if not document_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="document_id required for document feedback",
                )
            if field_key is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="field_key must be null for document feedback",
                )
            if section != "documents":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="section must be 'documents' for document feedback",
                )
            doc = db.query(Document).filter(
                Document.id == uuid.UUID(document_id),
                Document.application_id == application.id,
            ).first()
            if doc is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Document {document_id} not found"
                    f" in this application",
                )

    try:
        transition(application.status, new_status)
    except InvalidTransitionError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

    latest_sub = (
        db.query(Submission)
        .filter(Submission.application_id == application.id)
        .order_by(Submission.round_number.desc())
        .first()
    )
    if latest_sub is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No submission found",
        )

    created_items = []
    for item in feedback_items_data:
        fi = FeedbackItem(
            submission_id=latest_sub.id,
            target_type=item["target_type"],
            section=item["section"],
            field_key=item.get("field_key"),
            document_id=(
                uuid.UUID(item["document_id"])
                if item.get("document_id") else None
            ),
            comment=item["comment"],
            created_by=user.get("username", "officer"),
        )
        db.add(fi)
        created_items.append(fi)

    application.status = new_status
    db.commit()
    for fi in created_items:
        db.refresh(fi)

    notify(
        "operator",
        f"Application {application.id} updated to '{new_status}'."
        " Please log in to review officer feedback.",
    )

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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    new_status = body.get("new_status")
    if not new_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="new_status is required",
        )

    try:
        transition(application.status, new_status)
    except InvalidTransitionError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

    application.status = new_status
    db.commit()
    db.refresh(application)

    notify(
        "operator",
        f"Application {application.id} status changed to '{new_status}'.",
    )

    return {
        "id": str(application.id),
        "status": new_status,
        "updated_at": application.updated_at.isoformat(),
    }
