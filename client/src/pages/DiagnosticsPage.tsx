import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity,
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Download,
  Trash2,
  ExternalLink,
  Users,
  FolderKanban,
  FileSpreadsheet,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Layout } from '../components/Layout.js';
import { useAuth } from '../context/AuthContext.js';
import {
  syncApi,
  DiagnosticLog,
  DiagnosticSummary,
  BottleneckStudent,
  BottleneckBatch,
} from '../services/api.js';

export const DiagnosticsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [summary, setSummary] = useState<DiagnosticSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [liveUpdates, setLiveUpdates] = useState<boolean>(true);

  // Filters
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [limit, setLimit] = useState<number>(100);

  // Selected Tab in Bottlenecks panel
  const [bottleneckTab, setBottleneckTab] = useState<'students' | 'batches'>('students');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Immediate test action state
  const [testingStudentId, setTestingStudentId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchDiagnostics = useCallback(async (silent = false) => {
    try {
      if (!silent) setRefreshing(true);
      const res = await syncApi.getDiagnosticLogs({
        targetType: targetTypeFilter !== 'ALL' ? targetTypeFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: searchTerm.trim() || undefined,
        limit,
      });

      const rawLogs = res?.logs;
      const extractedLogs: DiagnosticLog[] = Array.isArray(rawLogs)
        ? rawLogs
        : (Array.isArray((rawLogs as any)?.logs) ? (rawLogs as any).logs : []);

      setLogs(extractedLogs);
      setSummary(res?.summary || null);
    } catch (err: any) {
      console.error('Failed to load diagnostic logs:', err);
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetTypeFilter, statusFilter, searchTerm, limit]);

  useEffect(() => {
    fetchDiagnostics();
  }, [fetchDiagnostics]);

  // Live polling interval
  useEffect(() => {
    if (!liveUpdates) return;
    const interval = setInterval(() => {
      fetchDiagnostics(true);
    }, 6000);
    return () => clearInterval(interval);
  }, [liveUpdates, fetchDiagnostics]);

  const handleClearLogs = async () => {
    if (!isAdmin) return;
    if (!window.confirm('Are you sure you want to clear all recorded sync diagnostic logs?')) return;
    try {
      await syncApi.clearDiagnosticLogs();
      setActionNotice('Diagnostic logs cleared successfully');
      fetchDiagnostics();
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to clear logs');
    }
  };

  const handleTestStudentSync = async (studentId: string, studentName: string) => {
    setTestingStudentId(studentId);
    try {
      const startTime = Date.now();
      await syncApi.syncStudent(studentId);
      const latency = Date.now() - startTime;
      setActionNotice(`Retested sync for ${studentName}: Completed in ${(latency / 1000).toFixed(2)}s`);
      await fetchDiagnostics(true);
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err: any) {
      setActionNotice(`Sync test failed for ${studentName}: ${err.response?.data?.error || err.message}`);
      setTimeout(() => setActionNotice(null), 5000);
    } finally {
      setTestingStudentId(null);
    }
  };

  const handleExportLogs = () => {
    if (logs.length === 0) return;
    const csvRows: string[] = [
      ['Timestamp', 'Target Type', 'Target Name', 'Identifier', 'Batch', 'Latency (ms)', 'Status', 'Details'].join(','),
    ];

    logs.forEach((l) => {
      csvRows.push(
        [
          `"${new Date(l.timestamp).toISOString()}"`,
          `"${l.targetType}"`,
          `"${l.targetName.replace(/"/g, '""')}"`,
          `"${(l.identifier || '').replace(/"/g, '""')}"`,
          `"${(l.batchName || '').replace(/"/g, '""')}"`,
          l.latencyMs,
          `"${l.status}"`,
          `"${(l.details || l.errorMessage || '').replace(/"/g, '""')}"`,
        ].join(',')
      );
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sync-diagnostics-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper for latency meter color
  const getLatencyColor = (ms: number) => {
    if (ms < 1500) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (ms < 3500) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-red-400 border-red-500/30 bg-red-500/10';
  };

  const getTargetBadge = (type: DiagnosticLog['targetType']) => {
    switch (type) {
      case 'LEETCODE_STUDENT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">STUDENT</span>;
      case 'LEETCODE_BATCH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">BATCH</span>;
      case 'LEETCODE_SECTION':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">SECTION</span>;
      case 'GOOGLE_SHEET':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">GOOGLE SHEET</span>;
      default:
        return null;
    }
  };

  return (
    <Layout title="Sync Diagnostics & Latency Bottlenecks">
      <div className="space-y-6" id="diagnostic-dashboard-root">
        {/* Top Header Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  <Activity size={20} />
                </span>
                <h2 className="text-xl font-bold text-slate-100">Sync Latency & Diagnostic Telemetry</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Real-time tracking of individual LeetCode and Google Sheets sync latency to isolate bottleneck students, slow batches, and API delays.
              </p>
            </div>

            {/* Top Toolbar Actions */}
            <div className="flex items-center flex-wrap gap-2.5">
              {/* Live Polling Toggle */}
              <button
                type="button"
                onClick={() => setLiveUpdates(!liveUpdates)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  liveUpdates
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }`}
                title="Toggle continuous background log polling"
              >
                <span className={`w-2 h-2 rounded-full ${liveUpdates ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <span>Live Feed: {liveUpdates ? 'ON' : 'PAUSED'}</span>
              </button>

              <button
                type="button"
                onClick={() => fetchDiagnostics()}
                disabled={refreshing}
                className="btn-secondary px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
                title="Manually refresh diagnostic logs"
              >
                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={handleExportLogs}
                disabled={logs.length === 0}
                className="btn-secondary px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
                title="Export diagnostic logs to CSV"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={handleClearLogs}
                  disabled={logs.length === 0}
                  className="btn-secondary px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-500/60"
                  title="Clear all recorded sync logs"
                >
                  <Trash2 size={13} />
                  <span>Clear Logs</span>
                </button>
              )}
            </div>
          </div>

          {/* Action Notification Banner */}
          {actionNotice && (
            <div className="mt-3 p-2.5 rounded-lg text-xs font-medium bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 flex items-center gap-2">
              <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
              <span>{actionNotice}</span>
            </div>
          )}
        </div>

        {/* Latency & Telemetry Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Overall Average Latency */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Average Sync Latency</span>
              <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Clock size={15} />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-100">
              {summary ? `${(summary.avgLatencyMs / 1000).toFixed(2)}s` : '0.00s'}
            </div>
            <div className="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
              <span>{summary?.totalSyncs || 0} total requests measured</span>
            </div>
          </div>

          {/* LeetCode Sync Latency */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">LeetCode Avg Latency</span>
              <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                <Zap size={15} />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-purple-300">
              {summary ? `${(summary.leetcodeAvgLatencyMs / 1000).toFixed(2)}s` : '0.00s'}
            </div>
            <div className="mt-1 text-xs text-slate-500">Official GraphQL + fallback proxies</div>
          </div>

          {/* Google Sheets Sync Latency */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Google Sheets Avg Latency</span>
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <FileSpreadsheet size={15} />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-300">
              {summary ? `${(summary.googleSheetsAvgLatencyMs / 1000).toFixed(2)}s` : '0.00s'}
            </div>
            <div className="mt-1 text-xs text-slate-500">Matrix compute & Apps Script dispatch</div>
          </div>

          {/* Sync Success Rate */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sync Success Rate</span>
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 size={15} />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-400">
              {summary ? `${summary.successRate}%` : '100%'}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {summary?.activeSyncCount && summary.activeSyncCount > 0
                ? `${summary.activeSyncCount} active task(s) currently fetching`
                : 'All background queues idle'}
            </div>
          </div>
        </div>

        {/* Bottleneck Isolation Section */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-800 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-400" />
                <h3 className="text-base font-bold text-slate-100">Bottleneck Pinpointing</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Identifies students or batches with abnormal latency or elevated failure frequencies.
              </p>
            </div>

            {/* Toggle between Student Bottlenecks and Batch Bottlenecks */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setBottleneckTab('students')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  bottleneckTab === 'students'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Top Student Bottlenecks ({summary?.bottleneckStudents?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setBottleneckTab('batches')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  bottleneckTab === 'batches'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Slowest Batches ({summary?.bottleneckBatches?.length || 0})
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="mt-4">
            {bottleneckTab === 'students' ? (
              !summary?.bottleneckStudents || summary.bottleneckStudents.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No student sync bottlenecks detected. Individual sync times are within optimal thresholds.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800/80">
                      <tr>
                        <th className="py-2.5 px-3">Student</th>
                        <th className="py-2.5 px-3">LeetCode Username</th>
                        <th className="py-2.5 px-3">Batch</th>
                        <th className="py-2.5 px-3">Avg Latency</th>
                        <th className="py-2.5 px-3">Peak Latency</th>
                        <th className="py-2.5 px-3">Failures</th>
                        <th className="py-2.5 px-3 text-right">Quick Retest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {summary.bottleneckStudents.map((st, idx) => (
                        <tr key={st.studentId} className="hover:bg-slate-800/20">
                          <td className="py-2.5 px-3 font-semibold text-slate-200 flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] text-slate-400 flex items-center justify-center font-mono">
                              {idx + 1}
                            </span>
                            <span>{st.studentName}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-indigo-400">
                            {st.username ? (
                              <a
                                href={`https://leetcode.com/u/${st.username}`}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:underline inline-flex items-center gap-1"
                              >
                                <span>@{st.username}</span>
                                <ExternalLink size={10} />
                              </a>
                            ) : (
                              <span className="text-slate-500">Unlinked</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">{st.batchName || 'General'}</td>
                          <td className="py-2.5 px-3 font-mono">
                            <span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${getLatencyColor(st.avgLatencyMs)}`}>
                              {(st.avgLatencyMs / 1000).toFixed(2)}s
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">
                            {(st.maxLatencyMs / 1000).toFixed(2)}s
                          </td>
                          <td className="py-2.5 px-3">
                            {st.failCount > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 text-[11px] font-bold">
                                {st.failCount} failed
                              </span>
                            ) : (
                              <span className="text-slate-500">0</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleTestStudentSync(st.studentId, st.studentName)}
                              disabled={testingStudentId === st.studentId}
                              className="btn-secondary px-2.5 py-1 text-[11px] font-semibold inline-flex items-center gap-1"
                              title="Test current sync latency for this student"
                            >
                              <RefreshCw size={11} className={testingStudentId === st.studentId ? 'animate-spin' : ''} />
                              <span>{testingStudentId === st.studentId ? 'Testing...' : 'Test Sync'}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              !summary?.bottleneckBatches || summary.bottleneckBatches.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No batch sync bottlenecks detected. Batch sync cycles are completing smoothly.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800/80">
                      <tr>
                        <th className="py-2.5 px-3">Batch Name</th>
                        <th className="py-2.5 px-3">Department</th>
                        <th className="py-2.5 px-3">Avg Latency</th>
                        <th className="py-2.5 px-3">Max Latency</th>
                        <th className="py-2.5 px-3">Total Syncs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {summary.bottleneckBatches.map((b, idx) => (
                        <tr key={b.batchId} className="hover:bg-slate-800/20">
                          <td className="py-2.5 px-3 font-semibold text-slate-200 flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] text-slate-400 flex items-center justify-center font-mono">
                              {idx + 1}
                            </span>
                            <span>{b.batchName}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">{b.department || 'All Departments'}</td>
                          <td className="py-2.5 px-3 font-mono">
                            <span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${getLatencyColor(b.avgLatencyMs)}`}>
                              {(b.avgLatencyMs / 1000).toFixed(2)}s
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">
                            {(b.maxLatencyMs / 1000).toFixed(2)}s
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">{b.syncCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>

        {/* Diagnostic Event Stream Logs */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-800 gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-100">Live Diagnostic Event Stream</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Timestamped execution log showing individual response times, payload sizes, and fallback sources.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 w-40 sm:w-52"
                />
              </div>

              {/* Target Type Filter */}
              <select
                value={targetTypeFilter}
                onChange={(e) => setTargetTypeFilter(e.target.value)}
                className="bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Types</option>
                <option value="LEETCODE_STUDENT">Students</option>
                <option value="LEETCODE_BATCH">Batches</option>
                <option value="LEETCODE_SECTION">Sections</option>
                <option value="GOOGLE_SHEET">Google Sheets</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="SUCCESS">Success Only</option>
                <option value="WARNING">Warnings</option>
                <option value="FAILED">Failed Only</option>
              </select>

              {/* Limit */}
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                className="bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value={25}>25 logs</option>
                <option value={50}>50 logs</option>
                <option value={100}>100 logs</option>
                <option value={250}>250 logs</option>
              </select>
            </div>
          </div>

          {/* Logs Table */}
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <RefreshCw size={24} className="animate-spin text-indigo-400 mb-2" />
              <p className="text-xs">Loading sync diagnostic logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No diagnostic events match your active filters. Trigger a sync or wait for the next background auto-sync cycle.
            </div>
          ) : (
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/40 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Target</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Identifier</th>
                    <th className="py-2.5 px-3">Latency</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Details / Diagnostics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 font-sans">
                  {logs.map((log) => {
                    const date = new Date(log.timestamp);
                    const isExpanded = expandedLogId === log.id;

                    return (
                      <React.Fragment key={log.id}>
                        <tr
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="hover:bg-slate-800/30 cursor-pointer transition-colors"
                        >
                          {/* Time */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                            {date.toLocaleTimeString()}
                          </td>

                          {/* Target Name */}
                          <td className="py-2.5 px-3 font-semibold text-slate-200">
                            {log.targetName}
                            {log.batchName && (
                              <span className="block text-[10px] font-normal text-slate-500">
                                {log.batchName} {log.sectionName ? `• Sec ${log.sectionName}` : ''}
                              </span>
                            )}
                          </td>

                          {/* Target Type */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {getTargetBadge(log.targetType)}
                          </td>

                          {/* Identifier */}
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 max-w-[150px] truncate">
                            {log.identifier || '-'}
                          </td>

                          {/* Latency with visual meter */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded border text-[11px] font-bold font-mono ${getLatencyColor(log.latencyMs)}`}>
                              {(log.latencyMs / 1000).toFixed(2)}s
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {log.status === 'SUCCESS' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-medium">
                                <CheckCircle2 size={12} />
                                <span>Success</span>
                              </span>
                            ) : log.status === 'WARNING' ? (
                              <span className="inline-flex items-center gap-1 text-amber-400 text-[11px] font-medium">
                                <AlertTriangle size={12} />
                                <span>Warning</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-400 text-[11px] font-medium">
                                <AlertCircle size={12} />
                                <span>Failed</span>
                              </span>
                            )}
                          </td>

                          {/* Details preview */}
                          <td className="py-2.5 px-3 text-slate-300 max-w-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-[11px] text-slate-400">
                                {log.details || log.errorMessage || '-'}
                              </span>
                              {isExpanded ? (
                                <ChevronUp size={12} className="text-slate-500 shrink-0" />
                              ) : (
                                <ChevronDown size={12} className="text-slate-500 shrink-0" />
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded details row */}
                        {isExpanded && (
                          <tr className="bg-slate-950/60 border-t border-b border-indigo-500/20">
                            <td colSpan={7} className="p-3 text-xs text-slate-300">
                              <div className="space-y-1.5 bg-slate-900/80 p-3 rounded-lg border border-slate-800 font-mono text-[11px]">
                                <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800">
                                  <span>Event ID: {log.id}</span>
                                  <span>Recorded at: {date.toISOString()}</span>
                                  <span>Source: {log.source || 'default'}</span>
                                </div>
                                <div className="text-slate-200">
                                  <strong className="text-slate-400">Diagnostic Details: </strong>
                                  {log.details || 'None provided'}
                                </div>
                                {log.errorMessage && (
                                  <div className="text-red-400">
                                    <strong className="text-red-300">Error Payload: </strong>
                                    {log.errorMessage}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};
