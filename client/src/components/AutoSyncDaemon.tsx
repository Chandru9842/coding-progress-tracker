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
    autoSyncService.fetchServerCandidates(50);

    // Periodic check every 8 minutes
    const interval = setInterval(() => {
      autoSyncService.fetchServerCandidates(50);
    }, 8 * 60 * 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // If not currently auto-syncing or queue is empty, keep daemon completely invisible
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
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(16, 185, 129, 0.35)',
        borderRadius: '9999px',
        padding: '0.4rem 0.85rem',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
        color: '#f8fafc',
        fontSize: '0.78rem',
        fontWeight: 500,
        pointerEvents: 'none',
        transition: 'all 0.3s ease',
      }}
    >
      <RefreshCw
        size={13}
        color="#34d399"
        style={{
          animation: 'spin 2s linear infinite',
        }}
      />
      <span>
        Auto-syncing background ({status.pendingCount} student{status.pendingCount !== 1 ? 's' : ''} queued)
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
