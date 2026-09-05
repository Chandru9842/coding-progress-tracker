import React, { useState, useEffect, useRef } from 'react';
import { googleSheetsApi, GoogleSheetsSyncStatus } from '../services/api.js';
import { CheckCircle2, AlertCircle, RefreshCw, FileSpreadsheet, ExternalLink, ChevronDown, Clock, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SyncStatusProps {
  variant?: 'badge' | 'card';
  showRefreshButton?: boolean;
  className?: string;
  align?: 'left' | 'right' | 'auto';
  onSyncComplete?: () => void;
}

/**
 * Format timestamp into friendly date and time
 */
function formatSyncTimestamp(isoString?: string | null): { relative: string; full: string } {
  if (!isoString) {
    return { relative: 'Never', full: 'No successful synchronization recorded yet' };
  }

  const syncDate = new Date(isoString);
  if (isNaN(syncDate.getTime())) {
    return { relative: 'Never', full: 'Invalid sync timestamp' };
  }

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - syncDate.getTime()) / 1000);

  let relative = '';
  if (diffSec < 45) {
    relative = 'Just now';
  } else if (diffSec < 3600) {
    const mins = Math.max(1, Math.floor(diffSec / 60));
    relative = `${mins}m ago`;
  } else if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    relative = `${hours}h ago`;
  } else {
    const days = Math.floor(diffSec / 86400);
    relative = `${days}d ago`;
  }

  const full = syncDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return { relative, full };
}

export const SyncStatus: React.FC<SyncStatusProps> = ({
  variant = 'badge',
  showRefreshButton = true,
  className = '',
  align = 'auto',
  onSyncComplete,
}) => {
  const [statusData, setStatusData] = useState<GoogleSheetsSyncStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [popoverAlignLeft, setPopoverAlignLeft] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Smart popover viewport boundary detection
  useEffect(() => {
    if (dropdownOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      if (align === 'left') {
        setPopoverAlignLeft(true);
      } else if (align === 'right') {
        setPopoverAlignLeft(false);
      } else {
        // Auto-detect: if the button is within 300px of the viewport left edge, align left so it opens inward
        setPopoverAlignLeft(rect.left < 300);
      }
    }
  }, [dropdownOpen, align]);

  const fetchStatus = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await googleSheetsApi.getSyncStatus();
      setStatusData(data);
    } catch {
      // Fallback disconnected state
      setStatusData((prev) =>
        prev
          ? { ...prev, connected: false, status: 'DISCONNECTED' }
          : {
              connected: false,
              status: 'DISCONNECTED',
              lastSuccessfulSyncAt: null,
              lastSyncStatus: 'FAILED',
              lastSyncError: 'Unable to reach sync service',
              activeLinksCount: 0,
              totalLinksCount: 0,
              activeSheets: [],
            }
      );
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // 30-second interval real-time polling
    const interval = setInterval(() => {
      fetchStatus(true);
    }, 30000);

    // Listen to custom window sync events for immediate UI reactivity
    const handleGlobalSync = () => fetchStatus(true);
    window.addEventListener('sheets-synced', handleGlobalSync);
    window.addEventListener('student-synced', handleGlobalSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener('sheets-synced', handleGlobalSync);
      window.removeEventListener('student-synced', handleGlobalSync);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [dropdownOpen]);

  const handleManualSync = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setSyncing(true);
      setSyncFeedback(null);
      const res = await googleSheetsApi.syncAllLinks();
      setSyncFeedback(res.message || 'Sheets successfully synchronized!');
      await fetchStatus(true);
      if (onSyncComplete) onSyncComplete();
      window.dispatchEvent(new CustomEvent('sheets-synced'));
    } catch (err: any) {
      setSyncFeedback(err.response?.data?.error || 'Manual sync failed');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const isConnected = Boolean(statusData?.connected);
  const timeInfo = formatSyncTimestamp(statusData?.lastSuccessfulSyncAt);

  // Status visual configurations
  const getBadgeConfig = () => {
    if (loading && !statusData) {
      return {
        label: 'Checking...',
        color: '#94a3b8',
        bg: 'rgba(148, 163, 184, 0.1)',
        border: 'rgba(148, 163, 184, 0.25)',
        dotColor: '#94a3b8',
        pulse: false,
      };
    }
    if (syncing) {
      return {
        label: 'Syncing Sheets...',
        color: '#818cf8',
        bg: 'rgba(99, 102, 241, 0.15)',
        border: 'rgba(99, 102, 241, 0.35)',
        dotColor: '#818cf8',
        pulse: true,
      };
    }
    if (statusData?.status === 'NO_LINKS') {
      return {
        label: 'Disconnected',
        sublabel: 'No Sheets Linked',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.3)',
        dotColor: '#f59e0b',
        pulse: false,
      };
    }
    if (isConnected) {
      return {
        label: 'Connected',
        sublabel: 'Sheets Operational',
        color: '#34d399',
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.35)',
        dotColor: '#10b981',
        pulse: true,
      };
    }
    return {
      label: 'Disconnected',
      sublabel: statusData?.lastSyncError ? 'Sync Error' : 'Unreachable',
      color: '#f87171',
      bg: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.35)',
      dotColor: '#ef4444',
      pulse: false,
    };
  };

  const badge = getBadgeConfig();

  // Variant 1: Compact Badge (Ideal for Topbar and Tables)
  if (variant === 'badge') {
    return (
      <div
        id="sync-status-badge-container"
        ref={dropdownRef}
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
        className={className}
      >
        <button
          id="sync-status-badge-button"
          type="button"
          onClick={() => setDropdownOpen((prev) => !prev)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.35rem 0.65rem',
            backgroundColor: badge.bg,
            border: `1px solid ${badge.border}`,
            borderRadius: '9999px',
            color: badge.color,
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
          title={`Google Sheets Status: ${badge.label} • Last synced: ${timeInfo.full}`}
        >
          {/* Status Indicator Dot */}
          <span style={{ position: 'relative', display: 'flex', height: '8px', width: '8px' }}>
            {badge.pulse && (
              <span
                style={{
                  position: 'absolute',
                  display: 'inline-flex',
                  height: '100%',
                  width: '100%',
                  borderRadius: '50%',
                  backgroundColor: badge.dotColor,
                  opacity: 0.75,
                  animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                }}
              />
            )}
            <span
              style={{
                position: 'relative',
                display: 'inline-flex',
                borderRadius: '50%',
                height: '8px',
                width: '8px',
                backgroundColor: badge.dotColor,
              }}
            />
          </span>

          <span style={{ fontWeight: 700 }}>{badge.label}</span>

          {/* Last sync timestamp display */}
          <span
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              fontWeight: 500,
              paddingLeft: '0.2rem',
              borderLeft: '1px solid var(--border-subtle)',
            }}
          >
            {statusData?.lastSuccessfulSyncAt ? timeInfo.relative : 'No sync'}
          </span>

          <ChevronDown size={13} style={{ opacity: 0.7 }} />
        </button>

        {/* Dropdown Popover */}
        {dropdownOpen && (
          <div
            id="sync-status-popover"
            className="glass-panel"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              ...(popoverAlignLeft ? { left: 0 } : { right: 0 }),
              width: 'min(320px, calc(100vw - 32px))',
              maxWidth: '90vw',
              backgroundColor: 'rgba(15, 23, 42, 0.98)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--border-glow)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              boxShadow: '0 12px 30px -5px rgba(0, 0, 0, 0.6)',
              zIndex: 100,
              fontSize: '0.85rem',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', paddingBottom: '0.65rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet size={18} style={{ color: 'var(--primary)' }} />
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  Google Sheets Sync
                </span>
              </div>
              <span
                style={{
                  padding: '0.15rem 0.5rem',
                  borderRadius: '9999px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  backgroundColor: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.border}`,
                }}
              >
                {badge.label}
              </span>
            </div>

            {/* Sync Feedback Alert */}
            {syncFeedback && (
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: syncFeedback.includes('failed') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: syncFeedback.includes('failed') ? '#f87171' : '#34d399',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  marginBottom: '0.75rem',
                }}
              >
                {syncFeedback}
              </div>
            )}

            {/* Details List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock size={13} /> Last Sync:
                </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right' }} title={timeInfo.full}>
                  {timeInfo.full}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Active Spreadsheets:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {statusData?.activeLinksCount || 0} sheet(s) linked
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Daily Schedule:</span>
                <span style={{ color: '#38bdf8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <ShieldCheck size={13} /> 12:30 AM IST (Daily)
                </span>
              </div>

              {statusData?.lastSyncError && (
                <div style={{ marginTop: '0.25rem', padding: '0.45rem 0.6rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', fontSize: '0.75rem' }}>
                  ⚠️ {statusData.lastSyncError}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleManualSync}
                disabled={syncing}
                style={{
                  flex: 1,
                  padding: '0.45rem',
                  fontSize: '0.78rem',
                  justifyContent: 'center',
                }}
              >
                <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                <span>{syncing ? 'Syncing...' : 'Sync Sheets Now'}</span>
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setDropdownOpen(false);
                  navigate('/reports?tab=sheets');
                }}
                style={{
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.78rem',
                }}
                title="Manage Google Sheets Integration & Webhooks"
              >
                <ExternalLink size={13} />
                <span>Manage</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Variant 2: Card Display (Ideal for Dashboard & Automation Hub)
  return (
    <div
      id="sync-status-card"
      className={`glass-panel ${className}`}
      style={{
        padding: '1.25rem',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              padding: '0.55rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: badge.bg,
              color: badge.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Google Sheets Automation Status
              </h4>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.border}`,
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: badge.dotColor,
                  }}
                />
                {badge.label}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              {isConnected
                ? `${statusData?.activeLinksCount || 0} spreadsheet(s) linked and synchronizing with Zero-Error architecture`
                : statusData?.status === 'NO_LINKS'
                ? 'No Google Sheets currently linked to this system'
                : 'Connection or synchronization issue detected'}
            </p>
          </div>
        </div>

        {showRefreshButton && (
          <button
            type="button"
            className="btn-secondary"
            onClick={handleManualSync}
            disabled={syncing}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.825rem' }}
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Syncing...' : 'Sync All Sheets'}</span>
          </button>
        )}
      </div>

      {syncFeedback && (
        <div
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: syncFeedback.includes('failed') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: syncFeedback.includes('failed') ? '#f87171' : '#34d399',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          {syncFeedback}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.75rem',
          padding: '0.75rem',
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.825rem',
        }}
      >
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.2rem' }}>LAST SUCCESSFUL SYNC</div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{timeInfo.full}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.2rem' }}>AUTOMATED SCHEDULE</div>
          <div style={{ color: '#38bdf8', fontWeight: 600 }}>12:30 AM IST (Every Night)</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.2rem' }}>ACTIVE SPREADSHEETS</div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{statusData?.activeLinksCount || 0} Linked</div>
        </div>
      </div>
    </div>
  );
};
