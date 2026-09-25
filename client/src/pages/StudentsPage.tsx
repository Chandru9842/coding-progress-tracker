import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout.js';
import { useAuth } from '../context/AuthContext.js';
import { studentApi, batchApi, staffApi, syncApi, Student, Batch, StaffUser, extractErrorMessage, getCachedData, clearClientCache, notifySyncStarted, notifySyncEnded } from '../services/api.js';
import { syncReportStudents } from '../api/reports.js';
import { autoSyncService } from '../services/autoSyncService.js';
import {
  Users,
  UserPlus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  Filter,
  RefreshCw,
  X,
  CheckCircle2,
  UserCheck,
  ShieldAlert,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sliders,
  Settings2,
  Clock,
  Hourglass,
} from 'lucide-react';
import { SyncStatus } from '../components/SyncStatus.js';
import { InteractiveLoader } from '../components/InteractiveLoader.js';
import {
  analyzeAndParseStudents,
  downloadSampleCSVFile,
  downloadSampleExcelFile,
  ParsedImportRow,
  ParseResult,
  AvailableColumn,
  ActiveColumnMapping,
  ColumnMappingConfig,
} from '../utils/studentImportUtils.js';
import * as XLSX from 'xlsx';

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}s`;
}

function formatStudyYear(currentYear?: string | null, batchName?: string | null, startYear?: number | null): string {
  if (currentYear) {
    const trimmed = currentYear.trim();
    if (/^[1-4]$/.test(trimmed)) {
      return `Year ${trimmed}`;
    }
    if (/^(1st|2nd|3rd|4th)\s*year$/i.test(trimmed)) {
      const numMatch = trimmed.match(/^(1|2|3|4)/);
      if (numMatch) return `Year ${numMatch[1]}`;
      return trimmed;
    }
    if (/^(I|II|III|IV)$/i.test(trimmed)) {
      const map: Record<string, string> = { I: 'Year 1', II: 'Year 2', III: 'Year 3', IV: 'Year 4' };
      return map[trimmed.toUpperCase()] || `Year ${trimmed}`;
    }
    return trimmed;
  }

  let effectiveStartYear = startYear;
  if (!effectiveStartYear && batchName) {
    const match = batchName.match(/^(20\d\d)/);
    if (match) {
      effectiveStartYear = parseInt(match[1], 10);
    }
  }

  if (effectiveStartYear) {
    const currentCalYear = new Date().getFullYear();
    const diff = currentCalYear - effectiveStartYear + 1;
    if (diff >= 1 && diff <= 4) {
      return `Year ${diff}`;
    }
  }
  return '-';
}

function findMatchingStaff(rawMentorName: string, staffList: StaffUser[]): StaffUser | null {
  if (!rawMentorName || rawMentorName === 'Unassigned' || staffList.length === 0) return null;
  const rawClean = rawMentorName.trim().toLowerCase();
  const normInput = rawClean.replace(/^(dr|mr|mrs|ms|prof|er)\.?\s*/i, '').replace(/[^a-z0-9]/g, '');
  const tokens = rawClean
    .replace(/^(dr|mr|mrs|ms|prof|er)\.?\s*/i, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0 && !['dr', 'mr', 'mrs', 'ms', 'prof', 'er'].includes(t));

  // 1. Exact case-insensitive match
  const direct = staffList.find((s) => s.name.trim().toLowerCase() === rawClean);
  if (direct) return direct;

  // 2. Normalized match without title & punctuation
  const normMatch = staffList.find((s) => {
    const sNorm = s.name.toLowerCase().replace(/^(dr|mr|mrs|ms|prof|er)\.?\s*/i, '').replace(/[^a-z0-9]/g, '');
    return sNorm === normInput;
  });
  if (normMatch) return normMatch;

  // 3. Substring match
  if (normInput.length >= 4) {
    const subMatch = staffList.find((s) => {
      const sNorm = s.name.toLowerCase().replace(/^(dr|mr|mrs|ms|prof|er)\.?\s*/i, '').replace(/[^a-z0-9]/g, '');
      return sNorm.length >= 4 && (sNorm.includes(normInput) || normInput.includes(sNorm));
    });
    if (subMatch) return subMatch;
  }

  // 4. Token-based matching (handles Dr. A. Muthuraj -> Muthuraj / A. Muthuraj)
  let bestScore = 0;
  let bestStaff: StaffUser | null = null;
  for (const stf of staffList) {
    const sTokens = stf.name
      .toLowerCase()
      .replace(/^(dr|mr|mrs|ms|prof|er)\.?\s*/i, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0 && !['dr', 'mr', 'mrs', 'ms', 'prof', 'er'].includes(t));

    let score = 0;
    for (const t of tokens) {
      if (t.length >= 3 && sTokens.some((st) => st.includes(t) || t.includes(st))) {
        score += 2;
      } else if (t.length < 3 && sTokens.includes(t)) {
        score += 1;
      }
    }
    const emailPrefix = (stf.email || '').split('@')[0].toLowerCase();
    for (const t of tokens) {
      if (t.length >= 3 && emailPrefix.includes(t)) {
        score += 2;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestStaff = stf;
    }
  }

  if (bestScore >= 2) return bestStaff;
  return null;
}

export const StudentsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isStaff = user?.role === 'STAFF';
  const canManage = isAdmin || isStaff;
  const navigate = useNavigate();

  const initialStudents = getCachedData<Student[]>('students_{}') || [];
  const initialBatches = getCachedData<Batch[]>('batches_all') || [];
  const initialStaff = getCachedData<StaffUser[]>('staff_all') || [];

  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [batches, setBatches] = useState<Batch[]>(initialBatches);
  const [staffList, setStaffList] = useState<StaffUser[]>(initialStaff);
  const [loading, setLoading] = useState<boolean>(initialStudents.length === 0);
  const [syncingAll, setSyncingAll] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [syncCompletedSummary, setSyncCompletedSummary] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    active: boolean;
    total: number;
    current: number;
    successCount: number;
    errorCount: number;
    currentStudentName: string;
    elapsedSeconds: number;
    estimatedRemainingSeconds: number;
    percentage: number;
  }>({
    active: false,
    total: 0,
    current: 0,
    successCount: 0,
    errorCount: 0,
    currentStudentName: '',
    elapsedSeconds: 0,
    estimatedRemainingSeconds: 0,
    percentage: 0,
  });

  const pendingSyncCount = React.useMemo(() => {
    return students.filter(
      (s) => s.leetcode_username && !s.latest_snapshot && (!s.snapshots || s.snapshots.length === 0)
    ).length;
  }, [students]);
  const [search, setSearch] = useState<string>('');
  const [filterBatchId, setFilterBatchId] = useState<string>('');
  const [filterSectionId, setFilterSectionId] = useState<string>('');
  const [filterDept, setFilterDept] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterAllocBatchId, setFilterAllocBatchId] = useState<string>('');
  const [filterMentorId, setFilterMentorId] = useState<string>('');
  const [appliedFilters, setAppliedFilters] = useState<{
    batchId: string;
    sectionId: string;
    department: string;
    currentYear: string;
    allocationBatchId: string;
    mentorId: string;
    search: string;
  }>({
    batchId: '',
    sectionId: '',
    department: '',
    currentYear: '',
    allocationBatchId: '',
    mentorId: '',
    search: '',
  });
  const [filterAllocBatches, setFilterAllocBatches] = useState<any[]>([]);
  const [formAllocBatches, setFormAllocBatches] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Pagination State for Instant Responsiveness
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Selection & Bulk Action States
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [tableQuickAssignStaffId, setTableQuickAssignStaffId] = useState<string>('');
  const [syncingStudentId, setSyncingStudentId] = useState<string | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [deletingStudentIds, setDeletingStudentIds] = useState<Set<string>>(new Set());
  const [deleteSuccessNotice, setDeleteSuccessNotice] = useState<string | null>(null);

  // Modal States
  const [showStudentModal, setShowStudentModal] = useState<boolean>(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState({
    register_number: '',
    name: '',
    department: 'CSE',
    batch_id: '',
    section_id: '',
    current_year: '',
    sub_batch: '',
    allocation_batch_id: '',
    leetcode_username: '',
    mentor_id: '',
  });
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Smart CSV / Excel Import Modal States
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importRows, setImportRows] = useState<ParsedImportRow[]>([]);
  const [detectedMentors, setDetectedMentors] = useState<string[]>([]);
  const [detectedYears, setDetectedYears] = useState<string[]>([]);
  const [detectedSections, setDetectedSections] = useState<string[]>([]);
  const [selectedMentorFilters, setSelectedMentorFilters] = useState<Set<string>>(new Set(['ALL']));
  const [isMultiMentorMode, setIsMultiMentorMode] = useState<boolean>(false);
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('ALL');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('ALL');
  const [importBatchId, setImportBatchId] = useState<string>('');
  const [importSectionId, setImportSectionId] = useState<string>('');
  const [importAllocBatchId, setImportAllocBatchId] = useState<string>('');
  const [importSubBatchCustom, setImportSubBatchCustom] = useState<string>('');
  const [importCurrentYear, setImportCurrentYear] = useState<string>('');
  const [importMentorId, setImportMentorId] = useState<string>('');
  const [mentorMappings, setMentorMappings] = useState<Record<string, string>>({});
  const [importAllocBatches, setImportAllocBatches] = useState<any[]>([]);
  const [importDuplicateCount, setImportDuplicateCount] = useState<number>(0);
  const [importSearch, setImportSearch] = useState<string>('');
  const [quickAssignStaffId, setQuickAssignStaffId] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgressText, setImportProgressText] = useState<string>('');
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    createdCount?: number;
    updatedCount?: number;
    failedCount?: number;
    errors?: Array<{ register_number: string; error: string }>;
  } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [workbookInstance, setWorkbookInstance] = useState<XLSX.WorkBook | null>(null);
  const [workbookSheets, setWorkbookSheets] = useState<string[]>([]);
  const [selectedExcelSheet, setSelectedExcelSheet] = useState<string>('');
  const [rawFileMatrix, setRawFileMatrix] = useState<(string | number)[][] | null>(null);
  const [rawCsvText, setRawCsvText] = useState<string>('');
  const [availableColumns, setAvailableColumns] = useState<AvailableColumn[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMappingConfig>({});
  const [activeMapping, setActiveMapping] = useState<ActiveColumnMapping | null>(null);
  const [showColumnMappingPanel, setShowColumnMappingPanel] = useState<boolean>(false);

  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  const { tableMentorCounts, tableUnassignedCount } = useMemo(() => {
    const counts: Record<string, number> = {};
    let unassigned = 0;
    students.forEach((s) => {
      if (s.mentor?.id) {
        counts[s.mentor.id] = (counts[s.mentor.id] || 0) + 1;
      } else {
        unassigned++;
      }
    });
    return { tableMentorCounts: counts, tableUnassignedCount: unassigned };
  }, [students]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchStudents = async (
    showLoadingSpinner: boolean = false,
    bypassCache: boolean = false,
    activeFiltersOverride?: typeof appliedFilters
  ) => {
    try {
      setError(null);
      const f = activeFiltersOverride || appliedFilters;
      const params = {
        batchId: f.batchId || undefined,
        sectionId: f.sectionId || undefined,
        department: f.department || undefined,
        currentYear: f.currentYear || undefined,
        allocationBatchId: f.allocationBatchId || undefined,
        mentorId: f.mentorId || undefined,
        search: (f.search || '').trim() || undefined,
      };
      const cacheKey = `students_${JSON.stringify(params)}`;
      if (!bypassCache) {
        const cached = getCachedData<Student[]>(cacheKey);
        if (cached) {
          setStudents(cached);
          if (Array.isArray(cached) && cached.length > 0) {
            autoSyncService.enqueueStudents(cached);
          }
          setLoading(false);
          return;
        }
      }
      if (showLoadingSpinner || students.length === 0) {
        setLoading(true);
      }
      const data = await studentApi.getStudents(params, bypassCache);
      setStudents(data);
      if (Array.isArray(data) && data.length > 0) {
        autoSyncService.enqueueStudents(data);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load student roster'));
    } finally {
      setLoading(false);
    }
  };

  // Live in-place row update when background auto-sync updates any student
  useEffect(() => {
    const handleStudentSynced = (e: any) => {
      const results = e.detail?.results;
      if (!Array.isArray(results) || results.length === 0) return;
      const statsMap = new Map<string, any>();
      results.forEach((r: any) => {
        if (r.studentId && r.success && r.stats) statsMap.set(r.studentId, r.stats);
      });
      if (statsMap.size === 0) return;

      setStudents((prevList) =>
        prevList.map((st) => {
          const match = statsMap.get(st.id);
          if (match) {
            const newSnap = {
              id: `live_${st.id}_${Date.now()}`,
              student_id: st.id,
              snapshot_date: new Date().toISOString(),
              total_solved: match.totalSolved ?? 0,
              easy_solved: match.easySolved ?? 0,
              medium_solved: match.mediumSolved ?? 0,
              hard_solved: match.hardSolved ?? 0,
              ranking: match.ranking ?? 0,
            };
            return {
              ...st,
              total_solved: match.totalSolved ?? (st as any).total_solved,
              easy_solved: match.easySolved ?? (st as any).easy_solved,
              medium_solved: match.mediumSolved ?? (st as any).medium_solved,
              hard_solved: match.hardSolved ?? (st as any).hard_solved,
              snapshots: [newSnap as any],
              latest_snapshot: newSnap as any,
            };
          }
          return st;
        })
      );
    };

    window.addEventListener('student-synced', handleStudentSynced);
    return () => window.removeEventListener('student-synced', handleStudentSynced);
  }, []);

  const handleToggleSelectStudent = (studentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedStudentIds);
    if (next.has(studentId)) {
      next.delete(studentId);
    } else {
      next.add(studentId);
    }
    setSelectedStudentIds(next);
  };

  const handleToggleSelectAll = () => {
    const currentViewIds = students.map((s) => s.id);
    const isAllCurrentSelected = currentViewIds.length > 0 && currentViewIds.every((id) => selectedStudentIds.has(id));
    if (isAllCurrentSelected) {
      // Clear selection
      setSelectedStudentIds(new Set());
    } else {
      // Select ONLY the students currently visible in the active filtered view
      setSelectedStudentIds(new Set(currentViewIds));
    }
  };

  const handleClearSelection = () => {
    setSelectedStudentIds(new Set());
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedStudentIds.size === 0) return;
    // CRITICAL: Strictly scope deletion to students matching the current filtered view
    const currentViewIdsSet = new Set(students.map((s) => s.id));
    const toDeleteIds = Array.from(selectedStudentIds).filter((id) => currentViewIdsSet.has(id));
    if (toDeleteIds.length === 0) return;
    const toDeleteSet = new Set(toDeleteIds);

    try {
      setSubmitting(true);
      setBulkDeleteError(null);
      // Mark rows for animated deletion effect
      setDeletingStudentIds(toDeleteSet);

      await studentApi.bulkDeleteStudents(toDeleteIds);

      // Smooth 350ms delay allowing CSS row slide-out animation to complete
      await new Promise((resolve) => setTimeout(resolve, 350));

      // Confirmed deletion: update UI state
      setStudents((prev) => prev.filter((s) => !toDeleteSet.has(s.id)));
      setSelectedStudentIds(new Set());
      setDeletingStudentIds(new Set());
      setShowBulkDeleteModal(false);
      setDeleteSuccessNotice(`🎉 Successfully deleted ${toDeleteIds.length} student record(s) and their associated daily snapshots!`);

      clearClientCache();
      window.dispatchEvent(new CustomEvent('student-synced'));
      window.dispatchEvent(new CustomEvent('sheets-synced'));
      await fetchStudents(false, true);
    } catch (err: any) {
      setDeletingStudentIds(new Set());
      const errMsg = extractErrorMessage(err, 'Failed to delete selected students');
      setBulkDeleteError(errMsg);
      setError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTableBulkMentorAssignment = async () => {
    if (!tableQuickAssignStaffId || selectedStudentIds.size === 0) return;
    const targetMentorId = tableQuickAssignStaffId === 'NONE' || tableQuickAssignStaffId === 'UNASSIGNED' ? null : tableQuickAssignStaffId;
    const targetStaff = staffList.find((s) => s.id === targetMentorId);

    // CRITICAL: Strictly scope mentor reassignment to students matching the current filtered view
    const currentViewIdsSet = new Set(students.map((s) => s.id));
    const studentIds = Array.from(selectedStudentIds).filter((id) => currentViewIdsSet.has(id));
    if (studentIds.length === 0) return;
    const targetIdsSet = new Set(studentIds);

    try {
      setSubmitting(true);

      // 1. Optimistic instant UI update: immediately reflect the new mentor or unassigned state in table
      setStudents((prev) =>
        prev.map((s) => {
          if (!targetIdsSet.has(s.id)) return s;
          return {
            ...s,
            mentor_id: targetMentorId,
            mentor: targetStaff ? { id: targetStaff.id, name: targetStaff.name, email: targetStaff.email } : null,
          };
        })
      );

      // 2. High-speed single API call to bulk assign mentor
      await studentApi.bulkAssignMentor(studentIds, targetMentorId);

      setTableQuickAssignStaffId('');
      setSelectedStudentIds(new Set());
      setSyncNotice(targetMentorId ? `Successfully assigned mentor to ${studentIds.length} student(s)` : `Successfully unassigned ${studentIds.length} student(s)`);

      // 3. Background revalidation
      await fetchStudents(false, true);
    } catch (err: any) {
      await fetchStudents(false, true);
      alert(extractErrorMessage(err, 'Failed to update mentor for selected students'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleInlineMentorChange = async (studentId: string, newMentorId: string) => {
    const targetMentorId = !newMentorId || newMentorId === 'NONE' || newMentorId === 'UNASSIGNED' ? null : newMentorId;
    const targetStaff = staffList.find((s) => s.id === targetMentorId);

    // Instant optimistic update in local table
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? {
        ...s,
        mentor_id: targetMentorId,
        mentor: targetStaff ? { id: targetStaff.id, name: targetStaff.name, email: targetStaff.email } : null,
      } : s))
    );

    try {
      await studentApi.bulkAssignMentor([studentId], targetMentorId);
      setSyncNotice(targetMentorId ? `Assigned mentor to ${targetStaff?.name || 'Staff'}` : 'Unassigned mentor');
      await fetchStudents(false, true);
    } catch (err: any) {
      await fetchStudents(false, true);
      alert(extractErrorMessage(err, 'Failed to update mentor'));
    }
  };

  const handleOpenDeleteStudent = (student: Student, e: React.MouseEvent) => {
    e.stopPropagation();
    setStudentToDelete(student);
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    const deletedId = studentToDelete.id;
    const studentName = studentToDelete.name;

    try {
      setSubmitting(true);
      setDeleteError(null);
      // Mark row for animated exit
      setDeletingStudentIds(new Set([deletedId]));

      await studentApi.deleteStudent(deletedId);

      // Smooth 350ms delay allowing CSS row slide-out animation to complete
      await new Promise((resolve) => setTimeout(resolve, 350));

      // Confirmed deletion: update UI state
      setStudents((prev) => prev.filter((s) => s.id !== deletedId));
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        next.delete(deletedId);
        return next;
      });
      setDeletingStudentIds(new Set());
      setShowDeleteModal(false);
      setStudentToDelete(null);
      setDeleteSuccessNotice(`🎉 Successfully deleted ${studentName}'s record and associated daily snapshots.`);

      clearClientCache();
      window.dispatchEvent(new CustomEvent('student-synced'));
      window.dispatchEvent(new CustomEvent('sheets-synced'));
      await fetchStudents(false, true);
    } catch (err: any) {
      setDeletingStudentIds(new Set());
      const errMsg = extractErrorMessage(err, 'Failed to delete student record');
      setDeleteError(errMsg);
      setError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Load all students once on mount
  useEffect(() => {
    fetchStudents(true);
  }, []);

  const handleApplyFilter = () => {
    const newApplied = {
      batchId: filterBatchId,
      sectionId: filterSectionId,
      department: filterDept,
      currentYear: filterYear,
      allocationBatchId: filterAllocBatchId,
      mentorId: filterMentorId,
      search: search.trim(),
    };
    setAppliedFilters(newApplied);
    setCurrentPage(1);
    setSelectedStudentIds(new Set());
    fetchStudents(true, true, newApplied);
  };

  const handleResetFilters = () => {
    setFilterBatchId('');
    setFilterSectionId('');
    setFilterDept('');
    setFilterYear('');
    setFilterAllocBatchId('');
    setFilterMentorId('');
    setSearch('');
    const emptyApplied = {
      batchId: '',
      sectionId: '',
      department: '',
      currentYear: '',
      allocationBatchId: '',
      mentorId: '',
      search: '',
    };
    setAppliedFilters(emptyApplied);
    setCurrentPage(1);
    setSelectedStudentIds(new Set());
    fetchStudents(true, true, emptyApplied);
  };

  const hasSelectedFilters = Boolean(
    filterBatchId || filterSectionId || filterDept || filterYear || filterAllocBatchId || filterMentorId || search.trim()
  );
  const selectedFilterCount = [
    filterBatchId, filterSectionId, filterDept, filterYear, filterAllocBatchId, filterMentorId, search.trim()
  ].filter(Boolean).length;

  const hasAppliedFilters = Boolean(
    appliedFilters.batchId ||
    appliedFilters.sectionId ||
    appliedFilters.department ||
    appliedFilters.currentYear ||
    appliedFilters.allocationBatchId ||
    appliedFilters.mentorId ||
    appliedFilters.search
  );

  const isFilterDirty =
    filterBatchId !== appliedFilters.batchId ||
    filterSectionId !== appliedFilters.sectionId ||
    filterDept !== appliedFilters.department ||
    filterYear !== appliedFilters.currentYear ||
    filterAllocBatchId !== appliedFilters.allocationBatchId ||
    filterMentorId !== appliedFilters.mentorId ||
    search.trim() !== appliedFilters.search;

  useEffect(() => {
    if (filterSectionId) {
      batchApi.getAllocationBatches(filterSectionId)
        .then((abs) => setFilterAllocBatches(abs || []))
        .catch(() => setFilterAllocBatches([]));
    } else {
      setFilterAllocBatches([]);
      setFilterAllocBatchId('');
    }
  }, [filterSectionId]);

  useEffect(() => {
    if (studentForm.section_id) {
      batchApi.getAllocationBatches(studentForm.section_id)
        .then((abs) => setFormAllocBatches(abs || []))
        .catch(() => setFormAllocBatches([]));
    } else {
      setFormAllocBatches([]);
    }
  }, [studentForm.section_id]);

  useEffect(() => {
    if (importSectionId) {
      batchApi.getAllocationBatches(importSectionId)
        .then((abs) => setImportAllocBatches(abs || []))
        .catch(() => setImportAllocBatches([]));
    } else {
      setImportAllocBatches([]);
    }
  }, [importSectionId]);

  useEffect(() => {
    Promise.all([
      batchApi.getAllBatches().then(setBatches),
      staffApi.getAllStaff(true).then(setStaffList),
    ]).catch(console.error);
  }, []);

  const handleLiveSyncStudent = async (student: Student, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!student.leetcode_username) {
      setError(`Student ${student.name} does not have a LeetCode username configured.`);
      return;
    }
    try {
      setSyncingStudentId(student.id);
      setSyncNotice(null);
      setError(null);
      const res = await syncReportStudents({ studentIds: [student.id] });
      const match = res.results?.find((r: any) => r.studentId === student.id && r.success);
      const stats = match?.stats;
      const solved = stats?.totalSolved;
      if (stats) {
        setStudents((prev) =>
          prev.map((s) => {
            if (s.id === student.id) {
              const snap = {
                id: `live_${s.id}_${Date.now()}`,
                student_id: s.id,
                snapshot_date: new Date().toISOString(),
                total_solved: stats.totalSolved ?? 0,
                easy_solved: stats.easySolved ?? 0,
                medium_solved: stats.mediumSolved ?? 0,
                hard_solved: stats.hardSolved ?? 0,
                ranking: stats.ranking ?? 0,
              };
              return {
                ...s,
                snapshots: [snap as any],
                latest_snapshot: snap as any,
              };
            }
            return s;
          })
        );
      }
      setSyncCompletedSummary(`⚡ Live LeetCode sync completed for ${student.name} (@${student.leetcode_username.replace(/^@/, '')}): ${solved !== undefined ? `${solved} problems solved` : 'data updated'}!`);
      clearClientCache('students_');
      await fetchStudents(false, true);
      window.dispatchEvent(new CustomEvent('student-synced'));
    } catch (err: any) {
      setError(extractErrorMessage(err, `Failed to live sync LeetCode stats for @${student.leetcode_username}`));
    } finally {
      setSyncingStudentId(null);
    }
  };

  const handleSyncBatchOrAll = async (pendingOnly: boolean = false) => {
    let targetIds: string[] = [];
    if (selectedStudentIds.size > 0) {
      targetIds = Array.from(selectedStudentIds);
    } else if (pendingOnly) {
      targetIds = students
        .filter((s) => s.leetcode_username && !s.latest_snapshot && (!s.snapshots || s.snapshots.length === 0))
        .map((s) => s.id);
    } else {
      targetIds = students.filter((s) => s.leetcode_username).map((s) => s.id);
    }

    if (targetIds.length === 0) {
      setSyncCompletedSummary(pendingOnly ? 'No pending students found to sync.' : 'No students with LeetCode usernames found to sync.');
      return;
    }

    // Sync ALL target students — no artificial caps so all students are updated together
    const immediateIds = targetIds;
    const backgroundIds: string[] = [];

    const totalToSync = immediateIds.length;
    const batchSize = 10; // High-throughput batch of 10 students
    const startTime = Date.now();
    // Calibrated standard target duration: ~0.3s per student with concurrency = 3
    const targetDuration = Math.min(45, Math.max(10, Math.ceil(totalToSync * 0.3)));

    notifySyncStarted('Sync All Students');
    setSyncingAll(true);
    setSyncCompletedSummary(null);
    setSyncNotice(null);
    setError(null);

    // Initialize interactive live progress state immediately
    setSyncProgress({
      active: true,
      total: totalToSync,
      current: 0,
      successCount: 0,
      errorCount: 0,
      currentStudentName: '',
      elapsedSeconds: 0,
      estimatedRemainingSeconds: targetDuration,
      percentage: 0,
    });

    // CRITICAL: Yield to browser paint loop so the panel renders BEFORE the sync starts.
    // Without this the panel appears 15-20s late because Promise.all blocks the render.
    await new Promise<void>((resolve) => setTimeout(resolve, 80));

    // Start 1-second live countdown / elapsed timer interval
    const timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setSyncProgress((prev) => {
        if (!prev.active) return prev;
        const current = prev.current;
        const remaining = Math.max(0, Math.min(45, Math.round((1 - (current / totalToSync)) * targetDuration)));
        return {
          ...prev,
          elapsedSeconds: elapsed,
          estimatedRemainingSeconds: remaining,
        };
      });
    }, 1000);

    let totalSuccess = 0;
    let totalErrors = 0;

    // Divide into chunks of 10
    const chunks: string[][] = [];
    for (let i = 0; i < totalToSync; i += batchSize) {
      chunks.push(immediateIds.slice(i, i + batchSize));
    }

    try {
      let processedCount = 0;
      const invalidUsersSet = new Set<string>();

      for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
        const chunk = chunks[cIdx];

        // Identify student usernames in current batch
        const batchStudentNames = students
          .filter((s) => chunk.includes(s.id))
          .map((s) => `@${(s.leetcode_username || '').replace(/^@/, '')}`)
          .slice(0, 5)
          .join(', ');

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, Math.min(45, Math.round((1 - (processedCount / totalToSync)) * targetDuration)));
        const percent = Math.min(100, Math.round((processedCount / totalToSync) * 100));

        setSyncProgress((prev) => ({
          ...prev,
          current: processedCount,
          percentage: percent,
          currentStudentName: batchStudentNames,
          elapsedSeconds: elapsed,
          estimatedRemainingSeconds: remaining,
        }));

        try {
          const res = await syncReportStudents({ studentIds: chunk });
          const successfulInChunk = (res.successful ?? chunk.length);
          totalSuccess += successfulInChunk;

          // LIVE IN-PLACE STATE MUTATION:
          // Immediately update local students array so table rows turn from 'Pending sync' to green counts in real time!
          if (Array.isArray(res.results)) {
            res.results.forEach((r: any) => {
              if (!r.success && (r.isUserNotFound || (r.error && (r.error.includes('not exist') || r.error.includes('404'))))) {
                const matched = students.find((s) => s.id === r.studentId);
                if (matched?.leetcode_username) {
                  invalidUsersSet.add(matched.leetcode_username);
                }
              }
            });

            setStudents((prevList) =>
              prevList.map((st) => {
                const match = res.results.find((r: any) => r.studentId === st.id && r.success && r.stats);
                if (match) {
                  const newSnap = {
                    id: `live_${st.id}_${Date.now()}`,
                    student_id: st.id,
                    snapshot_date: new Date().toISOString(),
                    total_solved: match.stats.totalSolved ?? 0,
                    easy_solved: match.stats.easySolved ?? 0,
                    medium_solved: match.stats.mediumSolved ?? 0,
                    hard_solved: match.stats.hardSolved ?? 0,
                    ranking: match.stats.ranking ?? 0,
                  };
                  return {
                    ...st,
                    total_solved: match.stats.totalSolved ?? (st as any).total_solved,
                    easy_solved: match.stats.easySolved ?? (st as any).easy_solved,
                    medium_solved: match.stats.mediumSolved ?? (st as any).medium_solved,
                    hard_solved: match.stats.hardSolved ?? (st as any).hard_solved,
                    snapshots: [newSnap as any],
                    latest_snapshot: newSnap as any,
                  };
                }
                return st;
              })
            );
          }
        } catch (chunkErr) {
          totalErrors += chunk.length;
          console.warn(`[Sync Chunk Warning]:`, chunkErr);
        } finally {
          processedCount += chunk.length;
        }

        // Update progress count after batch
        const batchPercent = Math.min(100, Math.round((processedCount / totalToSync) * 100));
        setSyncProgress((prev) => ({
          ...prev,
          current: processedCount,
          percentage: batchPercent,
          successCount: totalSuccess,
          errorCount: totalErrors,
        }));
      }

      if (invalidUsersSet.size > 0) {
        setSyncNotice(
          `⚠️ Notice: ${invalidUsersSet.size} account(s) (${Array.from(invalidUsersSet).join(', ')}) do not exist on LeetCode. Please verify their usernames.`
        );
      }

      const totalElapsed = Math.floor((Date.now() - startTime) / 1000);
      if (backgroundIds.length > 0) {
        const bgCandidates = students.filter((s) => backgroundIds.includes(s.id));
        autoSyncService.enqueueStudents(bgCandidates);
        setSyncCompletedSummary(
          `🎉 Live Sync Complete! ${totalSuccess} / ${totalToSync} students synchronized in ${totalElapsed}s. Remaining ${backgroundIds.length} students queued for seamless background sync.`
        );
      } else {
        setSyncCompletedSummary(
          `🎉 Live Sync Complete! ${totalSuccess} / ${totalToSync} students synchronized in ${totalElapsed}s. All student solve counts updated!`
        );
      }

      clearClientCache('students_');
      await fetchStudents(false, true);
      window.dispatchEvent(new CustomEvent('student-synced'));
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to complete student synchronization'));
    } finally {
      notifySyncEnded('Sync All Students');
      clearInterval(timerInterval);
      setSyncingAll(false);
      setSyncProgress((prev) => ({
        ...prev,
        active: false,
        percentage: 100,
      }));
    }
  };

  const handleOpenCreateModal = () => {
    setEditingStudentId(null);
    setStudentForm({
      register_number: '',
      name: '',
      department: 'CSE',
      batch_id: '',
      section_id: '',
      current_year: '',
      sub_batch: '',
      allocation_batch_id: '',
      leetcode_username: '',
      mentor_id: isStaff && user ? (user.id || (user as any).userId || '') : '',
    });
    staffApi.getAllStaff(true, true).then(setStaffList).catch(console.error);
    setShowStudentModal(true);
  };

  const handleOpenEditModal = (student: Student, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingStudentId(student.id);
    setStudentForm({
      register_number: student.register_number,
      name: student.name,
      department: student.department,
      batch_id: student.batch_id,
      section_id: student.section_id,
      current_year: student.current_year || '',
      sub_batch: student.sub_batch || '',
      allocation_batch_id: student.allocation_batch_id || student.allocation_batch?.id || '',
      leetcode_username: student.leetcode_username || '',
      mentor_id: student.mentor_id || student.mentor?.id || '',
    });
    staffApi.getAllStaff(true, true).then(setStaffList).catch(console.error);
    setShowStudentModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.batch_id || !studentForm.section_id) {
      alert('Please select both a batch and section');
      return;
    }

    if (!studentForm.leetcode_username.trim()) {
      alert('LeetCode username is required');
      return;
    }

    const selectedBatch = batches.find((b) => b.id === studentForm.batch_id);
    const selectedSection = selectedBatch?.sections?.find((s) => s.id === studentForm.section_id);
    const selectedAllocBatch = selectedSection?.allocation_batches?.find((ab) => ab.id === studentForm.allocation_batch_id);
    const selectedMentor = staffList.find((m) => m.id === studentForm.mentor_id);

    // Optimistic student representation for 0ms perceptual delay
    const tempId = editingStudentId || `temp_student_${Date.now()}`;
    const optimisticStudent: Student = {
      id: tempId,
      register_number: studentForm.register_number.trim(),
      name: studentForm.name.trim(),
      department: studentForm.department,
      batch_id: studentForm.batch_id,
      section_id: studentForm.section_id,
      allocation_batch_id: studentForm.allocation_batch_id || null,
      sub_batch: studentForm.sub_batch || null,
      current_year: studentForm.current_year || null,
      leetcode_username: studentForm.leetcode_username.trim(),
      mentor_id: studentForm.mentor_id || null,
      mentor: selectedMentor ? { id: selectedMentor.id, name: selectedMentor.name, email: selectedMentor.email } : null,
      allocation_batch: selectedAllocBatch ? { id: selectedAllocBatch.id, name: selectedAllocBatch.name } : null,
      created_at: new Date().toISOString(),
      batch: selectedBatch ? { id: selectedBatch.id, batch_name: selectedBatch.batch_name, start_year: selectedBatch.start_year, end_year: selectedBatch.end_year } : undefined,
      section: selectedSection ? { name: selectedSection.name } : undefined,
    };

    // 1. Immediately apply optimistic update to local state & close modal instantly
    if (editingStudentId) {
      setStudents((prev) => prev.map((s) => (s.id === editingStudentId ? { ...s, ...optimisticStudent } : s)));
      setSyncNotice('Student updated! Syncing LeetCode stats & Google Sheets in background...');
    } else {
      setStudents((prev) => [optimisticStudent, ...prev]);
      setSyncNotice('Student added! Fetching initial LeetCode stats & syncing in background...');
    }

    setShowStudentModal(false);

    try {
      setSubmitting(true);
      if (editingStudentId) {
        const updated = await studentApi.updateStudent(editingStudentId, studentForm);
        if (updated && updated.id) {
          setStudents((prev) => prev.map((s) => (s.id === editingStudentId ? { ...s, ...updated } : s)));
        }
        setSyncNotice('Student updated successfully! LeetCode details & Google Sheets automatically synced.');
      } else {
        const created = await studentApi.createStudent(studentForm);
        if (created && created.id) {
          // Replace optimistic temporary student with server-confirmed record
          setStudents((prev) => prev.map((s) => (s.id === tempId ? { ...created, ...s, id: created.id } : s)));
        }
        setSyncNotice('Student added successfully! Initial LeetCode snapshot & Google Sheets automatically synced.');
      }
      fetchStudents(false);
      window.dispatchEvent(new CustomEvent('student-synced'));
      window.dispatchEvent(new CustomEvent('sheets-synced'));
    } catch (err: any) {
      // Revert optimistic addition if error occurs
      if (!editingStudentId) {
        setStudents((prev) => prev.filter((s) => s.id !== tempId));
      }
      alert(err.response?.data?.error || 'Failed to save student record');
    } finally {
      setSubmitting(false);
    }
  };

  // Smart CSV / Excel Import Handlers
  const handleOpenImportModal = () => {
    setImportFileName('');
    setImportRows([]);
    setDetectedMentors([]);
    setSelectedMentorFilters(new Set(['ALL']));
    setImportSearch('');
    setImportCurrentYear('');
    setImportMentorId('');
    setMentorMappings({});
    setImportDuplicateCount(0);
    setImportResult(null);
    staffApi.getAllStaff(true, true).then(setStaffList).catch(console.error);

    // Intelligently preselect active/first batch and section
    const activeBatch = batches.find((b) => b.id === filterBatchId) || (batches.length > 0 ? batches[0] : null);
    if (activeBatch) {
      setImportBatchId(activeBatch.id);
      const activeSec = activeBatch.sections?.find((s) => s.id === filterSectionId) || (activeBatch.sections && activeBatch.sections.length > 0 ? activeBatch.sections[0] : null);
      if (activeSec) {
        setImportSectionId(activeSec.id);
        if (activeSec.allocation_batches && activeSec.allocation_batches.length > 0) {
          setImportAllocBatches(activeSec.allocation_batches);
        } else {
          batchApi.getAllocationBatches(activeSec.id)
            .then((abs) => setImportAllocBatches(abs || []))
            .catch(() => setImportAllocBatches([]));
        }
      } else {
        setImportSectionId('');
        setImportAllocBatches([]);
      }
    } else {
      setImportBatchId('');
      setImportSectionId('');
      setImportAllocBatches([]);
    }
    setImportAllocBatchId('');
    setImportSubBatchCustom('');
    setShowImportModal(true);
  };

  const handleImportBatchChange = (newBatchId: string) => {
    setImportBatchId(newBatchId);
    const b = batches.find((item) => item.id === newBatchId);
    if (b && b.sections && b.sections.length > 0) {
      const firstSec = b.sections[0];
      setImportSectionId(firstSec.id);
      if (firstSec.allocation_batches && firstSec.allocation_batches.length > 0) {
        setImportAllocBatches(firstSec.allocation_batches);
      } else {
        batchApi.getAllocationBatches(firstSec.id)
          .then((abs) => setImportAllocBatches(abs || []))
          .catch(() => setImportAllocBatches([]));
      }
    } else {
      setImportSectionId('');
      setImportAllocBatches([]);
    }
    setImportAllocBatchId('');
    setImportSubBatchCustom('');
  };

  const handleImportSectionChange = (newSecId: string) => {
    setImportSectionId(newSecId);
    setImportAllocBatchId('');
    setImportSubBatchCustom('');
    if (newSecId) {
      const b = batches.find((item) => item.id === importBatchId);
      const sec = b?.sections?.find((s) => s.id === newSecId);
      if (sec && sec.allocation_batches && sec.allocation_batches.length > 0) {
        setImportAllocBatches(sec.allocation_batches);
      } else {
        batchApi.getAllocationBatches(newSecId)
          .then((abs) => setImportAllocBatches(abs || []))
          .catch(() => setImportAllocBatches([]));
      }
    } else {
      setImportAllocBatches([]);
    }
  };

  const handleCloseImportModal = () => {
    setShowImportModal(false);
    setImportFileName('');
    setImportRows([]);
    setSelectedMentorFilters(new Set(['ALL']));
    setIsMultiMentorMode(false);
    setSelectedYearFilter('ALL');
    setSelectedSectionFilter('ALL');
    setDetectedYears([]);
    setDetectedSections([]);
    setImportCurrentYear('');
    setImportMentorId('');
    setMentorMappings({});
    setImportDuplicateCount(0);
    setQuickAssignStaffId('');
    setImportResult(null);
    setWorkbookInstance(null);
    setWorkbookSheets([]);
    setSelectedExcelSheet('');
    setRawFileMatrix(null);
    setRawCsvText('');
    setAvailableColumns([]);
    setColumnMapping({});
    setActiveMapping(null);
    setShowColumnMappingPanel(false);
  };

  const applyParsing = (
    dataInput: string | (string | number)[][],
    configOverride?: ColumnMappingConfig
  ) => {
    const config = configOverride !== undefined ? configOverride : columnMapping;
    const configWithStaff: ColumnMappingConfig = { ...config, knownStaffList: staffList };
    const result = analyzeAndParseStudents(dataInput, configWithStaff, staffList);

    setImportRows(result.rows);
    setDetectedMentors(result.detectedMentors);
    setDetectedYears(result.detectedYears || []);
    setDetectedSections(result.detectedSections || []);
    setSelectedYearFilter('ALL');
    setSelectedSectionFilter('ALL');
    setImportDuplicateCount(result.duplicateCount);
    setAvailableColumns(result.availableColumns || []);
    setActiveMapping(result.activeMapping || null);

    // Auto-populate mentorMappings for each detected mentor from the sheet against staffList created by admin
    const autoMappings: Record<string, string> = { ...mentorMappings };
    result.detectedMentors.forEach((mName) => {
      if (mName === 'Unassigned') {
        if (!autoMappings[mName]) autoMappings[mName] = 'NONE';
        return;
      }
      if (!autoMappings[mName] || autoMappings[mName] === 'AUTO') {
        const matched = findMatchingStaff(mName, staffList);
        // If matched to registered staff use staff id, otherwise default to 'AUTO' so backend will resolve it rather than unassigning!
        autoMappings[mName] = matched ? matched.id : 'AUTO';
      }
    });
    setMentorMappings(autoMappings);

    // Auto-detect matching batch if not explicitly picked yet
    const sampleYear = result.rows.find((r) => r.academicYear)?.academicYear;
    if (sampleYear && batches.length > 0 && !importBatchId) {
      const matchedB = batches.find((b) => `${b.start_year}-${b.end_year}`.includes(sampleYear) || b.batch_name.includes(sampleYear));
      if (matchedB) {
        setImportBatchId(matchedB.id);
        if (matchedB.sections && matchedB.sections.length > 0) {
          const firstS = matchedB.sections[0];
          setImportSectionId(firstS.id);
          if (firstS.allocation_batches && firstS.allocation_batches.length > 0) {
            setImportAllocBatches(firstS.allocation_batches);
          }
        }
      }
    }

    // Default to showing and selecting ALL valid students from the uploaded sheet
    setSelectedMentorFilters(new Set(['ALL']));
    setImportRows(result.rows.map((r) => ({
      ...r,
      selected: r.isValid,
    })));
    if (isStaff && user?.id && !importMentorId) {
      setImportMentorId(user.id);
    }
  };

  // When staffList loads or changes, re-resolve any 'AUTO' or unmapped mentors
  useEffect(() => {
    if (staffList.length > 0 && detectedMentors.length > 0) {
      setMentorMappings((prev) => {
        let changed = false;
        const updated = { ...prev };
        detectedMentors.forEach((mName) => {
          if (mName !== 'Unassigned') {
            if (!updated[mName] || updated[mName] === 'AUTO') {
              const matched = findMatchingStaff(mName, staffList);
              if (matched) {
                updated[mName] = matched.id;
                changed = true;
              }
            }
          }
        });
        return changed ? updated : prev;
      });
    }
  }, [staffList, detectedMentors]);

  const handleFileProcess = (file: File) => {
    if (!file) return;
    setImportFileName(file.name);
    setImportResult(null);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          setWorkbookInstance(workbook);
          setWorkbookSheets(workbook.SheetNames);
          const initialSheet = workbook.SheetNames[0] || '';
          setSelectedExcelSheet(initialSheet);

          const worksheet = workbook.Sheets[initialSheet];
          const rawMatrix: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: false,
            defval: '',
          });
          setRawFileMatrix(rawMatrix);
          setRawCsvText('');
          applyParsing(rawMatrix);
        } catch (excelErr: any) {
          console.error('Failed to parse Excel file:', excelErr);
          alert('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) return;
        setRawCsvText(text);
        setRawFileMatrix(null);
        setWorkbookInstance(null);
        setWorkbookSheets([]);
        setSelectedExcelSheet('');
        applyParsing(text);
      };
      reader.readAsText(file);
    }
  };

  const handleSheetChange = (newSheetName: string) => {
    if (!workbookInstance) return;
    setSelectedExcelSheet(newSheetName);
    const worksheet = workbookInstance.Sheets[newSheetName];
    if (!worksheet) return;
    const rawMatrix: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: '',
    });
    setRawFileMatrix(rawMatrix);
    applyParsing(rawMatrix, columnMapping);
  };

  const handleColumnMappingChange = (field: keyof ColumnMappingConfig, colIdx: number) => {
    const nextConfig: ColumnMappingConfig = {
      ...columnMapping,
      [field]: colIdx,
    };
    setColumnMapping(nextConfig);
    const sourceData = rawFileMatrix || rawCsvText;
    if (sourceData) {
      applyParsing(sourceData, nextConfig);
    }
  };

  const handleResetColumnMapping = () => {
    setColumnMapping({});
    const sourceData = rawFileMatrix || rawCsvText;
    if (sourceData) {
      applyParsing(sourceData, {});
    }
  };

  // Single-Select: Filter preview table to ONLY this mentor (does NOT deselect other students!)
  const handleSelectOnlyMentor = (mentor: string) => {
    let nextSet: Set<string>;
    if (mentor === 'ALL') {
      nextSet = new Set(['ALL']);
    } else {
      nextSet = new Set([mentor]);
    }
    setSelectedMentorFilters(nextSet);
  };

  // Toggle mentor filter
  const handleToggleMentorFilter = (mentor: string) => {
    if (!isMultiMentorMode) {
      handleSelectOnlyMentor(mentor);
      return;
    }

    let nextSet: Set<string>;

    if (mentor === 'ALL') {
      nextSet = new Set(['ALL']);
    } else if (selectedMentorFilters.has('ALL')) {
      // Switching from ALL to a specific mentor
      nextSet = new Set([mentor]);
    } else {
      // Multi-select toggle
      nextSet = new Set(selectedMentorFilters);
      if (nextSet.has(mentor)) {
        nextSet.delete(mentor);
        if (nextSet.size === 0) {
          nextSet = new Set(['ALL']);
        }
      } else {
        nextSet.add(mentor);
        if (nextSet.size === detectedMentors.length && detectedMentors.length > 0) {
          nextSet = new Set(['ALL']);
        }
      }
    }

    setSelectedMentorFilters(nextSet);
  };

  // Explicit Selection Helpers so user has total control over what is imported
  const handleSelectAllStudents = () => {
    setImportRows((prev) => prev.map((r) => ({ ...r, selected: r.isValid })));
  };

  const handleSelectOnlyVisibleStudents = () => {
    const visibleIds = new Set(getFilteredImportRows().map((r) => r.id));
    setImportRows((prev) =>
      prev.map((r) => ({
        ...r,
        selected: r.isValid && visibleIds.has(r.id),
      }))
    );
  };

  const handleDeselectAllStudents = () => {
    setImportRows((prev) => prev.map((r) => ({ ...r, selected: false })));
  };

  // Top Target Scope Mentor dropdown handler
  const handleImportMentorChange = (newMentorId: string) => {
    setImportMentorId(newMentorId);
  };

  const handleToggleImportRow = (rowId: string) => {
    setImportRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, selected: !r.selected } : r))
    );
  };

  const handleToggleAllVisibleImportRows = (selectAll: boolean) => {
    const visibleIds = new Set(
      getFilteredImportRows().map((r) => r.id)
    );
    setImportRows((prev) =>
      prev.map((r) => {
        if (!r.isValid) return { ...r, selected: false };
        if (visibleIds.has(r.id)) {
          return { ...r, selected: selectAll };
        }
        return r;
      })
    );
  };

  const handleApplyBulkMentorAssignment = () => {
    if (!quickAssignStaffId) return;
    const targetRows = getFilteredImportRows().filter((r) => r.selected && r.isValid);
    if (targetRows.length === 0) return;
    const targetIds = new Set(targetRows.map((r) => r.id));
    const targetStaff = staffList.find((s) => s.id === quickAssignStaffId);

    setImportRows((prev) =>
      prev.map((r) => {
        if (!targetIds.has(r.id)) return r;
        return {
          ...r,
          mentorStaffId: quickAssignStaffId === 'NONE' ? 'NONE' : quickAssignStaffId,
          cleanMentor: quickAssignStaffId === 'NONE' ? 'Unassigned' : (targetStaff?.name || r.cleanMentor),
        };
      })
    );
    setQuickAssignStaffId('');
  };


  const getFilteredImportRows = () => {
    return importRows.filter((row) => {
      // Mentor filter (supports multi-selection of mentors)
      if (!selectedMentorFilters.has('ALL') && !selectedMentorFilters.has(row.cleanMentor)) {
        return false;
      }
      // Year filter (All / 1st Year / 2nd Year, etc.)
      if (selectedYearFilter !== 'ALL') {
        const rowYear = (row.currentYear || row.academicYear || '').toLowerCase();
        const targetYear = selectedYearFilter.toLowerCase();
        if (!rowYear.includes(targetYear) && !targetYear.includes(rowYear)) {
          return false;
        }
      }
      // Section filter (All / Section A / Section B, etc.)
      if (selectedSectionFilter !== 'ALL') {
        const rowSec = (row.section || '').toUpperCase().replace(/^SECTION\s*/i, '').trim();
        const targetSec = selectedSectionFilter.toUpperCase().replace(/^SECTION\s*/i, '').trim();
        if (rowSec && targetSec && rowSec !== targetSec) {
          return false;
        }
      }
      // Text search
      if (importSearch.trim()) {
        const s = importSearch.toLowerCase();
        const matchesReg = row.cleanRegisterNumber.toLowerCase().includes(s);
        const matchesName = row.name.toLowerCase().includes(s);
        const matchesHandle = row.cleanLeetCode.toLowerCase().includes(s);
        const matchesMentor = row.cleanMentor.toLowerCase().includes(s);
        const matchesSec = (row.section || '').toLowerCase().includes(s);
        if (!matchesReg && !matchesName && !matchesHandle && !matchesMentor && !matchesSec) return false;
      }
      return true;
    });
  };

  const handleExecuteImport = async (importScope: 'ALL' | 'FILTERED' | 'SELECTED' = 'SELECTED') => {
    let targetRowsToImport: ParsedImportRow[] = [];

    if (importScope === 'FILTERED') {
      const visibleIds = new Set(getFilteredImportRows().map((r) => r.id));
      targetRowsToImport = importRows.filter((r) => r.isValid && visibleIds.has(r.id));
    } else if (importScope === 'ALL') {
      targetRowsToImport = importRows.filter((r) => r.isValid);
    } else {
      const selectedValid = importRows.filter((r) => r.selected && r.isValid);
      targetRowsToImport = selectedValid.length > 0 ? selectedValid : importRows.filter((r) => r.isValid);
    }

    if (targetRowsToImport.length === 0) {
      alert('Please select at least one valid student to import from the list.');
      return;
    }

    if (!importBatchId) {
      alert('Please select a target Academic Year (Batch).');
      return;
    }

    try {
      setIsImporting(true);
      setImportProgressText('');
      setImportResult(null);

      const targetBatch = batches.find((b) => b.id === importBatchId);

      const allStudentPayloads = targetRowsToImport.map((r) => {
        let rowMentorId: string | undefined = undefined;
        if (r.mentorStaffId && r.mentorStaffId !== 'AUTO') {
          rowMentorId = r.mentorStaffId;
        } else if (mentorMappings[r.cleanMentor] && mentorMappings[r.cleanMentor] !== 'AUTO') {
          rowMentorId = mentorMappings[r.cleanMentor];
        } else if (r.cleanMentor === 'Unassigned' && importMentorId && importMentorId !== 'AUTO') {
          rowMentorId = importMentorId;
        }

        if (!rowMentorId && importMentorId && importMentorId !== 'AUTO' && importMentorId !== 'NONE') {
          rowMentorId = importMentorId;
        }

        // Smart Section resolution: check if row itself specified a section, otherwise use batch default
        let resolvedSectionId = importSectionId;
        if (r.section && targetBatch?.sections && targetBatch.sections.length > 0) {
          const cleanSec = r.section.toUpperCase().replace(/^SECTION\s*/i, '').trim();
          const matchedSec = targetBatch.sections.find(
            (sec) =>
              sec.name.toUpperCase().trim() === cleanSec ||
              `SECTION ${sec.name}`.toUpperCase() === r.section?.toUpperCase().trim() ||
              sec.name.toUpperCase().trim().includes(cleanSec) ||
              cleanSec.includes(sec.name.toUpperCase().trim())
          );
          if (matchedSec) {
            resolvedSectionId = matchedSec.id;
          }
        }
        if ((!resolvedSectionId || resolvedSectionId === 'ALL') && targetBatch?.sections && targetBatch.sections.length > 0) {
          resolvedSectionId = targetBatch.sections[0].id;
        }

        return {
          register_number: r.cleanRegisterNumber,
          name: r.name,
          department: r.department || 'CSE',
          batch_id: importBatchId,
          section_id: resolvedSectionId,
          section_name: r.section || undefined,
          allocation_batch_id: importAllocBatchId || undefined,
          sub_batch: importSubBatchCustom || undefined,
          current_year: r.currentYear || importCurrentYear || undefined,
          leetcode_username: r.cleanLeetCode,
          mentor_name: r.cleanMentor !== 'Unassigned' ? r.cleanMentor : undefined,
          mentor_id: rowMentorId,
        };
      });

      const targetScope = {
        batch_id: importBatchId,
        section_id: importSectionId,
        allocation_batch_id: importAllocBatchId || undefined,
        sub_batch: importSubBatchCustom || undefined,
        current_year: importCurrentYear || undefined,
        mentor_id: (importMentorId && importMentorId !== 'AUTO' && importMentorId !== 'NONE') ? importMentorId : undefined,
      };

      // Chunk in safe batches of 10 so Vercel serverless execution limits (10-15s) are never hit and live progress is visible
      const CHUNK_SIZE = 10;
      const chunks: typeof allStudentPayloads[] = [];
      for (let i = 0; i < allStudentPayloads.length; i += CHUNK_SIZE) {
        chunks.push(allStudentPayloads.slice(i, i + CHUNK_SIZE));
      }

      let totalCreated = 0;
      let totalUpdated = 0;
      let totalFailed = 0;
      const allErrors: Array<{ register_number: string; error: string }> = [];
      const allUnsyncedIds: string[] = [];

      for (let c = 0; c < chunks.length; c++) {
        if (chunks.length > 1) {
          const startNum = c * CHUNK_SIZE + 1;
          const endNum = Math.min((c + 1) * CHUNK_SIZE, allStudentPayloads.length);
          setImportProgressText(`Importing (${startNum}-${endNum} of ${allStudentPayloads.length})...`);
        } else {
          setImportProgressText(`Importing ${allStudentPayloads.length} student(s)...`);
        }

        const res = await studentApi.bulkImportStudents({
          students: chunks[c],
          targetScope,
        });

        totalCreated += res.createdCount || 0;
        totalUpdated += res.updatedCount || 0;
        totalFailed += res.failedCount || 0;
        if (Array.isArray(res.errors)) {
          allErrors.push(...res.errors);
        }
        if (Array.isArray(res.unsyncedStudentIds)) {
          allUnsyncedIds.push(...res.unsyncedStudentIds);
        }
      }

      setImportResult({
        success: totalFailed === 0,
        message: `Successfully processed ${allStudentPayloads.length} student(s): ${totalCreated} created, ${totalUpdated} updated${totalFailed > 0 ? `, ${totalFailed} failed` : ''}.`,
        createdCount: totalCreated,
        updatedCount: totalUpdated,
        failedCount: totalFailed,
        errors: allErrors,
      });

      // Enqueue any unsynced imported students into background auto-sync immediately
      if (allUnsyncedIds.length > 0) {
        autoSyncService.enqueueStudentIds(allUnsyncedIds);
      }

      // Purge cached lists and refresh student roster with latest live data
      clearClientCache('students_');
      clearClientCache('stats_');
      clearClientCache('staff_');
      await fetchStudents(false, true);
    } catch (err: any) {
      setImportResult({
        success: false,
        message: extractErrorMessage(err, 'Failed to import students from spreadsheet.'),
      });
    } finally {
      setIsImporting(false);
      setImportProgressText('');
    }
  };

  return (
    <Layout title="Student Management">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Users size={28} style={{ color: 'var(--primary)' }} />
              <span>Student Management</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              {isStaff ? 'Manage student records, assign mentors, and sync LeetCode profiles.' : 'View all registered students, assigned mentors, and track LeetCode stats.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <SyncStatus variant="badge" align="left" />

            {pendingSyncCount > 0 && (
              <button
                className="btn-secondary"
                onClick={() => handleSyncBatchOrAll(true)}
                disabled={syncingAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  borderColor: 'rgba(245, 158, 11, 0.45)',
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  color: '#fbbf24',
                  fontWeight: 700,
                  boxShadow: '0 0 12px rgba(245, 158, 11, 0.2)',
                }}
                title={`Fast sync only the ${pendingSyncCount} students currently showing 'Pending sync'`}
              >
                <RefreshCw size={15} className={syncingAll ? 'animate-spin' : ''} />
                <span>⚡ Sync Pending ({pendingSyncCount})</span>
              </button>
            )}

            <button
              className="btn-secondary"
              onClick={() => handleSyncBatchOrAll(false)}
              disabled={syncingAll}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={16} className={syncingAll ? 'animate-spin' : ''} />
              <span>
                {syncingAll
                  ? 'Syncing Live...'
                  : selectedStudentIds.size > 0
                  ? `⚡ Sync Selected (${selectedStudentIds.size})`
                  : search.trim()
                  ? `⚡ Live Sync: "${search.trim()}"`
                  : filterBatchId
                  ? 'Sync Active Batch'
                  : `Sync All Students (${students.filter((s) => s.leetcode_username).length})`}
              </span>
            </button>

            {canManage && (
              <>
                <button
                  className="btn-secondary"
                  onClick={handleOpenImportModal}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    borderColor: 'rgba(99, 102, 241, 0.4)',
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    color: '#818cf8',
                    fontWeight: 600,
                  }}
                >
                  <Upload size={16} />
                  <span>Bulk Import CSV / Excel</span>
                </button>

                <button
                  className="btn-primary"
                  onClick={handleOpenCreateModal}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <UserPlus size={16} />
                  <span>Add Student Record</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Interactive Live Sync Progress Card with Timer & Real-Time Progress */}
        {syncProgress.active && (
          <div
            className="glass-panel"
            style={{
              padding: '1.25rem 1.5rem',
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35), 0 0 15px rgba(59, 130, 246, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              animation: 'fadeIn 0.25s ease-in-out',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    color: '#60a5fa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <RefreshCw size={20} className="animate-spin" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>⚡ Live LeetCode Sync in Progress</span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        color: '#34d399',
                        fontWeight: 700,
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                      }}
                    >
                      ● Live Active
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {syncProgress.currentStudentName ? (
                      <span>Fetching profiles for: <strong style={{ color: '#93c5fd' }}>{syncProgress.currentStudentName}</strong></span>
                    ) : (
                      'Connecting to LeetCode API...'
                    )}
                  </div>
                </div>
              </div>

              {/* Timers & Counters */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                  title="Elapsed execution time"
                >
                  <Clock size={14} style={{ color: '#38bdf8' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Elapsed:</span>
                  <span style={{ fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                    {formatTimer(syncProgress.elapsedSeconds)}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                  title="Estimated time remaining"
                >
                  <Hourglass size={14} style={{ color: '#fbbf24' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Est. Remaining:</span>
                  <span style={{ fontWeight: 700, color: '#fbbf24', fontFamily: 'monospace' }}>
                    ~{formatTimer(syncProgress.estimatedRemainingSeconds)}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#34d399',
                    fontWeight: 700,
                  }}
                >
                  <span>{syncProgress.current} / {syncProgress.total}</span>
                  <span style={{ fontSize: '0.78rem', opacity: 0.85 }}>({syncProgress.percentage}%)</span>
                </div>
              </div>
            </div>

            {/* Smooth Shimmer Animated Progress Bar */}
            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '999px',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${syncProgress.percentage}%`,
                  background: 'linear-gradient(90deg, #38bdf8, #3b82f6, #10b981)',
                  borderRadius: '999px',
                  transition: 'width 0.4s ease',
                  boxShadow: '0 0 12px rgba(56, 189, 248, 0.6)',
                }}
              />
            </div>
          </div>
        )}

        {/* Completion Banner */}
        {syncCompletedSummary && (
          <div
            style={{
              padding: '0.85rem 1.25rem',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '10px',
              color: '#34d399',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.9rem',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <CheckCircle2 size={18} />
              <span style={{ fontWeight: 600 }}>{syncCompletedSummary}</span>
            </div>
            <button
              onClick={() => setSyncCompletedSummary(null)}
              style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', padding: '0.2rem' }}
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {syncNotice && (
          <div style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: '#34d399',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.875rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={16} />
              <span>{typeof syncNotice === 'string' ? syncNotice : String(syncNotice || '')}</span>
            </div>
            <button onClick={() => setSyncNotice(null)} style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search reg no, name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplyFilter();
              }}
              style={{ paddingLeft: '2.25rem', width: '100%' }}
            />
          </div>

          <select
            className="form-input"
            value={filterBatchId}
            onChange={(e) => {
              const selectedBatchId = e.target.value;
              setFilterBatchId(selectedBatchId);
              setFilterSectionId('');
              setFilterAllocBatchId('');
              if (selectedBatchId) {
                const b = batches.find((item) => item.id === selectedBatchId);
                if (b && b.department) setFilterDept(b.department);
              }
            }}
            style={{ flex: '1 1 140px' }}
          >
            <option value="">Academic Year (All)</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.batch_name}</option>
            ))}
          </select>

          <select
            className="form-input"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            style={{ flex: '1 1 130px' }}
          >
            <option value="">Study Year (All)</option>
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
            <option value="3rd Year">3rd Year</option>
            <option value="4th Year">4th Year</option>
          </select>

          <select
            className="form-input"
            value={filterDept}
            onChange={(e) => {
              setFilterDept(e.target.value);
              setFilterSectionId('');
              setFilterAllocBatchId('');
            }}
            style={{ flex: '1 1 120px' }}
          >
            <option value="">Department (All)</option>
            {Array.from(
              new Set(
                (filterBatchId
                  ? batches.filter((b) => b.id === filterBatchId)
                  : batches
                ).map((b) => b.department)
              )
            ).filter(Boolean).sort().map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          <select
            className="form-input"
            value={filterSectionId}
            onChange={(e) => {
              setFilterSectionId(e.target.value);
              setFilterAllocBatchId('');
            }}
            style={{ flex: '1 1 130px' }}
          >
            <option value="">Section (All)</option>
            {batches
              .filter((b) => (!filterBatchId || b.id === filterBatchId) && (!filterDept || b.department === filterDept))
              .flatMap((b) => b.sections || [])
              .map((sec) => (
                <option key={sec.id} value={sec.id}>Section {sec.name}</option>
              ))}
          </select>

          <select
            className="form-input"
            value={filterAllocBatchId}
            onChange={(e) => setFilterAllocBatchId(e.target.value)}
            disabled={!filterSectionId}
            style={{ flex: '1 1 150px' }}
          >
            <option value="">Allocation Batch (All)</option>
            {filterAllocBatches.map((ab) => (
              <option key={ab.id} value={ab.id}>{ab.name}</option>
            ))}
          </select>

          <select
            className="form-input"
            value={filterMentorId}
            onChange={(e) => setFilterMentorId(e.target.value)}
            style={{ flex: '1 1 170px' }}
          >
            <option value="">Mentor (All Students - {students.length})</option>
            <option value="UNASSIGNED">
              ⚠️ Unpaired / No Mentor ({tableUnassignedCount} {tableUnassignedCount === 1 ? 'student' : 'students'})
            </option>
            <optgroup label="Assigned Staff Mentors">
              {staffList.map((stf) => (
                <option key={stf.id} value={stf.id}>
                  👤 {stf.name} ({tableMentorCounts[stf.id] || 0} {(tableMentorCounts[stf.id] || 0) === 1 ? 'student' : 'students'})
                </option>
              ))}
            </optgroup>
          </select>

          {/* Action Buttons: Explicit Filter Trigger & Reset */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              className="btn-primary"
              onClick={handleApplyFilter}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.5rem 1rem',
                fontWeight: 700,
                fontSize: '0.85rem',
                backgroundColor: isFilterDirty ? 'var(--primary)' : 'rgba(59, 130, 246, 0.9)',
                boxShadow: isFilterDirty ? '0 0 14px rgba(59, 130, 246, 0.45)' : undefined,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              title="Apply selected filter criteria to student roster"
            >
              <Filter size={15} />
              <span>Filter</span>
              {selectedFilterCount > 0 && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    fontWeight: 800,
                  }}
                >
                  {selectedFilterCount}
                </span>
              )}
            </button>

            {(hasSelectedFilters || hasAppliedFilters) && (
              <button
                className="btn-secondary"
                onClick={handleResetFilters}
                disabled={loading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
                title="Clear all filters and view all students"
              >
                <X size={15} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Applied Filters Indicator Chips */}
        {hasAppliedFilters && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
              padding: '0.45rem 0.85rem',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '8px',
              fontSize: '0.8rem',
              color: '#93c5fd',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Filter size={13} style={{ color: '#60a5fa' }} />
              Active Filters:
            </span>
            {appliedFilters.search && (
              <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.08)' }}>
                Search: "{appliedFilters.search}"
              </span>
            )}
            {appliedFilters.batchId && (
              <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.08)' }}>
                Batch: {batches.find((b) => b.id === appliedFilters.batchId)?.batch_name || appliedFilters.batchId}
              </span>
            )}
            {appliedFilters.currentYear && (
              <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.08)' }}>
                Year: {appliedFilters.currentYear}
              </span>
            )}
            {appliedFilters.department && (
              <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.08)' }}>
                Dept: {appliedFilters.department}
              </span>
            )}
            {appliedFilters.sectionId && (
              <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.08)' }}>
                Section: {batches.flatMap((b) => b.sections || []).find((s) => s.id === appliedFilters.sectionId)?.name || appliedFilters.sectionId}
              </span>
            )}
            {appliedFilters.allocationBatchId && (
              <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.08)' }}>
                Alloc: {filterAllocBatches.find((ab) => ab.id === appliedFilters.allocationBatchId)?.name || appliedFilters.allocationBatchId}
              </span>
            )}
            {appliedFilters.mentorId && (
              <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.08)' }}>
                Mentor: {appliedFilters.mentorId === 'UNASSIGNED' ? 'Unpaired' : staffList.find((st) => st.id === appliedFilters.mentorId)?.name || 'Staff'}
              </span>
            )}
            <button
              onClick={handleResetFilters}
              style={{
                background: 'none',
                border: 'none',
                color: '#60a5fa',
                cursor: 'pointer',
                fontSize: '0.78rem',
                textDecoration: 'underline',
                marginLeft: 'auto',
              }}
            >
              Clear all
            </button>
          </div>
        )}

        {loading && (
          <InteractiveLoader
            mode="inline"
            title="HYDRATING STUDENT REGISTRY"
            subtitle="Streaming student index records • Precision telemetry active"
          />
        )}

        {error && (
          <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#f87171', borderRadius: 'var(--radius-sm)' }}>
            <span>{typeof error === 'string' ? error : (error as any)?.message || String(error)}</span>
          </div>
        )}

        {deleteSuccessNotice && (
          <div style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            color: '#4ade80',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <CheckCircle2 size={18} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{deleteSuccessNotice}</span>
            </div>
            <button
              onClick={() => setDeleteSuccessNotice(null)}
              style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer', padding: '0.2rem' }}
              title="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Bulk Action Controls Bar */}
        {canManage && selectedStudentIds.size > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.85rem 1.25rem',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: 'var(--radius-sm)',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              <span style={{ fontSize: '0.9rem' }}>
                Selected: <strong style={{ color: 'var(--primary)' }}>{selectedStudentIds.size}</strong> of {students.length} Student(s)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* Quick Bulk Mentor Assign / Unpair Selector */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <select
                  className="form-input"
                  value={tableQuickAssignStaffId}
                  onChange={(e) => setTableQuickAssignStaffId(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', height: '32px', minWidth: '185px' }}
                >
                  <option value="">⚡ Assign Mentor to Selected...</option>
                  <option value="NONE">❌ Unpair Selected (Remove Mentor)</option>
                  <optgroup label="Pair with Staff Mentor">
                    {staffList.map((stf) => (
                      <option key={stf.id} value={stf.id}>
                        👤 {stf.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleTableBulkMentorAssignment}
                  disabled={!tableQuickAssignStaffId || submitting}
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.35rem 0.75rem',
                    opacity: !tableQuickAssignStaffId ? 0.6 : 1,
                    cursor: !tableQuickAssignStaffId ? 'not-allowed' : 'pointer',
                  }}
                >
                  Apply
                </button>
              </div>

              <span style={{ color: 'var(--border-subtle)', margin: '0 0.25rem' }}>|</span>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleToggleSelectAll}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
              >
                {selectedStudentIds.size === students.length ? 'Deselect All' : `Select All (${students.length})`}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleClearSelection}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
              >
                Clear Selection
              </button>

              <button
                type="button"
                onClick={() => {
                  setBulkDeleteError(null);
                  setShowBulkDeleteModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.85rem',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={15} />
                <span>Delete Selected ({selectedStudentIds.size})</span>
              </button>
            </div>
          </div>
        )}

        {!loading && (() => {
          const totalStudents = students.length;
          const totalPages = Math.max(1, Math.ceil(totalStudents / pageSize));
          const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
          const startIndex = (safeCurrentPage - 1) * pageSize;
          const endIndex = Math.min(startIndex + pageSize, totalStudents);
          const paginatedStudents = students.slice(startIndex, endIndex);
          const isAllSelected = totalStudents > 0 && selectedStudentIds.size === totalStudents;

          return (
            <>
              <div className="glass-panel table-responsive-container">
                <table style={{ width: '100%', minWidth: '1050px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      {canManage && (
                        <th style={{ padding: '1rem', width: '40px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            onChange={handleToggleSelectAll}
                            style={{ cursor: 'pointer' }}
                            title="Select All Students"
                          />
                        </th>
                      )}
                      <th style={{ padding: '1rem', width: '60px', textAlign: 'center', whiteSpace: 'nowrap' }}>Rank</th>
                      <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Register Number</th>
                      <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Student Name</th>
                      <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Year</th>
                      <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Department</th>
                      <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Batch</th>
                      <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Section</th>
                      <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Allocation Batch</th>
                      <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Mentor (Staff)</th>
                      <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>LeetCode Handle</th>
                      <th style={{ padding: '1rem', whiteSpace: 'nowrap', textAlign: 'center' }}>Problems Solved</th>
                      {canManage && <th style={{ padding: '1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {totalStudents === 0 ? (
                      <tr>
                        <td colSpan={canManage ? 13 : 11} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          {hasAppliedFilters || hasSelectedFilters ? 'No students match your filter criteria.' : 'No students yet.'}
                        </td>
                      </tr>
                    ) : (
                      paginatedStudents.map((student, index) => {
                        const globalIndex = startIndex + index;
                        const isSelected = selectedStudentIds.has(student.id);
                        const isDeleting = deletingStudentIds.has(student.id);
                        return (
                          <tr
                            key={student.id}
                            onClick={() => !isDeleting && navigate(`/students/${student.id}`)}
                            className={isDeleting ? 'row-deleting-animation' : undefined}
                            style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              cursor: isDeleting ? 'not-allowed' : 'pointer',
                              backgroundColor: isDeleting
                                ? 'rgba(239, 68, 68, 0.18)'
                                : isSelected
                                ? 'rgba(99, 102, 241, 0.08)'
                                : 'transparent',
                              transition: 'all 0.35s ease',
                            }}
                          >
                            {canManage && (
                              <td style={{ padding: '1rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={isDeleting}
                                  onChange={(e) => handleToggleSelectStudent(student.id, e as any)}
                                  style={{ cursor: isDeleting ? 'not-allowed' : 'pointer' }}
                                />
                              </td>
                            )}
                            <td style={{ padding: '1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-block',
                                minWidth: '26px',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                backgroundColor: isDeleting ? 'rgba(239, 68, 68, 0.25)' : globalIndex < 3 ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                                color: isDeleting ? '#f87171' : globalIndex < 3 ? 'var(--primary)' : 'var(--text-secondary)',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                              }}>
                                {globalIndex + 1}
                              </span>
                            </td>
                            <td style={{ padding: '1rem', fontWeight: 700, color: isDeleting ? '#f87171' : 'var(--primary)', whiteSpace: 'nowrap' }}>
                              {student.register_number}
                            </td>
                            <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>{student.name}</span>
                                {isDeleting && (
                                  <span className="badge-deleting">
                                    <Trash2 size={11} className="animate-spin" />
                                    Deleting...
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                color: '#818cf8',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                              }}>
                                {formatStudyYear(student.current_year, student.batch?.batch_name, student.batch?.start_year)}
                              </span>
                            </td>
                            <td style={{ padding: '1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              {student.department}
                            </td>
                            <td style={{ padding: '1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              {student.batch?.batch_name || 'N/A'}
                            </td>
                            <td style={{ padding: '1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              Section {student.section?.name || 'N/A'}
                            </td>
                            <td style={{ padding: '1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.06)', padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                                {student.allocation_batch?.name || student.sub_batch || '-'}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem 1rem', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                              {canManage ? (
                                <select
                                  value={student.mentor_id || ''}
                                  onChange={(e) => handleInlineMentorChange(student.id, e.target.value)}
                                  className="form-input"
                                  style={{
                                    fontSize: '0.8rem',
                                    padding: '0.2rem 0.45rem',
                                    height: '28px',
                                    borderRadius: '6px',
                                    backgroundColor: student.mentor_id ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                                    color: student.mentor_id ? '#818cf8' : 'var(--text-muted)',
                                    border: student.mentor_id ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--border-subtle)',
                                    cursor: 'pointer',
                                    maxWidth: '170px',
                                    fontWeight: 500,
                                  }}
                                  title="Change mentor for this student"
                                >
                                  <option value="">⚠️ Unassigned</option>
                                  {staffList.map((stf) => (
                                    <option key={stf.id} value={stf.id}>
                                      👤 {stf.name}
                                    </option>
                                  ))}
                                </select>
                              ) : student.mentor?.name ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'rgba(99, 102, 241, 0.12)', color: '#818cf8', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                                  <UserCheck size={13} />
                                  <span>{student.mentor.name}</span>
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Unassigned</span>
                              )}
                            </td>
                            <td style={{ padding: '1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                              {student.leetcode_username ? (
                                <a
                                  href={`https://leetcode.com/u/${student.leetcode_username.replace(/^@/, '')}/`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                                    color: '#fb923c',
                                    fontWeight: 600,
                                    textDecoration: 'none',
                                    fontSize: '0.82rem',
                                    transition: 'all 0.15s ease',
                                    border: '1px solid rgba(249, 115, 22, 0.2)',
                                  }}
                                  title={`Open @${student.leetcode_username}'s LeetCode Profile in new tab`}
                                >
                                  <span>@{student.leetcode_username.replace(/^@/, '')}</span>
                                  <ExternalLink size={12} />
                                </a>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>Not linked</span>
                              )}
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {(() => {
                                const snap = (student as any).latest_snapshot || (student.snapshots && student.snapshots[0]);
                                if (!snap) {
                                  return (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                      {student.leetcode_username ? 'Pending sync' : '-'}
                                    </span>
                                  );
                                }
                                const total = snap.total_solved || 0;
                                return (
                                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
                                    <span style={{ fontWeight: 800, color: total > 0 ? '#10b981' : 'var(--text-muted)', fontSize: '0.95rem' }}>
                                      {total}
                                    </span>
                                    {total > 0 && (
                                      <div style={{ display: 'flex', gap: '0.25rem', fontSize: '0.7rem' }}>
                                        <span style={{ color: '#34d399', fontWeight: 600 }}>{snap.easy_solved || 0}E</span>
                                        <span style={{ color: 'var(--text-muted)' }}>·</span>
                                        <span style={{ color: '#facc15', fontWeight: 600 }}>{snap.medium_solved || 0}M</span>
                                        <span style={{ color: 'var(--text-muted)' }}>·</span>
                                        <span style={{ color: '#f87171', fontWeight: 600 }}>{snap.hard_solved || 0}H</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            {canManage && (
                              <td style={{ padding: '1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                                  {student.leetcode_username && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleLiveSyncStudent(student, e)}
                                      disabled={syncingStudentId === student.id || syncingAll}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        padding: '0.3rem 0.6rem',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        backgroundColor: syncingStudentId === student.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.12)',
                                        color: syncingStudentId === student.id ? '#60a5fa' : '#34d399',
                                        border: syncingStudentId === student.id ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(16, 185, 129, 0.3)',
                                        cursor: (syncingStudentId === student.id || syncingAll) ? 'not-allowed' : 'pointer',
                                        whiteSpace: 'nowrap',
                                      }}
                                      title={`Fetch live LeetCode data for @${student.leetcode_username}`}
                                    >
                                      <RefreshCw size={12} className={syncingStudentId === student.id ? 'animate-spin' : ''} />
                                      <span>{syncingStudentId === student.id ? 'Syncing...' : '⚡ Live Sync'}</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => handleOpenEditModal(student, e)}
                                    className="touch-target"
                                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.4rem' }}
                                    title="Edit Student"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    onClick={(e) => handleOpenDeleteStudent(student, e)}
                                    className="touch-target"
                                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0.4rem' }}
                                    title="Delete Student"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Enhanced Pagination Controls Bar */}
              {totalStudents > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  padding: '1rem 1.25rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.75rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span>
                      Showing <strong style={{ color: 'var(--text-primary)' }}>{startIndex + 1}</strong> to{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>{endIndex}</strong> of{' '}
                      <strong style={{ color: 'var(--primary)' }}>{totalStudents}</strong> students
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rows:</span>
                      <select
                        className="form-input"
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.8rem',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(30, 41, 59, 0.8)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          width: 'auto',
                        }}
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>

                  {totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        type="button"
                        className="btn-secondary touch-target"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={safeCurrentPage === 1}
                        style={{
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.825rem',
                          opacity: safeCurrentPage === 1 ? 0.45 : 1,
                          cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <ChevronLeft size={16} />
                        <span>Previous</span>
                      </button>

                      {/* Google-style Page Number navigation */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 2)
                        .map((p, idx, arr) => {
                          const prevP = arr[idx - 1];
                          const hasEllipsis = prevP && p - prevP > 1;
                          return (
                            <React.Fragment key={p}>
                              {hasEllipsis && <span style={{ padding: '0 0.25rem', color: 'var(--text-muted)' }}>...</span>}
                              <button
                                type="button"
                                onClick={() => setCurrentPage(p)}
                                style={{
                                  minWidth: '32px',
                                  height: '32px',
                                  padding: '0 0.5rem',
                                  borderRadius: '4px',
                                  border: p === safeCurrentPage ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                                  backgroundColor: p === safeCurrentPage ? 'var(--primary)' : 'rgba(30, 41, 59, 0.6)',
                                  color: p === safeCurrentPage ? '#ffffff' : 'var(--text-secondary)',
                                  fontWeight: p === safeCurrentPage ? 700 : 500,
                                  fontSize: '0.85rem',
                                  cursor: 'pointer',
                                }}
                              >
                                {p}
                              </button>
                            </React.Fragment>
                          );
                        })}

                      <button
                        type="button"
                        className="btn-secondary touch-target"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safeCurrentPage === totalPages}
                        style={{
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.825rem',
                          opacity: safeCurrentPage === totalPages ? 0.45 : 1,
                          cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <span>Next</span>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          );
        })()}

        {/* SINGLE DELETE STUDENT CONFIRMATION MODAL */}
        {showDeleteModal && studentToDelete && (
          <div className="modal-overlay-responsive">
            <div className="glass-panel modal-card-responsive" style={{ maxWidth: '450px' }}>
              {submitting ? (
                <div style={{ textAlign: 'center', padding: '1.25rem 0.5rem' }}>
                  <div className="delete-halo" style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(239, 68, 68, 0.3) 0%, rgba(239, 68, 68, 0.05) 70%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.25rem',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                  }}>
                    <Trash2 size={32} className="animate-spin" style={{ color: '#ef4444', animationDuration: '2.5s' }} />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f87171', marginBottom: '0.4rem' }}>
                    Deleting Student Record...
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                    Permanently removing <strong style={{ color: 'var(--text-primary)' }}>{studentToDelete.name}</strong> and purging associated daily coding snapshots.
                  </p>
                  <div className="delete-progress-bar" style={{ marginBottom: '1.25rem' }} />
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Updating database & cache... Please wait.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f87171' }}>
                      <ShieldAlert size={26} />
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Delete Student Record</h3>
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                      Permanent Action
                    </span>
                  </div>

                  {deleteError && (
                    <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                      <span>{deleteError}</span>
                      <button type="button" onClick={handleConfirmDeleteStudent} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.25rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                        Retry
                      </button>
                    </div>
                  )}

                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.5' }}>
                    Are you sure you want to delete student <strong style={{ color: 'var(--text-primary)' }}>{studentToDelete.name}</strong> (<span style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{studentToDelete.register_number}</span>)?
                  </p>
                  <p style={{ fontSize: '0.825rem', color: '#f87171', backgroundColor: 'rgba(248, 113, 113, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', border: '1px solid rgba(248, 113, 113, 0.25)' }}>
                    ⚠️ Warning: This will permanently remove this student record and all their associated daily coding snapshots.
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => { setShowDeleteModal(false); setStudentToDelete(null); setDeleteError(null); }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDeleteStudent}
                      style={{
                        padding: '0.6rem 1.25rem',
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <Trash2 size={16} />
                      Confirm Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* BULK DELETE CONFIRMATION MODAL */}
        {showBulkDeleteModal && (
          <div className="modal-overlay-responsive">
            <div className="glass-panel modal-card-responsive" style={{ maxWidth: '460px' }}>
              {submitting ? (
                <div style={{ textAlign: 'center', padding: '1.25rem 0.5rem' }}>
                  <div className="delete-halo" style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(239, 68, 68, 0.3) 0%, rgba(239, 68, 68, 0.05) 70%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.25rem',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                  }}>
                    <Trash2 size={34} className="animate-spin" style={{ color: '#ef4444', animationDuration: '2.5s' }} />
                  </div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f87171', marginBottom: '0.4rem' }}>
                    Deleting {students.filter((s) => selectedStudentIds.has(s.id)).length} Student Records...
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                    Safely purging student profiles, daily coding snapshots, mentor allocations, and activity logs.
                  </p>
                  <div className="delete-progress-bar" style={{ marginBottom: '1.25rem' }} />
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Updating database & cache... Please do not close this window.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f87171' }}>
                      <Trash2 size={26} />
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Delete Selected Students</h3>
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                      Permanent Action
                    </span>
                  </div>

                  {bulkDeleteError && (
                    <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                      <span>{bulkDeleteError}</span>
                      <button type="button" onClick={handleConfirmBulkDelete} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.25rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                        Retry
                      </button>
                    </div>
                  )}

                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: '1.5' }}>
                    Are you sure you want to delete <strong style={{ color: '#ef4444' }}>{students.filter((s) => selectedStudentIds.has(s.id)).length} selected student(s)</strong> from the current view?
                  </p>

                  <div style={{ maxHeight: '140px', overflowY: 'auto', marginBottom: '1rem', padding: '0.5rem 0.75rem', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid var(--border-subtle)' }}>
                    {students.filter((s) => selectedStudentIds.has(s.id)).slice(0, 8).map((s) => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.register_number} - {s.name}</span>
                        <span style={{ color: s.mentor?.name ? '#818cf8' : 'var(--text-muted)' }}>{s.mentor?.name || 'Unassigned'}</span>
                      </div>
                    ))}
                    {students.filter((s) => selectedStudentIds.has(s.id)).length > 8 && (
                      <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.35rem', textAlign: 'center' }}>
                        ...and {students.filter((s) => selectedStudentIds.has(s.id)).length - 8} more student(s)
                      </div>
                    )}
                  </div>

                  <p style={{ fontSize: '0.825rem', color: '#f87171', backgroundColor: 'rgba(248, 113, 113, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', border: '1px solid rgba(248, 113, 113, 0.25)' }}>
                    ⚠️ Warning: This will permanently remove the selected student records and all their associated daily coding snapshots.
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button type="button" className="btn-secondary" onClick={() => { setShowBulkDeleteModal(false); setBulkDeleteError(null); }}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmBulkDelete}
                      style={{
                        padding: '0.6rem 1.25rem',
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <Trash2 size={16} />
                      Confirm Bulk Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Add / Edit Student Modal */}
      {showStudentModal && (
        <div className="modal-overlay-responsive">
          <div className="glass-panel modal-card-responsive" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem' }}>
              {editingStudentId ? 'Edit Student Record' : 'Add Student Record'}
            </h3>
            <form onSubmit={handleSaveStudent}>
              <div className="form-group">
                <label className="form-label">Register Number (Unique)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 814723104029"
                  value={studentForm.register_number}
                  onChange={(e) => setStudentForm({ ...studentForm, register_number: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. John Doe"
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Department</label>
                <input
                  type="text"
                  className="form-input"
                  value={studentForm.department}
                  onChange={(e) => setStudentForm({ ...studentForm, department: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Batch</label>
                  <select
                    className="form-input"
                    value={studentForm.batch_id}
                    onChange={(e) => {
                      const bId = e.target.value;
                      setStudentForm({ ...studentForm, batch_id: bId, section_id: '' });
                    }}
                    required
                  >
                    <option value="">Select Batch</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>{b.batch_name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Section</label>
                  <select
                    className="form-input"
                    value={studentForm.section_id}
                    onChange={(e) => setStudentForm({ ...studentForm, section_id: e.target.value })}
                    required
                  >
                    <option value="">Select Section</option>
                    {batches.find((b) => b.id === studentForm.batch_id)?.sections?.map((sec) => (
                      <option key={sec.id} value={sec.id}>Section {sec.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Current Year (Optional)</label>
                  <select
                    className="form-input"
                    value={studentForm.current_year}
                    onChange={(e) => setStudentForm({ ...studentForm, current_year: e.target.value })}
                  >
                    <option value="">Select Year</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Allocation Batch (Optional)</label>
                  <select
                    className="form-input"
                    value={studentForm.allocation_batch_id || studentForm.sub_batch}
                    onChange={(e) => {
                      const selectedVal = e.target.value;
                      const availList = formAllocBatches.length > 0
                        ? formAllocBatches
                        : batches
                            .find((b) => b.id === studentForm.batch_id)
                            ?.sections?.find((sec) => sec.id === studentForm.section_id)
                            ?.allocation_batches || [];
                      const matchingAb = availList.find((b: any) => b.id === selectedVal || b.name === selectedVal);

                      setStudentForm({
                        ...studentForm,
                        allocation_batch_id: matchingAb?.id || selectedVal,
                        sub_batch: matchingAb?.name || selectedVal,
                      });
                    }}
                  >
                    <option value="">Select Allocation Batch</option>
                    {(formAllocBatches.length > 0
                      ? formAllocBatches
                      : batches
                          .find((b) => b.id === studentForm.batch_id)
                          ?.sections?.find((sec) => sec.id === studentForm.section_id)
                          ?.allocation_batches || []
                    ).map((ab: any) => (
                      <option key={ab.id || ab.name} value={ab.id || ab.name}>{ab.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Mentor (Staff)</label>
                <select
                  className="form-input"
                  value={studentForm.mentor_id}
                  onChange={(e) => setStudentForm({ ...studentForm, mentor_id: e.target.value })}
                >
                  <option value="">❌ None / Unassigned (No Mentor)</option>
                  <optgroup label="Available Faculty Mentors (Created by Admin)">
                    {staffList
                      .filter((stf) => stf.is_active || stf.isActive)
                      .map((stf) => (
                        <option key={stf.id} value={stf.id}>
                          👤 {stf.name} ({(stf.role || 'staff').toLowerCase()})
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">LeetCode Username *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. johndoe_code"
                  value={studentForm.leetcode_username}
                  onChange={(e) => setStudentForm({ ...studentForm, leetcode_username: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowStudentModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {editingStudentId ? 'Update Student' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Smart CSV / Excel Bulk Import Modal */}
      {showImportModal && (
        <div className="modal-overlay-responsive" style={{ zIndex: 1100 }}>
          <div className="modal-card-responsive" style={{
            backgroundColor: 'var(--bg-card, #1e293b)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg, 12px)',
            width: '100%',
            maxWidth: '950px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            padding: 0,
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  padding: '0.5rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  color: '#818cf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Smart CSV / Excel Student Bulk Import
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                    Auto-cleans LeetCode URLs, detects mentors, and assigns target batches & sections.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={downloadSampleCSVFile}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.65rem',
                    backgroundColor: 'rgba(52, 211, 153, 0.1)',
                    color: '#34d399',
                    border: '1px solid rgba(52, 211, 153, 0.25)',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Download a formatted sample spreadsheet"
                >
                  <Download size={13} />
                  <span>Sample Template</span>
                </button>

                <button
                  type="button"
                  onClick={handleCloseImportModal}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '0.35rem',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Target Scope Configuration */}
              <div style={{
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                padding: '1rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
              }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Target Academic Year (Batch) *
                  </label>
                  <select
                    className="form-input"
                    value={importBatchId}
                    onChange={(e) => handleImportBatchChange(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="">Select Target Batch</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.academicYear || b.batch_name} ({b.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Target Section *
                  </label>
                  <select
                    className="form-input"
                    value={importSectionId}
                    onChange={(e) => handleImportSectionChange(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="">Select Section</option>
                    <option value="ALL">✨ All Sections (Preserve from CSV / Batch)</option>
                    {batches
                      .find((b) => b.id === importBatchId)
                      ?.sections?.map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          Section {sec.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Study Year (Optional)
                  </label>
                  <select
                    className="form-input"
                    value={importCurrentYear}
                    onChange={(e) => setImportCurrentYear(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="">Auto-Detect / Optional</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Target Allocation Batch (Optional)
                  </label>
                  {importAllocBatches.length > 0 ? (
                    <select
                      className="form-input"
                      value={importAllocBatchId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setImportAllocBatchId(val);
                        const match = importAllocBatches.find((ab: any) => ab.id === val);
                        if (match) setImportSubBatchCustom(match.name);
                      }}
                      style={{ fontSize: '0.85rem' }}
                    >
                      <option value="">Inherit / None</option>
                      {importAllocBatches.map((ab: any) => (
                        <option key={ab.id} value={ab.id}>{ab.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Batch-1, Batch-3"
                      value={importSubBatchCustom}
                      onChange={(e) => setImportSubBatchCustom(e.target.value)}
                      style={{ fontSize: '0.85rem' }}
                    />
                  )}
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <UserCheck size={13} style={{ color: '#818cf8' }} />
                    <span>Mentor / Staff (Created by Admin)</span>
                  </label>
                  <select
                    className="form-input"
                    value={importMentorId}
                    onChange={(e) => handleImportMentorChange(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="">✨ Auto-Match from CSV Mentors (Default)</option>
                    <option value="NONE">❌ Unassigned / No Mentor</option>
                    <optgroup label="Assign Specific Staff (Created by Admin)">
                      {staffList.map((stf) => (
                        <option key={stf.id} value={stf.id}>
                          👤 {stf.name} ({(stf.role || 'staff').toLowerCase()})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Template Download & Universal Compatibility Bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.65rem 1rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <FileSpreadsheet size={16} style={{ color: '#818cf8' }} />
                  <span>Works with <strong>ANY Excel spreadsheet</strong> (.xlsx, .xls) or CSV file with any column arrangement</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={downloadSampleExcelFile}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      color: '#34d399',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    title="Download clean Excel (.xlsx) template"
                  >
                    <Download size={13} />
                    <span>Sample Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={downloadSampleCSVFile}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(99, 102, 241, 0.12)',
                      border: '1px solid rgba(99, 102, 241, 0.35)',
                      color: '#818cf8',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    title="Download clean CSV template"
                  >
                    <Download size={13} />
                    <span>Sample CSV</span>
                  </button>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileProcess(e.dataTransfer.files[0]);
                  }
                }}
                style={{
                  border: isDragging ? '2px dashed var(--primary)' : '2px dashed var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  backgroundColor: isDragging ? 'rgba(99, 102, 241, 0.08)' : 'rgba(15, 23, 42, 0.4)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => {
                  const input = document.getElementById('csv-file-input') as HTMLInputElement;
                  if (input) input.click();
                }}
              >
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt,.tsv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileProcess(e.target.files[0]);
                    }
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    padding: '0.75rem',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    color: 'var(--primary)',
                  }}>
                    <FileSpreadsheet size={28} />
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {importFileName ? (
                      <span style={{ color: '#818cf8' }}>📄 Loaded: {importFileName}</span>
                    ) : (
                      'Click to upload or drag & drop Excel (.xlsx, .xls) or CSV spreadsheet'
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Supports raw institutional rosters, LeetCode profile links, and multi-mentor sheets.
                  </div>
                </div>
              </div>

              {/* Status Alert if Import Result Exists */}
              {importResult && (
                <div style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  backgroundColor: importResult.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${importResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: importResult.success ? '#34d399' : '#f87171',
                  fontSize: '0.85rem',
                }}>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {importResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{importResult.message}</span>
                  </div>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <ul style={{ margin: '0.5rem 0 0 1.25rem', padding: 0, fontSize: '0.78rem' }}>
                      {importResult.errors.slice(0, 5).map((err, idx) => (
                        <li key={idx}><strong>{err.register_number}</strong>: {err.error}</li>
                      ))}
                      {importResult.errors.length > 5 && <li>...and {importResult.errors.length - 5} more issues.</li>}
                    </ul>
                  )}
                </div>
              )}

              {/* Preview Table & Filtering Controls */}
              {importRows.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* AI Intelligent Analysis Banner */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    fontSize: '0.8rem',
                    color: 'var(--text-primary)',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Sparkles size={16} style={{ color: '#818cf8' }} />
                      <span>
                        <strong>AI Analysis:</strong> {importRows.length} Student(s) Parsed &bull; {detectedMentors.filter((m) => m !== 'Unassigned').length} Mentor(s) Detected &bull; {importRows.filter((r) => r.isValid).length} Valid
                      </span>
                    </div>
                    {importDuplicateCount > 0 && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                        color: '#fbbf24',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                      }}>
                        ✨ {importDuplicateCount} Duplicate(s) Auto-Resolved
                      </span>
                    )}
                  </div>

                  {/* Multi-Sheet Selector if Excel file has multiple sheets */}
                  {workbookSheets.length > 1 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.6rem 0.9rem',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(30, 41, 59, 0.8)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600, color: '#38bdf8' }}>
                        <FileSpreadsheet size={16} />
                        <span>Multi-Sheet Excel Workbook:</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Choose Sheet to Import:</span>
                        <select
                          className="form-input"
                          value={selectedExcelSheet}
                          onChange={(e) => handleSheetChange(e.target.value)}
                          style={{ fontSize: '0.78rem', height: '30px', minWidth: '180px', borderColor: '#38bdf8' }}
                        >
                          {workbookSheets.map((sName) => (
                            <option key={sName} value={sName}>
                              📄 {sName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Universal Column Mapping Panel (Works with ANY Excel/CSV column order) */}
                  {availableColumns.length > 0 && (
                    <div style={{
                      borderRadius: '8px',
                      backgroundColor: 'rgba(30, 41, 59, 0.75)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      overflow: 'hidden',
                    }}>
                      <div
                        onClick={() => setShowColumnMappingPanel(!showColumnMappingPanel)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.6rem 0.9rem',
                          backgroundColor: 'rgba(99, 102, 241, 0.1)',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <Sliders size={16} style={{ color: '#818cf8' }} />
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Universal Column Mapping
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            color: '#34d399',
                            backgroundColor: 'rgba(52, 211, 153, 0.12)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                          }}>
                            ✓ Auto-Detected
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            (Works with ANY Excel column format &amp; order)
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ fontSize: '0.74rem', color: '#818cf8', fontWeight: 600 }}>
                            {showColumnMappingPanel ? '▲ Hide Mapping' : '⚙️ Customize Column Mapping ▼'}
                          </span>
                        </div>
                      </div>

                      {/* Mapping Controls Grid */}
                      {showColumnMappingPanel && (
                        <div style={{ padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Match columns from your uploaded Excel sheet to the system. The preview below updates instantly.
                            </span>
                            <button
                              type="button"
                              onClick={handleResetColumnMapping}
                              style={{
                                background: 'rgba(239, 68, 68, 0.12)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#f87171',
                                borderRadius: '4px',
                                padding: '0.2rem 0.5rem',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              🔄 Reset to Auto-Detected
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                            {/* Header Row Index */}
                            <div>
                              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                                📌 Header Row
                              </label>
                              <select
                                className="form-input"
                                value={columnMapping.headerRowIndex ?? activeMapping?.headerRowIndex ?? 0}
                                onChange={(e) => handleColumnMappingChange('headerRowIndex', parseInt(e.target.value, 10))}
                                style={{ fontSize: '0.75rem', height: '30px' }}
                              >
                                <option value="-1">No Header (First row is student data)</option>
                                <option value="0">Row 1 (First row contains column titles)</option>
                                <option value="1">Row 2 (Titles are on row 2)</option>
                                <option value="2">Row 3 (Titles are on row 3)</option>
                              </select>
                            </div>

                            {/* Register Number Column */}
                            <div>
                              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#fbbf24', display: 'block', marginBottom: '0.25rem' }}>
                                🏷️ Register Number Column *
                              </label>
                              <select
                                className="form-input"
                                value={columnMapping.regNoCol ?? activeMapping?.regNoCol ?? -1}
                                onChange={(e) => handleColumnMappingChange('regNoCol', parseInt(e.target.value, 10))}
                                style={{ fontSize: '0.75rem', height: '30px', borderColor: '#fbbf24' }}
                              >
                                <option value="-1">🔍 Auto-Detect</option>
                                {availableColumns.map((col) => (
                                  <option key={col.index} value={col.index}>
                                    Col {col.letter}: {col.headerName} {col.sampleValues.length > 0 ? `(${col.sampleValues[0]})` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Student Name Column */}
                            <div>
                              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#38bdf8', display: 'block', marginBottom: '0.25rem' }}>
                                👤 Student Name Column *
                              </label>
                              <select
                                className="form-input"
                                value={columnMapping.nameCol ?? activeMapping?.nameCol ?? -1}
                                onChange={(e) => handleColumnMappingChange('nameCol', parseInt(e.target.value, 10))}
                                style={{ fontSize: '0.75rem', height: '30px', borderColor: '#38bdf8' }}
                              >
                                <option value="-1">🔍 Auto-Detect</option>
                                {availableColumns.map((col) => (
                                  <option key={col.index} value={col.index}>
                                    Col {col.letter}: {col.headerName} {col.sampleValues.length > 0 ? `(${col.sampleValues[0]})` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* LeetCode Profile / URL Column */}
                            <div>
                              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#fb923c', display: 'block', marginBottom: '0.25rem' }}>
                                💻 LeetCode Profile / URL Column *
                              </label>
                              <select
                                className="form-input"
                                value={columnMapping.leetcodeCol ?? activeMapping?.leetcodeCol ?? -1}
                                onChange={(e) => handleColumnMappingChange('leetcodeCol', parseInt(e.target.value, 10))}
                                style={{ fontSize: '0.75rem', height: '30px', borderColor: '#fb923c' }}
                              >
                                <option value="-1">🔍 Auto-Detect</option>
                                {availableColumns.map((col) => (
                                  <option key={col.index} value={col.index}>
                                    Col {col.letter}: {col.headerName} {col.sampleValues.length > 0 ? `(${col.sampleValues[0]})` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Mentor Name Column */}
                            <div>
                              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#818cf8', display: 'block', marginBottom: '0.25rem' }}>
                                🎓 Mentor Name Column (Optional)
                              </label>
                              <select
                                className="form-input"
                                value={columnMapping.mentorCol ?? activeMapping?.mentorCol ?? -1}
                                onChange={(e) => handleColumnMappingChange('mentorCol', parseInt(e.target.value, 10))}
                                style={{ fontSize: '0.75rem', height: '30px' }}
                              >
                                <option value="-1">🔍 Auto-Detect from Sheet</option>
                                <option value="-2">❌ No Mentor Column (Keep Unassigned)</option>
                                {availableColumns.map((col) => (
                                  <option key={col.index} value={col.index}>
                                    Col {col.letter}: {col.headerName} {col.sampleValues.length > 0 ? `(${col.sampleValues[0]})` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Department Column */}
                            <div>
                              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                                🏛️ Department Column (Optional)
                              </label>
                              <select
                                className="form-input"
                                value={columnMapping.deptCol ?? activeMapping?.deptCol ?? -1}
                                onChange={(e) => handleColumnMappingChange('deptCol', parseInt(e.target.value, 10))}
                                style={{ fontSize: '0.75rem', height: '30px' }}
                              >
                                <option value="-1">🔍 Auto-Detect / Default (CSE)</option>
                                {availableColumns.map((col) => (
                                  <option key={col.index} value={col.index}>
                                    Col {col.letter}: {col.headerName}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Section Column */}
                            <div>
                              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                                📁 Section Column (Optional)
                              </label>
                              <select
                                className="form-input"
                                value={columnMapping.secCol ?? activeMapping?.secCol ?? -1}
                                onChange={(e) => handleColumnMappingChange('secCol', parseInt(e.target.value, 10))}
                                style={{ fontSize: '0.75rem', height: '30px' }}
                              >
                                <option value="-1">🔍 Auto-Detect from Sheet</option>
                                {availableColumns.map((col) => (
                                  <option key={col.index} value={col.index}>
                                    Col {col.letter}: {col.headerName}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Academic / Study Year Column */}
                            <div>
                              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                                📅 Academic / Study Year Column (Optional)
                              </label>
                              <select
                                className="form-input"
                                value={columnMapping.yearCol ?? activeMapping?.yearCol ?? -1}
                                onChange={(e) => handleColumnMappingChange('yearCol', parseInt(e.target.value, 10))}
                                style={{ fontSize: '0.75rem', height: '30px' }}
                              >
                                <option value="-1">🔍 Auto-Detect from Sheet</option>
                                {availableColumns.map((col) => (
                                  <option key={col.index} value={col.index}>
                                    Col {col.letter}: {col.headerName}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mentor to Staff Assignment & Unpair Mapping */}
                  {importRows.length > 0 && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                      padding: '0.85rem 1rem',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(30, 41, 59, 0.75)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          <UserCheck size={16} style={{ color: '#818cf8' }} />
                          <span>Map CSV Sheet Mentors to Registered Staff / Unpair Options:</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Matches registered staff or allows setting to Unpaired (No Mentor)
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
                        {/* Unpaired / Non-Mentor Students Mapping Card */}
                        {(importRows.some((r) => r.cleanMentor === 'Unassigned') || detectedMentors.length === 0) && (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              padding: '0.35rem 0.65rem',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(245, 158, 11, 0.12)',
                              border: '1px solid rgba(245, 158, 11, 0.35)',
                              fontSize: '0.78rem',
                            }}
                          >
                            <div style={{ fontWeight: 600, color: '#fbbf24', whiteSpace: 'nowrap' }}>
                              ⚠️ Unpaired / No Mentor ({importRows.filter((r) => r.cleanMentor === 'Unassigned').length || importRows.length}) &rarr;
                            </div>
                            <select
                              className="form-input"
                              value={mentorMappings['Unassigned'] || 'NONE'}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMentorMappings((prev) => ({ ...prev, Unassigned: val }));
                                if (val && val !== 'NONE' && val !== 'AUTO') {
                                  const staff = staffList.find((s) => s.id === val);
                                  setImportRows((prevRows) =>
                                    prevRows.map((r) =>
                                      r.cleanMentor === 'Unassigned'
                                        ? { ...r, mentorStaffId: val, cleanMentor: staff?.name || 'Assigned' }
                                        : r
                                    )
                                  );
                                }
                              }}
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.2rem 0.4rem',
                                height: '28px',
                                minWidth: '165px',
                                borderColor: mentorMappings['Unassigned'] && mentorMappings['Unassigned'] !== 'NONE' ? '#818cf8' : undefined,
                              }}
                            >
                              <option value="NONE">❌ Keep Unpaired / Unassigned</option>
                              <optgroup label="Pair with Registered Staff...">
                                {staffList.map((stf) => (
                                  <option key={stf.id} value={stf.id}>
                                    👤 {stf.name} ({(stf.role || 'staff').toLowerCase()})
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </div>
                        )}

                        {detectedMentors.filter((m) => m !== 'Unassigned').map((mentorName) => {
                          const studentCount = importRows.filter((r) => r.cleanMentor === mentorName).length;
                          const currentMappedVal = mentorMappings[mentorName] || 'NONE';
                          const matchedStaff = (currentMappedVal !== 'AUTO' && currentMappedVal !== 'NONE')
                            ? staffList.find((s) => s.id === currentMappedVal)
                            : (currentMappedVal === 'AUTO' ? findMatchingStaff(mentorName, staffList) : null);
                          const hasDirectStaffMatch = findMatchingStaff(mentorName, staffList) !== null;

                          return (
                            <div
                              key={mentorName}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                backgroundColor: matchedStaff
                                  ? 'rgba(99, 102, 241, 0.14)'
                                  : (currentMappedVal === 'NONE' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(15, 23, 42, 0.7)'),
                                border: matchedStaff
                                  ? '1px solid rgba(99, 102, 241, 0.35)'
                                  : (currentMappedVal === 'NONE' ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-subtle)'),
                                fontSize: '0.78rem',
                              }}
                            >
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                {hasDirectStaffMatch ? '👤' : '⚠️'} {mentorName}{' '}
                                <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>({studentCount})</span> &rarr;
                              </div>
                              <select
                                className="form-input"
                                value={currentMappedVal}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMentorMappings((prev) => ({ ...prev, [mentorName]: val }));
                                }}
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.2rem 0.4rem',
                                  height: '28px',
                                  minWidth: '165px',
                                  borderColor: matchedStaff ? '#818cf8' : (currentMappedVal === 'NONE' ? '#f87171' : undefined),
                                }}
                              >
                                <option value="NONE">❌ Unpair (No Mentor)</option>
                                {hasDirectStaffMatch && <option value="AUTO">🔍 Auto-Match Staff</option>}
                                <optgroup label="Assign to Registered Staff">
                                  {staffList.map((stf) => (
                                    <option key={stf.id} value={stf.id}>
                                      👤 {stf.name} ({(stf.role || 'staff').toLowerCase()})
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                              {!hasDirectStaffMatch && currentMappedVal === 'NONE' && (
                                <span style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 600 }}>Unpaired</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Filter Toolbar (Mentor, Year & Section Filter with All Options) */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    padding: '0.75rem',
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    {/* Top Row: Mentor Filter Pills & Search */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}>
                      {/* Mentor Filter Pills */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          Filter by Mentor:
                        </span>
                        
                        {/* All Mentors Button */}
                        <button
                          type="button"
                          onClick={() => handleSelectOnlyMentor('ALL')}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.28rem 0.65rem',
                            borderRadius: '16px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: selectedMentorFilters.has('ALL') ? 'var(--primary)' : 'rgba(255, 255, 255, 0.06)',
                            color: selectedMentorFilters.has('ALL') ? '#ffffff' : 'var(--text-secondary)',
                            border: selectedMentorFilters.has('ALL') ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          title="Show and import all mentors' students in the sheet"
                        >
                          <span>{selectedMentorFilters.has('ALL') ? '✓' : '○'}</span>
                          <span>All Mentors ({importRows.length})</span>
                        </button>

                        {/* Each Detected Mentor Pill */}
                        {detectedMentors.map((mentor) => {
                          const count = importRows.filter((r) => r.cleanMentor === mentor).length;
                          const isExplicitSingle = selectedMentorFilters.size === 1 && selectedMentorFilters.has(mentor);
                          const isSelectedInMulti = isMultiMentorMode && selectedMentorFilters.has(mentor);
                          const isActive = isExplicitSingle || isSelectedInMulti;
                          const isUnassigned = mentor === 'Unassigned';

                          return (
                            <button
                              key={mentor}
                              type="button"
                              onClick={() => handleToggleMentorFilter(mentor)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.28rem 0.65rem',
                                borderRadius: '16px',
                                border: isActive
                                  ? (isUnassigned ? '1px solid #d97706' : '1px solid var(--primary)')
                                  : '1px solid var(--border-subtle)',
                                backgroundColor: isActive
                                  ? (isUnassigned ? '#d97706' : 'var(--primary)')
                                  : 'rgba(255, 255, 255, 0.05)',
                                color: isActive ? '#ffffff' : (isUnassigned ? '#fbbf24' : 'var(--text-secondary)'),
                                fontWeight: isActive ? 700 : 500,
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              title={isMultiMentorMode ? `Click to toggle ${mentor} in/out` : `Click to filter preview to ONLY ${mentor}'s students`}
                            >
                              <span>{isActive ? '✓' : '○'}</span>
                              <span>{isUnassigned ? '⚠️ Unpaired / No Mentor' : `👤 ${mentor}`}</span>
                              <span style={{ opacity: 0.85, fontSize: '0.7rem' }}>({count})</span>
                            </button>
                          );
                        })}

                        {/* Multi-Select Toggle Switch */}
                        {detectedMentors.length > 1 && (
                          <label style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.72rem',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            marginLeft: '0.3rem',
                          }}>
                            <input
                              type="checkbox"
                              checked={isMultiMentorMode}
                              onChange={(e) => setIsMultiMentorMode(e.target.checked)}
                              style={{ cursor: 'pointer', width: '13px', height: '13px' }}
                            />
                            <span>Multi-mentor mode</span>
                          </label>
                        )}

                      </div>

                      {/* Search inside preview */}
                      <div style={{ position: 'relative', width: '220px' }}>
                        <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                          type="text"
                          placeholder="Search parsed students..."
                          value={importSearch}
                          onChange={(e) => setImportSearch(e.target.value)}
                          className="form-input"
                          style={{ paddingLeft: '2rem', paddingRight: '0.5rem', paddingTop: '0.35rem', paddingBottom: '0.35rem', fontSize: '0.8rem' }}
                        />
                      </div>
                    </div>

                    {/* Active Mentor Filter Banner */}
                    {!selectedMentorFilters.has('ALL') && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.45rem 0.75rem',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(99, 102, 241, 0.12)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        fontSize: '0.8rem',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span>🎯</span>
                          <span style={{ color: 'var(--text-primary)' }}>
                            Viewing Mentor: <strong>{Array.from(selectedMentorFilters).join(', ')}</strong> ({getFilteredImportRows().length} students visible).
                            <span style={{ marginLeft: '0.5rem', color: '#34d399', fontWeight: 600 }}>
                              Total selected for import: {importRows.filter((r) => r.selected && r.isValid).length} of {importRows.filter((r) => r.isValid).length} valid students across all mentors.
                            </span>
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={handleSelectOnlyVisibleStudents}
                            style={{
                              background: 'rgba(245, 158, 11, 0.15)',
                              border: '1px solid rgba(245, 158, 11, 0.4)',
                              color: '#fbbf24',
                              borderRadius: '4px',
                              padding: '0.15rem 0.45rem',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                            title="Only import the students visible under this mentor filter"
                          >
                            Select Only This Mentor ({getFilteredImportRows().filter((r) => r.isValid).length})
                          </button>
                          <button
                            type="button"
                            onClick={handleSelectAllStudents}
                            style={{
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              color: '#34d399',
                              borderRadius: '4px',
                              padding: '0.15rem 0.45rem',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                            title="Keep all students from all mentors selected for import"
                          >
                            ✓ Keep All {importRows.filter((r) => r.isValid).length} Selected
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectOnlyMentor('ALL')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#818cf8',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              textDecoration: 'underline',
                              cursor: 'pointer',
                            }}
                          >
                            Show All Mentors
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Second Row: Study Year & Section Filters */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      paddingTop: '0.4rem',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    }}>
                      {/* Year Filter Pills */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          Year:
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedYearFilter('ALL')}
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '16px',
                            fontSize: '0.73rem',
                            fontWeight: 600,
                            backgroundColor: selectedYearFilter === 'ALL' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.06)',
                            color: selectedYearFilter === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                            border: selectedYearFilter === 'ALL' ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                          }}
                        >
                          {selectedYearFilter === 'ALL' ? '✓ ' : ''}All Years
                        </button>
                        {Array.from(new Set([
                          ...detectedYears,
                          ...importRows.map((r) => r.currentYear).filter(Boolean) as string[],
                          '1st Year', '2nd Year', '3rd Year', '4th Year',
                        ]))
                          .filter((yr) => importRows.some((r) => (r.currentYear || r.academicYear || '').toLowerCase().includes(yr.toLowerCase())))
                          .map((yr) => {
                            const count = importRows.filter((r) => (r.currentYear || r.academicYear || '').toLowerCase().includes(yr.toLowerCase())).length;
                            const isSel = selectedYearFilter.toLowerCase() === yr.toLowerCase();
                            return (
                              <button
                                key={yr}
                                type="button"
                                onClick={() => setSelectedYearFilter(isSel ? 'ALL' : yr)}
                                style={{
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '16px',
                                  fontSize: '0.73rem',
                                  fontWeight: 600,
                                  backgroundColor: isSel ? 'var(--primary)' : 'rgba(255, 255, 255, 0.06)',
                                  color: isSel ? '#ffffff' : 'var(--text-secondary)',
                                  border: isSel ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                                  cursor: 'pointer',
                                }}
                              >
                                {isSel ? '✓ ' : ''}{yr} ({count})
                              </button>
                            );
                          })}
                      </div>

                      {/* Section Filter Pills */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          Section:
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedSectionFilter('ALL')}
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '16px',
                            fontSize: '0.73rem',
                            fontWeight: 600,
                            backgroundColor: selectedSectionFilter === 'ALL' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.06)',
                            color: selectedSectionFilter === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                            border: selectedSectionFilter === 'ALL' ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                          }}
                        >
                          {selectedSectionFilter === 'ALL' ? '✓ ' : ''}All Sections
                        </button>
                        {Array.from(new Set([
                          ...detectedSections,
                          ...importRows.map((r) => r.section).filter(Boolean) as string[],
                          ...(batches.find((b) => b.id === importBatchId)?.sections?.map((s) => s.name) || []),
                        ]))
                          .filter(Boolean)
                          .sort()
                          .filter((sec) => importRows.some((r) => (r.section || '').toUpperCase().replace(/^SECTION\s*/i, '').trim() === sec.toUpperCase().replace(/^SECTION\s*/i, '').trim()))
                          .map((sec) => {
                            const cleanSec = sec.toUpperCase().replace(/^SECTION\s*/i, '').trim();
                            const count = importRows.filter((r) => (r.section || '').toUpperCase().replace(/^SECTION\s*/i, '').trim() === cleanSec).length;
                            const isSel = selectedSectionFilter.toUpperCase().replace(/^SECTION\s*/i, '').trim() === cleanSec;
                            return (
                              <button
                                key={sec}
                                type="button"
                                onClick={() => setSelectedSectionFilter(isSel ? 'ALL' : cleanSec)}
                                style={{
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '16px',
                                  fontSize: '0.73rem',
                                  fontWeight: 600,
                                  backgroundColor: isSel ? 'var(--primary)' : 'rgba(255, 255, 255, 0.06)',
                                  color: isSel ? '#ffffff' : 'var(--text-secondary)',
                                  border: isSel ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                                  cursor: 'pointer',
                                }}
                              >
                                {isSel ? '✓ ' : ''}Sec {cleanSec} ({count})
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </div>

                  {/* Table Selection & Quick Bulk Mentor Assignment Helper */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(30, 41, 59, 0.85)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Showing <strong>{getFilteredImportRows().length}</strong> student(s) &bull; Selected:{' '}
                        <strong style={{ color: 'var(--primary)' }}>
                          {getFilteredImportRows().filter((r) => r.selected && r.isValid).length}
                        </strong>
                      </span>

                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <select
                          className="form-input"
                          value={quickAssignStaffId}
                          onChange={(e) => setQuickAssignStaffId(e.target.value)}
                          style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem', height: '28px', minWidth: '170px' }}
                        >
                          <option value="">⚡ Assign Selected to Mentor...</option>
                          <option value="NONE">❌ Set Unassigned (No Mentor)</option>
                          <optgroup label="Available Staff (Admin Created)">
                            {staffList.map((stf) => (
                              <option key={stf.id} value={stf.id}>
                                👤 {stf.name} ({(stf.role || 'staff').toLowerCase()})
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        <button
                          type="button"
                          onClick={handleApplyBulkMentorAssignment}
                          disabled={!quickAssignStaffId || getFilteredImportRows().filter((r) => r.selected && r.isValid).length === 0}
                          style={{
                            padding: '0.25rem 0.65rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            backgroundColor: quickAssignStaffId && getFilteredImportRows().filter((r) => r.selected && r.isValid).length > 0 ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                            color: '#ffffff',
                            border: 'none',
                            cursor: quickAssignStaffId && getFilteredImportRows().filter((r) => r.selected && r.isValid).length > 0 ? 'pointer' : 'not-allowed',
                          }}
                        >
                          Assign Mentor
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setImportRows((prev) => prev.map((r) => ({ ...r, selected: r.isValid })))}
                        style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '4px', padding: '0.2rem 0.5rem', color: '#818cf8', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
                      >
                        ✓ Select All in File ({importRows.filter((r) => r.isValid).length})
                      </button>
                      <span style={{ color: 'var(--text-muted)' }}>|</span>
                      <button
                        type="button"
                        onClick={() => handleToggleAllVisibleImportRows(false)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem', textDecoration: 'underline' }}
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  {/* Preview Scrollable Table */}
                  <div style={{
                    maxHeight: '320px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-card)',
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#0f172a', zIndex: 2 }}>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                          <th style={{ padding: '0.6rem 0.75rem', width: '36px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={
                                getFilteredImportRows().length > 0 &&
                                getFilteredImportRows().every((r) => r.selected || !r.isValid)
                              }
                              onChange={(e) => handleToggleAllVisibleImportRows(e.target.checked)}
                              style={{ cursor: 'pointer' }}
                            />
                          </th>
                          <th style={{ padding: '0.6rem 0.75rem' }}>Register No</th>
                          <th style={{ padding: '0.6rem 0.75rem' }}>Student Name</th>
                          <th style={{ padding: '0.6rem 0.75rem' }}>Year</th>
                          <th style={{ padding: '0.6rem 0.75rem' }}>Sec</th>
                          <th style={{ padding: '0.6rem 0.75rem' }}>Dept</th>
                          <th style={{ padding: '0.6rem 0.75rem' }}>LeetCode Handle</th>
                          <th style={{ padding: '0.6rem 0.75rem' }}>Detected Mentor</th>
                          <th style={{ padding: '0.6rem 0.75rem' }}>Assigned Staff (Mentor)</th>
                          <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getFilteredImportRows().map((row) => (
                          <tr
                            key={row.id}
                            style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              backgroundColor: row.selected ? 'rgba(99, 102, 241, 0.07)' : 'transparent',
                              opacity: row.isValid ? 1 : 0.6,
                            }}
                          >
                            <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={row.selected}
                                disabled={!row.isValid}
                                onChange={() => handleToggleImportRow(row.id)}
                                style={{ cursor: row.isValid ? 'pointer' : 'not-allowed' }}
                              />
                            </td>
                            <td style={{ padding: '0.55rem 0.75rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {row.cleanRegisterNumber || <span style={{ color: '#f87171' }}>Missing</span>}
                            </td>
                            <td style={{ padding: '0.55rem 0.75rem', color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {row.name}
                            </td>
                            <td style={{ padding: '0.55rem 0.75rem', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                color: '#818cf8',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                              }}>
                                {formatStudyYear(row.currentYear || importCurrentYear, null) !== '-'
                                  ? formatStudyYear(row.currentYear || importCurrentYear, null)
                                  : (row.academicYear || batches.find((b) => b.id === importBatchId)?.batch_name || 'Year 1')}
                              </span>
                            </td>
                            <td style={{ padding: '0.55rem 0.75rem', whiteSpace: 'nowrap' }}>
                              <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.06)', fontSize: '0.72rem' }}>
                                {row.section
                                  ? (row.section.toUpperCase().startsWith('SEC') ? row.section : `Sec ${row.section}`)
                                  : (batches.find((b) => b.id === importBatchId)?.sections?.find((s) => s.id === importSectionId)?.name
                                    ? `Sec ${batches.find((b) => b.id === importBatchId)?.sections?.find((s) => s.id === importSectionId)?.name}`
                                    : '-')}
                              </span>
                            </td>
                            <td style={{ padding: '0.55rem 0.75rem', color: 'var(--text-secondary)' }}>
                              <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.06)', fontSize: '0.72rem' }}>
                                {row.department}
                              </span>
                            </td>
                            <td style={{ padding: '0.55rem 0.75rem', fontFamily: 'monospace', color: '#818cf8' }}>
                              @{row.cleanLeetCode || <span style={{ color: '#f87171' }}>Missing</span>}
                            </td>
                            <td style={{ padding: '0.55rem 0.75rem', color: 'var(--text-secondary)' }}>
                              {row.cleanMentor}
                            </td>
                            <td style={{ padding: '0.4rem 0.6rem', whiteSpace: 'nowrap' }}>
                              {(() => {
                                let effectiveStaffId = '';
                                if (row.mentorStaffId && row.mentorStaffId !== 'AUTO') {
                                  effectiveStaffId = row.mentorStaffId;
                                } else if (importMentorId && importMentorId !== 'AUTO') {
                                  effectiveStaffId = importMentorId;
                                } else if (mentorMappings[row.cleanMentor] && mentorMappings[row.cleanMentor] !== 'AUTO') {
                                  effectiveStaffId = mentorMappings[row.cleanMentor];
                                }

                                return (
                                  <select
                                    className="form-input"
                                    value={effectiveStaffId}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const stf = staffList.find((s) => s.id === val);
                                      setImportRows((prev) =>
                                        prev.map((r) =>
                                          r.id === row.id
                                            ? {
                                                ...r,
                                                mentorStaffId: val || undefined,
                                                cleanMentor: val === 'NONE' ? 'Unassigned' : (stf?.name || r.cleanMentor),
                                              }
                                            : r
                                        )
                                      );
                                    }}
                                    style={{
                                      fontSize: '0.74rem',
                                      padding: '0.15rem 0.35rem',
                                      height: '26px',
                                      minWidth: '145px',
                                      borderColor: effectiveStaffId && effectiveStaffId !== 'NONE' ? '#818cf8' : undefined,
                                    }}
                                  >
                                    <option value="">
                                      {row.cleanMentor && row.cleanMentor !== 'Unassigned'
                                        ? `🔍 ${row.cleanMentor}`
                                        : '⚠️ Unassigned'}
                                    </option>
                                    <option value="NONE">❌ Unassigned</option>
                                    <optgroup label="Assign Staff">
                                      {staffList.map((stf) => (
                                        <option key={stf.id} value={stf.id}>
                                          👤 {stf.name}
                                        </option>
                                      ))}
                                    </optgroup>
                                  </select>
                                );
                              })()}
                            </td>
                            <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right' }}>
                              {row.isDuplicate ? (
                                <span style={{
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                  color: '#fbbf24',
                                }} title="Duplicate student in sheet (auto-deselected)">
                                  Duplicate
                                </span>
                              ) : row.isValid ? (
                                <span style={{
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                  color: '#34d399',
                                }}>
                                  Ready
                                </span>
                              ) : (
                                <span style={{
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                  color: '#f87171',
                                }} title={row.validationError}>
                                  Invalid
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {importRows.length > 0 && (
                  <span>
                    Ready to import <strong>{importRows.filter((r) => r.isValid).length}</strong> valid student(s) from sheet into selected Batch.
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseImportModal}
                  disabled={isImporting}
                >
                  Cancel
                </button>

                {!selectedMentorFilters.has('ALL') && (
                  <button
                    type="button"
                    onClick={() => handleExecuteImport('FILTERED')}
                    disabled={isImporting || getFilteredImportRows().filter((r) => r.isValid).length === 0}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.5rem 0.9rem',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(245, 158, 11, 0.18)',
                      border: '1px solid rgba(245, 158, 11, 0.45)',
                      color: '#fbbf24',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: isImporting || getFilteredImportRows().filter((r) => r.isValid).length === 0 ? 'not-allowed' : 'pointer',
                    }}
                    title="Import ONLY students for the currently selected mentor filter"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>{importProgressText || 'Importing Filtered...'}</span>
                      </>
                    ) : (
                      <>
                        <Upload size={15} />
                        <span>
                          Import Filtered ({getFilteredImportRows().filter((r) => r.isValid).length})
                        </span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleExecuteImport('ALL')}
                  disabled={isImporting || importRows.filter((r) => r.isValid).length === 0}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', minWidth: '170px', justifyContent: 'center' }}
                  title="Import ALL valid students across all mentors into selected Batch"
                >
                  {isImporting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{importProgressText || 'Importing...'}</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      <span>
                        Import All ({importRows.filter((r) => r.isValid).length} Students)
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
