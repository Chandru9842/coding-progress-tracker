import React, { useState, useEffect } from 'react';
import { RefreshCw, Activity, CheckCircle2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { syncApi, ActiveSyncStatus } from '../services/api.js';

export const GlobalSyncIndicator: React.FC = () => {
  const [activeStatus, setActiveStatus] = useState<ActiveSyncStatus>({
    isSyncing: false,
    activeCount: 0,
    activeTasks: [],
  });
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const navigate = useNavigate();

  // Poll active sync status every 6 seconds
  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      try {
        const data = await syncApi.getActiveStatus();
        if (isMounted) {
          setActiveStatus((prev) => {
            if (prev.isSyncing && !data.isSyncing) {
              setLastSyncTime(new Date());
            }
            return data;
          });
        }
      } catch (err) {
        // Silently fail if unauthenticated or network drop
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 6000);

    // Also listen to immediate window events triggered by manual actions
    const handleSyncEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ isSyncing: boolean; task?: string }>;
      const { isSyncing, task } = customEvent.detail || {};

      setActiveStatus((prev) => {
        if (isSyncing) {
          const updatedTasks = task && !prev.activeTasks.includes(task)
            ? [...prev.activeTasks, task]
            : prev.activeTasks;
          return {
            isSyncing: true,
            activeCount: Math.max(1, prev.activeCount + 1),
            activeTasks: updatedTasks,
          };
        } else {
          const updatedTasks = task
            ? prev.activeTasks.filter((t) => t !== task)
            : [];
          const newCount = Math.max(0, prev.activeCount - 1);
          if (newCount === 0) {
            setLastSyncTime(new Date());
          }
          return {
            isSyncing: newCount > 0,
            activeCount: newCount,
            activeTasks: updatedTasks,
          };
        }
      });
    };

    window.addEventListener('app-sync-state', handleSyncEvent);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('app-sync-state', handleSyncEvent);
    };
  }, []);

  const isSyncing = activeStatus.isSyncing || activeStatus.activeCount > 0;

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        type="button"
        onClick={() => navigate('/diagnostics')}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 cursor-pointer ${
          isSyncing
            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
            : 'bg-slate-800/40 border-slate-700/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800/80'
        }`}
        title="Click to view Diagnostic Sync Dashboard"
      >
        {isSyncing ? (
          <>
            {/* Pulsing indicator animation */}
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <RefreshCw size={13} className="animate-spin text-emerald-400" />
            <span className="font-semibold text-emerald-300 whitespace-nowrap">
              {activeStatus.activeTasks.length > 0
                ? activeStatus.activeTasks[0]
                : 'Background Syncing...'}
            </span>
            {activeStatus.activeCount > 1 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300">
                +{activeStatus.activeCount - 1}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="relative flex h-2 w-2">
              <span className="inline-flex rounded-full h-2 w-2 bg-emerald-500/70"></span>
            </span>
            <Activity size={12} className="text-slate-400" />
            <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
              Sync Active
            </span>
          </>
        )}
      </button>

      {/* Popover Tooltip for quick detail */}
      {showTooltip && (
        <div
          className="absolute right-0 top-full mt-2 w-64 p-3 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-md z-50 text-xs text-slate-200"
          style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 font-semibold text-slate-100">
            <div className="flex items-center gap-1.5">
              <Activity size={14} className={isSyncing ? 'text-emerald-400' : 'text-slate-400'} />
              <span>Sync Engine Status</span>
            </div>
            <span
              className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                isSyncing ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isSyncing ? 'FETCHING' : 'IDLE'}
            </span>
          </div>

          {isSyncing ? (
            <div className="space-y-1.5 mb-2">
              <p className="text-[11px] text-slate-400">Active synchronizations:</p>
              {activeStatus.activeTasks.length > 0 ? (
                <ul className="space-y-1">
                  {activeStatus.activeTasks.map((task, idx) => (
                    <li key={idx} className="flex items-center gap-1.5 text-emerald-300 font-mono text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="truncate">{task}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-emerald-300 text-[11px]">Processing student metrics...</p>
              )}
            </div>
          ) : (
            <div className="mb-2 text-slate-400 text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 size={13} />
                <span>All automated queues synchronized</span>
              </div>
              {lastSyncTime && (
                <p className="text-[10px] text-slate-500">
                  Last active: {lastSyncTime.toLocaleTimeString()}
                </p>
              )}
            </div>
          )}

          <div
            onClick={() => {
              setShowTooltip(false);
              navigate('/diagnostics');
            }}
            className="pt-2 border-t border-slate-800 flex items-center justify-between text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
          >
            <span>Open Diagnostic Dashboard</span>
            <ChevronRight size={12} />
          </div>
        </div>
      )}
    </div>
  );
};
