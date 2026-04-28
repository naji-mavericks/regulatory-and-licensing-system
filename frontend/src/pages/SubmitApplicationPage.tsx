import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '../lib/api'
import DocumentUploader from '../components/DocumentUploader'
import ProgressIndicator from '../components/ProgressIndicator'

const formSchema = z.object({
  basic_details: z.object({
    centre_name: z.string().min(1, 'Required'),
    operator_company_name: z.string().min(1, 'Required'),
    uen: z.string().min(1, 'Required'),
    contact_person: z.string().min(1, 'Required'),
    contact_email: z.string().email(),
    contact_phone: z.string().min(1, 'Required'),
  }),
  operations: z.object({
    centre_address: z.string().min(1, 'Required'),
    type_of_service: z.enum(['Student Care', 'Childcare']),
    proposed_capacity: z.number({ coerce: true }).min(1),
  }),
  declarations: z.object({
    compliance_confirmed: z.literal(true, {
      errorMap: () => ({ message: 'You must confirm the declaration' }),
    }),
  }),
})

type FormData = z.infer<typeof formSchema>

interface UploadedDoc {
  id: string
  doc_type: string
  filename: string
  ai_status: string
  ai_details: Record<string, unknown> | null
}

export default function SubmitApplicationPage() {
  const navigate = useNavigate()
  const [applicationId, setApplicationId] = React.useState<string | null>(null)
  const [uploadedDocs, setUploadedDocs] = React.useState<UploadedDoc[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      basic_details: { centre_name: '', operator_company_name: '', uen: '', contact_person: '', contact_email: '', contact_phone: '' },
      operations: { centre_address: '', type_of_service: 'Childcare', proposed_capacity: undefined },
      declarations: { compliance_confirmed: undefined },
    },
  })

  const watchedValues = useWatch({ control })

  const sections = [
    {
      name: 'Basic Details',
      complete: Object.values(watchedValues.basic_details).every(v => v !== '' && v !== undefined),
    },
    {
      name: 'Operations',
      complete: Object.values(watchedValues.operations).every(v => v !== '' && v !== undefined),
    },
    {
      name: 'Documents',
      complete: ['staff_qualification', 'fire_safety', 'floor_plan'].every(
        dt => uploadedDocs.some(d => d.doc_type === dt && d.ai_status === 'pass')
      ),
    },
    {
      name: 'Declarations',
      complete: watchedValues.declarations.compliance_confirmed === true,
    },
  ]

  const canSubmit = sections.every(s => s.complete)

  const handleDocUpload = (doc: UploadedDoc) => {
    setUploadedDocs(prev => {
      const filtered = prev.filter(d => d.doc_type !== doc.doc_type)
      return [...filtered, doc]
    })
  }

  const onSubmit = async (data: FormData) => {
    if (!applicationId) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const response = await api.post('/applications', {
        application_id: applicationId,
        form_data: data,
        document_ids: uploadedDocs.map(d => d.id),
      })
      navigate(`/operator/applications/${response.data.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Submission failed'
      setSubmitError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">New Application</h1>

      <ProgressIndicator sections={sections} />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* Basic Details */}
        <fieldset className="border rounded-lg p-4">
          <legend className="font-semibold px-1">Basic Details</legend>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm">Centre Name</label>
              <input className="border rounded p-2 text-sm" {...register('basic_details.centre_name')} />
              {errors.basic_details?.centre_name && <p className="text-xs text-red-500">{errors.basic_details.centre_name.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm">Operator / Company Name</label>
              <input className="border rounded p-2 text-sm" {...register('basic_details.operator_company_name')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm">UEN</label>
              <input className="border rounded p-2 text-sm" {...register('basic_details.uen')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm">Contact Person</label>
              <input className="border rounded p-2 text-sm" {...register('basic_details.contact_person')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm">Contact Email</label>
              <input className="border rounded p-2 text-sm" type="email" {...register('basic_details.contact_email')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm">Contact Phone</label>
              <input className="border rounded p-2 text-sm" {...register('basic_details.contact_phone')} />
            </div>
          </div>
        </fieldset>

        {/* Operations */}
        <fieldset className="border rounded-lg p-4">
          <legend className="font-semibold px-1">Operations</legend>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-sm">Centre Address</label>
              <input className="border rounded p-2 text-sm" {...register('operations.centre_address')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm">Type of Service</label>
              <select className="border rounded p-2 text-sm" {...register('operations.type_of_service')}>
                <option value="Childcare">Childcare</option>
                <option value="Student Care">Student Care</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm">Proposed Capacity</label>
              <input className="border rounded p-2 text-sm" type="number" {...register('operations.proposed_capacity', { valueAsNumber: true })} />
            </div>
          </div>
        </fieldset>

        {/* Document Uploads */}
        <fieldset className="border rounded-lg p-4">
          <legend className="font-semibold px-1">Documents</legend>
          <div className="flex flex-col gap-3">
            <DocumentUploader
              docType="staff_qualification"
              label="Staff Qualification Certificate(s)"
              applicationId={applicationId}
              onApplicationId={setApplicationId}
              onUpload={handleDocUpload}
            />
            <DocumentUploader
              docType="fire_safety"
              label="Fire Safety Certificate"
              applicationId={applicationId}
              onApplicationId={setApplicationId}
              onUpload={handleDocUpload}
            />
            <DocumentUploader
              docType="floor_plan"
              label="Floor Plan of Premises"
              applicationId={applicationId}
              onApplicationId={setApplicationId}
              onUpload={handleDocUpload}
            />
            <DocumentUploader
              docType="insurance"
              label="Insurance Certificate"
              required={false}
              applicationId={applicationId}
              onApplicationId={setApplicationId}
              onUpload={handleDocUpload}
            />
          </div>
        </fieldset>

        {/* Declarations */}
        <fieldset className="border rounded-lg p-4">
          <legend className="font-semibold px-1">Declarations</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('declarations.compliance_confirmed')} />
            I confirm all information is accurate
          </label>
          {errors.declarations?.compliance_confirmed && (
            <p className="text-xs text-red-500 mt-1">{errors.declarations.compliance_confirmed.message}</p>
          )}
        </fieldset>

        {submitError && <p className="text-sm text-red-500">{submitError}</p>}

        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="bg-slate-900 text-white p-3 rounded disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Application'}
        </button>
      </form>
    </div>
  )
}
