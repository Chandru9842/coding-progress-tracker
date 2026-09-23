import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout.js';
import { useAuth } from '../context/AuthContext.js';
import {
  statsApi,
  studentApi,
  batchApi,
  staffApi,
  getCachedData,
  notifySyncStarted,
  notifySyncEnded,
  Batch,
  Section,
  AllocationBatch,
  StaffUser,
} from '../services/api.js';
import { syncReportStudents } from '../api/reports.js';
import { DashboardStats } from '../types/index.js';
import {
  Users,
  FolderKanban,
  UserCheck,
  GraduationCap,
  AlertCircle,
  Loader2,
  Code2,
  Trophy,
  Zap,
  TrendingUp,
  RefreshCw,
  ChevronRight,
  Sparkles,
  Award,
  ExternalLink,
  Filter,
  Search,
  RotateCcw,
  Building2,
  Calendar,
  Layers,
  Check,
  ChevronDown,
} from 'lucide-react';
import { SyncStatus } from '../components/SyncStatus.js';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentUserId = user?.id || user?.userId || '';

  // Primary stats state
  const cachedStats = getCachedData<DashboardStats>('stats_dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(cachedStats);
  const [loading, setLoading] = useState<boolean>(!cachedStats);
  const [error, setError] = useState<string | null>(null);
  const [syncingLeetCode, setSyncingLeetCode] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Filter state
  const [batches, setBatches] = useState<Batch[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [allocBatches, setAllocBatches] = useState<AllocationBatch[]>([]);
  const [loadingFilters, setLoadingFilters] = useState<boolean>(true);

  const [filterDept, setFilterDept] = useState<string>('ALL');
  const [filterBatchId, setFilterBatchId] = useState<string>('ALL');
  const [filterSectionId, setFilterSectionId] = useState<string>('ALL');
  const [filterAllocBatchId, setFilterAllocBatchId] = useState<string>('ALL');
  const [filterMentorId, setFilterMentorId] = useState<string>(
    user?.role === 'STAFF' ? currentUserId : 'ALL'
  );

  // Searchable mentor dropdown state
  const [mentorSearch, setMentorSearch] = useState<string>('');
  const [mentorDropdownOpen, setMentorDropdownOpen] = useState<boolean>(false);
  const mentorDropdownRef = useRef<HTMLDivElement>(null);

  // Sync staff mentor default once user profile is verified
  useEffect(() => {
    if (user?.role === 'STAFF' && filterMentorId === 'ALL' && currentUserId) {
      setFilterMentorId(currentUserId);
    }
  }, [user, currentUserId]);

  // Close mentor dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (mentorDropdownRef.current && !mentorDropdownRef.current.contains(e.target as Node)) {
        setMentorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch filter metadata (batches and staff)
  useEffect(() => {
    let isMounted = true;
    const loadMetadata = async () => {
      try {
        setLoadingFilters(true);
        const [batchRes, staffRes] = await Promise.all([
          batchApi.getAllBatches().catch(() => []),
          staffApi.getAllStaff(true).catch(() => []),
        ]);
        if (isMounted) {
          setBatches(batchRes || []);
          setStaffList(staffRes || []);
        }
      } catch (err) {
        console.warn('Failed to fetch dashboard filter metadata:', err);
      } finally {
        if (isMounted) setLoadingFilters(false);
      }
    };
    loadMetadata();
    return () => {
      isMounted = false;
    };
  }, []);

  // When selected section changes, load its allocation batches
  useEffect(() => {
    if (filterSectionId && filterSectionId !== 'ALL') {
      batchApi
        .getAllocationBatches(filterSectionId)
        .then((res) => setAllocBatches(res || []))
        .catch(() => setAllocBatches([]));
    } else {
      setAllocBatches([]);
      if (filterAllocBatchId !== 'ALL') {
        setFilterAllocBatchId('ALL');
      }
    }
  }, [filterSectionId]);

  // Derived filter options
  const departmentOptions = Array.from(
    new Set([
      'CSE',
      'IT',
      'ECE',
      'AIDS',
      ...batches.map((b) => b.department).filter(Boolean),
    ])
  ).sort();

  const filteredBatches = batches.filter((b) => {
    if (filterDept !== 'ALL' && b.department?.toUpperCase() !== filterDept.toUpperCase()) {
      return false;
    }
    return true;
  });

  const availableSections: Section[] = [];
  if (filterBatchId !== 'ALL') {
    const matchedBatch = batches.find((b) => b.id === filterBatchId);
    if (matchedBatch?.sections) {
      availableSections.push(...matchedBatch.sections);
    }
  } else {
    // Combine sections from filtered batches
    for (const b of filteredBatches) {
      if (b.sections) {
        availableSections.push(...b.sections);
      }
    }
  }

  // Fetch dashboard stats with active filters
  const fetchStats = useCallback(
    async (
      bypassCache: boolean = false,
      overrides?: {
        department?: string;
        batchId?: string;
        sectionId?: string;
        allocationBatchId?: string;
        mentorId?: string;
      }
    ) => {
      try {
        setLoading(true);
        const dept = overrides?.department !== undefined ? overrides.department : filterDept;
        const bId = overrides?.batchId !== undefined ? overrides.batchId : filterBatchId;
        const sId = overrides?.sectionId !== undefined ? overrides.sectionId : filterSectionId;
        const aId =
          overrides?.allocationBatchId !== undefined ? overrides.allocationBatchId : filterAllocBatchId;
        const mId = overrides?.mentorId !== undefined ? overrides.mentorId : filterMentorId;

        const params: any = {};
        if (dept && dept !== 'ALL') params.department = dept;
        if (bId && bId !== 'ALL') params.batchId = bId;
        if (sId && sId !== 'ALL') params.sectionId = sId;
        if (aId && aId !== 'ALL') params.allocationBatchId = aId;
        if (mId && mId !== 'ALL') {
          params.mentorId = mId;
        } else if (user?.role === 'STAFF') {
          // If staff specifically chose 'ALL', signal backend to show full authorized cohort
          params.mentorId = 'ALL';
        }

        const data = await statsApi.getStats(params, bypassCache);
        setStats(data);
        setError(null);
      } catch (err: unknown) {
        console.error('Failed to load dashboard statistics:', err);
        setError('Unable to load dashboard data. Please verify your connection.');
      } finally {
        setLoading(false);
      }
    },
    [filterDept, filterBatchId, filterSectionId, filterAllocBatchId, filterMentorId, user]
  );

  // Trigger stats load on filter adjustments
  useEffect(() => {
    fetchStats(false);
  }, [fetchStats]);

  // Sync event listener
  useEffect(() => {
    const handleSyncEvent = () => fetchStats(true);
    window.addEventListener('student-synced', handleSyncEvent);
    window.addEventListener('sheets-synced', handleSyncEvent);

    return () => {
      window.removeEventListener('student-synced', handleSyncEvent);
      window.removeEventListener('sheets-synced', handleSyncEvent);
    };
  }, [fetchStats]);

  // Reset all filters to default
  const handleResetFilters = () => {
    const defaultMentor = user?.role === 'STAFF' ? currentUserId : 'ALL';
    setFilterDept('ALL');
    setFilterBatchId('ALL');
    setFilterSectionId('ALL');
    setFilterAllocBatchId('ALL');
    setFilterMentorId(defaultMentor);
    setMentorSearch('');
    fetchStats(false, {
      department: 'ALL',
      batchId: 'ALL',
      sectionId: 'ALL',
      allocationBatchId: 'ALL',
      mentorId: defaultMentor,
    });
  };

  const isFilterActive =
    filterDept !== 'ALL' ||
    filterBatchId !== 'ALL' ||
    filterSectionId !== 'ALL' ||
    filterAllocBatchId !== 'ALL' ||
    (user?.role === 'ADMIN' ? filterMentorId !== 'ALL' : filterMentorId !== currentUserId);

  // Interactive Live LeetCode Sync scoped to active filters
  const handleLiveLeetCodeSync = async () => {
    notifySyncStarted('Dashboard Live Sync');
    try {
      setSyncingLeetCode(true);
      setSyncMessage(null);
      setError(null);

      const activeFilterParams: any = {};
      if (filterDept !== 'ALL') activeFilterParams.department = filterDept;
      if (filterBatchId !== 'ALL') activeFilterParams.batchId = filterBatchId;
      if (filterSectionId !== 'ALL') activeFilterParams.sectionId = filterSectionId;
      if (filterAllocBatchId !== 'ALL') activeFilterParams.allocationBatchId = filterAllocBatchId;
      if (filterMentorId && filterMentorId !== 'ALL') {
        activeFilterParams.mentorId = filterMentorId;
      } else if (user?.role === 'STAFF') {
        activeFilterParams.mentorId = currentUserId;
      }

      let studentIds: string[] = [];
      try {
        const studentList = await studentApi.getStudents(activeFilterParams, true);
        if (Array.isArray(studentList)) {
          studentIds = studentList.filter((s) => s.leetcode_username).map((s) => s.id);
        }
      } catch {
        // fallback to sync report without IDs
      }

      if (studentIds.length > 0) {
        const MAX_INTERACTIVE_SYNC = 100;
        const immediateIds = studentIds.slice(0, MAX_INTERACTIVE_SYNC);
        const batchSize = 10;
        let totalSuccess = 0;
        const totalToSync = immediateIds.length;

        const chunks: string[][] = [];
        for (let i = 0; i < totalToSync; i += batchSize) {
          chunks.push(immediateIds.slice(i, i + batchSize));
        }

        let processedCount = 0;
        const concurrency = 2;
        for (let cIdx = 0; cIdx < chunks.length; cIdx += concurrency) {
          const chunkBatch = chunks.slice(cIdx, cIdx + concurrency);
          await Promise.all(
            chunkBatch.map(async (chunk) => {
              try {
                const res = await syncReportStudents({ studentIds: chunk });
                totalSuccess += res.successful ?? chunk.length;
              } catch (chunkErr) {
                console.warn('[Sync Chunk Warning]:', chunkErr);
              } finally {
                processedCount += chunk.length;
              }
            })
          );
          const percent = Math.min(100, Math.round((processedCount / totalToSync) * 100));
          setSyncMessage(
            `⚡ Live syncing LeetCode stats: ${processedCount}/${totalToSync} students (${percent}%)... Please wait.`
          );
        }
        setSyncMessage(
          `⚡ Live LeetCode sync completed! ${totalSuccess}/${totalToSync} student records synchronized.`
        );
      } else {
        const res = await syncReportStudents();
        setSyncMessage(`⚡ Live LeetCode sync completed! ${res.successful ?? 'All'} student records synchronized.`);
      }

      await fetchStats(true);
      window.dispatchEvent(new CustomEvent('student-synced'));
    } catch (err: any) {
      console.error('Failed to sync LeetCode stats:', err);
      setError('Failed to live sync LeetCode statistics. Please try again.');
    } finally {
      notifySyncEnded('Dashboard Live Sync');
      setSyncingLeetCode(false);
    }
  };

  const lc = (stats as any)?.leetcodeStats;

  // Selected mentor display label
  const selectedMentor = staffList.find((s) => s.id === filterMentorId);
  const mentorDisplayLabel =
    filterMentorId === 'ALL'
      ? 'All Mentors / Whole Cohort'
      : filterMentorId === 'UNASSIGNED'
      ? 'Unassigned Students'
      : filterMentorId === currentUserId
      ? `⭐ My Students (${user?.name})`
      : selectedMentor?.name || 'Selected Mentor';

  return (
    <Layout title="Dashboard">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        {/* Welcome Banner with Action Buttons */}
        <div
          className="glass-panel"
          style={{
            padding: '2rem',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)',
            borderLeft: '4px solid var(--primary)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.25rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>
              Welcome back, {user?.name}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              {user?.role === 'ADMIN'
                ? 'Administrator Overview & College-Wide Coding Performance'
                : 'Faculty Dashboard & Assigned Student Coding Analytics'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleLiveLeetCodeSync}
              disabled={syncingLeetCode || loading}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.15rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              }}
              title="Fetch fresh real-time LeetCode problem counts for current cohort"
            >
              <RefreshCw size={16} className={syncingLeetCode ? 'animate-spin' : ''} />
              <span>{syncingLeetCode ? 'Syncing...' : '⚡ Sync Live LeetCode'}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.65rem 1rem',
                fontSize: '0.9rem',
              }}
            >
              <span>Detailed Reports</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Sync Success Feedback Notice */}
        {syncMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 1.25rem',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#34d399',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}
          >
            <Sparkles size={18} />
            <span>{syncMessage}</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 1.25rem',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#f87171',
            }}
          >
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* Dynamic Performance & Cohort Filter Bar */}
        <div
          className="glass-panel"
          style={{
            padding: '1.25rem 1.5rem',
            background: 'rgba(30, 41, 59, 0.7)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  padding: '0.35rem',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Filter size={16} />
              </div>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Dashboard Cohort Filters
              </span>

              {user?.role === 'STAFF' && filterMentorId === currentUserId && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    fontWeight: 600,
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                >
                  ⭐ Direct Mentoring Mode (Auto-scoped)
                </span>
              )}

              {user?.role === 'ADMIN' && filterMentorId === 'ALL' && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    color: '#a5b4fc',
                    fontWeight: 600,
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                  }}
                >
                  🌐 College / Whole Department View
                </span>
              )}
            </div>

            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#f87171')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                title="Reset all filters back to default scope"
              >
                <RotateCcw size={13} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Filter Controls Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.85rem',
              alignItems: 'flex-end',
            }}
          >
            {/* 1. Department Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Department
              </label>
              <select
                value={filterDept}
                onChange={(e) => {
                  setFilterDept(e.target.value);
                  setFilterBatchId('ALL');
                  setFilterSectionId('ALL');
                  setFilterAllocBatchId('ALL');
                }}
                style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              >
                <option value="ALL">All Departments</option>
                {departmentOptions.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Academic Batch Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Academic Batch
              </label>
              <select
                value={filterBatchId}
                onChange={(e) => {
                  setFilterBatchId(e.target.value);
                  setFilterSectionId('ALL');
                  setFilterAllocBatchId('ALL');
                }}
                style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              >
                <option value="ALL">All Batches</option>
                {filteredBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batch_name} ({b.department} {b.start_year}-{b.end_year})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Class / Section Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Class / Section
              </label>
              <select
                value={filterSectionId}
                onChange={(e) => {
                  setFilterSectionId(e.target.value);
                  setFilterAllocBatchId('ALL');
                }}
                style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              >
                <option value="ALL">All Sections</option>
                {availableSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Allocation Batch Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Allocation Batch
              </label>
              <select
                value={filterAllocBatchId}
                onChange={(e) => setFilterAllocBatchId(e.target.value)}
                disabled={allocBatches.length === 0 && filterSectionId === 'ALL'}
                style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  opacity: allocBatches.length === 0 && filterSectionId === 'ALL' ? 0.6 : 1,
                }}
              >
                <option value="ALL">All Allocation Batches</option>
                {allocBatches.map((ab) => (
                  <option key={ab.id} value={ab.id}>
                    {ab.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Mentor Filter (Searchable for Admin / Quick Scoped for Staff) */}
            <div
              ref={mentorDropdownRef}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', position: 'relative' }}
            >
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Mentor / Faculty
              </label>

              {user?.role === 'STAFF' ? (
                // Staff Dropdown
                <select
                  value={filterMentorId}
                  onChange={(e) => setFilterMentorId(e.target.value)}
                  style={{
                    padding: '0.55rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                >
                  <option value={currentUserId}>⭐ My Students Only ({user?.name})</option>
                  <option value="ALL">All Students in My Scope</option>
                </select>
              ) : (
                // Admin Searchable Dropdown
                <div>
                  <button
                    type="button"
                    onClick={() => setMentorDropdownOpen(!mentorDropdownOpen)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginRight: '0.5rem',
                      }}
                    >
                      {mentorDisplayLabel}
                    </span>
                    <ChevronDown size={14} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                  </button>

                  {/* Dropdown Menu Popup */}
                  {mentorDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '0.35rem',
                        backgroundColor: 'rgba(15, 23, 42, 0.98)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                        zIndex: 50,
                        padding: '0.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        minWidth: '240px',
                      }}
                    >
                      {/* Search Input */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.4rem 0.6rem',
                          backgroundColor: 'rgba(30, 41, 59, 0.8)',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <Search size={14} style={{ color: 'var(--text-muted)' }} />
                        <input
                          type="text"
                          placeholder="Search mentor name..."
                          value={mentorSearch}
                          onChange={(e) => setMentorSearch(e.target.value)}
                          autoFocus
                          style={{
                            background: 'none',
                            border: 'none',
                            outline: 'none',
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                            width: '100%',
                          }}
                        />
                      </div>

                      {/* Mentor List Options */}
                      <div
                        style={{
                          maxHeight: '200px',
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.2rem',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setFilterMentorId('ALL');
                            setMentorDropdownOpen(false);
                          }}
                          style={{
                            padding: '0.5rem 0.65rem',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor:
                              filterMentorId === 'ALL' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                            color: filterMentorId === 'ALL' ? 'var(--primary)' : 'var(--text-secondary)',
                            fontWeight: filterMentorId === 'ALL' ? 700 : 500,
                            fontSize: '0.83rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <span>All Mentors / Whole Cohort</span>
                          {filterMentorId === 'ALL' && <Check size={14} />}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setFilterMentorId('UNASSIGNED');
                            setMentorDropdownOpen(false);
                          }}
                          style={{
                            padding: '0.5rem 0.65rem',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor:
                              filterMentorId === 'UNASSIGNED' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                            color:
                              filterMentorId === 'UNASSIGNED' ? 'var(--primary)' : 'var(--text-secondary)',
                            fontWeight: filterMentorId === 'UNASSIGNED' ? 700 : 500,
                            fontSize: '0.83rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <span>Unassigned Students</span>
                          {filterMentorId === 'UNASSIGNED' && <Check size={14} />}
                        </button>

                        <div
                          style={{
                            height: '1px',
                            backgroundColor: 'var(--border-subtle)',
                            margin: '0.2rem 0',
                          }}
                        />

                        {staffList
                          .filter(
                            (s) =>
                              !mentorSearch ||
                              s.name.toLowerCase().includes(mentorSearch.toLowerCase()) ||
                              s.email.toLowerCase().includes(mentorSearch.toLowerCase())
                          )
                          .map((staff) => (
                            <button
                              key={staff.id}
                              type="button"
                              onClick={() => {
                                setFilterMentorId(staff.id);
                                setMentorDropdownOpen(false);
                              }}
                              style={{
                                padding: '0.5rem 0.65rem',
                                borderRadius: '4px',
                                border: 'none',
                                backgroundColor:
                                  filterMentorId === staff.id
                                    ? 'rgba(99, 102, 241, 0.2)'
                                    : 'transparent',
                                color:
                                  filterMentorId === staff.id
                                    ? 'var(--primary)'
                                    : 'var(--text-secondary)',
                                fontWeight: filterMentorId === staff.id ? 700 : 500,
                                fontSize: '0.83rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span>{staff.name}</span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {staff.email}
                                </span>
                              </div>
                              {filterMentorId === staff.id && <Check size={14} />}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loading state indicator */}
        {loading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1.5rem',
              color: 'var(--text-secondary)',
            }}
          >
            <Loader2 className="animate-spin" size={22} style={{ color: 'var(--primary)' }} />
            <span>Updating LeetCode diagnostic metrics for selected cohort...</span>
          </div>
        )}

        {/* Key LeetCode Progress Metrics Cards */}
        {!loading && lc && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Code2 size={20} style={{ color: '#fb923c' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                LeetCode Performance Overview
              </h3>
            </div>

            <div
              className="stats-grid-responsive"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {/* Card 1: Total Problems Solved */}
              <div
                className="glass-panel"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  borderTop: '3px solid #10b981',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Total Problems Solved
                  </span>
                  <div
                    style={{
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                    }}
                  >
                    <Award size={20} />
                  </div>
                </div>
                <span
                  style={{ fontSize: '2.25rem', fontWeight: 800, color: '#10b981', letterSpacing: '-0.02em' }}
                >
                  {(lc.totalSolved || 0).toLocaleString()}
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(52, 211, 153, 0.15)',
                      color: '#34d399',
                      fontWeight: 700,
                    }}
                  >
                    {lc.easySolved || 0} Easy
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(250, 204, 21, 0.15)',
                      color: '#facc15',
                      fontWeight: 700,
                    }}
                  >
                    {lc.mediumSolved || 0} Med
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(248, 113, 113, 0.15)',
                      color: '#f87171',
                      fontWeight: 700,
                    }}
                  >
                    {lc.hardSolved || 0} Hard
                  </span>
                </div>
              </div>

              {/* Card 2: Today's Solved (IST) */}
              <div
                className="glass-panel"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  borderTop: '3px solid #6366f1',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Today's Solved (Midnight–Now)
                  </span>
                  <div
                    style={{
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                      color: 'var(--primary)',
                    }}
                  >
                    <Zap size={20} />
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '2.25rem',
                    fontWeight: 800,
                    color: 'var(--primary)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  +{(lc.todaySolved || 0).toLocaleString()}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Fresh problems solved since 12:00 AM IST
                </span>
              </div>

              {/* Card 3: Active Coders */}
              <div
                className="glass-panel"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  borderTop: '3px solid #06b6d4',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Active LeetCode Coders
                  </span>
                  <div
                    style={{
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(6, 182, 212, 0.15)',
                      color: '#06b6d4',
                    }}
                  >
                    <TrendingUp size={20} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '2.25rem',
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {lc.activeCoders || 0}
                  </span>
                  <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
                    / {lc.totalCoders || 0} students
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    marginTop: '0.25rem',
                  }}
                >
                  <div
                    style={{
                      width: `${
                        lc.totalCoders > 0 ? Math.round((lc.activeCoders / lc.totalCoders) * 100) : 0
                      }%`,
                      height: '100%',
                      backgroundColor: '#06b6d4',
                      borderRadius: '3px',
                    }}
                  />
                </div>
              </div>

              {/* Card 4: Coding Participation Rate */}
              <div
                className="glass-panel"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  borderTop: '3px solid #ec4899',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Participation Rate
                  </span>
                  <div
                    style={{
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(236, 72, 153, 0.15)',
                      color: '#ec4899',
                    }}
                  >
                    <UserCheck size={20} />
                  </div>
                </div>
                <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#ec4899', letterSpacing: '-0.02em' }}>
                  {lc.totalCoders > 0 ? Math.round((lc.activeCoders / lc.totalCoders) * 100) : 0}%
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Active profiles with problems solved
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Top 5 Performers Leaderboard with Mentor Tag */}
        {!loading && lc?.topCoders && lc.topCoders.length > 0 && (
          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.25rem',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div
                  style={{
                    padding: '0.45rem',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(234, 179, 8, 0.15)',
                    color: '#eab308',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Trophy size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Top LeetCode Performers
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Leading students ranked by overall solved problems in this cohort
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/students')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <span>View All Students</span>
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="table-responsive-container">
              <table
                style={{
                  width: '100%',
                  minWidth: '780px',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.9rem',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem 1rem', width: '60px', textAlign: 'center' }}>Rank</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Register No</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Student Name</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Mentor</th>
                    <th style={{ padding: '0.75rem 1rem' }}>LeetCode Handle</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Breakdown (E / M / H)</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Solved</th>
                  </tr>
                </thead>
                <tbody>
                  {lc.topCoders.map((student: any, idx: number) => {
                    const rankMedals = ['🥇', '🥈', '🥉'];
                    return (
                      <tr
                        key={student.id}
                        onClick={() => navigate(`/students/${student.id}`)}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)',
                        }}
                      >
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          {idx < 3 ? (
                            <span style={{ fontSize: '1.2rem' }}>{rankMedals[idx]}</span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-block',
                                minWidth: '24px',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-secondary)',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                              }}
                            >
                              #{idx + 1}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--primary)' }}>
                          {student.register_number}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {student.name}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          {student.mentor_name ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                color: '#a5b4fc',
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                border: '1px solid rgba(99, 102, 241, 0.25)',
                              }}
                            >
                              <UserCheck size={12} />
                              <span>{student.mentor_name}</span>
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-muted)',
                                fontSize: '0.75rem',
                              }}
                            >
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>
                          <a
                            href={`https://leetcode.com/u/${student.leetcode_username.replace(/^@/, '')}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(249, 115, 22, 0.12)',
                              color: '#fb923c',
                              fontWeight: 600,
                              fontSize: '0.82rem',
                              textDecoration: 'none',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              border: '1px solid rgba(249, 115, 22, 0.25)',
                            }}
                            title={`Open ${student.leetcode_username}'s LeetCode profile in new tab`}
                          >
                            <span>@{student.leetcode_username.replace(/^@/, '')}</span>
                            <ExternalLink size={12} />
                          </a>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '3px',
                                backgroundColor: 'rgba(52, 211, 153, 0.12)',
                                color: '#34d399',
                                fontWeight: 600,
                              }}
                            >
                              {student.easy_solved || 0}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>/</span>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '3px',
                                backgroundColor: 'rgba(250, 204, 21, 0.12)',
                                color: '#facc15',
                                fontWeight: 600,
                              }}
                            >
                              {student.medium_solved || 0}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>/</span>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '3px',
                                backgroundColor: 'rgba(248, 113, 113, 0.12)',
                                color: '#f87171',
                                fontWeight: 600,
                              }}
                            >
                              {student.hard_solved || 0}
                            </span>
                          </div>
                        </td>
                        <td
                          style={{
                            padding: '0.85rem 1rem',
                            textAlign: 'right',
                            fontWeight: 800,
                            fontSize: '1.1rem',
                            color: '#10b981',
                          }}
                        >
                          {(student.total_solved || 0).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Academic / Faculty Operational Stats */}
        {!loading && stats && (
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Academic & Allocation Metrics
            </h3>

            {stats.role === 'ADMIN' ? (
              <div
                className="stats-grid-responsive"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1.25rem',
                }}
              >
                <div
                  className="glass-panel"
                  style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Total Staff
                    </span>
                    <div
                      style={{
                        padding: '0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        color: 'var(--primary)',
                      }}
                    >
                      <Users size={20} />
                    </div>
                  </div>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {stats.totalStaff}
                  </span>
                </div>

                <div
                  className="glass-panel"
                  style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Total Batches
                    </span>
                    <div
                      style={{
                        padding: '0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(6, 182, 212, 0.15)',
                        color: '#06b6d4',
                      }}
                    >
                      <FolderKanban size={20} />
                    </div>
                  </div>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {stats.totalBatches}
                  </span>
                </div>

                <div
                  className="glass-panel"
                  style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Students in Filtered Cohort
                    </span>
                    <div
                      style={{
                        padding: '0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                      }}
                    >
                      <GraduationCap size={20} />
                    </div>
                  </div>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {stats.totalStudents}
                  </span>
                </div>

                <div
                  className="glass-panel"
                  style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Active Faculty
                    </span>
                    <div
                      style={{
                        padding: '0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(236, 72, 153, 0.15)',
                        color: '#ec4899',
                      }}
                    >
                      <UserCheck size={20} />
                    </div>
                  </div>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {stats.activeStaff}
                  </span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1.25rem',
                }}
              >
                <div
                  className="glass-panel"
                  style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                >
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Assigned Batches
                  </span>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {stats.assignedBatchesCount}
                  </span>
                </div>
                <div
                  className="glass-panel"
                  style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                >
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {filterMentorId && filterMentorId !== 'ALL'
                      ? 'Students in Mentored Cohort'
                      : 'Students in Assigned Batches'}
                  </span>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {stats.totalStudentsInAssignedBatches}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Real-time Google Sheets Sync & Zero-Error Automation Status */}
        {!loading && <SyncStatus variant="card" />}
      </div>
    </Layout>
  );
};
