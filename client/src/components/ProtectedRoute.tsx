import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#0f172a',
        color: '#94a3b8'
      }}>
        <Loader2 className="animate-spin" size={32} style={{ color: '#6366f1' }} />
        <span style={{ marginLeft: '12px', fontSize: '1rem', fontWeight: 500 }}>
          Verifying session...
        </span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
