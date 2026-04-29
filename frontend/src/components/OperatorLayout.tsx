import { Outlet, NavLink, useNavigate } from 'react-router-dom'

export default function OperatorLayout() {
  const navigate = useNavigate()
  const role = localStorage.getItem('role') ?? 'operator'

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    navigate('/login')
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
      isActive
        ? 'bg-indigo-50 text-indigo-700 font-medium'
        : 'text-slate-600 hover:bg-slate-50'
    }`

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="px-4 py-5 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-800">Licensing Portal</span>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          <NavLink to="/operator/applications" className={navLinkClass}>
            My Applications
          </NavLink>
        </nav>

        <div className="px-4 py-4 border-t border-slate-100 flex flex-col gap-2">
          <span className="text-xs text-slate-500 capitalize">{role}</span>
          <button
            onClick={handleLogout}
            className="text-left text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
