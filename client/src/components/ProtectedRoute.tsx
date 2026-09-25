import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { InteractiveLoader } from './InteractiveLoader.js';

interface ProtectedRouteProps {
  requiredRole?: 'ADMIN' | 'STAFF';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <InteractiveLoader
        mode="fullscreen"
        title="Verifying Faculty Session..."
        subtitle="Interactive Matrix • Click or drag to ripple or squash bugs while authenticating!"
      />
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
