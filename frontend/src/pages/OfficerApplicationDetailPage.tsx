import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import StatusBadge from '../components/StatusBadge'
import ApplicationSections from '../components/ApplicationSections'
import FeedbackPanel from '../components/FeedbackPanel'

interface DocumentData {
  id: string; doc_type: string; filename: string; ai_status: string; ai_details: unknown
}
interface FeedbackItemData {
  id: string; target_type: string; section: string; field_key: string | null
  document_id: string | null; comment: string; created_by: string
}
interface SubmissionData {
  id: string; round_number: number; submitted_at: string
  form_data: Record<string, Record<string, unknown>>
  documents: DocumentData[]; feedback_items: FeedbackItemData[]
}
interface OfficerApp {
  id: string; status: string; current_round: number
  operator: { id: string; full_name: string; email: string; phone: string }
  submissions: SubmissionData[]
}

function computeChangesCount(curr: SubmissionData, prev: SubmissionData): number {
  let count = 0
  for (const section of ['basic_details', 'operations', 'declarations']) {
    const c = curr.form_data[section] ?? {}
    const p = prev.form_data[section] ?? {}
    for (const key of Object.keys({ ...c, ...p })) {
      if (c[key] !== p[key]) count++
    }
  }
  const prevByType = new Map(prev.documents.map(d => [d.doc_type, d.filename]))
  for (const doc of curr.documents) {
    if (prevByType.has(doc.doc_type) && prevByType.get(doc.doc_type) !== doc.filename) count++
  }
  return count
}

function ChangesView({ current, previous }: { current: SubmissionData; previous: SubmissionData }) {
  const fieldChanges: { label: string; oldVal: unknown; newVal: unknown }[] = []
  for (const section of ['basic_details', 'operations', 'declarations']) {
    const c = current.form_data[section] ?? {}
    const p = previous.form_data[section] ?? {}
    for (const key of Object.keys({ ...c, ...p })) {
      if (c[key] !== p[key]) fieldChanges.push({ label: `${section} / ${key}`, oldVal: p[key], newVal: c[key] })
    }
  }
  const docChanges = current.documents.filter(doc => {
    const prev = previous.documents.find(d => d.doc_type === doc.doc_type)
    return prev && prev.filename !== doc.filename
  })
  return (
    <div className="flex flex-col gap-3">
      {fieldChanges.map(({ label, oldVal, newVal }) => (
        <div key={label} className="border border-slate-200 rounded-md p-3">
          <p className="text-xs text-slate-500 mb-1">{label}</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="line-through text-slate-400">{String(oldVal ?? '')}</span>
            <span>→</span>
            <span className="text-slate-800">{String(newVal ?? '')}</span>
          </div>
        </div>
      ))}
      {docChanges.map(doc => (
        <div key={doc.id} className="border border-slate-200 rounded-md p-3">
          <p className="text-xs text-slate-500 mb-1">document / {doc.doc_type}</p>
          <div className="flex items-center gap-2 text-sm">
            <span>Re-uploaded</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${doc.ai_status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {doc.ai_status}
            </span>
          </div>
        </div>
      ))}
      {fieldChanges.length === 0 && docChanges.length === 0 && (
        <p className="text-sm text-slate-500">No changes detected.</p>
      )}
    </div>
  )
}

function SubmissionContent({ submission, previousSubmission }: { submission: SubmissionData; previousSubmission?: SubmissionData }) {
  const [activeTab, setActiveTab] = React.useState<'changes' | 'full'>('full')
  const hasChanges = previousSubmission !== undefined
  const changesCount = hasChanges ? computeChangesCount(submission, previousSubmission) : 0

  return (
    <div>
      {hasChanges && (
        <div className="flex gap-0 mb-4 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('changes')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'changes' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600'}`}
          >
            Changes ({changesCount})
          </button>
          <button
            onClick={() => setActiveTab('full')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'full' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600'}`}
          >
            Full Submission
          </button>
        </div>
      )}
      {hasChanges && activeTab === 'changes' && (
        <ChangesView current={submission} previous={previousSubmission!} />
      )}
      {(!hasChanges || activeTab === 'full') && (
        <ApplicationSections
          formData={submission.form_data}
          documents={submission.documents}
          previousFormData={previousSubmission?.form_data}
          previousDocuments={previousSubmission?.documents}
        />
      )}
    </div>
  )
}

export default function OfficerApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [app, setApp] = React.useState<OfficerApp | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedRoundIndex, setSelectedRoundIndex] = React.useState(0)

  const loadApp = React.useCallback(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    api.get(`/applications/${id}`)
      .then(res => {
        setApp(res.data)
        setSelectedRoundIndex(res.data.submissions.length - 1)
      })
      .catch(() => setError('Failed to load application.'))
      .finally(() => setLoading(false))
  }, [id])

  React.useEffect(() => {
    if (!id) return
    let cancelled = false
    api.get(`/applications/${id}`)
      .then(res => {
        if (!cancelled) {
          setApp(res.data)
          setSelectedRoundIndex(res.data.submissions.length - 1)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load application.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [id])

  if (loading) return <p className="p-6">Loading...</p>
  if (error) return <p className="p-6 text-red-500">{error}</p>
  if (!app) return <p className="p-6">Application not found.</p>

  const selectedSubmission = app.submissions[selectedRoundIndex]
  const previousSubmission = selectedRoundIndex > 0 ? app.submissions[selectedRoundIndex - 1] : undefined
  const latestSubmission = app.submissions[app.submissions.length - 1]
  const centreName = latestSubmission?.form_data.basic_details?.centre_name as string | undefined

  return (
    <div className="flex gap-6 p-6 min-h-screen">
      <div className="flex-1 min-w-0">
        <Link to="/officer/applications" className="text-sm text-blue-600 underline mb-2 block">
          &larr; Back to applications
        </Link>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{centreName || 'Application'}</h1>
            <p className="text-sm text-slate-600 mt-1">
              Round {app.current_round} · {app.operator.full_name} · {app.operator.email}
            </p>
          </div>
          <StatusBadge status={app.status} />
        </div>

        {app.submissions.length > 1 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {app.submissions.map((sub, idx) => (
              <button
                key={sub.id}
                onClick={() => setSelectedRoundIndex(idx)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                  idx === selectedRoundIndex ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Round {sub.round_number}
              </button>
            ))}
          </div>
        )}

        {selectedSubmission && (
          <SubmissionContent submission={selectedSubmission} previousSubmission={previousSubmission} />
        )}
      </div>

      <div className="w-80 shrink-0" style={{ position: 'sticky', top: '1rem', alignSelf: 'flex-start' }}>
        <FeedbackPanel
          applicationId={app.id}
          currentStatus={app.status}
          documents={latestSubmission?.documents ?? []}
          onSuccess={loadApp}
        />
      </div>
    </div>
  )
}
