import React from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import StatusBadge from '../components/StatusBadge'

interface OfficerAppSummary {
  id: string
  status: string
  centre_name: string
  operator_name: string
  type_of_service: string
  current_round: number
  updated_at: string
}

const FILTER_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Application Received', value: 'Application Received' },
  { label: 'Under Review', value: 'Under Review' },
  { label: 'Pending Pre-Site Resubmission', value: 'Pending Pre-Site Resubmission' },
  { label: 'Pre-Site Resubmitted', value: 'Pre-Site Resubmitted' },
  { label: 'Route to Approval', value: 'Pending Approval' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Rejected', value: 'Rejected' },
]

export default function OfficerApplicationListPage() {
  const navigate = useNavigate()
  const [apps, setApps] = React.useState<OfficerAppSummary[]>([])
  const [loading, setLoading] = React.useState(true)
  const [statusFilter, setStatusFilter] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    const params = statusFilter ? { status: statusFilter } : {}
    api.get('/applications', { params })
      .then(res => { if (!cancelled) setApps(res.data) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [statusFilter])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Applications</h1>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-1.5 text-sm"
        >
          {FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {loading && <p>Loading...</p>}

      {!loading && apps.length === 0 && (
        <p className="text-slate-500">No applications matching this filter.</p>
      )}

      {!loading && apps.length > 0 && (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
              <th className="py-2 pr-4">Centre Name</th>
              <th className="py-2 pr-4">Operator</th>
              <th className="py-2 pr-4">Service Type</th>
              <th className="py-2 pr-4">Round</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {apps.map(app => (
              <tr
                key={app.id}
                onClick={() => navigate(`/officer/applications/${app.id}`)}
                className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
              >
                <td className="py-3 pr-4 font-medium">{app.centre_name}</td>
                <td className="py-3 pr-4 text-slate-600">{app.operator_name}</td>
                <td className="py-3 pr-4 text-slate-600">{app.type_of_service}</td>
                <td className="py-3 pr-4 text-slate-600">{app.current_round}</td>
                <td className="py-3 pr-4"><StatusBadge status={app.status} /></td>
                <td className="py-3 text-slate-500">{new Date(app.updated_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
