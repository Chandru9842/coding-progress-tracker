import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, FileSpreadsheet, Download, Trash2, CheckCircle2, AlertCircle, X, Layers, AlertTriangle } from 'lucide-react';
import { Layout } from '../components/Layout.js';
import { GoogleSheetsIntegration } from '../components/GoogleSheetsIntegration.js';
import { SyncErrorsView } from '../components/SyncErrorsView.js';
import {
  getReportFilters,
  getReportData,
  getStudentDailyProgress,
  exportCsvReport,
  exportExcelReport,
  getReportsList,
  downloadReportFile,
  syncReportStudents,
  deleteReportItem,
  bulkDeleteReportItems,
  clearAllReportItems,
  ReportFilterOptions,
  ReportDataResponse,
  StudentReportItem,
  ReportItem,
} from '../api/reports.js';

export type DatePresetType = 'all' | 'today' | 'yesterday' | 'last_7' | 'last_30' | 'this_month' | 'last_month' | 'month' | 'custom';

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTabParam = searchParams.get('tab');
  const activeTab: 'reports' | 'sheets' | 'errors' =
    currentTabParam === 'sheets' ? 'sheets' : currentTabParam === 'errors' ? 'errors' : 'reports';

  const handleTabChange = (tab: 'reports' | 'sheets' | 'errors') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'sheets') {
        next.set('tab', 'sheets');
      } else if (tab === 'errors') {
        next.set('tab', 'errors');
      } else {
        next.delete('tab');
      }
      return next;
    });
  };

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
  const [datePreset, setDatePreset] = useState<DatePresetType>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (3600000 * 5.5));
    const y = ist.getFullYear();
    const m = String(ist.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [autoSyncOnSection, setAutoSyncOnSection] = useState<boolean>(true);

  const extractErrorMessage = (err: any, fallback: string): string => {
    if (!err) return fallback;
    if (typeof err === 'string' && err.trim()) return err;
    if (err.response?.data) {
      const data = err.response.data;
      if (typeof data === 'string' && data.trim()) return data;
      if (typeof data === 'object') {
        if (typeof data.error === 'string' && data.error.trim()) return data.error;
        if (data.error && typeof data.error === 'object') {
          if (typeof data.error.message === 'string' && data.error.message.trim()) {
            return data.error.message;
          }
          if (data.error.code && data.error.message) {
            return `${data.error.code}: ${data.error.message}`;
          }
        }
        if (typeof data.message === 'string' && data.message.trim()) {
          if (data.code) return `${data.code}: ${data.message}`;
          return data.message;
        }
        if (data.code && typeof data.code === 'string') {
          return `Error: ${data.code}`;
        }
      }
    }
    if (typeof err.message === 'string' && err.message.trim()) {
      return err.message;
    }
    return fallback;
  };

  const getISTDateString = (offsetDays: number = 0): string => {
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

  const recentMonthsList = React.useMemo(() => {
    const list: string[] = [];
    const ist = getISTNow();
    for (let i = 0; i < 24; i++) {
      const d = new Date(ist.getFullYear(), ist.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      list.push(`${y}-${m}`);
    }
    return list;
  }, []);

  const fetchWithParams = async (
    overrideFrom?: string | {
      from?: string;
      to?: string;
      preset?: DatePresetType;
      sectionId?: string;
      batchId?: string;
      academicYear?: string;
      department?: string;
      allocationBatchId?: string;
      staffId?: string;
    },
    overrideTo?: string,
    overridePreset?: DatePresetType
  ) => {
    setLoading(true);
    setError(null);
    try {
      let opts: any = {};
      if (typeof overrideFrom === 'object' && overrideFrom !== null) {
        opts = overrideFrom;
      } else {
        opts = { from: overrideFrom, to: overrideTo, preset: overridePreset };
      }

      const activeFrom = opts.from !== undefined ? opts.from : fromDate;
      const activeTo = opts.to !== undefined ? opts.to : toDate;
      const activeSec = opts.sectionId !== undefined ? opts.sectionId : sectionId;
      const activeBatch = opts.batchId !== undefined ? opts.batchId : batchId;
      const activeAY = opts.academicYear !== undefined ? opts.academicYear : academicYear;
      const activeDept = opts.department !== undefined ? opts.department : department;
      const activeAlloc = opts.allocationBatchId !== undefined ? opts.allocationBatchId : allocationBatchId;
      const activeStaff = opts.staffId !== undefined ? opts.staffId : staffId;
      const parsedMin = minProblems.trim() ? parseInt(minProblems.trim(), 10) : undefined;

      const data = await getReportData({
        academicYear: activeAY || undefined,
        department: activeDept || undefined,
        batchId: activeBatch || undefined,
        sectionId: activeSec || undefined,
        allocationBatchId: activeAlloc || undefined,
        staffId: activeStaff || undefined,
        fromDate: activeFrom || undefined,
        toDate: activeTo || undefined,
        sortBy,
        sortOrder,
        activityStatus,
        minProblems: (parsedMin !== undefined && !isNaN(parsedMin)) ? parsedMin : undefined,
      });
      setReportData(data);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load report data'));
    } finally {
      setLoading(false);
    }
  };

  const handleDatePresetChange = (preset: DatePresetType) => {
    setDatePreset(preset);

    if (preset === 'all') {
      setFromDate('');
      setToDate('');
      fetchWithParams('', '', 'all');
    } else if (preset === 'today') {
      const todayStr = getISTDateString(0);
      setFromDate(todayStr);
      setToDate(todayStr);
      // Immediately switch view to today's date boundary
      fetchWithParams({ from: todayStr, to: todayStr, preset: 'today' });
      // Automatically trigger live LeetCode sync for current scope so problems solved since 12:00 AM midnight are fetched live
      handleSyncFilteredLeetCode(undefined, undefined, todayStr, todayStr);
    } else if (preset === 'yesterday') {
      const yestStr = getISTDateString(-1);
      setFromDate(yestStr);
      setToDate(yestStr);
      fetchWithParams({ from: yestStr, to: yestStr, preset: 'yesterday' });
    } else if (preset === 'last_7') {
      const d7Str = getISTDateString(-7);
      const todayStr = getISTDateString(0);
      setFromDate(d7Str);
      setToDate(todayStr);
      fetchWithParams({ from: d7Str, to: todayStr, preset: 'last_7' });
    } else if (preset === 'last_30') {
      const d30Str = getISTDateString(-30);
      const todayStr = getISTDateString(0);
      setFromDate(d30Str);
      setToDate(todayStr);
      fetchWithParams({ from: d30Str, to: todayStr, preset: 'last_30' });
    } else if (preset === 'this_month') {
      const r = getThisMonthRange();
      setFromDate(r.start);
      setToDate(r.end);
      fetchWithParams({ from: r.start, to: r.end, preset: 'this_month' });
    } else if (preset === 'last_month') {
      const r = getLastMonthRange();
      setFromDate(r.start);
      setToDate(r.end);
      fetchWithParams({ from: r.start, to: r.end, preset: 'last_month' });
    } else if (preset === 'month') {
      const ym = selectedMonth || getThisMonthRange().start.slice(0, 7);
      if (!selectedMonth) setSelectedMonth(ym);
      const r = getCustomMonthRange(ym);
      setFromDate(r.start);
      setToDate(r.end);
      fetchWithParams({ from: r.start, to: r.end, preset: 'month' });
    } else if (preset === 'custom') {
      // Keep existing fromDate/toDate or default to today for user customization
      if (!fromDate && !toDate) {
        const todayStr = getISTDateString(0);
        setFromDate(todayStr);
        setToDate(todayStr);
      }
    }
  };

  const handleMonthSelectChange = (ym: string) => {
    setSelectedMonth(ym);
    const r = getCustomMonthRange(ym);
    setFromDate(r.start);
    setToDate(r.end);
    fetchWithParams({ from: r.start, to: r.end, preset: 'month' });
  };
  const [sortBy, setSortBy] = useState<'total' | 'easy' | 'medium' | 'hard' | 'register_number' | 'name' | 'overall_total'>('total');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activityStatus, setActivityStatus] = useState<'all' | 'active' | 'no_activity'>('all');
  const [minProblems, setMinProblems] = useState<string>('');

  const [reportData, setReportData] = useState<ReportDataResponse | null>(null);
  const [reportsList, setReportsList] = useState<ReportItem[]>([]);
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set());
  const [deletingReport, setDeletingReport] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [syncingLeetcode, setSyncingLeetcode] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Report Selection & Deletion Handlers
  const handleToggleSelectReport = (reportId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedReportIds((prev) => {
      const next = new Set(prev);
      if (next.has(reportId)) {
        next.delete(reportId);
      } else {
        next.add(reportId);
      }
      return next;
    });
  };

  const handleToggleSelectAllReports = () => {
    if (selectedReportIds.size === reportsList.length && reportsList.length > 0) {
      setSelectedReportIds(new Set());
    } else {
      setSelectedReportIds(new Set(reportsList.map((r) => r.id)));
    }
  };

  const handleClearReportSelection = () => {
    setSelectedReportIds(new Set());
  };

  const handleDeleteSingleReport = async (rep: ReportItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Delete report audit entry "${rep.file_name}"?`)) return;
    try {
      setDeletingReport(true);
      setError(null);
      await deleteReportItem(rep.id);
      setReportsList((prev) => prev.filter((r) => r.id !== rep.id));
      setSelectedReportIds((prev) => {
        const next = new Set(prev);
        next.delete(rep.id);
        return next;
      });
      setSuccessMsg(`Deleted "${rep.file_name}" from audit history.`);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to delete report audit entry'));
    } finally {
      setDeletingReport(false);
    }
  };

  const handleBulkDeleteReports = async () => {
    if (selectedReportIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedReportIds.size} selected report audit record(s)?`)) return;
    try {
      setDeletingReport(true);
      setError(null);
      const toDelete = Array.from(selectedReportIds);
      await bulkDeleteReportItems(toDelete);
      setReportsList((prev) => prev.filter((r) => !selectedReportIds.has(r.id)));
      setSelectedReportIds(new Set());
      setSuccessMsg(`Successfully deleted ${toDelete.length} report audit record(s).`);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to bulk delete reports'));
    } finally {
      setDeletingReport(false);
    }
  };

  const handleClearAllReports = async () => {
    if (reportsList.length === 0) return;
    if (!window.confirm(`⚠️ Clear all ${reportsList.length} report export audit records from history?`)) return;
    try {
      setDeletingReport(true);
      setError(null);
      await clearAllReportItems();
      setReportsList([]);
      setSelectedReportIds(new Set());
      setSuccessMsg('All report export audit history cleared.');
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to clear report history'));
    } finally {
      setDeletingReport(false);
    }
  };

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
      setError(extractErrorMessage(err, 'Failed to load reports data'));
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
      const parsedMin = minProblems.trim() ? parseInt(minProblems.trim(), 10) : undefined;
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
        minProblems: (parsedMin !== undefined && !isNaN(parsedMin)) ? parsedMin : undefined,
      });
      setReportData(data);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to apply report filters'));
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFilteredLeetCode = async (
    overrideSecId?: string | React.MouseEvent,
    overrideBatchId?: string,
    overrideFromDate?: string,
    overrideToDate?: string
  ) => {
    setSyncingLeetcode(true);
    setSuccessMsg(null);
    setError(null);
    const targetSecId = typeof overrideSecId === 'string' ? overrideSecId : sectionId;
    const targetBatchId = typeof overrideBatchId === 'string' ? overrideBatchId : batchId;
    const activeFrom = overrideFromDate !== undefined ? overrideFromDate : fromDate;
    const activeTo = overrideToDate !== undefined ? overrideToDate : toDate;
    const startTime = Date.now();
    try {
      const res = await syncReportStudents({
        batchId: targetBatchId || undefined,
        sectionId: targetSecId || undefined,
        department: department || undefined,
        allocationBatchId: allocationBatchId || undefined,
        staffId: staffId || undefined,
      });

      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      setSuccessMsg(
        res.message
          ? `${res.message} (completed in ${res.durationSeconds || elapsedSec}s)`
          : `⚡ Live LeetCode sync completed for ${res.successful || 0} student(s) in ${elapsedSec}s. Solves submitted after 12:00 AM midnight are now updated live.`
      );

      const parsedMin = minProblems.trim() ? parseInt(minProblems.trim(), 10) : undefined;
      const refreshedData = await getReportData({
        academicYear: academicYear || undefined,
        department: department || undefined,
        batchId: targetBatchId || undefined,
        sectionId: targetSecId || undefined,
        allocationBatchId: allocationBatchId || undefined,
        staffId: staffId || undefined,
        fromDate: activeFrom || undefined,
        toDate: activeTo || undefined,
        sortBy,
        sortOrder,
        activityStatus,
        minProblems: (parsedMin !== undefined && !isNaN(parsedMin)) ? parsedMin : undefined,
      });
      setReportData(refreshedData);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to sync LeetCode data for filtered students'));
    } finally {
      setSyncingLeetcode(false);
    }
  };

  const handleSortChange = (newSortBy: 'total' | 'easy' | 'medium' | 'hard' | 'register_number' | 'name' | 'overall_total') => {
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
        if (newSortBy === 'overall_total') {
          const valA = a.overall_total ?? 0;
          const valB = b.overall_total ?? 0;
          if (valA !== valB) {
            return newOrder === 'asc' ? valA - valB : valB - valA;
          }
          return a.register_number.localeCompare(b.register_number, undefined, { numeric: true });
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
      const parsedMin = minProblems.trim() ? parseInt(minProblems.trim(), 10) : undefined;
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
        minProblems: (parsedMin !== undefined && !isNaN(parsedMin)) ? parsedMin : undefined,
      });
      setSuccessMsg(`📊 Excel report exported successfully with auto-fitted columns as ${res.fileName}`);
      const updatedList = await getReportsList();
      setReportsList(updatedList);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to export Excel report'));
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    setSuccessMsg(null);
    setError(null);
    try {
      const parsedMin = minProblems.trim() ? parseInt(minProblems.trim(), 10) : undefined;
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
        minProblems: (parsedMin !== undefined && !isNaN(parsedMin)) ? parsedMin : undefined,
      });
      setSuccessMsg(`📄 CSV report exported successfully as ${res.fileName}`);
      const updatedList = await getReportsList();
      setReportsList(updatedList);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to export CSV report'));
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
    <Layout title="Reports & Sync">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Top-Level Tab Switcher: Reports & Exports vs Google Sheets Integration */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '0.75rem',
          flexWrap: 'wrap',
        }}>
          <button
            id="tab-reports-exports"
            type="button"
            onClick={() => handleTabChange('reports')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              backgroundColor: activeTab === 'reports' ? 'var(--primary, #4f46e5)' : 'rgba(255, 255, 255, 0.04)',
              color: activeTab === 'reports' ? '#ffffff' : 'var(--text-secondary)',
              border: `1px solid ${activeTab === 'reports' ? 'var(--primary, #4f46e5)' : 'var(--border-subtle)'}`,
            }}
          >
            <Layers size={16} />
            <span>Reports & Exports</span>
          </button>

          <button
            id="tab-google-sheets-integration"
            type="button"
            onClick={() => handleTabChange('sheets')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              backgroundColor: activeTab === 'sheets' ? '#10b981' : 'rgba(255, 255, 255, 0.04)',
              color: activeTab === 'sheets' ? '#ffffff' : 'var(--text-secondary)',
              border: `1px solid ${activeTab === 'sheets' ? '#10b981' : 'var(--border-subtle)'}`,
            }}
          >
            <FileSpreadsheet size={16} style={{ color: activeTab === 'sheets' ? '#ffffff' : '#10b981' }} />
            <span>Google Sheets Integration</span>
            <span style={{
              fontSize: '0.7rem',
              padding: '0.15rem 0.45rem',
              borderRadius: '9999px',
              backgroundColor: activeTab === 'sheets' ? 'rgba(0, 0, 0, 0.25)' : 'rgba(16, 185, 129, 0.2)',
              color: activeTab === 'sheets' ? '#ffffff' : '#34d399',
              fontWeight: 700,
            }}>
              Zero-Error
            </span>
          </button>

          <button
            id="tab-sync-errors"
            type="button"
            onClick={() => handleTabChange('errors')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              backgroundColor: activeTab === 'errors' ? '#ef4444' : 'rgba(255, 255, 255, 0.04)',
              color: activeTab === 'errors' ? '#ffffff' : 'var(--text-secondary)',
              border: `1px solid ${activeTab === 'errors' ? '#ef4444' : 'var(--border-subtle)'}`,
            }}
          >
            <AlertTriangle size={16} style={{ color: activeTab === 'errors' ? '#ffffff' : '#f87171' }} />
            <span>Sync Errors</span>
          </button>
        </div>

        {activeTab === 'sheets' ? (
          <GoogleSheetsIntegration />
        ) : activeTab === 'errors' ? (
          <SyncErrorsView />
        ) : (
          <>
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
              title="Recommended: Downloads formatted Microsoft Excel (.xlsx) file with pre-sized wide columns and navy headers"
            >
              <FileSpreadsheet size={16} />
              <span>{exporting ? 'Exporting...' : '📊 Generate & Download Excel Report (.xlsx)'}</span>
            </button>

            <button
              id="export-csv-btn"
              onClick={handleExportCsv}
              disabled={exporting}
              style={{
                padding: '0.65rem 0.9rem',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-secondary, #94a3b8)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 500,
                fontSize: '0.825rem',
                cursor: exporting ? 'not-allowed' : 'pointer',
                opacity: exporting ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'var(--transition-fast)',
              }}
              title="Raw Plain Text (.csv). Note: CSV files cannot store column width formatting"
            >
              <Download size={14} />
              <span>Plain CSV (.csv)</span>
            </button>
          </div>
        </div>

        {/* Banners */}
        {successMsg && (
          <div style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>{typeof successMsg === 'string' ? successMsg : (successMsg as any)?.message || String(successMsg)}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#34d399',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '1rem',
                padding: '0.2rem 0.5rem',
                lineHeight: 1,
              }}
              title="Dismiss message"
            >
              ✕
            </button>
          </div>
        )}

        {error && (
          <div style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{typeof error === 'string' ? error : (error as any)?.message || String(error)}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#f87171',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '1rem',
                padding: '0.2rem 0.5rem',
                lineHeight: 1,
              }}
              title="Dismiss error"
            >
              ✕
            </button>
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
                  const v = e.target.value;
                  setAcademicYear(v);
                  setDepartment('');
                  setBatchId('');
                  setSectionId('');
                  setAllocationBatchId('');
                  fetchWithParams({ academicYear: v, department: '', batchId: '', sectionId: '', allocationBatchId: '' });
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
                  const v = e.target.value;
                  setDepartment(v);
                  setBatchId('');
                  setSectionId('');
                  setAllocationBatchId('');
                  fetchWithParams({ department: v, batchId: '', sectionId: '', allocationBatchId: '' });
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
                  const targetBatchId = secMatch ? secMatch.batchId : '';
                  setBatchId(targetBatchId);
                  fetchWithParams({ sectionId: selectedSecId, batchId: targetBatchId, allocationBatchId: '' });
                  if (selectedSecId && autoSyncOnSection) {
                    handleSyncFilteredLeetCode(selectedSecId, targetBatchId);
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

              <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.725rem', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={autoSyncOnSection}
                    onChange={(e) => setAutoSyncOnSection(e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: '#34d399' }}
                  />
                  <span>Auto-fetch live LeetCode on section select</span>
                </label>

                {sectionId && (
                  <button
                    type="button"
                    onClick={() => handleSyncFilteredLeetCode(sectionId, batchId)}
                    disabled={syncingLeetcode}
                    style={{
                      width: '100%',
                      padding: '0.38rem 0.65rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: 'rgba(52, 211, 153, 0.15)',
                      color: '#34d399',
                      border: '1px solid rgba(52, 211, 153, 0.4)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      cursor: syncingLeetcode ? 'not-allowed' : 'pointer',
                    }}
                    title="Fetch live LeetCode stats for this section right now (picks up solves submitted after 12:00 AM midnight)"
                  >
                    <RefreshCw size={12} className={syncingLeetcode ? 'spin' : ''} />
                    <span>{syncingLeetcode ? 'Fetching Live Solves...' : '⚡ Sync Section LeetCode (12 AM+ Solves)'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Allocation Batch Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Allocation Batch
              </label>
              <select
                id="filter-allocation-batch"
                value={allocationBatchId}
                onChange={(e) => {
                  const v = e.target.value;
                  setAllocationBatchId(v);
                  fetchWithParams({ allocationBatchId: v });
                }}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)' }}>
                  📅 Date Range Filter Mode
                </label>
                {datePreset === 'today' && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34d399', display: 'inline-block' }}></span>
                    Auto Live Sync: Solves since 12:00 AM midnight active
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
                {[
                  { key: 'all', label: '🌐 All Time (Cumulative)' },
                  { key: 'today', label: '⚡ Today (12:00 AM – Till Now Live)' },
                  { key: 'yesterday', label: '⏪ Yesterday (Yesterday Only)' },
                  { key: 'last_7', label: '📅 Last 7 Days (Past 7 Days Only)' },
                  { key: 'last_30', label: '🗓️ Last 30 Days (Past 30 Days Only)' },
                  { key: 'this_month', label: '🗓️ This Month (Current Month)' },
                  { key: 'last_month', label: '⏪ Last Month (Previous Month)' },
                  { key: 'month', label: '📅 Select Month' },
                  { key: 'custom', label: '🔍 Custom Range (Between Dates)' },
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

              {/* Informative helper banner for active date mode */}
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.45rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginBottom: '0.5rem',
              }}>
                {datePreset === 'today' && (
                  <span>⚡ <strong>Today Preset:</strong> Shows problems students solved starting from 12:00 AM midnight till now, alongside their overall cumulative total. Live LeetCode sync is triggered immediately on selection.</span>
                )}
                {datePreset === 'yesterday' && (
                  <span>⏪ <strong>Yesterday Preset:</strong> Isolates strictly yesterday's solves (problems submitted from yesterday's 12:00 AM to 11:59 PM), alongside overall cumulative total.</span>
                )}
                {datePreset === 'last_7' && (
                  <span>📅 <strong>Last 7 Days Preset:</strong> Shows problems solved during the past 7 calendar days only, alongside overall cumulative total.</span>
                )}
                {datePreset === 'last_30' && (
                  <span>🗓️ <strong>Last 30 Days Preset:</strong> Shows problems solved during the past 30 calendar days only, alongside overall cumulative total.</span>
                )}
                {datePreset === 'this_month' && (
                  <span>🗓️ <strong>This Month Preset:</strong> Shows problems students solved starting from the 1st of the current month ({getThisMonthRange().start}) through today, alongside overall cumulative total.</span>
                )}
                {datePreset === 'last_month' && (
                  <span>⏪ <strong>Last Month Preset:</strong> Shows problems solved during the previous calendar month ({getLastMonthRange().start} to {getLastMonthRange().end}), alongside overall cumulative total.</span>
                )}
                {datePreset === 'month' && (
                  <span>📅 <strong>Select Month:</strong> Shows problems solved during {formatMonthLabel(selectedMonth)} ({getCustomMonthRange(selectedMonth).start} to {getCustomMonthRange(selectedMonth).end}), alongside overall cumulative total.</span>
                )}
                {datePreset === 'custom' && (
                  <span>🔍 <strong>Custom Range:</strong> Enter start date and end date below to isolate problems solved strictly between those dates, alongside overall cumulative total.</span>
                )}
                {datePreset === 'all' && (
                  <span>🌐 <strong>All Time:</strong> Displays cumulative all-time problems solved on LeetCode for each student.</span>
                )}
              </div>

              {/* Month Picker for 'month' Preset */}
              {datePreset === 'month' && (
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Historical Month:</label>
                    <select
                      id="filter-month-select"
                      value={selectedMonth}
                      onChange={(e) => handleMonthSelectChange(e.target.value)}
                      style={{
                        backgroundColor: 'var(--bg-input, #0f172a)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-main)',
                        padding: '0.45rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                      }}
                    >
                      {recentMonthsList.map((ym) => (
                        <option key={ym} value={ym}>
                          {formatMonthLabel(ym)} ({ym})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Or pick specific month:</label>
                    <input
                      type="month"
                      className="form-input"
                      value={selectedMonth}
                      onChange={(e) => handleMonthSelectChange(e.target.value)}
                      style={{ fontSize: '0.85rem', padding: '0.35rem 0.6rem' }}
                    />
                  </div>
                </div>
              )}

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

            {/* Minimum Problems Solved Filter */}
            <div>
              <label htmlFor="filter-min-problems" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Min Problems Solved
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  id="filter-min-problems"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 2 (solved ≥ 2)"
                  value={minProblems}
                  onChange={(e) => setMinProblems(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-input, #0f172a)',
                    border: minProblems ? '1px solid #3b82f6' : '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.875rem',
                  }}
                />
                {minProblems && (
                  <button
                    type="button"
                    onClick={() => setMinProblems('')}
                    style={{
                      position: 'absolute',
                      right: '0.5rem',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '0.2rem',
                    }}
                    title="Clear filter"
                  >
                    ✕
                  </button>
                )}
              </div>
              <span style={{ display: 'block', fontSize: '0.7rem', color: minProblems ? '#60a5fa' : 'var(--text-muted)', marginTop: '0.25rem' }}>
                {minProblems ? `Filter: Students who solved ≥ ${minProblems}` : 'e.g. enter 2 to show students with 2+ solved'}
              </span>
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
                  onChange={(e) => handleSortChange(e.target.value as any)}
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
                  <option value="total">{(fromDate || toDate) ? 'Period Solved (New Solved in Range)' : 'Total Solved (Cumulative)'}</option>
                  {(fromDate || toDate) && (
                    <option value="overall_total">Overall Total (Till Now Cumulative)</option>
                  )}
                  <option value="easy">{(fromDate || toDate) ? 'Period Easy Solved' : 'Easy Solved'}</option>
                  <option value="medium">{(fromDate || toDate) ? 'Period Medium Solved' : 'Medium Solved'}</option>
                  <option value="hard">{(fromDate || toDate) ? 'Period Hard Solved' : 'Hard Solved'}</option>
                  <option value="register_number">Register Number</option>
                  <option value="name">Student Name</option>
                </select>

                <select
                  id="filter-sort-order"
                  value={sortOrder}
                  onChange={(e) => {
                    const newOrder = e.target.value as 'asc' | 'desc';
                    setSortOrder(newOrder);
                    if (reportData) {
                      const sorted = [...reportData.students].sort((a, b) => {
                        if (sortBy === 'register_number') {
                          const cmp = a.register_number.localeCompare(b.register_number, undefined, { numeric: true });
                          return newOrder === 'asc' ? cmp : -cmp;
                        }
                        if (sortBy === 'name') {
                          const cmp = a.name.localeCompare(b.name);
                          return newOrder === 'asc' ? cmp : -cmp;
                        }
                        if (sortBy === 'overall_total') {
                          const valA = a.overall_total ?? 0;
                          const valB = b.overall_total ?? 0;
                          if (valA !== valB) {
                            return newOrder === 'asc' ? valA - valB : valB - valA;
                          }
                          return a.register_number.localeCompare(b.register_number, undefined, { numeric: true });
                        }
                        const valA = a[`${sortBy}_solved` as keyof StudentReportItem] as number;
                        const valB = b[`${sortBy}_solved` as keyof StudentReportItem] as number;
                        if (valA !== valB) {
                          return newOrder === 'asc' ? valA - valB : valB - valA;
                        }
                        return a.register_number.localeCompare(b.register_number, undefined, { numeric: true });
                      });
                      setReportData({ ...reportData, students: sorted });
                    }
                  }}
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              id="reset-filters-btn"
              type="button"
              onClick={() => {
                setAcademicYear('');
                setDepartment('');
                setBatchId('');
                setSectionId('');
                setAllocationBatchId('');
                setStaffId('');
                setFromDate('');
                setToDate('');
                setDatePreset('all');
                setActivityStatus('all');
                setMinProblems('');
                setSortBy('total');
                setSortOrder('desc');
              }}
              style={{
                padding: '0.65rem 1.25rem',
                backgroundColor: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
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

              {/* Minimum Problems Filter Active Box */}
              {minProblems && (
                <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase' }}>
                    🎯 Solved ≥ {minProblems} Problems
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#60a5fa', marginTop: '0.25rem' }}>
                    {reportData.students.length}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    Matching Students
                  </div>
                </div>
              )}
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
          {syncingLeetcode && (
            <div style={{
              backgroundColor: 'rgba(52, 211, 153, 0.12)',
              border: '1px solid rgba(52, 211, 153, 0.35)',
              borderRadius: '8px',
              padding: '0.65rem 1rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              color: '#34d399',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}>
              <RefreshCw size={16} className="spin" />
              <span>⚡ Fetching live LeetCode submissions for section (capturing all problems solved past 12:00 AM midnight)...</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Student Coding Leaderboard & Report Data ({reportData?.students.length || 0})
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                <span style={{
                  fontSize: '0.825rem',
                  color: datePreset === 'today' ? '#34d399' : datePreset === 'yesterday' ? '#60a5fa' : (fromDate || toDate) ? '#4ade80' : 'var(--primary)',
                  fontWeight: 600,
                  backgroundColor: datePreset === 'today' ? 'rgba(52, 211, 153, 0.12)' : datePreset === 'yesterday' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                  padding: (datePreset === 'today' || datePreset === 'yesterday') ? '0.2rem 0.6rem' : '0',
                  borderRadius: '4px',
                  border: (datePreset === 'today' || datePreset === 'yesterday') ? '1px solid currentColor' : 'none',
                }}>
                  {datePreset === 'today'
                    ? `⚡ Showing Progress Solved Today (${fromDate || getISTDateString(0)}) since 12:00 AM midnight`
                    : datePreset === 'yesterday'
                    ? `⚡ Showing Progress Solved Yesterday (${fromDate || getISTDateString(-1)})`
                    : datePreset === 'last_7'
                    ? `⚡ Showing Progress in Last 7 Days (${fromDate} to ${toDate})`
                    : datePreset === 'last_30'
                    ? `⚡ Showing Progress in Last 30 Days (${fromDate} to ${toDate})`
                    : (fromDate || toDate)
                    ? `⚡ Showing Progress in Custom Range (${fromDate || 'Start'} to ${toDate || 'Today'})`
                    : '🏆 Showing All-Time Cumulative Totals'}
                </span>
                {minProblems && (
                  <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                    🎯 Min Solved: ≥ {minProblems}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleSyncFilteredLeetCode}
                disabled={syncingLeetcode}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(52, 211, 153, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(52, 211, 153, 0.35)',
                  borderRadius: '6px',
                  cursor: syncingLeetcode ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
                title="Query LeetCode right now for any newly solved problems (e.g. past 12:00 AM midnight)"
              >
                <RefreshCw size={13} className={syncingLeetcode ? 'spin' : ''} />
                <span>{syncingLeetcode ? 'Syncing Live LeetCode (12 AM–Now)...' : '⚡ Sync Live LeetCode (12 AM–Now)'}</span>
              </button>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Click row for daily history
              </div>
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
                      {datePreset === 'today' ? "Today's Easy" : datePreset === 'yesterday' ? "Yesterday's Easy" : (fromDate || toDate) ? 'Period Easy' : 'Easy'} {sortBy === 'easy' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                    </th>
                    <th style={{ padding: '0.75rem 1rem', cursor: 'pointer' }} onClick={() => handleSortChange('medium')}>
                      {datePreset === 'today' ? "Today's Med" : datePreset === 'yesterday' ? "Yesterday's Med" : (fromDate || toDate) ? 'Period Med' : 'Medium'} {sortBy === 'medium' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                    </th>
                    <th style={{ padding: '0.75rem 1rem', cursor: 'pointer' }} onClick={() => handleSortChange('hard')}>
                      {datePreset === 'today' ? "Today's Hard" : datePreset === 'yesterday' ? "Yesterday's Hard" : (fromDate || toDate) ? 'Period Hard' : 'Hard'} {sortBy === 'hard' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                    </th>
                    <th style={{ padding: '0.75rem 1rem', cursor: 'pointer' }} onClick={() => handleSortChange('total')}>
                      {datePreset === 'today'
                        ? "Today's Solved (12 AM–Now Live)"
                        : datePreset === 'yesterday'
                        ? "Yesterday's Solved (Yesterday Only)"
                        : datePreset === 'last_7'
                        ? "Last 7 Days Solved"
                        : datePreset === 'last_30'
                        ? "Last 30 Days Solved"
                        : (fromDate || toDate)
                        ? 'Period Solved'
                        : 'Total Solved'}{' '}
                      {sortBy === 'total' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                    </th>
                    {(fromDate || toDate) && (
                      <th
                        style={{ padding: '0.75rem 1rem', cursor: 'pointer', color: '#60a5fa' }}
                        onClick={() => handleSortChange('overall_total')}
                        title="Cumulative total problems solved on LeetCode till now"
                      >
                        Overall Total (Till Now) {sortBy === 'overall_total' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                      </th>
                    )}
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
                      <td style={{ padding: '0.85rem 1rem', color: '#4ade80', fontWeight: 600 }}>
                        {(fromDate || toDate) && st.easy_solved > 0 ? `+${st.easy_solved}` : st.easy_solved}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#fbbf24', fontWeight: 600 }}>
                        {(fromDate || toDate) && st.medium_solved > 0 ? `+${st.medium_solved}` : st.medium_solved}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#f87171', fontWeight: 600 }}>
                        {(fromDate || toDate) && st.hard_solved > 0 ? `+${st.hard_solved}` : st.hard_solved}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {(fromDate || toDate) ? (
                          <div>
                            <span style={{
                              display: 'inline-block',
                              padding: '0.22rem 0.6rem',
                              borderRadius: '6px',
                              fontSize: '0.9rem',
                              fontWeight: 800,
                              backgroundColor: st.total_solved > 0 ? 'rgba(52, 211, 153, 0.18)' : 'rgba(148, 163, 184, 0.1)',
                              color: st.total_solved > 0 ? '#34d399' : '#94a3b8',
                              border: st.total_solved > 0 ? '1px solid rgba(52, 211, 153, 0.35)' : '1px solid rgba(148, 163, 184, 0.2)',
                            }}>
                              {st.total_solved > 0 ? `+${st.total_solved}` : '0'}
                            </span>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                              {datePreset === 'today'
                                ? '12:00 AM – Now'
                                : datePreset === 'yesterday'
                                ? 'Yesterday only'
                                : datePreset === 'last_7'
                                ? 'Past 7 days'
                                : datePreset === 'last_30'
                                ? 'Past 30 days'
                                : 'Period delta'}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#60a5fa' }}>
                            {st.total_solved}
                          </span>
                        )}
                      </td>
                      {(fromDate || toDate) && (
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.22rem 0.6rem',
                            borderRadius: '6px',
                            fontSize: '0.95rem',
                            fontWeight: 800,
                            backgroundColor: 'rgba(96, 165, 250, 0.12)',
                            color: '#60a5fa',
                            border: '1px solid rgba(96, 165, 250, 0.28)',
                          }}>
                            {st.overall_total}
                          </span>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Cumulative till now
                          </div>
                        </td>
                      )}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
              Report Export Audit History
            </h3>
            {reportsList.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllReports}
                disabled={deletingReport}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                title="Clear all export records"
              >
                <Trash2 size={13} />
                <span>Clear All History</span>
              </button>
            )}
          </div>

          {/* Bulk Action Controls Bar for Reports */}
          {selectedReportIds.size > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                <span style={{ fontSize: '0.875rem' }}>
                  Selected: <strong style={{ color: 'var(--primary)' }}>{selectedReportIds.size}</strong> of {reportsList.length} Report(s)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleClearReportSelection}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                >
                  Clear Selection
                </button>

                <button
                  type="button"
                  onClick={handleBulkDeleteReports}
                  disabled={deletingReport}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.35rem 0.75rem',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={13} />
                  <span>Delete Selected ({selectedReportIds.size})</span>
                </button>
              </div>
            </div>
          )}

          {reportsList.length === 0 ? (
            <div style={{ padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No reports generated yet. Click "Generate & Download Excel Report" above to create an audit record.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.6rem 0.75rem', width: '36px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={reportsList.length > 0 && selectedReportIds.size === reportsList.length}
                        onChange={handleToggleSelectAllReports}
                        style={{ cursor: 'pointer' }}
                        title="Select All Reports"
                      />
                    </th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>File Name</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Report Type</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Scope</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Generated Date</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reportsList.map((rep) => {
                    const isSelected = selectedReportIds.has(rep.id);
                    return (
                      <tr
                        key={rep.id}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleToggleSelectReport(rep.id, e as any)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
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
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                            <button
                              onClick={() => downloadReportFile(rep.id, rep.file_name)}
                              style={{
                                padding: '0.3rem 0.65rem',
                                backgroundColor: 'var(--bg-input, #0f172a)',
                                color: '#818cf8',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                              }}
                              title={`Download ${rep.file_name}`}
                            >
                              <Download size={13} />
                              <span>Download</span>
                            </button>
                            <button
                              onClick={(e) => handleDeleteSingleReport(rep, e)}
                              disabled={deletingReport}
                              style={{
                                padding: '0.3rem 0.5rem',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                              title={`Delete ${rep.file_name} from history`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

          </>
        )}
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
              {(fromDate || toDate) && (
                <span style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 500, marginLeft: '0.5rem' }}>
                  ({datePreset === 'this_month' ? 'This Month' : datePreset === 'last_month' ? 'Last Month' : datePreset === 'month' ? formatMonthLabel(selectedMonth) : `${fromDate || 'Start'} to ${toDate || 'Today'}`})
                </span>
              )}
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
                      <th style={{ padding: '0.6rem 0.75rem' }}>Date (IST)</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Day's Solved</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Day's Breakdown</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Cumul. Easy</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Cumul. Med</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Cumul. Hard</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Total Solved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailySnapshots.map((snap, idx) => {
                      const prevSnap = dailySnapshots[idx + 1];
                      const dailyTotal = typeof snap.daily_solved === 'number'
                        ? snap.daily_solved
                        : (prevSnap ? Math.max(0, snap.total_solved - prevSnap.total_solved) : 0);
                      const dailyEasy = typeof snap.daily_easy === 'number'
                        ? snap.daily_easy
                        : (prevSnap ? Math.max(0, snap.easy_solved - prevSnap.easy_solved) : 0);
                      const dailyMed = typeof snap.daily_medium === 'number'
                        ? snap.daily_medium
                        : (prevSnap ? Math.max(0, snap.medium_solved - prevSnap.medium_solved) : 0);
                      const dailyHrd = typeof snap.daily_hard === 'number'
                        ? snap.daily_hard
                        : (prevSnap ? Math.max(0, snap.hard_solved - prevSnap.hard_solved) : 0);

                      const dateDisplay = typeof snap.snapshot_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(snap.snapshot_date)
                        ? snap.snapshot_date
                        : (() => {
                            const d = new Date(snap.snapshot_date);
                            return isNaN(d.getTime())
                              ? String(snap.snapshot_date)
                              : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
                          })();

                      return (
                        <tr key={snap.id || idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>
                            {dateDisplay}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              backgroundColor: dailyTotal > 0 ? 'rgba(52, 211, 153, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                              color: dailyTotal > 0 ? '#34d399' : '#94a3b8',
                              border: dailyTotal > 0 ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid rgba(148, 163, 184, 0.2)',
                            }}>
                              {dailyTotal > 0 ? `+${dailyTotal}` : '0'}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            <span style={{ color: '#4ade80', fontWeight: dailyEasy > 0 ? 700 : 400 }}>+{dailyEasy} E</span> &bull;{' '}
                            <span style={{ color: '#fbbf24', fontWeight: dailyMed > 0 ? 700 : 400 }}>+{dailyMed} M</span> &bull;{' '}
                            <span style={{ color: '#f87171', fontWeight: dailyHrd > 0 ? 700 : 400 }}>+{dailyHrd} H</span>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', color: '#4ade80' }}>{snap.easy_solved}</td>
                          <td style={{ padding: '0.65rem 0.75rem', color: '#fbbf24' }}>{snap.medium_solved}</td>
                          <td style={{ padding: '0.65rem 0.75rem', color: '#f87171' }}>{snap.hard_solved}</td>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 800, color: '#60a5fa' }}>{snap.total_solved}</td>
                        </tr>
                      );
                    })}
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
