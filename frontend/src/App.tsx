import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { DASHBOARD_PATH } from './config/roleNav';

import DashboardLayout from './layouts/DashboardLayout';
import AuthLayout from './layouts/AuthLayout';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/ToastContainer';
import ProtectedRoute from './components/ProtectedRoute';
import { ConfirmDialogProvider } from './components/ConfirmDialog';

// Pages
import Login from './pages/auth/Login';
import RoleLoginPage from './pages/auth/RoleLoginPage';
import Register from './pages/auth/Register';
import VerifyEmail from './pages/auth/VerifyEmail';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import ShiftRegistrationRequest from './pages/auth/ShiftRegistrationRequest';

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
import RevenueReports from './pages/reports/RevenueReports';
import Cms from './pages/cms/Cms';
import Chat from './pages/chat/Chat';
import Settings from './pages/settings/Settings';
import Notifications from './pages/notifications/Notifications';
import ContentAdmin from './pages/content/ContentAdmin';
import PublicPosts from './pages/content/PublicPosts';
import PublicPostDetail from './pages/content/PublicPostDetail';
import {
  AboutPage,
  ContactPage,
  CookiesPage,
  FAQPage,
  PrivacyPage,
  ServicesPage,
  TermsPage,
} from './pages/public/PublicPages';

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
      <ConfirmDialogProvider>
        <BrowserRouter>
          <Routes>
          {/* Public Auth routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Navigate to="/staff/login" replace />} />
            <Route path="/admin/login" element={<RoleLoginPage role="admin" />} />
            <Route path="/manager/login" element={<RoleLoginPage role="manager" />} />
            <Route path="/staff/login" element={<RoleLoginPage role="staff" />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/verify-account" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/staff/register-shift-request" element={<ShiftRegistrationRequest />} />
          </Route>

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin']} loginPath="/admin/login">
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/create" element={<CreateOrder />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="reports" element={<RevenueReports />} />
            <Route path="users" element={<Users />} />
            <Route path="branches" element={<Branches />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="services" element={<Services />} />
            <Route path="cms" element={<Cms />} />
            <Route path="content" element={<ContentAdmin />} />
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
              <ProtectedRoute roles={['manager']} loginPath="/manager/login">
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
            <Route path="reports" element={<RevenueReports />} />
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
              <ProtectedRoute roles={['staff']} loginPath="/staff/login">
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
            <Route path="reports" element={<RevenueReports />} />
            <Route path="chat" element={<Chat />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={<Settings />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Route>

          <Route path="/" element={<Navigate to="/staff/login" replace />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/cookies" element={<CookiesPage />} />
          <Route path="/blog" element={<PublicPosts />} />
          <Route path="/blog/:slug" element={<PublicPostDetail />} />
          <Route path="/bai-viet" element={<PublicPosts />} />
          <Route path="/bai-viet/:slug" element={<PublicPostDetail />} />
          <Route path="/tuyen-dung" element={<PublicPosts defaultType="recruitment" />} />
          <Route path="/tuyen-dung/:slug" element={<PublicPostDetail />} />
          <Route path="*" element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
        <ToastContainer />
      </ConfirmDialogProvider>
    </ErrorBoundary>
  );
};

export default App;
