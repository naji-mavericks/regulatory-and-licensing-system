import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import StatusBadge from '../components/StatusBadge'
import {
  FIELD_LABELS,
  SECTION_LABELS,
  DOC_TYPE_LABELS,
  SECTION_ORDER,
  DOC_TYPE_ORDER,
  OPTIONAL_DOC_TYPES,
} from '../lib/formLabels'

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

  // Index feedback by field key and by document id
  const fieldFeedback: Record<string, FeedbackItem[]> = {}
  const sectionFeedback: Record<string, FeedbackItem[]> = {}
  const docFeedback: Record<string, FeedbackItem[]> = {}

  for (const item of app.latest_feedback) {
    if (item.target_type === 'document' && item.document_id) {
      docFeedback[item.document_id] = [...(docFeedback[item.document_id] ?? []), item]
    } else if (item.target_type === 'field' && item.field_key) {
      fieldFeedback[item.field_key] = [...(fieldFeedback[item.field_key] ?? []), item]
    } else if (item.target_type === 'field' && !item.field_key) {
      sectionFeedback[item.section] = [...(sectionFeedback[item.section] ?? []), item]
    }
  }

  const centreName = formData.basic_details?.centre_name as string | undefined

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
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

      {/* Alert banner */}
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

      {/* Section cards */}
      {app.latest_submission && SECTION_ORDER.map(section => {
        const fields = formData[section]
        if (!fields) return null
        const sectionItems = sectionFeedback[section] ?? []
        const sectionLabel = SECTION_LABELS[section] ?? section

        return (
          <div key={section} className="border border-slate-200 rounded-lg p-4 mb-4">
            <h2 className="font-semibold text-sm mb-3">{sectionLabel}</h2>

            {/* Section-level feedback banner */}
            {sectionItems.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
                {sectionItems.map(f => (
                  <p key={f.id} className="text-xs text-amber-900">{f.comment}</p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {Object.entries(fields).map(([key, value]) => {
                const isFullWidth = key === 'centre_address' || key === 'compliance_confirmed'
                const flaggedItems = fieldFeedback[key] ?? []
                const isFlagged = flaggedItems.length > 0
                const label = FIELD_LABELS[key] ?? key

                const displayValue = key === 'compliance_confirmed'
                  ? (value ? '✓ I confirm all information is accurate' : '✗ Not confirmed')
                  : String(value ?? '')

                return (
                  <div
                    key={key}
                    className={`flex flex-col gap-1 ${isFullWidth ? 'col-span-2' : ''}`}
                  >
                    <span className="text-xs text-slate-600 flex items-center gap-1">
                      {label}
                      {isFlagged && <span className="text-amber-600 font-medium">⚑ flagged</span>}
                    </span>
                    <div className={`rounded-md px-3 py-1.5 text-sm ${
                      isFlagged
                        ? 'bg-amber-50 border-2 border-amber-400 text-slate-800'
                        : 'bg-slate-50 border border-slate-200 text-slate-800'
                    }`}>
                      {displayValue}
                    </div>
                    {flaggedItems.map(f => (
                      <div
                        key={f.id}
                        className="bg-amber-100 border-l-2 border-amber-400 rounded text-amber-900 text-xs px-2 py-1"
                      >
                        {f.comment}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Documents card */}
      {app.latest_submission && (
        <div className="border border-slate-200 rounded-lg p-4 mb-4">
          <h2 className="font-semibold text-sm mb-3">Documents</h2>
          <div className="flex flex-col gap-2">
            {DOC_TYPE_ORDER.map(docType => {
              const doc = documents.find(d => d.doc_type === docType)
              const isOptional = OPTIONAL_DOC_TYPES.has(docType)
              const flaggedItems = doc ? (docFeedback[doc.id] ?? []) : []
              const isFlagged = flaggedItems.length > 0
              const label = DOC_TYPE_LABELS[docType] ?? docType

              return (
                <div key={docType}>
                  <div className={`rounded-md border px-3 py-2 ${
                    isFlagged
                      ? 'bg-amber-50 border-2 border-amber-400'
                      : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">
                          {label}
                          {isOptional && <span className="text-xs text-slate-500 ml-1">(optional)</span>}
                          {isFlagged && <span className="text-xs text-amber-600 font-medium ml-1">⚑ flagged</span>}
                        </span>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {doc ? doc.filename : 'Not submitted'}
                        </p>
                      </div>
                      {doc ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          doc.ai_status === 'pass'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {doc.ai_status}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </div>
                  </div>
                  {flaggedItems.map(f => (
                    <div
                      key={f.id}
                      className="bg-amber-100 border-l-2 border-amber-400 rounded text-amber-900 text-xs px-2 py-1 mt-1"
                    >
                      {f.comment}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
