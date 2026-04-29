const STATUS_CLASSES: Record<string, string> = {
  // Internal statuses
  'Application Received': 'bg-blue-50 text-blue-700',
  'Under Review': 'bg-blue-50 text-blue-700',
  'Pending Pre-Site Resubmission': 'bg-amber-50 text-amber-700',
  'Pre-Site Resubmitted': 'bg-purple-50 text-purple-700',
  'Pending Approval': 'bg-indigo-50 text-indigo-700',
  'Approved': 'bg-green-50 text-green-700',
  'Rejected': 'bg-red-50 text-red-700',
  // Operator-view labels
  'Submitted': 'bg-blue-50 text-blue-700',
  'Pending Site Visit': 'bg-amber-50 text-amber-700',
  'Pending Post-Site Clarification': 'bg-amber-50 text-amber-700',
  'Pending Post-Site Resubmission': 'bg-amber-50 text-amber-700',
  'Post-Site Resubmitted': 'bg-purple-50 text-purple-700',
  // Officer-view labels
  'Route to Approval': 'bg-indigo-50 text-indigo-700',
}

export default function StatusBadge({ status }: { status: string }) {
  const classes = STATUS_CLASSES[status] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${classes}`}>
      {status}
    </span>
  )
}
