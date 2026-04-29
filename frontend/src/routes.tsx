import { createBrowserRouter } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import OperatorLayout from './components/OperatorLayout'
import OfficerLayout from './components/OfficerLayout'
import ApplicationListPage from './pages/ApplicationListPage'
import SubmitApplicationPage from './pages/SubmitApplicationPage'
import ApplicationDetailPage from './pages/ApplicationDetailPage'
import ResubmissionPage from './pages/ResubmissionPage'
import OfficerApplicationListPage from './pages/OfficerApplicationListPage'
import OfficerApplicationDetailPage from './pages/OfficerApplicationDetailPage'

export const router = createBrowserRouter([
  { path: '/', element: <LoginPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/operator',
    element: <OperatorLayout />,
    children: [
      { index: true, element: <ApplicationListPage /> },
      { path: 'applications', element: <ApplicationListPage /> },
      { path: 'applications/:id', element: <ApplicationDetailPage /> },
      { path: 'applications/:id/resubmit', element: <ResubmissionPage /> },
      { path: 'apply', element: <SubmitApplicationPage /> },
    ],
  },
  {
    path: '/officer',
    element: <OfficerLayout />,
    children: [
      { index: true, element: <OfficerApplicationListPage /> },
      { path: 'applications', element: <OfficerApplicationListPage /> },
      { path: 'applications/:id', element: <OfficerApplicationDetailPage /> },
    ],
  },
])
