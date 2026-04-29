import React from 'react'
import { api } from '../lib/api'
import { getValidNextStatuses, getOfficerLabel } from '../lib/statusMachine'

interface Document {
  id: string
  doc_type: string
  filename: string
  ai_status: string
}

interface FeedbackItemDraft {
  targetType: 'field' | 'document'
  section: string
  fieldKey: string
  documentId: string
  comment: string
}

interface FeedbackPanelProps {
  applicationId: string
  currentStatus: string
  documents: Document[]
  onSuccess: () => void
}

const FIELD_SECTIONS = ['basic_details', 'operations', 'declarations']
const SECTION_LABELS: Record<string, string> = {
  basic_details: 'Basic Details',
  operations: 'Operations',
  declarations: 'Declarations',
}
const FIELDS_BY_SECTION: Record<string, string[]> = {
  basic_details: ['centre_name', 'operator_company_name', 'uen', 'contact_person', 'contact_email', 'contact_phone'],
  operations: ['centre_address', 'type_of_service', 'proposed_capacity'],
  declarations: ['compliance_confirmed'],
}
const FIELD_LABELS: Record<string, string> = {
  centre_name: 'Centre Name', operator_company_name: 'Operator / Company Name',
  uen: 'UEN', contact_person: 'Contact Person', contact_email: 'Contact Email',
  contact_phone: 'Contact Phone', centre_address: 'Centre Address',
  type_of_service: 'Type of Service', proposed_capacity: 'Proposed Capacity',
  compliance_confirmed: 'Compliance Declaration',
}
const COMMENT_TEMPLATES = [
  'Please provide a clearer copy of this document.',
  'This field contains incorrect or inconsistent information.',
  'The document appears to be expired or invalid.',
  'The information provided does not match supporting documents.',
  'Additional supporting evidence is required for this item.',
]

const emptyDraft = (): FeedbackItemDraft => ({
  targetType: 'field', section: 'basic_details', fieldKey: 'centre_name', documentId: '', comment: '',
})

function FeedbackItemRow({
  item, documents, onChange,
}: { item: FeedbackItemDraft; documents: Document[]; onChange: (u: Partial<FeedbackItemDraft>) => void }) {
  const [showTemplates, setShowTemplates] = React.useState(false)
  const fields = item.targetType === 'field' ? FIELDS_BY_SECTION[item.section] ?? [] : []

  return (
    <div className="border border-slate-100 rounded-md p-3 flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs text-slate-600">Type</label>
          <select
            value={item.targetType}
            onChange={e => {
              const t = e.target.value as 'field' | 'document'
              onChange({ targetType: t, section: t === 'field' ? 'basic_details' : 'documents', fieldKey: t === 'field' ? 'centre_name' : '', documentId: '' })
            }}
            className="border border-slate-200 rounded-md px-2 py-1 text-sm"
          >
            <option value="field">Form Field</option>
            <option value="document">Document</option>
          </select>
        </div>
        {item.targetType === 'field' && (
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs text-slate-600">Section</label>
            <select
              value={item.section}
              onChange={e => onChange({ section: e.target.value, fieldKey: FIELDS_BY_SECTION[e.target.value]?.[0] ?? '' })}
              className="border border-slate-200 rounded-md px-2 py-1 text-sm"
            >
              {FIELD_SECTIONS.map(s => <option key={s} value={s}>{SECTION_LABELS[s]}</option>)}
            </select>
          </div>
        )}
      </div>
      {item.targetType === 'field' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-600">Field</label>
          <select value={item.fieldKey} onChange={e => onChange({ fieldKey: e.target.value })}
            className="border border-slate-200 rounded-md px-2 py-1 text-sm">
            {fields.map(f => <option key={f} value={f}>{FIELD_LABELS[f] ?? f}</option>)}
          </select>
        </div>
      )}
      {item.targetType === 'document' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-600">Document</label>
          <select value={item.documentId} onChange={e => onChange({ documentId: e.target.value })}
            className="border border-slate-200 rounded-md px-2 py-1 text-sm">
            <option value="">— Select document —</option>
            {documents.map(d => <option key={d.id} value={d.id}>{d.doc_type}: {d.filename}</option>)}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-600">Comment</label>
          <button type="button" onClick={() => setShowTemplates(t => !t)}
            className="text-xs text-blue-600 underline">Insert template</button>
        </div>
        {showTemplates && (
          <div className="border border-slate-100 rounded-md shadow-sm bg-white">
            {COMMENT_TEMPLATES.map(t => (
              <button key={t} type="button"
                className="block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50"
                onClick={() => { onChange({ comment: t }); setShowTemplates(false) }}>{t}</button>
            ))}
          </div>
        )}
        <textarea value={item.comment} onChange={e => onChange({ comment: e.target.value })}
          className="border border-slate-200 rounded-md px-3 py-1.5 text-sm resize-none"
          rows={2} placeholder="Enter feedback comment..." />
      </div>
    </div>
  )
}

export default function FeedbackPanel({ applicationId, currentStatus, documents, onSuccess }: FeedbackPanelProps) {
  const [items, setItems] = React.useState<FeedbackItemDraft[]>([emptyDraft()])
  const [newStatus, setNewStatus] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const validNextStatuses = getValidNextStatuses(currentStatus)
  const canSubmit = items.some(i => i.comment.trim()) && newStatus !== '' && !submitting

  const updateItem = (index: number, update: Partial<FeedbackItemDraft>) =>
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...update } : item))

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const feedbackItems = items.filter(i => i.comment.trim()).map(i => ({
        target_type: i.targetType,
        section: i.section,
        field_key: i.targetType === 'field' ? i.fieldKey : null,
        document_id: i.targetType === 'document' ? i.documentId : null,
        comment: i.comment,
      }))
      await api.post(`/applications/${applicationId}/feedback`, { feedback_items: feedbackItems, new_status: newStatus })
      setItems([emptyDraft()])
      setNewStatus('')
      onSuccess()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Failed to submit feedback.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4 flex flex-col gap-4">
      <h2 className="font-semibold text-sm">Officer Feedback</h2>
      {items.map((item, index) => (
        <FeedbackItemRow key={index} item={item} documents={documents} onChange={u => updateItem(index, u)} />
      ))}
      <button type="button" onClick={() => setItems(prev => [...prev, emptyDraft()])}
        className="text-sm text-blue-600 underline text-left">+ Add another item</button>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-600">Set Status</label>
        <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-1.5 text-sm">
          <option value="">— Select next status —</option>
          {validNextStatuses.map(s => <option key={s} value={s}>{getOfficerLabel(s)}</option>)}
        </select>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="button" onClick={handleSubmit} disabled={!canSubmit}
        className="bg-slate-900 text-white py-2 px-4 rounded-md text-sm disabled:opacity-50">
        Submit Feedback
      </button>
    </div>
  )
}
