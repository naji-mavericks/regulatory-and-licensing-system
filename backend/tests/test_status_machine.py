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
