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
import Maintentance from '../pages/module/Maintentance'
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

      <Route element={<ProtectedRoute allowedRoles={["owner", "manager", "admin"]} />} >
        <Route path="/dashboard" element={<DashboardLayout />}>
            <Route element={<ProtectedRoute allowedRoles={["owner"]} />} >
                <Route path="owner" element={<Owner />} />
            </Route>
            
            <Route  element={<ProtectedRoute allowedRoles={["manager"]} />}>
                <Route path="manager" element={<Manager />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={["manager"]} />}>  
                <Route path="admin" element={<Admin />} />
            </Route>
        </Route>
      </Route>

    </Route>
  )
)

export default router;