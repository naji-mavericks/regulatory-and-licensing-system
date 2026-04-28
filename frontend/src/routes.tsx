import { createBrowserRouter } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import OperatorLayout from './components/OperatorLayout'
import ApplicationListPage from './pages/ApplicationListPage'
import SubmitApplicationPage from './pages/SubmitApplicationPage'
import ApplicationDetailPage from './pages/ApplicationDetailPage'
import ResubmissionPage from './pages/ResubmissionPage'

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
])
