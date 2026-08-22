import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  FileSpreadsheet,
  Settings,
  UserCheck,
  Code2,
} from 'lucide-react';

import { X } from 'lucide-react';

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onClose }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const mainNavItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, enabled: true },
    { name: 'My Batches', path: '/batches', icon: FolderKanban, enabled: true },
    { name: 'Students', path: '/students', icon: Users, enabled: true },
    { name: 'Reports & Sync', path: '/reports', icon: FileSpreadsheet, enabled: true },
    { name: 'Settings', path: '/settings', icon: Settings, enabled: true },
  ];

  const adminNavItems = [
    { name: 'Staff Management', path: '/staff-management', icon: UserCheck, enabled: true },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 99,
          }}
          className="mobile-only"
        />
      )}

      <aside className={`sidebar-container ${mobileOpen ? 'mobile-open' : ''}`} style={{
        width: '260px',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem 1rem',
        flexShrink: 0,
      }}>
        {/* Brand Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 0.5rem 1.5rem 0.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            }}>
              <Code2 size={22} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                Coding Progress
              </h1>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Tracker v2.0
              </span>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="mobile-only touch-target"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.5rem',
              }}
              title="Close Menu"
            >
              <X size={24} />
            </button>
          )}
        </div>

      {/* Navigation Groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
        <div>
          <div style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            padding: '0 0.75rem 0.5rem 0.75rem',
          }}>
            Navigation
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {mainNavItems.map((item) => {
              const Icon = item.icon;

              if (!item.enabled) {
                return (
                  <div
                    key={item.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.7rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-muted)',
                      opacity: 0.5,
                      cursor: 'not-allowed',
                      fontSize: '0.9rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Icon size={18} />
                      <span>{item.name}</span>
                    </div>
                  </div>
                );
              }

              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  onClick={() => onClose?.()}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 0.85rem',
                    minHeight: '44px',
                    borderRadius: 'var(--radius-sm)',
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    fontWeight: isActive ? 600 : 500,
                    transition: 'var(--transition-fast)',
                  })}
                >
                  <Icon size={18} style={{ color: 'inherit' }} />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Admin Navigation */}
        {isAdmin && (
          <div>
            <div style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              padding: '0 0.75rem 0.5rem 0.75rem',
            }}>
              Administration
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    onClick={() => onClose?.()}
                    style={({ isActive }) => ({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 0.85rem',
                      minHeight: '44px',
                      borderRadius: 'var(--radius-sm)',
                      color: isActive ? '#ffffff' : 'var(--text-secondary)',
                      backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
                      borderLeft: isActive ? '3px solid var(--accent-admin)' : '3px solid transparent',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                      fontWeight: isActive ? 600 : 500,
                      transition: 'var(--transition-fast)',
                    })}
                  >
                    <Icon size={18} style={{ color: 'inherit' }} />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        )}
      </div>
    </aside>
  </>
);
};
