import { createBrowserRouter } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import ApplicationListPage from './pages/ApplicationListPage'
import SubmitApplicationPage from './pages/SubmitApplicationPage'

export const router = createBrowserRouter([
  { path: '/', element: <LoginPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/operator', element: <ApplicationListPage /> },
  { path: '/operator/applications', element: <ApplicationListPage /> },
  { path: '/operator/apply', element: <SubmitApplicationPage /> },
])
