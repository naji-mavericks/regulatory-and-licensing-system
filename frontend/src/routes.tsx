import { createBrowserRouter } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import ApplicationListPage from './pages/ApplicationListPage'
import SubmitApplicationPage from './pages/SubmitApplicationPage'
import ApplicationDetailPage from './pages/ApplicationDetailPage'

export const router = createBrowserRouter([
  { path: '/', element: <LoginPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/operator', element: <ApplicationListPage /> },
  { path: '/operator/applications', element: <ApplicationListPage /> },
  { path: '/operator/applications/:id', element: <ApplicationDetailPage /> },
  { path: '/operator/apply', element: <SubmitApplicationPage /> },
])
