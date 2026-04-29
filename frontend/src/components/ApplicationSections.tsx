import React from 'react'
import {
  FIELD_LABELS,
  SECTION_LABELS,
  DOC_TYPE_LABELS,
  SECTION_ORDER,
  DOC_TYPE_ORDER,
  OPTIONAL_DOC_TYPES,
} from '../lib/formLabels'

interface Document {
  id: string
  doc_type: string
  filename: string
  ai_status: string
}

interface FeedbackItem {
  id: string
  target_type: string
  section: string
  field_key: string | null
  document_id: string | null
  comment: string
  created_by: string
}

interface ApplicationSectionsProps {
  formData: Record<string, Record<string, unknown>>
  documents: Document[]
  feedbackByField?: Record<string, FeedbackItem[]>
  feedbackBySection?: Record<string, FeedbackItem[]>
  feedbackByDocument?: Record<string, FeedbackItem[]>
  previousFormData?: Record<string, Record<string, unknown>>
  previousDocuments?: Document[]
}

export default function ApplicationSections({
  formData,
  documents,
  feedbackByField = {},
  feedbackBySection = {},
  feedbackByDocument = {},
  previousFormData,
  previousDocuments,
}: ApplicationSectionsProps) {
  const changedFields = React.useMemo(() => {
    if (!previousFormData) return new Set<string>()
    const changed = new Set<string>()
    for (const section of SECTION_ORDER) {
      const curr = formData[section] ?? {}
      const prev = previousFormData[section] ?? {}
      for (const key of Object.keys({ ...curr, ...prev })) {
        if (curr[key] !== prev[key]) changed.add(`${section}.${key}`)
      }
    }
    return changed
  }, [formData, previousFormData])

  const changedDocTypes = React.useMemo(() => {
    if (!previousDocuments) return new Set<string>()
    const prevByType = new Map(previousDocuments.map(d => [d.doc_type, d.id]))
    const changed = new Set<string>()
    for (const doc of documents) {
      if (prevByType.has(doc.doc_type) && prevByType.get(doc.doc_type) !== doc.id) {
        changed.add(doc.doc_type)
      }
    }
    return changed
  }, [documents, previousDocuments])

  return (
    <>
      {SECTION_ORDER.map(section => {
        const fields = formData[section]
        if (!fields) return null
        const sectionItems = feedbackBySection[section] ?? []
        const sectionLabel = SECTION_LABELS[section] ?? section
        return (
          <div key={section} className="border border-slate-200 rounded-lg p-4 mb-4">
            <h2 className="font-semibold text-sm mb-3">{sectionLabel}</h2>
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
                const flaggedItems = feedbackByField[key] ?? []
                const isFlagged = flaggedItems.length > 0
                const isChanged = changedFields.has(`${section}.${key}`)
                const label = FIELD_LABELS[key] ?? key
                const displayValue = key === 'compliance_confirmed'
                  ? (value ? '✓ I confirm all information is accurate' : '✗ Not confirmed')
                  : String(value ?? '')
                return (
                  <div key={key} className={`flex flex-col gap-1 ${isFullWidth ? 'col-span-2' : ''}`}>
                    <span className="text-xs text-slate-600 flex items-center gap-1">
                      {label}
                      {isFlagged && <span className="text-amber-600 font-medium">⚑ flagged</span>}
                      {isChanged && <span className="text-indigo-600 font-medium text-xs px-1 bg-indigo-50 rounded">changed</span>}
                    </span>
                    <div className={`rounded-md px-3 py-1.5 text-sm ${
                      isFlagged
                        ? 'bg-amber-50 border-2 border-amber-400 text-slate-800'
                        : 'bg-slate-50 border border-slate-200 text-slate-800'
                    }`}>
                      {displayValue}
                    </div>
                    {flaggedItems.map(f => (
                      <div key={f.id} className="bg-amber-100 border-l-2 border-amber-400 rounded text-amber-900 text-xs px-2 py-1">
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

      <div className="border border-slate-200 rounded-lg p-4 mb-4">
        <h2 className="font-semibold text-sm mb-3">Documents</h2>
        <div className="flex flex-col gap-2">
          {DOC_TYPE_ORDER.map(docType => {
            const doc = documents.find(d => d.doc_type === docType)
            const isOptional = OPTIONAL_DOC_TYPES.has(docType)
            const flaggedItems = doc ? (feedbackByDocument[doc.id] ?? []) : []
            const isFlagged = flaggedItems.length > 0
            const isChanged = changedDocTypes.has(docType)
            const label = DOC_TYPE_LABELS[docType] ?? docType
            return (
              <div key={docType}>
                <div className={`rounded-md border px-3 py-2 ${isFlagged ? 'bg-amber-50 border-2 border-amber-400' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">
                        {label}
                        {isOptional && <span className="text-xs text-slate-500 ml-1">(optional)</span>}
                        {isFlagged && <span className="text-xs text-amber-600 font-medium ml-1">⚑ flagged</span>}
                        {isChanged && <span className="text-xs text-indigo-600 font-medium ml-1 px-1 bg-indigo-50 rounded">changed</span>}
                      </span>
                      <p className="text-xs text-slate-600 mt-0.5">{doc ? doc.filename : 'Not submitted'}</p>
                    </div>
                    {doc ? (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${doc.ai_status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {doc.ai_status}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </div>
                </div>
                {flaggedItems.map(f => (
                  <div key={f.id} className="bg-amber-100 border-l-2 border-amber-400 rounded text-amber-900 text-xs px-2 py-1 mt-1">
                    {f.comment}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
