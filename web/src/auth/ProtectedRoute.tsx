import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Spin } from 'antd';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, userData, isOwner } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Membership comes from an invitation; registration is an explicit owner flow.
  if (!userData?.subscriptionId && location.pathname !== '/invitation-required') {
    return <Navigate to="/invitation-required" replace />;
  }

  // A 'joiner' (default role from the invite-link join flow, before an
  // admin promotes them - see joinSubscription) can only see their own
  // Profile page, so any other route bounces them there.
  const roles = Object.values(userData?.groups || {});
  const isJoinerOnly = !roles.some(r => ['user', 'admin', 'superadmin'].includes(r));
  if (!isOwner && isJoinerOnly && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }

  return <>{children}</>;
};