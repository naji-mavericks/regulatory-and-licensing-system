import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { api } from '../lib/api'
import FeedbackSummary from '../components/FeedbackSummary'
import DocumentUploader from '../components/DocumentUploader'

interface FeedbackItem {
  id: string
  target_type: string
  section: string
  field_key: string | null
  document_id: string | null
  comment: string
  created_by: string
}

interface UploadedDoc {
  id: string
  doc_type: string
  filename: string
  ai_status: string
}

interface SubmissionRound {
  round_number: number
  submitted_at: string
  form_data: Record<string, Record<string, unknown>>
  documents: UploadedDoc[]
  feedback_items: FeedbackItem[]
}

const FIELD_LABELS: Record<string, string> = {
  centre_name: 'Centre Name',
  operator_company_name: 'Operator / Company Name',
  uen: 'UEN',
  contact_person: 'Contact Person',
  contact_email: 'Contact Email',
  contact_phone: 'Contact Phone',
  centre_address: 'Centre Address',
  type_of_service: 'Type of Service',
  proposed_capacity: 'Proposed Capacity',
}

const SECTION_LABELS: Record<string, string> = {
  basic_details: 'Basic Details',
  operations: 'Operations',
  documents: 'Documents',
  declarations: 'Declarations',
}

export default function ResubmissionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [app, setApp] = React.useState<{
    latest_feedback: FeedbackItem[]
    latest_submission: { form_data: Record<string, Record<string, unknown>> } | null
  } | null>(null)
  const [submissions, setSubmissions] = React.useState<SubmissionRound[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [uploadedDocs, setUploadedDocs] = React.useState<UploadedDoc[]>([])
  const [submitting, setSubmitting] = React.useState(false)

  const { register, handleSubmit, getValues } = useForm()

  React.useEffect(() => {
    if (!id) return
    Promise.all([
      api.get(`/applications/${id}`),
      api.get(`/applications/${id}/submissions`),
    ]).then(([appRes, subsRes]) => {
      setApp(appRes.data)
      setSubmissions(subsRes.data)
      setLoading(false)
    }).catch(() => {
      setError('Failed to load application.')
      setLoading(false)
    })
  }, [id])

  if (loading) return <p className="p-6">Loading...</p>
  if (error) return <p className="p-6 text-red-500">{error}</p>
  if (!app) return <p className="p-6">Application not found.</p>

  const feedback = app.latest_feedback
  const latestFormData = app.latest_submission?.form_data || {}

  // Determine which fields are flagged
  const flaggedFields = new Set<string>()
  const flaggedDocs = new Set<string>()
  for (const f of feedback) {
    if (f.target_type === 'field' && f.field_key) {
      flaggedFields.add(f.field_key)
    }
    if (f.target_type === 'field' && !f.field_key) {
      const sectionFields = latestFormData[f.section]
      if (sectionFields) {
        Object.keys(sectionFields).forEach(k => flaggedFields.add(k))
      }
    }
    if (f.target_type === 'document' && f.document_id) {
      flaggedDocs.add(f.document_id)
    }
  }

  const isFieldEditable = (fieldKey: string) => flaggedFields.has(fieldKey)

  const onSubmit = async () => {
    if (!id) return
    setSubmitting(true)
    try {
      const allValues = getValues() as Record<string, string>
      const formValues: Record<string, Record<string, unknown>> = {}
      for (const fieldKey of flaggedFields) {
        const newValue = allValues[fieldKey]
        if (newValue === undefined) continue
        for (const [section, fields] of Object.entries(latestFormData)) {
          if (fieldKey in fields) {
            if (!formValues[section]) formValues[section] = {}
            formValues[section][fieldKey] = newValue
          }
        }
      }

      const response = await api.post(`/applications/${id}/resubmit`, {
        form_data: formValues,
        document_ids: uploadedDocs.map(d => d.id),
      })
      navigate(`/operator/applications/${response.data.id}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Resubmit Application</h1>

      <FeedbackSummary feedback={feedback} />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {Object.entries(latestFormData).map(([section, fields]) => {
          if (section === 'declarations') return null
          const sectionLabel = SECTION_LABELS[section] || section

          return (
            <fieldset key={section} className="border rounded-lg p-4">
              <legend className="font-semibold px-1">{sectionLabel}</legend>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(fields).map(([key, value]) => {
                  const editable = isFieldEditable(key)
                  const label = FIELD_LABELS[key] || key

                  return (
                    <div key={key} className="flex flex-col gap-1">
                      <label className="text-sm flex items-center gap-1">
                        {label}
                        {editable && <span className="text-xs text-amber-600">(flagged)</span>}
                      </label>
                      <input
                        className={`border rounded p-2 text-sm ${editable ? 'border-amber-400 bg-amber-50' : 'bg-slate-50 text-slate-500'}`}
                        defaultValue={String(value ?? '')}
                        readOnly={!editable}
                        {...(editable ? register(key) : {})}
                      />
                    </div>
                  )
                })}
              </div>
            </fieldset>
          )
        })}

        <fieldset className="border rounded-lg p-4">
          <legend className="font-semibold px-1">Documents</legend>
          <div className="flex flex-col gap-3">
            {['staff_qualification', 'fire_safety', 'floor_plan', 'insurance'].map(docType => {
              const latestDoc = submissions[submissions.length - 1]?.documents?.find(d => d.doc_type === docType)
              const isFlagged = latestDoc ? flaggedDocs.has(latestDoc.id) : false

              if (isFlagged) {
                return (
                  <DocumentUploader
                    key={docType}
                    docType={docType}
                    label={docType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    applicationId={id!}
                    onApplicationId={() => {}}
                    onUpload={doc => setUploadedDocs(prev => [...prev.filter(d => d.doc_type !== doc.doc_type), doc])}
                  />
                )
              }

              return (
                <div key={docType} className="border rounded p-3 bg-slate-50">
                  <span className="text-sm text-slate-500">{latestDoc?.filename || 'No document'}</span>
                  <span className="text-xs text-slate-400 ml-2">(unchanged)</span>
                </div>
              )
            })}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={submitting}
          className="bg-slate-900 text-white p-3 rounded disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Resubmit Application'}
        </button>
      </form>
    </div>
  )
}
