import logging

from app.services.notifications import notify


def test_notify_operator_logs_message(caplog):
    with caplog.at_level(logging.INFO, logger="app.services.notifications"):
        notify("operator", "Application 123 updated to 'Under Review'.")
    expected = "[NOTIFY → OPERATOR] Application 123 updated to 'Under Review'."
    assert expected in caplog.text


def test_notify_officer_logs_message(caplog):
    with caplog.at_level(logging.INFO, logger="app.services.notifications"):
        notify("officer", "Application 456 resubmitted (Round 2). Ready for review.")
    expected = (
        "[NOTIFY → OFFICER] Application 456 resubmitted"
        " (Round 2). Ready for review."
    )
    assert expected in caplog.text
