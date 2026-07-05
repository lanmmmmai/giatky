import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { DASHBOARD_PATH, Role } from '../config/roleNav';

interface ProtectedRouteProps {
  children: JSX.Element;
  roles?: Role[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const { user, token } = useAuthStore();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={DASHBOARD_PATH[user.role]} replace />;
  }

  return children;
};

export default ProtectedRoute;
