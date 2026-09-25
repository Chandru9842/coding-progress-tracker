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
        title="AUTHENTICATING FACULTY SESSION"
        subtitle="Verifying cryptographic token signature • Telemetry link online"
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
