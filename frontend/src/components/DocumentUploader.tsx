import React from 'react'
import { api } from '../lib/api'

interface UploadedDoc {
  id: string
  doc_type: string
  filename: string
  ai_status: string
  ai_details: Record<string, unknown> | null
}

interface Props {
  docType: string
  label: string
  required?: boolean
  applicationId: string | null
  onApplicationId: (id: string) => void
  onUpload: (doc: UploadedDoc) => void
}

export default function DocumentUploader({
  docType,
  label,
  required = true,
  applicationId,
  onApplicationId,
  onUpload,
}: Props) {
  const [uploaded, setUploaded] = React.useState<UploadedDoc | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('doc_type', docType)
    if (applicationId) {
      formData.append('application_id', applicationId)
    }

    try {
      const response = await api.post('/documents/upload', formData)
      const doc = response.data as UploadedDoc
      setUploaded(doc)
      onUpload(doc)
      if (!applicationId && response.data.application_id) {
        onApplicationId(response.data.application_id)
      }
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
        {uploaded && (
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              uploaded.ai_status === 'pass'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {uploaded.ai_status === 'pass' ? '✓ Pass' : '✗ Issues found'}
          </span>
        )}
        {uploading && (
          <span className="text-xs text-slate-500">Verifying...</span>
        )}
      </div>

      {uploaded ? (
        <div>
          <p className="text-xs text-slate-500">{uploaded.filename}</p>
          {uploaded.ai_status === 'fail' && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-blue-600 underline mt-1"
            >
              Re-upload
            </button>
          )}
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-slate-300 rounded p-6 text-center cursor-pointer hover:border-slate-400"
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="text-sm text-slate-500">
            Click or drag to upload
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFile}
        accept=".pdf,.jpg,.jpeg,.png"
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
