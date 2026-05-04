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
import Staff from '../pages/dashboard/Staff'
import ProtectedRoute from './ProtectedRoute'

import Inventory from '../pages/module/Inventory'
import StaffInventory from '../pages/module/StaffInventory'
import Maintenance from '../pages/module/Maintentance'
import StockManagement from '../pages/module/StockManagement'
import UserAccess from '../pages/module/UserAccess'
import Report from '../pages/module/UserAccess'
//Contains all paths to pages

const router = createBrowserRouter (
  createRoutesFromElements(
        <Route>

      <Route path="/" element={<AuthLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["owner", "manager", "admin", "staff"]} />}>
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

          <Route element={<ProtectedRoute allowedRoles={["staff"]} />}>
            <Route path="staff" element={<Staff />} />
          </Route>

          {/* shared - owner and manager */}
          <Route element={<ProtectedRoute allowedRoles={["owner", "manager"]} />}>
            <Route path="inventory" element={<Inventory />} />
            <Route path="stock-management" element={<StockManagement />} />
            <Route path="report" element={<Report />} />
            <Route path="users" element={<UserAccess />} />
          </Route>

          {/* staff only */}
          <Route element={<ProtectedRoute allowedRoles={["staff"]} />}>
            <Route path="inventory/staff" element={<StaffInventory />} />
          </Route>

          {/* admin only */}
          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="maintenance" element={<Maintenance />} />
          </Route>

        </Route>
      </Route>

    </Route>
  )
)

export default router;