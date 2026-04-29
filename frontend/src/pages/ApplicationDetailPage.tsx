import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import StatusBadge from '../components/StatusBadge'
import ApplicationSections from '../components/ApplicationSections'

interface FeedbackItem {
  id: string
  target_type: string
  section: string
  field_key: string | null
  document_id: string | null
  comment: string
  created_by: string
}

interface Document {
  id: string
  doc_type: string
  filename: string
  ai_status: string
}

interface ApplicationDetail {
  id: string
  status: string
  current_round: number
  latest_submission: {
    form_data: Record<string, Record<string, unknown>>
    documents: Document[]
  } | null
  latest_feedback: FeedbackItem[]
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

  const hasFeedback = app.latest_feedback.length > 0
  const needsResubmission = app.status === 'Pending Pre-Site Resubmission'
  const formData = app.latest_submission?.form_data ?? {}
  const documents = app.latest_submission?.documents ?? []

  const feedbackByField: Record<string, FeedbackItem[]> = {}
  const feedbackBySection: Record<string, FeedbackItem[]> = {}
  const feedbackByDocument: Record<string, FeedbackItem[]> = {}

  for (const item of app.latest_feedback) {
    if (item.target_type === 'document' && item.document_id) {
      feedbackByDocument[item.document_id] = [...(feedbackByDocument[item.document_id] ?? []), item]
    } else if (item.target_type === 'field' && item.field_key) {
      feedbackByField[item.field_key] = [...(feedbackByField[item.field_key] ?? []), item]
    } else if (item.target_type === 'field' && !item.field_key) {
      feedbackBySection[item.section] = [...(feedbackBySection[item.section] ?? []), item]
    }
  }

  const centreName = formData.basic_details?.centre_name as string | undefined

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Link to="/operator/applications" className="text-sm text-blue-600 underline mb-2 block">
        &larr; Back to applications
      </Link>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{centreName || 'Application'}</h1>
          <p className="text-sm text-slate-600 mt-1">Round {app.current_round}</p>
        </div>
        <StatusBadge status={app.status} />
      </div>

      {hasFeedback && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <p className="text-sm font-medium text-amber-800">
            Officer feedback received. Review the comments below and resubmit.
          </p>
          {needsResubmission && (
            <Link
              to={`/operator/applications/${app.id}/resubmit`}
              className="text-sm text-blue-600 underline ml-4 whitespace-nowrap"
            >
              Resubmit Application
            </Link>
          )}
        </div>
      )}

      {app.latest_submission && (
        <ApplicationSections
          formData={formData}
          documents={documents}
          feedbackByField={feedbackByField}
          feedbackBySection={feedbackBySection}
          feedbackByDocument={feedbackByDocument}
        />
      )}
    </div>
  )
}
