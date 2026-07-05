import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { DASHBOARD_PATH } from './config/roleNav';

import DashboardLayout from './layouts/DashboardLayout';
import AuthLayout from './layouts/AuthLayout';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/ToastContainer';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import VerifyEmail from './pages/auth/VerifyEmail';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

import Dashboard from './pages/dashboard/Dashboard';
import Orders from './pages/orders/Orders';
import CreateOrder from './pages/orders/CreateOrder';
import OrderDetail from './pages/orders/OrderDetail';
import Users from './pages/users/Users';
import Branches from './pages/branches/Branches';
import Services from './pages/services/Services';
import Attendance from './pages/attendance/Attendance';
import Payroll from './pages/payroll/Payroll';
import Reports from './pages/reports/Reports';
import Cms from './pages/cms/Cms';
import Chat from './pages/chat/Chat';
import Settings from './pages/settings/Settings';
import Notifications from './pages/notifications/Notifications';

// Redirects "/" and any unmatched path to the user's own dashboard,
// or to /login when not authenticated.
const RootRedirect: React.FC = () => {
  const { user, token } = useAuthStore();
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={DASHBOARD_PATH[user.role]} replace />;
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Public Auth routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Route>

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin']}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/create" element={<CreateOrder />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="reports" element={<Reports />} />
            <Route path="users" element={<Users />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="services" element={<Services />} />
            <Route path="cms" element={<Cms />} />
            <Route path="chat" element={<Chat />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={<Settings />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Manager */}
          <Route
            path="/manager"
            element={
              <ProtectedRoute roles={['manager']}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="branches" element={<Branches />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/create" element={<CreateOrder />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="staff" element={<Users />} />
            <Route path="services" element={<Services />} />
            <Route path="cms" element={<Cms />} />
            <Route path="chat" element={<Chat />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={<Settings />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Staff */}
          <Route
            path="/staff"
            element={
              <ProtectedRoute roles={['staff']}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/create" element={<CreateOrder />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="reports" element={<Reports />} />
            <Route path="chat" element={<Chat />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={<Settings />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Route>

          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer />
    </ErrorBoundary>
  );
};

export default App;
