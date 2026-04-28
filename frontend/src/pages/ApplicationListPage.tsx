import React from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import StatusBadge from '../components/StatusBadge'

interface ApplicationSummary {
  id: string
  status: string
  centre_name: string
  type_of_service: string
  current_round: number
  updated_at: string
}

export default function ApplicationListPage() {
  const [apps, setApps] = React.useState<ApplicationSummary[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    api.get('/applications')
      .then(res => setApps(res.data))
      .catch(() => setError('Failed to load applications.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Applications</h1>
        <Link
          to="/operator/apply"
          className="bg-slate-900 text-white px-4 py-2 rounded text-sm"
        >
          New Application
        </Link>
      </div>

      {loading && <p className="text-slate-500">Loading...</p>}

      {error && (
        <div className="text-center py-12 border rounded-lg border-red-200 bg-red-50">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {!loading && !error && apps.length === 0 && (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-slate-500 mb-4">No applications yet</p>
          <Link to="/operator/apply" className="text-blue-600 underline">
            Start your first application
          </Link>
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-col gap-4">
        {apps.map(app => (
          <Link
            key={app.id}
            to={`/operator/applications/${app.id}`}
            className="border rounded-lg p-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{app.centre_name}</h2>
                <p className="text-sm text-slate-500">{app.type_of_service}</p>
              </div>
              <StatusBadge status={app.status} />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Round {app.current_round} &middot; Updated {new Date(app.updated_at).toLocaleDateString()}
            </p>
          </Link>
        ))}
      </div>
      )}
    </div>
  )
}
