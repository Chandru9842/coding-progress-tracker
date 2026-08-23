import React, { useState, useEffect } from 'react';
import { RefreshCw, FileSpreadsheet, Download } from 'lucide-react';
import { Layout } from '../components/Layout.js';
import {
  getReportFilters,
  getReportData,
  getStudentDailyProgress,
  exportCsvReport,
  exportExcelReport,
  getReportsList,
  downloadReportFile,
  syncReportStudents,
  ReportFilterOptions,
  ReportDataResponse,
  StudentReportItem,
  ReportItem,
} from '../api/reports.js';

export default function ReportsPage() {
  const [filterOptions, setFilterOptions] = useState<ReportFilterOptions>({
    academicYears: [],
    departments: [],
    batches: [],
    staff: [],
  });

  const [academicYear, setAcademicYear] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [batchId, setBatchId] = useState<string>('');
  const [sectionId, setSectionId] = useState<string>('');
  const [allocationBatchId, setAllocationBatchId] = useState<string>('');
  const [staffId, setStaffId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | 'last_7' | 'last_30' | 'custom'>('all');

  const handleDatePresetChange = (preset: 'all' | 'today' | 'yesterday' | 'last_7' | 'last_30' | 'custom') => {
    setDatePreset(preset);
    const now = new Date();
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (preset === 'all') {
      setFromDate('');
      setToDate('');
    } else if (preset === 'today') {
      const todayStr = formatDate(now);
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const yestStr = formatDate(yest);
      setFromDate(yestStr);
      setToDate(yestStr);
    } else if (preset === 'last_7') {
      const d7 = new Date(now);
      d7.setDate(d7.getDate() - 7);
      setFromDate(formatDate(d7));
      setToDate(formatDate(now));
    } else if (preset === 'last_30') {
      const d30 = new Date(now);
      d30.setDate(d30.getDate() - 30);
      setFromDate(formatDate(d30));
      setToDate(formatDate(now));
    }
  };
  const [sortBy, setSortBy] = useState<'total' | 'easy' | 'medium' | 'hard' | 'register_number' | 'name'>('total');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activityStatus, setActivityStatus] = useState<'all' | 'active' | 'no_activity'>('all');

  const [reportData, setReportData] = useState<ReportDataResponse | null>(null);
  const [reportsList, setReportsList] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [syncingLeetcode, setSyncingLeetcode] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Student Daily Progress Modal State
  const [selectedStudent, setSelectedStudent] = useState<StudentReportItem | null>(null);
  const [dailySnapshots, setDailySnapshots] = useState<any[]>([]);
  const [loadingStudentProgress, setLoadingStudentProgress] = useState<boolean>(false);

  useEffect(() => {
    loadFiltersAndData();
  }, []);

  const loadFiltersAndData = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = await getReportFilters();
      setFilterOptions(filters);

      const data = await getReportData({
        sortBy: 'total',
        sortOrder: 'desc',
        activityStatus: 'all',
      });
      setReportData(data);

      const reps = await getReportsList();
      setReportsList(reps);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load reports data');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = async () => {
    if (datePreset === 'custom' && fromDate && toDate && fromDate > toDate) {
      setError('Start date cannot be after end date');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getReportData({
        academicYear: academicYear || undefined,
        department: department || undefined,
        batchId: batchId || undefined,
        sectionId: sectionId || undefined,
        allocationBatchId: allocationBatchId || undefined,
        staffId: staffId || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        sortBy,
        sortOrder,
        activityStatus,
      });
      setReportData(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to apply report filters');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFilteredLeetCode = async () => {
    setSyncingLeetcode(true);
    setSuccessMsg(null);
    setError(null);
    const startTime = Date.now();
    try {
      const res = await syncReportStudents({
        batchId: batchId || undefined,
        sectionId: sectionId || undefined,
        department: department || undefined,
        allocationBatchId: allocationBatchId || undefined,
        staffId: staffId || undefined,
      });

      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      setSuccessMsg(res.message ? `${res.message} (completed in ${res.durationSeconds || elapsedSec}s)` : `⚡ Successfully synchronized LeetCode data for ${res.successful || 0} student(s) in ${elapsedSec}s`);

      const refreshedData = await getReportData({
        academicYear: academicYear || undefined,
        department: department || undefined,
        batchId: batchId || undefined,
        sectionId: sectionId || undefined,
        allocationBatchId: allocationBatchId || undefined,
        staffId: staffId || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        sortBy,
        sortOrder,
        activityStatus,
      });
      setReportData(refreshedData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to sync LeetCode data for filtered students');
    } finally {
      setSyncingLeetcode(false);
    }
  };

  const handleSortChange = (newSortBy: 'total' | 'easy' | 'medium' | 'hard' | 'register_number' | 'name') => {
    let newOrder: 'asc' | 'desc' = 'desc';
    if (sortBy === newSortBy) {
      newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    }
    setSortBy(newSortBy);
    setSortOrder(newOrder);

    if (reportData) {
      const sorted = [...reportData.students].sort((a, b) => {
        if (newSortBy === 'register_number') {
          const cmp = a.register_number.localeCompare(b.register_number, undefined, { numeric: true });
          return newOrder === 'asc' ? cmp : -cmp;
        }
        if (newSortBy === 'name') {
          const cmp = a.name.localeCompare(b.name);
          return newOrder === 'asc' ? cmp : -cmp;
        }
        const valA = a[`${newSortBy}_solved` as keyof StudentReportItem] as number;
        const valB = b[`${newSortBy}_solved` as keyof StudentReportItem] as number;
        if (valA !== valB) {
          return newOrder === 'asc' ? valA - valB : valB - valA;
        }
        return a.register_number.localeCompare(b.register_number, undefined, { numeric: true });
      });
      setReportData({ ...reportData, students: sorted });
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    setSuccessMsg(null);
    setError(null);
    try {
      const res = await exportExcelReport({
        academicYear: academicYear || undefined,
        department: department || undefined,
        batchId: batchId || undefined,
        sectionId: sectionId || undefined,
        allocationBatchId: allocationBatchId || undefined,
        staffId: staffId || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        sortBy,
        sortOrder,
        activityStatus,
      });
      setSuccessMsg(`📊 Excel report exported successfully with auto-fitted columns as ${res.fileName}`);
      const updatedList = await getReportsList();
      setReportsList(updatedList);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to export Excel report');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    setSuccessMsg(null);
    setError(null);
    try {
      const res = await exportCsvReport({
        academicYear: academicYear || undefined,
        department: department || undefined,
        batchId: batchId || undefined,
        sectionId: sectionId || undefined,
        allocationBatchId: allocationBatchId || undefined,
        staffId: staffId || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        sortBy,
        sortOrder,
        activityStatus,
      });
      setSuccessMsg(`📄 CSV report exported successfully as ${res.fileName}`);
      const updatedList = await getReportsList();
      setReportsList(updatedList);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to export CSV report');
    } finally {
      setExporting(false);
    }
  };

  const handleOpenStudentModal = async (student: StudentReportItem) => {
    setSelectedStudent(student);
    setLoadingStudentProgress(true);
    try {
      const res = await getStudentDailyProgress(student.id, {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setDailySnapshots(res.snapshots || []);
    } catch (err: any) {
      setDailySnapshots([]);
    } finally {
      setLoadingStudentProgress(false);
    }
  };

  // Dynamic chained filter computation
  const matchingBatchesByAY = filterOptions.batches.filter(
    (b) => !academicYear || b.academicYear === academicYear
  );

  const availableDepartments = Array.from(
    new Set(matchingBatchesByAY.map((b) => b.department))
  ).sort();

  const matchingBatchesByDept = matchingBatchesByAY.filter(
    (b) => !department || b.department.toLowerCase() === department.toLowerCase()
  );

  const availableSections = matchingBatchesByDept.flatMap((b) =>
    b.sections.map((sec) => ({
      ...sec,
      batchId: b.id,
      batchName: b.batch_name,
      department: b.department,
    }))
  );

  const selectedSectionObj = availableSections.find((sec) => sec.id === sectionId);
  const availableAllocationBatches = selectedSectionObj?.allocation_batches || [];
  const isCustomDateInvalid = datePreset === 'custom' && !!fromDate && !!toDate && fromDate > toDate;

  return (
    <Layout title="Coding Progress Reports">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Top Header Banner */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
              Student Coding Analytics & Reports
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Comprehensive PostgreSQL-backed coding metrics, leaderboard rankings, and daily progress history.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              id="btn-sync-report-leetcode"
              onClick={handleSyncFilteredLeetCode}
              disabled={syncingLeetcode || loading}
              style={{
                padding: '0.65rem 1.25rem',
                backgroundColor: 'rgba(99, 102, 241, 0.18)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: syncingLeetcode || loading ? 'not-allowed' : 'pointer',
                opacity: syncingLeetcode || loading ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'var(--transition-fast)',
              }}
              title="Sync live LeetCode stats for all currently filtered students"
            >
              <RefreshCw size={16} className={syncingLeetcode ? 'spin' : ''} />
              <span>{syncingLeetcode ? 'Syncing LeetCode Data...' : '⚡ Sync Filtered LeetCode Data'}</span>
            </button>

            <button
              id="export-excel-btn"
              onClick={handleExportExcel}
              disabled={exporting}
              style={{
                padding: '0.65rem 1.25rem',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: exporting ? 'not-allowed' : 'pointer',
                opacity: exporting ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
                transition: 'var(--transition-fast)',
              }}
              title="Download Microsoft Excel (.xlsx) file with auto-sized column widths"
            >
              <FileSpreadsheet size={16} />
              <span>{exporting ? 'Exporting...' : '📊 Generate & Download Excel Report (.xlsx)'}</span>
            </button>

            <button
              id="export-csv-btn"
              onClick={handleExportCsv}
              disabled={exporting}
              style={{
                padding: '0.65rem 1rem',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-secondary, #94a3b8)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 500,
                fontSize: '0.875rem',
                cursor: exporting ? 'not-allowed' : 'pointer',
                opacity: exporting ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'var(--transition-fast)',
              }}
              title="Download standard CSV format"
            >
              <Download size={15} />
              <span>CSV (.csv)</span>
            </button>
          </div>
        </div>

        {/* Banners */}
        {successMsg && (
          <div style={{
            padding: '1rem',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.875rem',
          }}>
            {successMsg}
          </div>
        )}

        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}

        {/* Filter Controls Panel */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '1.25rem' }}>
            Report Filters
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>

            {/* Academic Year Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Academic Year
              </label>
              <select
                id="filter-academic-year"
                value={academicYear}
                onChange={(e) => {
                  setAcademicYear(e.target.value);
                  setDepartment('');
                  setBatchId('');
                  setSectionId('');
                  setAllocationBatchId('');
                }}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-input, #0f172a)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  padding: '0.6rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem',
                }}
              >
                <option value="">All Academic Years</option>
                {filterOptions.academicYears.map((ay) => (
                  <option key={ay} value={ay}>{ay}</option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Department
              </label>
              <select
                id="filter-department"
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setBatchId('');
                  setSectionId('');
                  setAllocationBatchId('');
                }}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-input, #0f172a)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  padding: '0.6rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem',
                }}
              >
                <option value="">All Departments</option>
                {availableDepartments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Section Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Section
              </label>
              <select
                id="filter-section"
                value={sectionId}
                onChange={(e) => {
                  const selectedSecId = e.target.value;
                  setSectionId(selectedSecId);
                  setAllocationBatchId('');
                  const secMatch = availableSections.find((s) => s.id === selectedSecId);
                  if (secMatch) {
                    setBatchId(secMatch.batchId);
                  } else {
                    setBatchId('');
                  }
                }}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-input, #0f172a)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  padding: '0.6rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem',
                }}
              >
                <option value="">All Sections</option>
                {availableSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>Section {sec.name} ({sec.department})</option>
                ))}
              </select>
            </div>

            {/* Allocation Batch Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Allocation Batch
              </label>
              <select
                id="filter-allocation-batch"
                value={allocationBatchId}
                onChange={(e) => setAllocationBatchId(e.target.value)}
                disabled={!sectionId}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-input, #0f172a)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  padding: '0.6rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem',
                  opacity: sectionId ? 1 : 0.5,
                }}
              >
                <option value="">All Allocation Batches</option>
                {availableAllocationBatches.map((ab) => (
                  <option key={ab.id} value={ab.id}>{ab.name}</option>
                ))}
              </select>
            </div>

            {/* Staff Member Filter (Admin only view) */}
            {filterOptions.staff.length > 1 && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Staff Member
                </label>
                <select
                  id="filter-staff"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-input, #0f172a)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="">All Staff Responsibility</option>
                  {filterOptions.staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range Mode Selector */}
            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.75rem' }}>
                📅 Date Range Mode
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
                {[
                  { key: 'all', label: 'All Time (Cumulative)' },
                  { key: 'today', label: 'Today (New Solved)' },
                  { key: 'yesterday', label: 'Yesterday (New Solved)' },
                  { key: 'last_7', label: 'Last 7 Days (Progress)' },
                  { key: 'last_30', label: 'Last 30 Days (Progress)' },
                  { key: 'custom', label: 'Custom Range' },
                ].map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className={datePreset === p.key ? 'btn-primary' : 'btn-secondary'}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
                    onClick={() => handleDatePresetChange(p.key as any)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {datePreset === 'custom' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '450px', marginTop: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>From Date</label>
                    <input
                      id="filter-from-date"
                      type="date"
                      className="form-input"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>To Date</label>
                    <input
                      id="filter-to-date"
                      type="date"
                      className="form-input"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Activity Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Activity Filter
              </label>
              <select
                id="filter-activity"
                value={activityStatus}
                onChange={(e) => setActivityStatus(e.target.value as any)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-input, #0f172a)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  padding: '0.6rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem',
                }}
              >
                <option value="all">All Students</option>
                <option value="active">Active Students Only</option>
                <option value="no_activity">No Activity / Low Progress</option>
              </select>
            </div>

            {/* Sorting Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Sort Leaderboard By
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  id="filter-sort-by"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--bg-input, #0f172a)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="total">Total Problems</option>
                  <option value="easy">Easy Solved</option>
                  <option value="medium">Medium Solved</option>
                  <option value="hard">Hard Solved</option>
                  <option value="register_number">Register Number</option>
                  <option value="name">Student Name</option>
                </select>

                <select
                  id="filter-sort-order"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  style={{
                    width: '180px',
                    backgroundColor: 'var(--bg-input, #0f172a)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="desc">Highest → Lowest (Z-A / Desc)</option>
                  <option value="asc">Lowest → Highest (A-Z / Asc)</option>
                </select>
              </div>
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <button
              id="apply-filters-btn"
              onClick={handleApplyFilters}
              disabled={loading}
              style={{
                padding: '0.65rem 1.5rem',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Filtering...' : 'Apply Filters'}
            </button>
          </div>
        </div>

        {/* Summary Metrics Cards */}
        {reportData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="stats-grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Students</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.25rem' }}>{reportData.summary.totalStudents}</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600, textTransform: 'uppercase' }}>Active Students</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399', marginTop: '0.25rem' }}>{reportData.summary.activeStudentsCount}</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600, textTransform: 'uppercase' }}>No Coding Activity</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f87171', marginTop: '0.25rem' }}>{reportData.summary.noActivityCount}</div>
              </div>

              {/* Period Solved Box (for period filters) */}
              {(fromDate || toDate) && (
                <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.08)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase' }}>
                    ⚡ Period New Solved ({datePreset === 'today' ? 'Today' : datePreset === 'yesterday' ? 'Yesterday' : datePreset === 'last_7' ? 'Last 7 Days' : datePreset === 'last_30' ? 'Last 30 Days' : 'Custom Range'})
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#818cf8', marginTop: '0.25rem' }}>
                    {reportData.summary.totalProblems}
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: '0.35rem' }}>
                    <span style={{ color: '#4ade80' }}>E: {reportData.summary.totalEasy}</span> | <span style={{ color: '#fbbf24' }}>M: {reportData.summary.totalMedium}</span> | <span style={{ color: '#f87171' }}>H: {reportData.summary.totalHard}</span>
                  </div>
                </div>
              )}

              {/* Overall LeetCode Cumulative Box */}
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                  🏆 Overall LeetCode Cumulative
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#60a5fa', marginTop: '0.25rem' }}>
                  {reportData.summary.overallTotalProblems || reportData.summary.totalProblems}
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: '0.35rem' }}>
                  <span style={{ color: '#4ade80' }}>E: {reportData.summary.overallTotalEasy ?? reportData.summary.totalEasy}</span> | <span style={{ color: '#fbbf24' }}>M: {reportData.summary.overallTotalMedium ?? reportData.summary.totalMedium}</span> | <span style={{ color: '#f87171' }}>H: {reportData.summary.overallTotalHard ?? reportData.summary.totalHard}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Student Leaderboard & Coding Report Table */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Student Coding Leaderboard & Report Data ({reportData?.students.length || 0})
              </h3>
              <span style={{ fontSize: '0.8rem', color: (fromDate || toDate) ? '#4ade80' : 'var(--primary)', fontWeight: 600, display: 'inline-block', marginTop: '0.25rem' }}>
                {(fromDate || toDate) ? `⚡ Showing New Solved Progress (${fromDate || 'Start'} to ${toDate || 'Today'})` : '🏆 Showing All-Time Cumulative Totals'}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Click any student row to inspect date-wise daily progress history
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
              Loading report data...
            </div>
          ) : !reportData || reportData.students.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
              No student coding records found for the selected filter scope.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Rank</th>
                    <th style={{ padding: '0.75rem 1rem', cursor: 'pointer' }} onClick={() => handleSortChange('register_number')}>
                      Register Number {sortBy === 'register_number' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                    </th>
                    <th style={{ padding: '0.75rem 1rem', cursor: 'pointer' }} onClick={() => handleSortChange('name')}>
                      Student Name {sortBy === 'name' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                    </th>
                    <th style={{ padding: '0.75rem 1rem' }}>Batch & Section</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Allocation Batch</th>
                    <th style={{ padding: '0.75rem 1rem', cursor: 'pointer' }} onClick={() => handleSortChange('easy')}>
                      Easy {sortBy === 'easy' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                    </th>
                    <th style={{ padding: '0.75rem 1rem', cursor: 'pointer' }} onClick={() => handleSortChange('medium')}>
                      Medium {sortBy === 'medium' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                    </th>
                    <th style={{ padding: '0.75rem 1rem', cursor: 'pointer' }} onClick={() => handleSortChange('hard')}>
                      Hard {sortBy === 'hard' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                    </th>
                    <th style={{ padding: '0.75rem 1rem', cursor: 'pointer' }} onClick={() => handleSortChange('total')}>
                      Total {sortBy === 'total' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                    </th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.students.map((st, index) => (
                    <tr
                      key={st.id}
                      onClick={() => handleOpenStudentModal(st)}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        #{index + 1}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontWeight: 600, color: '#818cf8' }}>
                        {st.register_number}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {st.name}
                        {st.leetcode_username && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                            @{st.leetcode_username}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                        {st.batch.batch_name} ({st.section.name})
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {st.allocation_batch ? st.allocation_batch.name : '-'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#4ade80', fontWeight: 600 }}>{st.easy_solved}</td>
                      <td style={{ padding: '0.85rem 1rem', color: '#fbbf24', fontWeight: 600 }}>{st.medium_solved}</td>
                      <td style={{ padding: '0.85rem 1rem', color: '#f87171', fontWeight: 600 }}>{st.hard_solved}</td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 800, fontSize: '1rem', color: '#60a5fa' }}>{st.total_solved}</td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {st.has_activity ? (
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: 'rgba(52, 211, 153, 0.1)', color: '#34d399' }}>
                            Active
                          </span>
                        ) : (
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: 'rgba(248, 113, 113, 0.1)', color: '#f87171' }}>
                            No Activity
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Generated Reports Audit Log Section */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '1rem' }}>
            Report Export Audit History
          </h3>
          {reportsList.length === 0 ? (
            <div style={{ padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No reports generated yet. Click "Generate & Download Excel Report" above to create an audit record.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.6rem 0.75rem' }}>File Name</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Report Type</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Scope</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Generated Date</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reportsList.map((rep) => (
                    <tr key={rep.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace', color: '#818cf8' }}>{rep.file_name}</td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <span style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: rep.file_name.endsWith('.xlsx') || rep.report_type === 'EXCEL' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                          color: rep.file_name.endsWith('.xlsx') || rep.report_type === 'EXCEL' ? '#34d399' : '#818cf8',
                        }}>
                          {rep.file_name.endsWith('.xlsx') || rep.report_type === 'EXCEL' ? 'EXCEL (.xlsx)' : 'CSV (.csv)'}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)' }}>
                        {rep.batch ? rep.batch.batch_name : 'All Batches'}
                        {rep.section ? ` (${rep.section.name})` : ''}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(rep.generated_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                        <button
                          onClick={() => downloadReportFile(rep.id, rep.file_name)}
                          style={{
                            padding: '0.3rem 0.75rem',
                            backgroundColor: 'var(--bg-input, #0f172a)',
                            color: '#818cf8',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                          title={`Download ${rep.file_name}`}
                        >
                          <Download size={13} />
                          <span>Download</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Student Daily Progress Modal */}
      {selectedStudent && (
        <div className="modal-overlay-responsive">
          <div className="modal-card-responsive" style={{
            backgroundColor: 'var(--bg-card, #1e293b)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            width: '100%',
            maxWidth: '650px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {selectedStudent.name} ({selectedStudent.register_number})
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  LeetCode Handle: <strong style={{ color: '#818cf8' }}>@{selectedStudent.leetcode_username || 'N/A'}</strong> | {selectedStudent.batch.batch_name} ({selectedStudent.section.name})
                </p>
              </div>
              <button
                id="close-student-modal-btn"
                onClick={() => setSelectedStudent(null)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
              >
                ✕
              </button>
            </div>

            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
              Date-wise Daily Coding Snapshot History
            </h4>

            {loadingStudentProgress ? (
              <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading daily snapshots...
              </div>
            ) : dailySnapshots.length === 0 ? (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: '0.875rem',
              }}>
                No DailyCodingSnapshot progress recorded yet for this student.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Date</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Easy</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Medium</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Hard</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailySnapshots.map((snap) => (
                      <tr key={snap.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>
                          {new Date(snap.snapshot_date).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', color: '#4ade80' }}>{snap.easy_solved}</td>
                        <td style={{ padding: '0.65rem 0.75rem', color: '#fbbf24' }}>{snap.medium_solved}</td>
                        <td style={{ padding: '0.65rem 0.75rem', color: '#f87171' }}>{snap.hard_solved}</td>
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 800, color: '#60a5fa' }}>{snap.total_solved}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => setSelectedStudent(null)}
                style={{
                  padding: '0.5rem 1.2rem',
                  backgroundColor: 'var(--bg-input, #0f172a)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
