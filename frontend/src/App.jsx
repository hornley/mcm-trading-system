import { Route, 
  createBrowserRouter, 
  createRoutesFromElements, 
  RouterProvider 
} from 'react-router-dom'

import LandingPage from './pages/LandingPage'
import AuthLayout from './layouts/AuthLayout'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

import DashboardLayout from './layouts/DashboardLayout'
import OwnerDashboard from './pages/dashboard/OwnerDashboard'


const router = createBrowserRouter (
  createRoutesFromElements(
    <Route>
      <Route path="/" element={<AuthLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
      </Route>

      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route path="owner" element={<OwnerDashboard />} />
      </Route>
    </Route>
  )
)

const App = () => {
  return <RouterProvider router={router} />
}

export default App