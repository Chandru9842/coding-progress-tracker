import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout.js';
import { useAuth } from '../context/AuthContext.js';
import { studentApi, syncApi, Student, DailySnapshot, extractErrorMessage } from '../services/api.js';
import { ArrowLeft, User, ShieldAlert, Code2, GraduationCap, Layers, Loader2, Activity, RefreshCw, CheckCircle2, Trash2, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
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

  const [deleting, setDeleting] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [customRowsInput, setCustomRowsInput] = useState<string>('10');

  const handleSelectPresetRows = (size: number) => {
    setPageSize(size);
    setCustomRowsInput(size >= 99999 ? 'All' : String(size));
    setCurrentPage(1);
  };

  const handleCustomRowsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomRowsInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setPageSize(parsed);
      setCurrentPage(1);
    }
  };

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

  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | 'last_7' | 'this_month' | 'last_month' | 'month' | 'custom'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (3600000 * 5.5));
    const y = ist.getFullYear();
    const m = String(ist.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
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

  const getISTNow = () => {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 5.5));
  };

  const getThisMonthRange = () => {
    const ist = getISTNow();
    const y = ist.getFullYear();
    const m = String(ist.getMonth() + 1).padStart(2, '0');
    const d = String(ist.getDate()).padStart(2, '0');
    return {
      start: `${y}-${m}-01`,
      end: `${y}-${m}-${d}`,
    };
  };

  const getLastMonthRange = () => {
    const ist = getISTNow();
    const year = ist.getMonth() === 0 ? ist.getFullYear() - 1 : ist.getFullYear();
    const monthIdx = ist.getMonth() === 0 ? 12 : ist.getMonth();
    const month = String(monthIdx).padStart(2, '0');
    const lastDay = new Date(year, monthIdx, 0).getDate();
    return {
      start: `${year}-${month}-01`,
      end: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
    };
  };

  const getCustomMonthRange = (ym: string) => {
    if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return { start: '', end: '' };
    const [yStr, mStr] = ym.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      start: `${ym}-01`,
      end: `${ym}-${String(lastDay).padStart(2, '0')}`,
    };
  };

  const formatMonthLabel = (ym: string) => {
    if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym || '';
    const [y, m] = ym.split('-');
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    const thisM = getThisMonthRange().start.slice(0, 7);
    const lastM = getLastMonthRange().start.slice(0, 7);
    set.add(thisM);
    set.add(lastM);
    snapshots.forEach((s) => {
      const dStr = formatIST(s.snapshot_date);
      if (dStr && dStr.length >= 7) {
        set.add(dStr.slice(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [snapshots]);

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
  } else if (datePreset === 'this_month') {
    const r = getThisMonthRange();
    filterStart = r.start;
    filterEnd = r.end;
  } else if (datePreset === 'last_month') {
    const r = getLastMonthRange();
    filterStart = r.start;
    filterEnd = r.end;
  } else if (datePreset === 'month') {
    const r = getCustomMonthRange(selectedMonth);
    filterStart = r.start;
    filterEnd = r.end;
  } else if (datePreset === 'custom') {
    filterStart = customFromDate;
    filterEnd = customToDate;
  }

  // Reset pagination to page 1 whenever filter parameters change
  useEffect(() => {
    setCurrentPage(1);
  }, [datePreset, selectedMonth, customFromDate, customToDate]);

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

  // Filter snapshot history list for table display
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
                    {isPeriod ? (
                      datePreset === 'today' ? "Today's Solved" :
                      datePreset === 'yesterday' ? "Yesterday's Solved" :
                      datePreset === 'last_7' ? "Last 7 Days Solved" :
                      datePreset === 'this_month' ? "This Month's Solved" :
                      datePreset === 'last_month' ? "Last Month's Solved" :
                      datePreset === 'month' ? `${formatMonthLabel(selectedMonth)} Solved` :
                      "Period Solved"
                    ) : 'Total Solved'}
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
              const totalPages = Math.max(1, Math.ceil(displayedSnapshots.length / pageSize));
              const validPage = Math.min(Math.max(1, currentPage), totalPages);
              const startIndex = (validPage - 1) * pageSize;
              const endIndex = Math.min(startIndex + pageSize, displayedSnapshots.length);
              const currentSnapshots = displayedSnapshots.slice(startIndex, endIndex);

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
                  {/* Header Title and Status Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Activity size={22} style={{ color: 'var(--primary)' }} />
                      <div>
                        <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Daily Snapshot History</h4>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Daily LeetCode solves and cumulative snapshots
                        </span>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.8rem',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '9999px',
                      backgroundColor: isPeriod ? 'rgba(52, 211, 153, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                      color: isPeriod ? '#34d399' : '#818cf8',
                      border: isPeriod ? '1px solid rgba(52, 211, 153, 0.25)' : '1px solid rgba(99, 102, 241, 0.25)',
                      fontWeight: 600,
                    }}>
                      {isPeriod
                        ? `Showing ${displayedSnapshots.length > 0 ? startIndex + 1 : 0}–${endIndex} of ${displayedSnapshots.length} snapshots (${datePreset === 'this_month' ? 'This Month' : datePreset === 'last_month' ? 'Last Month' : datePreset === 'month' ? formatMonthLabel(selectedMonth) : `${filterStart} to ${filterEnd}`})`
                        : `Showing ${displayedSnapshots.length > 0 ? startIndex + 1 : 0}–${endIndex} of ${snapshots.length} total snapshots`}
                    </span>
                  </div>

                  {/* FILTER TOOLBAR: Month Filter & Rows Filter Above Table */}
                  <div style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.55)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md, 8px)',
                    padding: '1rem 1.15rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}>
                    {/* Row 1: Month & Date Filter */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', letterSpacing: '0.04em' }}>
                          <Calendar size={15} />
                          <span>Month & Date Filter</span>
                        </label>
                        <span style={{ fontSize: '0.75rem', color: isPeriod ? '#34d399' : 'var(--text-muted)', fontWeight: 500 }}>
                          {datePreset === 'today'
                            ? `⚡ Solved Today (${filterStart})`
                            : datePreset === 'yesterday'
                            ? `⚡ Solved Yesterday (${filterStart})`
                            : datePreset === 'last_7'
                            ? `⚡ Past 7 Days (${filterStart} to ${filterEnd})`
                            : datePreset === 'this_month'
                            ? `🗓️ This Month (${formatMonthLabel(filterStart.slice(0, 7))})`
                            : datePreset === 'last_month'
                            ? `⏪ Last Month (${formatMonthLabel(filterStart.slice(0, 7))})`
                            : datePreset === 'month' && selectedMonth
                            ? `📅 ${formatMonthLabel(selectedMonth)} (${filterStart} to ${filterEnd})`
                            : datePreset === 'custom' && (filterStart || filterEnd)
                            ? `⚡ Custom (${filterStart || 'Start'} to ${filterEnd || 'Today'})`
                            : '🌐 All Time History'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {[
                          { key: 'all', label: '🌐 All Time' },
                          { key: 'this_month', label: '🗓️ This Month' },
                          { key: 'last_month', label: '⏪ Last Month' },
                          { key: 'month', label: '📅 Select Month ▾' },
                          { key: 'today', label: '⚡ Today' },
                          { key: 'yesterday', label: '⏪ Yesterday' },
                          { key: 'last_7', label: 'Last 7 Days' },
                          { key: 'custom', label: 'Custom Range' },
                        ].map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            className={datePreset === p.key ? 'btn-primary' : 'btn-secondary'}
                            style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem', borderRadius: '6px' }}
                            onClick={() => {
                              setDatePreset(p.key as any);
                              if (p.key === 'month' && !selectedMonth) {
                                setSelectedMonth(getThisMonthRange().start.slice(0, 7));
                              }
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

                      {/* Month Picker for 'month' Preset */}
                      {datePreset === 'month' && (
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Choose Recorded Month:</label>
                            <select
                              id="select-history-month"
                              className="form-input"
                              value={selectedMonth}
                              onChange={(e) => setSelectedMonth(e.target.value)}
                              style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', minWidth: '170px' }}
                            >
                              {availableMonths.map((ym) => (
                                <option key={ym} value={ym}>
                                  {formatMonthLabel(ym)} ({ym})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Or pick calendar month:</label>
                            <input
                              type="month"
                              className="form-input"
                              value={selectedMonth}
                              onChange={(e) => setSelectedMonth(e.target.value)}
                              style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Custom Date Range Picker */}
                      {datePreset === 'custom' && (
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>From Date</label>
                            <input
                              type="date"
                              className="form-input"
                              value={customFromDate}
                              onChange={(e) => setCustomFromDate(e.target.value)}
                              style={{ fontSize: '0.8rem', padding: '0.35rem 0.55rem' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>To Date</label>
                            <input
                              type="date"
                              className="form-input"
                              value={customToDate}
                              onChange={(e) => setCustomToDate(e.target.value)}
                              style={{ fontSize: '0.8rem', padding: '0.35rem 0.55rem' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Row 2: Rows Filter (10, 15, 30, All, Custom) */}
                    <div style={{ paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                          Rows:
                        </span>
                        {[10, 15, 30].map((num) => (
                          <button
                            key={num}
                            type="button"
                            id={`btn-rows-${num}`}
                            className={pageSize === num && customRowsInput === String(num) ? 'btn-primary' : 'btn-secondary'}
                            style={{
                              fontSize: '0.78rem',
                              padding: '0.25rem 0.65rem',
                              borderRadius: '5px',
                              fontWeight: pageSize === num ? 700 : 500,
                            }}
                            onClick={() => handleSelectPresetRows(num)}
                          >
                            {num}
                          </button>
                        ))}
                        <button
                          type="button"
                          id="btn-rows-all"
                          className={pageSize >= 99999 ? 'btn-primary' : 'btn-secondary'}
                          style={{
                            fontSize: '0.78rem',
                            padding: '0.25rem 0.65rem',
                            borderRadius: '5px',
                            fontWeight: pageSize >= 99999 ? 700 : 500,
                          }}
                          onClick={() => handleSelectPresetRows(99999)}
                        >
                          All
                        </button>

                        {/* Custom Rows Input */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.5rem' }}>
                          <label htmlFor="custom-rows-input" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Custom:
                          </label>
                          <input
                            id="custom-rows-input"
                            type="number"
                            min="1"
                            max="1000"
                            value={customRowsInput === 'All' ? '' : customRowsInput}
                            onChange={handleCustomRowsChange}
                            placeholder="e.g. 15"
                            className="form-input"
                            style={{
                              width: '72px',
                              fontSize: '0.8rem',
                              padding: '0.25rem 0.45rem',
                              textAlign: 'center',
                            }}
                          />
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>rows</span>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Showing previous <strong style={{ color: 'var(--text-primary)' }}>{pageSize >= 99999 ? displayedSnapshots.length : Math.min(pageSize, displayedSnapshots.length)}</strong> snapshots
                      </div>
                    </div>
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
                        {currentSnapshots.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                              No daily snapshots recorded for the selected period ({filterStart || 'Start'} to {filterEnd || 'Today'}).
                            </td>
                          </tr>
                        ) : (
                          currentSnapshots.map((snap) => {
                            const snapDateStr = formatIST(snap.snapshot_date);
                            const prevSnap = snapshots.find((s) => formatIST(s.snapshot_date) < snapDateStr);
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
                                  {snapDateStr}
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
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Google-like Pagination Bar with Dynamic Page Size */}
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
                        Page <strong style={{ color: 'var(--text-primary)' }}>{validPage}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{totalPages}</strong> ({displayedSnapshots.length} total entries)
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
                          <span>Previous {pageSize < 99999 ? pageSize : 'All'}</span>
                        </button>

                        {/* Numbered Page Buttons */}
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
                          <span>Next {pageSize < 99999 ? pageSize : 'All'}</span>
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
