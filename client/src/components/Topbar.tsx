import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { LogOut, User as UserIcon, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SyncStatus } from './SyncStatus.js';

interface TopbarProps {
  title: string;
  onToggleMobileMenu?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ title, onToggleMobileMenu }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="topbar-header" style={{
      height: '70px',
      backgroundColor: 'var(--bg-topbar)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.25rem',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      {/* Mobile Hamburger & Page Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="mobile-only touch-target"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              padding: '0.4rem',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Open Navigation"
          >
            <Menu size={22} />
          </button>
        )}
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 'clamp(220px, 40vw, 450px)' }}>
          {title}
        </h2>
      </div>

      {/* Sync Status Badge & User Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {user && <SyncStatus variant="badge" />}

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className={`badge-role ${user.role.toLowerCase()}`}>
              {user.role}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid var(--border-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                flexShrink: 0,
              }}>
                <UserIcon size={16} />
              </div>
              <div className="desktop-only" style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user.name}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {user.email}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="btn-secondary"
              style={{
                marginLeft: '0.5rem',
                fontSize: '0.85rem',
                padding: '0.5rem 0.85rem',
              }}
              title="Sign Out"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
