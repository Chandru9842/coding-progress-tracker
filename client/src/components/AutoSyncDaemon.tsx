import React, { useEffect, useState } from 'react';
import { autoSyncService, SyncStatusState } from '../services/autoSyncService.js';
import { RefreshCw } from 'lucide-react';

export const AutoSyncDaemon: React.FC = () => {
  const [status, setStatus] = useState<SyncStatusState>(() => autoSyncService.getStatus());

  useEffect(() => {
    // Subscribe to status updates
    const unsubscribe = autoSyncService.subscribe((newStatus) => {
      setStatus(newStatus);
    });

    // Proactively fetch unsynced candidates from the server upon app load
    autoSyncService.fetchServerCandidates(100);

    // Periodic check every 30 seconds to pick up any new students or changes
    const interval = setInterval(() => {
      autoSyncService.fetchServerCandidates(100);
    }, 30 * 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // If not currently auto-syncing and queue is empty, keep daemon hidden
  if (!status.isAutoSyncing && status.pendingCount === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        zIndex: 999,
        background: 'rgba(15, 23, 42, 0.94)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(16, 185, 129, 0.45)',
        borderRadius: '9999px',
        padding: '0.42rem 0.95rem',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.55rem',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
        color: '#f8fafc',
        fontSize: '0.78rem',
        fontWeight: 600,
        pointerEvents: 'none',
        transition: 'all 0.3s ease',
      }}
    >
      <RefreshCw
        size={13}
        color="#34d399"
        style={{
          animation: 'spin 1.5s linear infinite',
        }}
      />
      <span>
        {status.lastSyncedName
          ? `⚡ Auto-syncing: ${status.lastSyncedName} (${status.pendingCount} queued)`
          : `⚡ Auto-syncing background (${status.pendingCount} queued)`}
      </span>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
