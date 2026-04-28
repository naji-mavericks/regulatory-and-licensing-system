def run_ai_verification(filename: str, doc_type: str) -> tuple[str, dict]:
    """Stub AI verification. Returns (ai_status, ai_details)."""
    if f"fail-{doc_type}" in filename.lower():
        return "fail", {"reason": "Document appears invalid/expired"}
    return "pass", {"confidence": 0.95}
