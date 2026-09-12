import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout.js';
import { useAuth } from '../context/AuthContext.js';
import { studentApi, syncApi, Student, DailySnapshot, extractErrorMessage } from '../services/api.js';
import { ArrowLeft, User, ShieldAlert, Code2, GraduationCap, Layers, Loader2, Activity, RefreshCw, CheckCircle2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { SyncStatus } from '../components/SyncStatus.js';

export const StudentDetailPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'STAFF';

  const [student, setStudent] = useState<Student | null>(null);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [backgroundSyncing, setBackgroundSyncing] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 10;

  const ensureContinuousTimeline = (rawSnaps: DailySnapshot[]): DailySnapshot[] => {
    if (!rawSnaps || rawSnaps.length === 0) return [];
    const sorted = [...rawSnaps].sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime());
    const toDateStr = (d: any) => {
      if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) return d.trim();
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? String(d) : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(parsed);
    };
    const minDateStr = toDateStr(sorted[0].snapshot_date);
    const todayIST = toDateStr(new Date());
    const lastDateStr = toDateStr(sorted[sorted.length - 1].snapshot_date);
    const maxDateStr = lastDateStr > todayIST ? lastDateStr : todayIST;

    const mapByDate = new Map<string, DailySnapshot>();
    sorted.forEach((s) => mapByDate.set(toDateStr(s.snapshot_date), s));

    const filled: DailySnapshot[] = [];
    const curr = new Date(`${minDateStr}T00:00:00.000Z`);
    const end = new Date(`${maxDateStr}T00:00:00.000Z`);
    let lastKnown = sorted[0];

    while (curr <= end) {
      const dStr = toDateStr(curr);
      if (mapByDate.has(dStr)) {
        lastKnown = mapByDate.get(dStr)!;
      }
      filled.push({
        ...lastKnown,
        id: lastKnown.id ? `${lastKnown.id}_${dStr}` : `snap_${dStr}`,
        snapshot_date: dStr,
      });
      curr.setUTCDate(curr.getUTCDate() + 1);
    }
    return filled.sort((a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime());
  };

  const fetchDetailAndSnapshots = async () => {
    if (!studentId) return;
    try {
      setLoading(true);
      setError(null);
      const [data, snapData] = await Promise.all([
        studentApi.getStudentById(studentId),
        syncApi.getSnapshots(studentId),
      ]);
      setStudent(data);
      setSnapshots(ensureContinuousTimeline(snapData || []));
      setLoading(false);

      const formatIST = (d: any) => {
        if (!d) return '';
        if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) return d.trim();
        const obj = typeof d === 'string' ? new Date(d) : d;
        return isNaN(obj.getTime()) ? String(d) : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(obj);
      };

      // Check if student has a LeetCode username and needs an auto-sync in background:
      // (1) Has 0 snapshots
      // (2) Or latest snapshot is not from today (YYYY-MM-DD IST)
      const latestSnap = snapData && snapData.length > 0 ? snapData[0] : null;
      const todayIST = formatIST(new Date());
      const latestDateStr = latestSnap ? formatIST(latestSnap.snapshot_date) : '';
      const needsDailySync = data?.leetcode_username && (!latestSnap || latestDateStr !== todayIST);

      if (needsDailySync) {
        setBackgroundSyncing(true);
        try {
          console.log(`[Auto-Snapshot] Asynchronously updating live LeetCode stats for ${data.name} (@${data.leetcode_username})...`);
          await syncApi.syncStudent(studentId);
          const [refreshedData, refreshedSnaps] = await Promise.all([
            studentApi.getStudentById(studentId),
            syncApi.getSnapshots(studentId),
          ]);
          setStudent(refreshedData);
          setSnapshots(ensureContinuousTimeline(refreshedSnaps || []));
          window.dispatchEvent(new CustomEvent('student-synced'));
          window.dispatchEvent(new CustomEvent('sheets-synced'));
        } catch (autoErr: any) {
          console.warn('[Auto-Snapshot] Background sync note:', autoErr?.message || autoErr);
        } finally {
          setBackgroundSyncing(false);
        }
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('403 Forbidden: You are not authorized to view this student\'s profile.');
      } else {
        setError(extractErrorMessage(err, 'Failed to load student details.'));
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetailAndSnapshots();
  }, [studentId]);

  const handleSyncNow = async () => {
    if (!studentId || !student?.leetcode_username) return;

    try {
      setSyncing(true);
      setSyncMessage(null);
      await syncApi.syncStudent(studentId);
      setSyncMessage(`Successfully synchronized LeetCode data and updated linked Google Sheets for @${student.leetcode_username}`);

      // Refresh student and snapshots
      const [data, snapData] = await Promise.all([
        studentApi.getStudentById(studentId),
        syncApi.getSnapshots(studentId),
      ]);
      setStudent(data);
      setSnapshots(ensureContinuousTimeline(snapData || []));
      window.dispatchEvent(new CustomEvent('student-synced'));
      window.dispatchEvent(new CustomEvent('sheets-synced'));
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Failed to sync LeetCode data'));
    } finally {
      setSyncing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!studentId) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      await studentApi.deleteStudent(studentId);
      navigate('/students');
    } catch (err: any) {
      setDeleteError(extractErrorMessage(err, 'Failed to delete student'));
    } finally {
      setDeleting(false);
    }
  };

  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | 'last_7' | 'custom'>('all');
  const [customFromDate, setCustomFromDate] = useState<string>('');
  const [customToDate, setCustomToDate] = useState<string>('');

  const formatIST = (d: any) => {
    if (!d) return '';
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) return d.trim();
    const obj = typeof d === 'string' ? new Date(d) : d;
    return isNaN(obj.getTime()) ? String(d) : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(obj);
  };

  const getRelativeIST = (offsetDays: number = 0) => {
    const now = new Date();
    const d = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
  };

  // Determine active start and end date based on datePreset
  let filterStart = '';
  let filterEnd = '';
  if (datePreset === 'today') {
    filterStart = getRelativeIST(0);
    filterEnd = getRelativeIST(0);
  } else if (datePreset === 'yesterday') {
    filterStart = getRelativeIST(-1);
    filterEnd = getRelativeIST(-1);
  } else if (datePreset === 'last_7') {
    filterStart = getRelativeIST(-7);
    filterEnd = getRelativeIST(0);
  } else if (datePreset === 'custom') {
    filterStart = customFromDate;
    filterEnd = customToDate;
  }

  const isPeriod = Boolean(filterStart || filterEnd);
  // Sort snapshots chronological (oldest to newest)
  const sortedAsc = [...snapshots].sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime());
  const latestSnapshot = sortedAsc.length > 0 ? sortedAsc[sortedAsc.length - 1] : null;

  let displayEasy = latestSnapshot ? latestSnapshot.easy_solved + Math.max(0, latestSnapshot.total_solved - (latestSnapshot.easy_solved + latestSnapshot.medium_solved + latestSnapshot.hard_solved)) : 0;
  let displayMedium = latestSnapshot ? latestSnapshot.medium_solved : 0;
  let displayHard = latestSnapshot ? latestSnapshot.hard_solved : 0;
  let displayTotal = latestSnapshot ? latestSnapshot.total_solved : 0;
  let periodDeltaTotal = 0;

  if (isPeriod && sortedAsc.length > 0) {
    const periodSnaps = sortedAsc.filter((s) => {
      const dStr = formatIST(s.snapshot_date);
      if (filterStart && dStr < filterStart) return false;
      if (filterEnd && dStr > filterEnd) return false;
      return true;
    });

    const priorBaseline = filterStart
      ? [...sortedAsc].reverse().find((s) => formatIST(s.snapshot_date) < filterStart)
      : null;

    if (priorBaseline) {
      const endSnap = periodSnaps.length > 0 ? periodSnaps[periodSnaps.length - 1] : null;
      if (endSnap) {
        displayEasy = Math.max(0, (endSnap.easy_solved || 0) - (priorBaseline.easy_solved || 0));
        displayMedium = Math.max(0, (endSnap.medium_solved || 0) - (priorBaseline.medium_solved || 0));
        displayHard = Math.max(0, (endSnap.hard_solved || 0) - (priorBaseline.hard_solved || 0));
        periodDeltaTotal = Math.max(0, (endSnap.total_solved || 0) - (priorBaseline.total_solved || 0));
        displayTotal = periodDeltaTotal;

        const sumDiff = displayEasy + displayMedium + displayHard;
        if (displayTotal > sumDiff) {
          displayEasy += (displayTotal - sumDiff);
        }
      } else {
        displayEasy = 0;
        displayMedium = 0;
        displayHard = 0;
        displayTotal = 0;
      }
    } else if (periodSnaps.length >= 2) {
      const firstSnap = periodSnaps[0];
      const lastSnap = periodSnaps[periodSnaps.length - 1];
      displayEasy = Math.max(0, (lastSnap.easy_solved || 0) - (firstSnap.easy_solved || 0));
      displayMedium = Math.max(0, (lastSnap.medium_solved || 0) - (firstSnap.medium_solved || 0));
      displayHard = Math.max(0, (lastSnap.hard_solved || 0) - (firstSnap.hard_solved || 0));
      periodDeltaTotal = Math.max(0, (lastSnap.total_solved || 0) - (firstSnap.total_solved || 0));
      displayTotal = periodDeltaTotal;

      const sumDiff = displayEasy + displayMedium + displayHard;
      if (displayTotal > sumDiff) {
        displayEasy += (displayTotal - sumDiff);
      }
    } else {
      displayEasy = 0;
      displayMedium = 0;
      displayHard = 0;
      displayTotal = 0;
    }
  }

  // If a period is active, optionally filter the snapshot history list or show all
  const displayedSnapshots = isPeriod
    ? snapshots.filter((s) => {
        const dStr = formatIST(s.snapshot_date);
        if (filterStart && dStr < filterStart) return false;
        if (filterEnd && dStr > filterEnd) return false;
        return true;
      })
    : snapshots;

  return (
    <Layout title="Student Profile">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '850px' }}>
        <button
          className="btn-secondary"
          onClick={() => navigate('/students')}
          style={{ width: 'fit-content', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Students Directory</span>
        </button>

        {loading && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Loader2 className="animate-spin" size={28} style={{ margin: '0 auto 0.75rem auto', color: 'var(--primary)' }} />
            <span>Loading student profile...</span>
          </div>
        )}

        {error && (
          <div className="glass-panel" style={{
            padding: '2.5rem', textAlign: 'center', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171'
          }}>
            <ShieldAlert size={42} style={{ margin: '0 auto 1rem auto' }} />
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Unable to Load Student Profile</h3>
            <p style={{ fontSize: '0.9rem', color: '#fca5a5', marginBottom: '1.5rem' }}>
              {typeof error === 'string' ? error : (error as any)?.message || String(error)}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                className="btn-primary"
                onClick={() => fetchDetailAndSnapshots()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
              >
                <RefreshCw size={14} />
                <span>Retry Loading</span>
              </button>
              <button
                className="btn-secondary"
                onClick={() => navigate('/students')}
                style={{ fontSize: '0.85rem' }}
              >
                Back to Students Directory
              </button>
            </div>
          </div>
        )}

        {!loading && student && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Background Syncing Notice */}
            {backgroundSyncing && (
              <div style={{
                padding: '0.6rem 1rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: '#818cf8',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                fontSize: '0.85rem',
              }}>
                <Loader2 className="animate-spin" size={16} />
                <span>Synchronizing today's live LeetCode stats for @{student.leetcode_username} in the background...</span>
              </div>
            )}

            {/* Metadata Header Card */}
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '54px', height: '54px', borderRadius: '50%',
                    backgroundColor: 'rgba(99, 102, 241, 0.2)', border: '1px solid var(--border-glow)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)',
                  }}>
                    <User size={28} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{student.name}</h3>
                    <span style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 600 }}>
                      Reg No: {student.register_number}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <SyncStatus variant="badge" />

                  {student.leetcode_username && (
                    <button
                      className="btn-primary"
                      onClick={handleSyncNow}
                      disabled={syncing || deleting}
                      style={{ fontSize: '0.85rem' }}
                    >
                      {syncing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                      <span>{syncing ? 'Syncing...' : 'Sync LeetCode Data'}</span>
                    </button>
                  )}

                  {canManage && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => { setDeleteError(null); setShowDeleteModal(true); }}
                      disabled={syncing || deleting}
                      style={{
                        fontSize: '0.85rem',
                        color: '#f87171',
                        borderColor: 'rgba(239, 68, 68, 0.3)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <Trash2 size={16} />
                      <span>Delete Student</span>
                    </button>
                  )}
                </div>
              </div>

              {syncMessage && (
                <div style={{
                  padding: '0.75rem 1rem', marginBottom: '1rem', backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  color: '#4ade80', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem'
                }}>
                  <CheckCircle2 size={16} />
                  <span>{typeof syncMessage === 'string' ? syncMessage : String(syncMessage || '')}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <GraduationCap size={20} style={{ color: 'var(--text-muted)' }} />
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Department</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{student.department}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Layers size={20} style={{ color: 'var(--text-muted)' }} />
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Academic Year & Section</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {student.batch?.batch_name} - Section {student.section?.name}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Layers size={20} style={{ color: 'var(--primary)' }} />
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Allocation Batch</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--primary)' }}>
                      {student.allocation_batch?.name || student.sub_batch || 'Batch 1'}
                    </span>
                  </div>
                </div>

                {student.current_year && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <GraduationCap size={20} style={{ color: 'var(--text-muted)' }} />
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Current Year</span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{student.current_year}</span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <User size={20} style={{ color: 'var(--accent-staff)' }} />
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Mentor (Staff)</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent-staff)' }}>
                      {student.mentor?.name || 'Unassigned'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Code2 size={20} style={{ color: 'var(--text-muted)' }} />
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>LeetCode Handle</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {student.leetcode_username ? `@${student.leetcode_username}` : 'Not linked'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Date Range Mode Selector for Student Profile */}
            {latestSnapshot && (
              <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    📅 Date Range Mode
                  </label>
                  <span style={{ fontSize: '0.78rem', color: isPeriod ? '#34d399' : 'var(--text-muted)', fontWeight: 600 }}>
                    {datePreset === 'today'
                      ? `⚡ Showing Progress Solved Today (${filterStart})`
                      : datePreset === 'yesterday'
                      ? `⚡ Showing Progress Solved Yesterday (${filterStart})`
                      : datePreset === 'last_7'
                      ? `⚡ Showing Progress in Last 7 Days (${filterStart} to ${filterEnd})`
                      : datePreset === 'custom' && (filterStart || filterEnd)
                      ? `⚡ Showing Custom Range Progress (${filterStart || 'Start'} to ${filterEnd || 'Today'})`
                      : '🏆 Showing All-Time Cumulative Totals'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {[
                    { key: 'all', label: 'All Time (Cumulative)' },
                    { key: 'today', label: 'Today (New Solved)' },
                    { key: 'yesterday', label: 'Yesterday (New Solved)' },
                    { key: 'last_7', label: 'Last 7 Days (Progress)' },
                    { key: 'custom', label: 'Custom Range' },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      className={datePreset === p.key ? 'btn-primary' : 'btn-secondary'}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }}
                      onClick={() => {
                        setDatePreset(p.key as any);
                        if (p.key === 'custom' && !customFromDate && !customToDate) {
                          const today = getRelativeIST(0);
                          setCustomFromDate(today);
                          setCustomToDate(today);
                        }
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {datePreset === 'custom' && (
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>From Date</label>
                      <input
                        type="date"
                        className="form-input"
                        value={customFromDate}
                        onChange={(e) => setCustomFromDate(e.target.value)}
                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>To Date</label>
                      <input
                        type="date"
                        className="form-input"
                        value={customToDate}
                        onChange={(e) => setCustomToDate(e.target.value)}
                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LeetCode Solved Cards */}
            {latestSnapshot ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 700, textTransform: 'uppercase' }}>
                    {isPeriod ? 'Period Easy' : 'Easy'}
                  </span>
                  <h4 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.25rem', color: '#4ade80' }}>
                    {isPeriod && displayEasy > 0 ? `+${displayEasy}` : displayEasy}
                  </h4>
                  {isPeriod && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                      Overall: {latestSnapshot.easy_solved}
                    </span>
                  )}
                </div>

                <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#facc15', fontWeight: 700, textTransform: 'uppercase' }}>
                    {isPeriod ? 'Period Med' : 'Medium'}
                  </span>
                  <h4 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.25rem', color: '#facc15' }}>
                    {isPeriod && displayMedium > 0 ? `+${displayMedium}` : displayMedium}
                  </h4>
                  {isPeriod && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                      Overall: {latestSnapshot.medium_solved}
                    </span>
                  )}
                </div>

                <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase' }}>
                    {isPeriod ? 'Period Hard' : 'Hard'}
                  </span>
                  <h4 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.25rem', color: '#f87171' }}>
                    {isPeriod && displayHard > 0 ? `+${displayHard}` : displayHard}
                  </h4>
                  {isPeriod && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                      Overall: {latestSnapshot.hard_solved}
                    </span>
                  )}
                </div>

                <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center', backgroundColor: isPeriod && displayTotal > 0 ? 'rgba(52, 211, 153, 0.15)' : 'rgba(99, 102, 241, 0.15)' }}>
                  <span style={{ fontSize: '0.75rem', color: isPeriod && displayTotal > 0 ? '#34d399' : 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {isPeriod ? (datePreset === 'today' ? "Today's Solved" : datePreset === 'yesterday' ? "Yesterday's Solved" : "Period Solved") : 'Total Solved'}
                  </span>
                  <h4 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.25rem', color: isPeriod && displayTotal > 0 ? '#34d399' : 'var(--primary)' }}>
                    {isPeriod && displayTotal > 0 ? `+${displayTotal}` : displayTotal}
                  </h4>
                  {isPeriod && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                      Overall Total: {latestSnapshot.total_solved}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Activity size={32} style={{ margin: '0 auto 0.75rem auto', color: 'var(--primary)' }} />
                <p>LeetCode data has not been synchronized yet.</p>
                {student.leetcode_username && (
                  <button className="btn-primary" onClick={handleSyncNow} disabled={syncing} style={{ marginTop: '1rem' }}>
                    Sync First Snapshot
                  </button>
                )}
              </div>
            )}

            {/* Daily Snapshots History Table */}
            {snapshots.length > 0 && (() => {
              const totalPages = Math.max(1, Math.ceil(snapshots.length / PAGE_SIZE));
              const validPage = Math.min(Math.max(1, currentPage), totalPages);
              const startIndex = (validPage - 1) * PAGE_SIZE;
              const endIndex = Math.min(startIndex + PAGE_SIZE, snapshots.length);
              const currentSnapshots = snapshots.slice(startIndex, endIndex);

              const getPageNumbers = () => {
                const pages: number[] = [];
                if (totalPages <= 7) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  let start = Math.max(2, validPage - 1);
                  let end = Math.min(totalPages - 1, validPage + 1);
                  if (start > 2) pages.push(-1);
                  for (let i = start; i <= end; i++) pages.push(i);
                  if (end < totalPages - 1) pages.push(-2);
                  pages.push(totalPages);
                }
                return pages;
              };

              return (
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Activity size={20} style={{ color: 'var(--primary)' }} />
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Daily Snapshot History</h4>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Showing {startIndex + 1}–{endIndex} of {snapshots.length} daily snapshots
                    </span>
                  </div>
                  <div className="table-responsive-container">
                    <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.75rem' }}>Date</th>
                          <th style={{ padding: '0.75rem' }}>Today's Solved</th>
                          <th style={{ padding: '0.75rem' }}>Today's Breakdown</th>
                          <th style={{ padding: '0.75rem' }}>Cumulative Easy</th>
                          <th style={{ padding: '0.75rem' }}>Cumulative Medium</th>
                          <th style={{ padding: '0.75rem' }}>Cumulative Hard</th>
                          <th style={{ padding: '0.75rem' }}>Total Solved</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentSnapshots.map((snap, pageIdx) => {
                          const globalIdx = startIndex + pageIdx;
                          const prevSnap = snapshots[globalIdx + 1];
                          const dailyTotal = prevSnap ? Math.max(0, snap.total_solved - prevSnap.total_solved) : 0;
                          let dailyEasy = prevSnap ? Math.max(0, snap.easy_solved - prevSnap.easy_solved) : 0;
                          let dailyMedium = prevSnap ? Math.max(0, snap.medium_solved - prevSnap.medium_solved) : 0;
                          let dailyHard = prevSnap ? Math.max(0, snap.hard_solved - prevSnap.hard_solved) : 0;

                          if (dailyTotal > (dailyEasy + dailyMedium + dailyHard)) {
                            dailyEasy += (dailyTotal - (dailyEasy + dailyMedium + dailyHard));
                          }

                          const snapEasy = snap.easy_solved + Math.max(0, snap.total_solved - (snap.easy_solved + snap.medium_solved + snap.hard_solved));

                          return (
                            <tr key={snap.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                                {(() => {
                                  if (typeof snap.snapshot_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(snap.snapshot_date)) {
                                    return snap.snapshot_date;
                                  }
                                  const d = new Date(snap.snapshot_date);
                                  return isNaN(d.getTime())
                                    ? String(snap.snapshot_date)
                                    : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
                                })()}
                              </td>
                              <td style={{ padding: '0.75rem' }}>
                                <span style={{
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  backgroundColor: dailyTotal > 0 ? 'rgba(52, 211, 153, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                                  color: dailyTotal > 0 ? '#34d399' : '#94a3b8',
                                  border: dailyTotal > 0 ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid rgba(148, 163, 184, 0.2)',
                                }}>
                                  {dailyTotal > 0 ? `+${dailyTotal}` : '0'}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                <span style={{ color: '#4ade80', fontWeight: dailyEasy > 0 ? 700 : 400 }}>+{dailyEasy} E</span> &bull;{' '}
                                <span style={{ color: '#facc15', fontWeight: dailyMedium > 0 ? 700 : 400 }}>+{dailyMedium} M</span> &bull;{' '}
                                <span style={{ color: '#f87171', fontWeight: dailyHard > 0 ? 700 : 400 }}>+{dailyHard} H</span>
                              </td>
                              <td style={{ padding: '0.75rem', color: '#4ade80' }}>{snapEasy}</td>
                              <td style={{ padding: '0.75rem', color: '#facc15' }}>{snap.medium_solved}</td>
                              <td style={{ padding: '0.75rem', color: '#f87171' }}>{snap.hard_solved}</td>
                              <td style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>{snap.total_solved}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Google-like Pagination Bar (10 items per page with arrow navigation) */}
                  {totalPages > 1 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '1.25rem',
                      paddingTop: '1rem',
                      borderTop: '1px solid var(--border-subtle)',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Page <strong style={{ color: 'var(--text-primary)' }}>{validPage}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{totalPages}</strong> ({snapshots.length} total entries)
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {/* Previous Arrow Button */}
                        <button
                          type="button"
                          id="btn-prev-snapshots"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={validPage <= 1}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.825rem',
                            fontWeight: 600,
                            borderRadius: 'var(--radius-sm, 6px)',
                            border: '1px solid var(--border-subtle, #334155)',
                            backgroundColor: validPage <= 1 ? 'rgba(30, 41, 59, 0.4)' : 'rgba(30, 41, 59, 0.9)',
                            color: validPage <= 1 ? '#64748b' : '#f8fafc',
                            cursor: validPage <= 1 ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <ChevronLeft size={16} />
                          <span>Previous 10</span>
                        </button>

                        {/* Numbered Page Buttons (Google Pages style) */}
                        {getPageNumbers().map((pageNum, idx) => {
                          if (pageNum < 0) {
                            return (
                              <span key={`ellipsis-${idx}`} style={{ padding: '0.4rem 0.5rem', color: 'var(--text-muted)' }}>
                                ...
                              </span>
                            );
                          }
                          const isActive = pageNum === validPage;
                          return (
                            <button
                              key={`page-${pageNum}`}
                              type="button"
                              id={`btn-page-${pageNum}`}
                              onClick={() => setCurrentPage(pageNum)}
                              style={{
                                minWidth: '34px',
                                height: '34px',
                                padding: '0 0.5rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.825rem',
                                fontWeight: isActive ? 700 : 500,
                                borderRadius: 'var(--radius-sm, 6px)',
                                border: isActive ? '1px solid #6366f1' : '1px solid var(--border-subtle, #334155)',
                                backgroundColor: isActive ? '#6366f1' : 'rgba(30, 41, 59, 0.7)',
                                color: isActive ? '#ffffff' : '#cbd5e1',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {pageNum}
                            </button>
                          );
                        })}

                        {/* Next Arrow Button */}
                        <button
                          type="button"
                          id="btn-next-snapshots"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={validPage >= totalPages}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.825rem',
                            fontWeight: 600,
                            borderRadius: 'var(--radius-sm, 6px)',
                            border: '1px solid var(--border-subtle, #334155)',
                            backgroundColor: validPage >= totalPages ? 'rgba(30, 41, 59, 0.4)' : 'rgba(30, 41, 59, 0.9)',
                            color: validPage >= totalPages ? '#64748b' : '#f8fafc',
                            cursor: validPage >= totalPages ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>Next 10</span>
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* SINGLE DELETE STUDENT CONFIRMATION MODAL */}
            {showDeleteModal && student && (
              <div className="modal-overlay-responsive">
                <div className="glass-panel modal-card-responsive" style={{ maxWidth: '440px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f87171', marginBottom: '1rem' }}>
                    <ShieldAlert size={26} />
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Delete Student Record</h3>
                  </div>

                  {deleteError && (
                    <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                      {deleteError}
                    </div>
                  )}

                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                    Are you sure you want to delete student <strong style={{ color: 'var(--text-primary)' }}>{student.name}</strong> (<span style={{ fontFamily: 'monospace' }}>{student.register_number}</span>)?
                  </p>
                  <p style={{ fontSize: '0.825rem', color: '#f87171', backgroundColor: 'rgba(248, 113, 113, 0.1)', padding: '0.65rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
                    ⚠️ Warning: This will permanently remove this student record and all their associated daily coding snapshots.
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowDeleteModal(false)}
                      disabled={deleting}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDelete}
                      disabled={deleting}
                      style={{
                        padding: '0.6rem 1.25rem',
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 600,
                        cursor: deleting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {deleting ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </Layout>
  );
};
