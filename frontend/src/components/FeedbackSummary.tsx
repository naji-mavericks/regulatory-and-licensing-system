interface FeedbackItem {
  id: string
  target_type: string
  section: string
  field_key: string | null
  document_id: string | null
  comment: string
  created_by: string
}

interface Props {
  feedback: FeedbackItem[]
}

export default function FeedbackSummary({ feedback }: Props) {
  if (feedback.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <h2 className="font-semibold text-amber-900 mb-3">Officer Feedback</h2>
      <div className="flex flex-col gap-2">
        {feedback.map(f => (
          <div key={f.id} className="bg-white rounded p-3 border border-amber-100">
            <p className="text-xs text-slate-500 mb-1">
              {f.section}{f.field_key ? ` → ${f.field_key}` : ''}{f.document_id ? ' → Document' : ''}
            </p>
            <p className="text-sm">{f.comment}</p>
            <p className="text-xs text-slate-400 mt-1">— {f.created_by}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
