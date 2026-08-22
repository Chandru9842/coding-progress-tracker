import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Code2, LogIn, AlertCircle, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { user, loading: authLoading, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Authenticated user visiting /login -> /dashboard
  if (!authLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    try {
      setSubmitting(true);
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const res = (err as { response?: { data?: { error?: string } } }).response;
        setError(res?.data?.error || 'Invalid credentials or server error.');
      } else {
        setError('Failed to connect to authentication service.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-main)',
      padding: '1.5rem',
      background: 'radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.15) 0%, transparent 60%), #0f172a',
    }}>
      <div className="glass-panel login-card-responsive" style={{
        width: '100%',
        maxWidth: '440px',
        boxShadow: 'var(--shadow-card)',
      }}>
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
            boxShadow: 'var(--shadow-glow)',
          }}>
            <Code2 size={30} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.35rem', letterSpacing: '-0.02em' }}>
            Coding Progress Tracker
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Faculty Coding Progress Management
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: '#f87171',
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="faculty@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
            style={{ width: '100%', padding: '0.85rem', fontSize: '1rem' }}
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        <div style={{
          marginTop: '2rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border-subtle)',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
        }}>
          Faculty Authentication Required &bull; No Student Accounts
        </div>
      </div>
    </div>
  );
};
