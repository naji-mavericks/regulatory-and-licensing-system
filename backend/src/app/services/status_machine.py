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
