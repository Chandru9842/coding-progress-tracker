import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-main)',
      padding: '1.5rem',
      background: 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.1) 0%, transparent 60%), #0f172a',
    }}>
      <div className="glass-panel" style={{
        maxWidth: '460px',
        width: '100%',
        padding: '3rem 2rem',
        textAlign: 'center',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          color: '#f87171',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
        }}>
          <FileQuestion size={36} />
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          404 - Page Not Found
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem' }}>
          The page or resource you are looking for does not exist or has been moved.
        </p>

        <button
          className="btn-primary"
          onClick={() => navigate('/dashboard')}
          style={{ width: '100%', padding: '0.8rem' }}
        >
          <ArrowLeft size={18} />
          <span>Return to Dashboard</span>
        </button>
      </div>
    </div>
  );
};
