export const VALID_TRANSITIONS: Record<string, string[]> = {
  "Application Received": ["Under Review"],
  "Under Review": ["Pending Pre-Site Resubmission", "Pending Approval", "Rejected"],
  "Pre-Site Resubmitted": ["Under Review"],
  "Pending Approval": ["Approved", "Rejected"],
}

export const OFFICER_STATUS_MAP: Record<string, string> = {
  "Pending Approval": "Route to Approval",
}

export function getOfficerLabel(internalStatus: string): string {
  return OFFICER_STATUS_MAP[internalStatus] ?? internalStatus
}

export function getValidNextStatuses(currentStatus: string): string[] {
  return VALID_TRANSITIONS[currentStatus] ?? []
}
