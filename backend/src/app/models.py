import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

_NOW = lambda: datetime.now(timezone.utc)  # noqa: E731


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)  # "operator" or "officer"
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_NOW
    )

    applications: Mapped[list["Application"]] = relationship(
        back_populates="operator"
    )


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    operator_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String, nullable=False, default="Application Received"
    )
    current_round: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_NOW
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_NOW, onupdate=_NOW
    )

    operator: Mapped["User"] = relationship(back_populates="applications")
    submissions: Mapped[list["Submission"]] = relationship(
        back_populates="application", order_by="Submission.round_number"
    )
    documents: Mapped[list["Document"]] = relationship(
        back_populates="application", foreign_keys="Document.application_id"
    )


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("applications.id"), nullable=False
    )
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    form_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_NOW
    )

    application: Mapped["Application"] = relationship(back_populates="submissions")
    documents: Mapped[list["Document"]] = relationship(
        back_populates="submission", foreign_keys="Document.submission_id"
    )
    feedback_items: Mapped[list["FeedbackItem"]] = relationship(
        back_populates="submission"
    )


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("applications.id"), nullable=False
    )
    submission_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("submissions.id"), nullable=True
    )
    doc_type: Mapped[str] = mapped_column(String, nullable=False)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    ai_status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    ai_details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_NOW
    )

    application: Mapped["Application"] = relationship(
        back_populates="documents", foreign_keys=[application_id]
    )
    submission: Mapped["Submission | None"] = relationship(
        back_populates="documents", foreign_keys=[submission_id]
    )


class FeedbackItem(Base):
    __tablename__ = "feedback_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    submission_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("submissions.id"), nullable=False
    )
    # target_type: "field" or "document"
    target_type: Mapped[str] = mapped_column(String, nullable=False)
    section: Mapped[str] = mapped_column(String, nullable=False)
    field_key: Mapped[str | None] = mapped_column(String, nullable=True)
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("documents.id"), nullable=True
    )
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_NOW
    )

    submission: Mapped["Submission"] = relationship(back_populates="feedback_items")
