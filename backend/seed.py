"""Seed the database with test users and a sample application for visual testing.

Usage:
    cd backend && uv run python seed.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

import uuid
from datetime import datetime, timezone

from app.database.session import SessionLocal
from app.models import Application, Document, FeedbackItem, Submission, User


def seed():
    db = SessionLocal()

    # Check if already seeded
    if db.query(User).first() is not None:
        print("Database already has users — skipping seed.")
        db.close()
        return

    # Users
    alice = User(
        id=uuid.uuid4(),
        username="alice",
        role="operator",
        full_name="Alice Operator",
        email="alice@test.com",
        phone="+65 1111 1111",
    )
    bob = User(
        id=uuid.uuid4(),
        username="bob",
        role="officer",
        full_name="Bob Officer",
        email="bob@test.com",
        phone="+65 2222 2222",
    )
    charlie = User(
        id=uuid.uuid4(),
        username="charlie",
        role="operator",
        full_name="Charlie Operator",
        email="charlie@test.com",
        phone="+65 3333 3333",
    )
    db.add_all([alice, bob, charlie])
    db.flush()

    # Sample application for alice — already submitted with feedback,
    # so both the detail view and resubmission flow can be tested.
    app = Application(
        id=uuid.uuid4(),
        operator_id=alice.id,
        status="Pending Pre-Site Resubmission",
        current_round=1,
    )
    db.add(app)
    db.flush()

    sub = Submission(
        id=uuid.uuid4(),
        application_id=app.id,
        round_number=1,
        form_data={
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
            "declarations": {"compliance_confirmed": True},
        },
    )
    db.add(sub)
    db.flush()

    # Documents for round 1
    docs = [
        Document(
            id=uuid.uuid4(),
            application_id=app.id,
            submission_id=sub.id,
            doc_type=dt,
            filename=fn,
            file_path=f"./uploads/{fn}",
            ai_status="pass",
            ai_details={"confidence": 0.95},
        )
        for dt, fn in [
            ("staff_qualification", "staff_cert.pdf"),
            ("fire_safety", "fire_safety_cert.pdf"),
            ("floor_plan", "floor_plan.pdf"),
        ]
    ]
    db.add_all(docs)
    db.flush()

    # Feedback item from officer bob
    feedback = FeedbackItem(
        id=uuid.uuid4(),
        submission_id=sub.id,
        target_type="field",
        section="basic_details",
        field_key="centre_name",
        comment="Please provide the registered business name, not the trading name.",
        created_by="bob",
    )
    db.add(feedback)

    db.commit()
    db.close()

    print("Seed data created successfully.")
    print("  Users: alice (operator), bob (officer), charlie (operator)")
    print("  Sample application with 1 feedback item ready for testing.")


if __name__ == "__main__":
    seed()
