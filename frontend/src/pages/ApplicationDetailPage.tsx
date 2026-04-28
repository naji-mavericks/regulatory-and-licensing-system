import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'

interface ApplicationDetail {
  id: string
  status: string
  current_round: number
  latest_submission: {
    form_data: Record<string, Record<string, unknown>>
    documents: Array<{
      id: string
      doc_type: string
      filename: string
      ai_status: string
    }>
  } | null
  latest_feedback: Array<{
    id: string
    target_type: string
    section: string
    field_key: string | null
    comment: string
    created_by: string
  }>
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [app, setApp] = React.useState<ApplicationDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!id) return
    api.get(`/applications/${id}`)
      .then(res => setApp(res.data))
      .catch(() => setError('Failed to load application.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="p-6">Loading...</p>
  if (error) return <p className="p-6 text-red-500">{error}</p>
  if (!app) return <p className="p-6">Application not found.</p>

  const needsResubmission = app.status === 'Pending Pre-Site Resubmission'

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/operator/applications" className="text-sm text-blue-600 underline mb-1 block">
            &larr; Back to applications
          </Link>
          <h1 className="text-2xl font-bold">
            {app.latest_submission?.form_data?.basic_details?.centre_name as string || 'Application'}
          </h1>
        </div>
        <span className="text-sm bg-slate-100 px-3 py-1 rounded">{app.status}</span>
      </div>

      {needsResubmission && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-amber-800">
            Officer feedback received. Review comments and resubmit.
          </p>
          <Link
            to={`/operator/applications/${app.id}/resubmit`}
            className="text-sm text-blue-600 underline mt-1 inline-block"
          >
            Resubmit Application
          </Link>
        </div>
      )}

      {app.latest_feedback.length > 0 && (
        <div className="border rounded-lg p-4 mb-6">
          <h2 className="font-semibold mb-3">Officer Feedback</h2>
          <div className="flex flex-col gap-2">
            {app.latest_feedback.map(f => (
              <div key={f.id} className="bg-slate-50 rounded p-3">
                <p className="text-xs text-slate-500 mb-1">
                  {f.section}{f.field_key ? ` \u2192 ${f.field_key}` : ''}
                </p>
                <p className="text-sm">{f.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {app.latest_submission && (
        <div className="border rounded-lg p-4">
          <h2 className="font-semibold mb-3">Submission (Round {app.current_round})</h2>
          <pre className="text-xs bg-slate-50 p-3 rounded overflow-auto max-h-96">
            {JSON.stringify(app.latest_submission.form_data, null, 2)}
          </pre>
          {app.latest_submission.documents.length > 0 && (
            <div className="mt-3">
              <h3 className="text-sm font-medium mb-2">Documents</h3>
              <ul className="text-sm text-slate-600">
                {app.latest_submission.documents.map(d => (
                  <li key={d.id} className="flex items-center gap-2">
                    <span>{d.filename}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${d.ai_status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {d.ai_status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
