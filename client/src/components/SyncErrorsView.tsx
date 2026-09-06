import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter,
  Users,
  Building,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { syncApi, SyncErrorInfo } from '../services/api.js';

export const SyncErrorsView: React.FC = () => {
  const [errors, setErrors] = useState<SyncErrorInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [actionFeedback, setActionFeedback] = useState<{
    studentId?: string;
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const fetchErrors = async () => {
    try {
      setLoading(true);
      const res = await syncApi.getSyncErrors();
      setErrors(res.errors || []);
    } catch (err: any) {
      console.error('Failed to load sync errors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, []);

  const handleRetryStudent = async (studentId: string, studentName: string) => {
    setRetryingId(studentId);
    setActionFeedback(null);
    try {
      const res = await syncApi.retryFailedStudent(studentId);
      setActionFeedback({
        studentId,
        type: 'success',
        message: `Successfully resolved and synced LeetCode metrics for ${studentName}!`,
      });
      // Refresh errors list
      await fetchErrors();
    } catch (err: any) {
      setActionFeedback({
        studentId,
        type: 'error',
        message: err.response?.data?.error || `Retry failed for ${studentName}. Verify the LeetCode username.`,
      });
      // Re-fetch to update attempt counts
      await fetchErrors();
    } finally {
      setRetryingId(null);
    }
  };

  const handleRetryAll = async () => {
    if (errors.length === 0) return;
    setRetryingAll(true);
    setActionFeedback(null);
    try {
      const res = await syncApi.retryAllFailedStudents();
      setActionFeedback({
        type: res.successful > 0 ? 'success' : 'info',
        message: res.message || `Retried ${res.totalAttempted} records: ${res.successful} resolved, ${res.failed} still failing.`,
      });
      await fetchErrors();
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Failed to retry sync errors.',
      });
    } finally {
      setRetryingAll(false);
    }
  };

  // Unique departments for filter
  const departments = Array.from(new Set(errors.map((e) => e.department).filter(Boolean))) as string[];

  // Filtered errors
  const filteredErrors = errors.filter((err) => {
    const matchesSearch =
      !searchTerm ||
      err.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      err.registerNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      err.leetcodeUsername.toLowerCase().includes(searchTerm.toLowerCase()) ||
      err.errorMessage.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDept = selectedDept === 'ALL' || err.department === selectedDept;

    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6" id="sync-errors-container">
      {/* Header Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <AlertTriangle size={18} />
              </span>
              <h3 className="text-lg font-bold text-slate-100">LeetCode Sync Exceptions & Parsing Errors</h3>
            </div>
            <p className="text-sm text-slate-400">
              Profiles that failed schema parsing or encountered 404/network errors during automated sync cycles.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="refresh-sync-errors-btn"
              onClick={fetchErrors}
              disabled={loading}
              className="btn-secondary px-3 py-2 text-xs font-semibold flex items-center gap-1.5"
              title="Reload sync errors list"
            >
              <RotateCcw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh List</span>
            </button>

            {errors.length > 0 && (
              <button
                id="retry-all-sync-errors-btn"
                onClick={handleRetryAll}
                disabled={retryingAll || loading}
                className="btn-primary px-4 py-2 text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                title="Immediately retry all failed profiles concurrently"
              >
                <RefreshCw size={13} className={retryingAll ? 'animate-spin' : ''} />
                <span>{retryingAll ? 'Retrying All...' : `Retry All (${errors.length})`}</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Feedback Notification */}
        {actionFeedback && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs font-medium flex items-center gap-2 border ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : actionFeedback.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
            }`}
          >
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0" />
            ) : (
              <AlertCircle size={16} className="shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Failed Profiles</span>
            <span className="p-1.5 rounded-lg bg-red-500/10 text-red-400">
              <AlertTriangle size={15} />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-100">{errors.length}</div>
          <div className="mt-1 text-xs text-slate-500">Unresolved parsing errors</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Affected Depts</span>
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Building size={15} />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-100">{departments.length}</div>
          <div className="mt-1 text-xs text-slate-500">Departments with errors</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sync Health</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Sparkles size={15} />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">
            {errors.length === 0 ? '100% Healthy' : 'Action Required'}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {errors.length === 0 ? 'All student profiles parsed' : 'Retry available for each record'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by student name, reg no, or LeetCode handle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/60 border border-slate-700/60 rounded-lg text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {departments.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-500" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Errors Table / List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-900/40 rounded-xl border border-slate-800 text-slate-400">
          <RefreshCw size={24} className="animate-spin mb-3 text-indigo-400" />
          <p className="text-sm">Scanning sync logs for profile parsing errors...</p>
        </div>
      ) : errors.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-900/40 rounded-xl border border-slate-800 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
            <CheckCircle2 size={24} />
          </div>
          <h4 className="text-base font-bold text-slate-200 mb-1">Zero LeetCode Sync Errors</h4>
          <p className="text-xs text-slate-400 max-w-md">
            All registered student profiles are currently parsing successfully without errors. Any automated sync exceptions will appear here with instant retry actions.
          </p>
        </div>
      ) : filteredErrors.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
          No failed profiles match your current search and filter criteria.
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">LeetCode Profile</th>
                  <th className="py-3.5 px-4">Batch / Section</th>
                  <th className="py-3.5 px-4">Error Diagnostics</th>
                  <th className="py-3.5 px-4">Failed At</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredErrors.map((err) => {
                  const isRetrying = retryingId === err.studentId || retryingAll;
                  const failedDate = new Date(err.failedAt);
                  const is404 = err.errorMessage.includes('404') || err.errorMessage.toLowerCase().includes('not found');

                  return (
                    <tr
                      key={err.studentId}
                      className="hover:bg-slate-800/30 transition-colors"
                      id={`sync-error-row-${err.studentId}`}
                    >
                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-100">{err.studentName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{err.registerNumber}</div>
                      </td>

                      {/* LeetCode Username */}
                      <td className="py-3.5 px-4">
                        <a
                          href={`https://leetcode.com/u/${err.leetcodeUsername}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 font-mono text-indigo-400 hover:text-indigo-300 font-medium"
                          title="Open LeetCode profile in new tab"
                        >
                          <span>@{err.leetcodeUsername}</span>
                          <ExternalLink size={12} />
                        </a>
                      </td>

                      {/* Batch / Section */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-300">{err.batchName || 'General Batch'}</div>
                        <div className="text-[11px] text-slate-500">
                          {err.department} {err.sectionName ? `• Sec ${err.sectionName}` : ''}
                        </div>
                      </td>

                      {/* Error Diagnostics */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-start gap-1.5">
                          <span
                            className={`mt-0.5 shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              is404
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}
                          >
                            {is404 ? '404 NOT FOUND' : 'PARSE ERROR'}
                          </span>
                          <span className="text-slate-300 text-[11px] line-clamp-2" title={err.errorMessage}>
                            {err.errorMessage}
                          </span>
                        </div>
                        {err.retryAttempts > 0 && (
                          <div className="text-[10px] text-slate-500 mt-1">
                            Retried {err.retryAttempts} time{err.retryAttempts > 1 ? 's' : ''}
                          </div>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        <div className="flex items-center gap-1">
                          <Clock size={11} className="text-slate-500" />
                          <span>{failedDate.toLocaleTimeString()}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">{failedDate.toLocaleDateString()}</div>
                      </td>

                      {/* Retry Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          id={`retry-btn-${err.studentId}`}
                          onClick={() => handleRetryStudent(err.studentId, err.studentName)}
                          disabled={isRetrying}
                          className="btn-secondary px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 border-indigo-500/30 hover:border-indigo-500/60"
                          title="Immediately retry fetching and parsing this LeetCode profile"
                        >
                          <RefreshCw size={12} className={isRetrying ? 'animate-spin' : ''} />
                          <span>{isRetrying ? 'Retrying...' : 'Retry'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
