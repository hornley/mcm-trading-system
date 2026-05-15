import { Route, 
  createBrowserRouter, 
  createRoutesFromElements, 
  RouterProvider 
} from 'react-router-dom'

import LandingPage from './../pages/LandingPage'
import AuthLayout from './../layouts/AuthLayout'
import Login from './../pages/auth/Login'
import Register from './../pages/auth/Register'

import DashboardLayout from './../layouts/DashboardLayout'
import Owner from '../pages/dashboard/Owner'
import Manager from '../pages/dashboard/Manager'
import Admin from '../pages/dashboard/Admin'

import ProtectedRoute from './ProtectedRoute'

import Inventory from '../pages/module/Inventory'
import Maintenance from '../pages/module/Maintenance'
import StockManagement from '../pages/module/StockManagement'
import Sales from '../pages/module/Sales'
import UserAccess from '../pages/module/UserAccess'
import Report from '../pages/module/Reports'
import SettingsPage from '../pages/module/Settings'
//Contains all paths to pages

const router = createBrowserRouter (
  createRoutesFromElements(
        <Route>

      <Route path="/" element={<AuthLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["owner", "manager", "admin"]} />}>
        <Route path="/dashboard" element={<DashboardLayout />}>

          {/* role dashboards */}
          <Route element={<ProtectedRoute allowedRoles={["owner"]} />}>
            <Route path="owner" element={<Owner />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["manager"]} />}>
            <Route path="manager" element={<Manager />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="admin" element={<Admin />} />
          </Route>

          {/* shared - owner and manager */}
          <Route element={<ProtectedRoute allowedRoles={["owner", "manager"]} />}>
            <Route path="inventory" element={<Inventory />} />
            <Route path="sales" element={<Sales />} />
            <Route path="stock-management" element={<StockManagement />} />
            <Route path="report" element={<Report />} />
            <Route path="users" element={<UserAccess />} />
          </Route>

          {/* admin and owner - maintenance */}
          <Route element={<ProtectedRoute allowedRoles={["admin", "owner"]} />}>
            <Route path="maintenance" element={<Maintenance />} />
          </Route>

          {/* settings - all roles */}
          <Route element={<ProtectedRoute allowedRoles={["owner", "manager", "admin"]} />}>
            <Route path="settings" element={<SettingsPage />} />
          </Route>

        </Route>
      </Route>

    </Route>
  )
)

export default router;