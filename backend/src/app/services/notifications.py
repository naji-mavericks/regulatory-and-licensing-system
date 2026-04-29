import logging

logger = logging.getLogger(__name__)


def notify(recipient_role: str, message: str) -> None:
    """Stub notification — logs to stdout. Swap transport here when real delivery is needed."""
    logger.info("[NOTIFY → %s] %s", recipient_role.upper(), message)
