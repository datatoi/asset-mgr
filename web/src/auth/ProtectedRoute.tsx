import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Spin } from 'antd';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, userData, isPlatformAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // A Platform Admin may have no subscription of their own - only redirect to
  // registration if they're neither in a subscription nor a Platform Admin.
  if (!userData && !isPlatformAdmin && location.pathname !== '/register') {
    return <Navigate to="/register" replace />;
  }

  return <>{children}</>;
};