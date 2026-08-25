import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout.js';
import { useAuth } from '../context/AuthContext.js';
import { studentApi, batchApi, staffApi, syncApi, Student, Batch, StaffUser } from '../services/api.js';
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
} from 'lucide-react';
import {
  analyzeAndParseStudents,
  downloadSampleCSVFile,
  ParsedImportRow,
  ParseResult,
} from '../utils/studentImportUtils.js';

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

export const StudentsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isStaff = user?.role === 'STAFF';
  const canManage = isAdmin || isStaff;
  const navigate = useNavigate();

  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncingAll, setSyncingAll] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [filterBatchId, setFilterBatchId] = useState<string>('');
  const [filterSectionId, setFilterSectionId] = useState<string>('');
  const [filterDept, setFilterDept] = useState<string>('');
  const [filterAllocBatchId, setFilterAllocBatchId] = useState<string>('');
  const [filterMentorId, setFilterMentorId] = useState<string>('');
  const [filterAllocBatches, setFilterAllocBatches] = useState<any[]>([]);
  const [formAllocBatches, setFormAllocBatches] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Selection & Bulk Action States
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
  const [selectedMentorFilters, setSelectedMentorFilters] = useState<Set<string>>(new Set(['ALL']));
  const [importBatchId, setImportBatchId] = useState<string>('');
  const [importSectionId, setImportSectionId] = useState<string>('');
  const [importAllocBatchId, setImportAllocBatchId] = useState<string>('');
  const [importSubBatchCustom, setImportSubBatchCustom] = useState<string>('');
  const [importCurrentYear, setImportCurrentYear] = useState<string>('');
  const [importAllocBatches, setImportAllocBatches] = useState<any[]>([]);
  const [importSearch, setImportSearch] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    createdCount?: number;
    updatedCount?: number;
    failedCount?: number;
    errors?: Array<{ register_number: string; error: string }>;
  } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchStudents = async (showLoadingSpinner: boolean = true) => {
    try {
      if (showLoadingSpinner && students.length === 0) {
        setLoading(true);
      }
      const data = await studentApi.getStudents({
        batchId: filterBatchId || undefined,
        sectionId: filterSectionId || undefined,
        department: filterDept || undefined,
        allocationBatchId: filterAllocBatchId || undefined,
        mentorId: filterMentorId || undefined,
        search: debouncedSearch || undefined,
      });
      setStudents(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load student roster');
    } finally {
      setLoading(false);
    }
  };

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
    if (selectedStudentIds.size === students.length && students.length > 0) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(students.map((s) => s.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedStudentIds(new Set());
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedStudentIds.size === 0) return;
    const toDeleteSet = new Set(selectedStudentIds);
    // Optimistic UI removal
    setStudents((prev) => prev.filter((s) => !toDeleteSet.has(s.id)));
    setShowBulkDeleteModal(false);
    setSelectedStudentIds(new Set());
    try {
      setSubmitting(true);
      await studentApi.bulkDeleteStudents(Array.from(toDeleteSet));
    } catch (err: any) {
      fetchStudents(false);
      alert(err.response?.data?.error || 'Failed to delete selected students');
    } finally {
      setSubmitting(false);
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
    // Optimistic UI removal
    setStudents((prev) => prev.filter((s) => s.id !== deletedId));
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      next.delete(deletedId);
      return next;
    });
    setShowDeleteModal(false);
    setStudentToDelete(null);

    try {
      setSubmitting(true);
      setDeleteError(null);
      await studentApi.deleteStudent(deletedId);
    } catch (err: any) {
      fetchStudents(false);
      alert(err.response?.data?.error || 'Failed to delete student record');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [debouncedSearch, filterBatchId, filterSectionId, filterDept, filterAllocBatchId, filterMentorId]);

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

  const handleSyncBatchOrAll = async () => {
    try {
      setSyncingAll(true);
      setSyncNotice(null);
      if (filterBatchId) {
        const res = await syncApi.syncBatch(filterBatchId);
        setSyncNotice(`Batch sync completed: ${res.data.successful} synced successfully.`);
      } else if (isAdmin) {
        const res = await syncApi.syncAll();
        setSyncNotice(`Global sync completed: ${res.successful} synced successfully.`);
      }
      fetchStudents(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to sync LeetCode data');
    } finally {
      setSyncingAll(false);
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

    try {
      setSubmitting(true);
      if (editingStudentId) {
        const updated = await studentApi.updateStudent(editingStudentId, studentForm);
        if (updated && updated.id) {
          setStudents((prev) => prev.map((s) => s.id === editingStudentId ? { ...s, ...updated } : s));
        }
      } else {
        const created = await studentApi.createStudent(studentForm);
        if (created && created.id) {
          setStudents((prev) => [created, ...prev]);
        }
      }
      setShowStudentModal(false);
      fetchStudents(false);
    } catch (err: any) {
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
    setImportResult(null);

    // Prepopulate default batch and section if available
    if (batches.length > 0) {
      const defaultB = batches[0];
      setImportBatchId(defaultB.id);
      if (defaultB.sections && defaultB.sections.length > 0) {
        setImportSectionId(defaultB.sections[0].id);
      }
    }
    setShowImportModal(true);
  };

  const handleCloseImportModal = () => {
    setShowImportModal(false);
    setImportFileName('');
    setImportRows([]);
    setSelectedMentorFilters(new Set(['ALL']));
    setImportCurrentYear('');
    setImportResult(null);
  };

  const handleFileProcess = (file: File) => {
    if (!file) return;
    setImportFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const result = analyzeAndParseStudents(text);
      setImportRows(result.rows);
      setDetectedMentors(result.detectedMentors);

      // Smart Auto-Filter for logged in user (e.g. Dr. A. Muthuraj)
      if (user?.name) {
        const userNorm = user.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matched = result.detectedMentors.find((m) => {
          const mNorm = m.toLowerCase().replace(/[^a-z0-9]/g, '');
          return mNorm.includes(userNorm) || userNorm.includes(mNorm);
        });
        if (matched) {
          setSelectedMentorFilters(new Set([matched]));
        } else {
          setSelectedMentorFilters(new Set(['ALL']));
        }
      } else {
        setSelectedMentorFilters(new Set(['ALL']));
      }
    };
    reader.readAsText(file);
  };

  const handleToggleMentorFilter = (mentor: string) => {
    if (mentor === 'ALL') {
      setSelectedMentorFilters(new Set(['ALL']));
      return;
    }

    setSelectedMentorFilters((prev) => {
      const next = new Set(prev);
      next.delete('ALL');

      if (next.has(mentor)) {
        next.delete(mentor);
        if (next.size === 0) {
          next.add('ALL');
        }
      } else {
        next.add(mentor);
      }
      return next;
    });
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
      prev.map((r) => (visibleIds.has(r.id) && r.isValid ? { ...r, selected: selectAll } : r))
    );
  };

  const getFilteredImportRows = () => {
    return importRows.filter((row) => {
      // Mentor filter (supports multi-selection of mentors)
      if (!selectedMentorFilters.has('ALL') && !selectedMentorFilters.has(row.cleanMentor)) {
        return false;
      }
      // Text search
      if (importSearch.trim()) {
        const s = importSearch.toLowerCase();
        const matchesReg = row.cleanRegisterNumber.toLowerCase().includes(s);
        const matchesName = row.name.toLowerCase().includes(s);
        const matchesHandle = row.cleanLeetCode.toLowerCase().includes(s);
        const matchesMentor = row.cleanMentor.toLowerCase().includes(s);
        if (!matchesReg && !matchesName && !matchesHandle && !matchesMentor) return false;
      }
      return true;
    });
  };

  const handleExecuteImport = async () => {
    // CRITICAL: Strictly import ONLY the rows that are matching active filter AND selected!
    const targetRowsToImport = getFilteredImportRows().filter((r) => r.selected && r.isValid);
    if (targetRowsToImport.length === 0) {
      alert('Please select at least one valid student to import from the filtered list.');
      return;
    }

    if (!importBatchId || !importSectionId) {
      alert('Please select a target Academic Year (Batch) and Section.');
      return;
    }

    try {
      setIsImporting(true);
      setImportResult(null);

      const payload = {
        students: targetRowsToImport.map((r) => ({
          register_number: r.cleanRegisterNumber,
          name: r.name,
          department: r.department || 'CSE',
          batch_id: importBatchId,
          section_id: importSectionId,
          allocation_batch_id: importAllocBatchId || undefined,
          sub_batch: importSubBatchCustom || undefined,
          current_year: r.currentYear || importCurrentYear || undefined,
          leetcode_username: r.cleanLeetCode,
          mentor_name: r.cleanMentor !== 'Unassigned' ? r.cleanMentor : undefined,
        })),
        targetScope: {
          batch_id: importBatchId,
          section_id: importSectionId,
          allocation_batch_id: importAllocBatchId || undefined,
          sub_batch: importSubBatchCustom || undefined,
          current_year: importCurrentYear || undefined,
        },
      };

      const res = await studentApi.bulkImportStudents(payload);

      setImportResult({
        success: true,
        message: res.message,
        createdCount: res.createdCount,
        updatedCount: res.updatedCount,
        failedCount: res.failedCount,
        errors: res.errors,
      });

      // Refresh student roster
      fetchStudents(false);
    } catch (err: any) {
      setImportResult({
        success: false,
        message: err.response?.data?.error || 'Failed to import students from spreadsheet.',
      });
    } finally {
      setIsImporting(false);
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

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn-secondary"
              onClick={handleSyncBatchOrAll}
              disabled={syncingAll}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={16} className={syncingAll ? 'animate-spin' : ''} />
              <span>{syncingAll ? 'Syncing...' : filterBatchId ? 'Sync Active Batch' : 'Sync All Students'}</span>
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
              <span>{syncNotice}</span>
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
            style={{ flex: '1 1 140px' }}
          >
            <option value="">Mentor (All Staff)</option>
            {staffList.map((stf) => (
              <option key={stf.id} value={stf.id}>{stf.name}</option>
            ))}
          </select>
        </div>

        {loading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto 0.5rem auto', color: 'var(--primary)' }} />
            <span>Loading student records...</span>
          </div>
        )}

        {error && (
          <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#f87171', borderRadius: 'var(--radius-sm)' }}>
            {error}
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
                onClick={() => setShowBulkDeleteModal(true)}
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

        {!loading && (
          <div className="glass-panel table-responsive-container">
            <table style={{ width: '100%', minWidth: '1050px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>

              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  {canManage && (
                    <th style={{ padding: '1rem', width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={students.length > 0 && selectedStudentIds.size === students.length}
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
                  {canManage && <th style={{ padding: '1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 12 : 10} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {search || filterBatchId ? 'No students match your filter criteria.' : 'No students yet.'}
                    </td>
                  </tr>
                ) : (
                  students.map((student, index) => {
                    const isSelected = selectedStudentIds.has(student.id);
                    return (
                      <tr
                        key={student.id}
                        onClick={() => navigate(`/students/${student.id}`)}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                          transition: 'var(--transition-fast)',
                        }}
                      >
                        {canManage && (
                          <td style={{ padding: '1rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleToggleSelectStudent(student.id, e as any)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                        )}
                        <td style={{ padding: '1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-block',
                            minWidth: '26px',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            backgroundColor: index < 3 ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                            color: index < 3 ? 'var(--primary)' : 'var(--text-secondary)',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                          }}>
                            {index + 1}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                          {student.register_number}
                        </td>
                        <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {student.name}
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
                        <td style={{ padding: '1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {student.mentor?.name ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'rgba(99, 102, 241, 0.12)', color: '#818cf8', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                              <UserCheck size={13} />
                              <span>{student.mentor.name}</span>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Unassigned</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {student.leetcode_username ? `@${student.leetcode_username}` : 'Not linked'}
                        </td>
                        {canManage && (
                          <td style={{ padding: '1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
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
        )}

        {/* SINGLE DELETE STUDENT CONFIRMATION MODAL */}
        {showDeleteModal && studentToDelete && (
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
                Are you sure you want to delete student <strong style={{ color: 'var(--text-primary)' }}>{studentToDelete.name}</strong> (<span style={{ fontFamily: 'monospace' }}>{studentToDelete.register_number}</span>)?
              </p>
              <p style={{ fontSize: '0.825rem', color: '#f87171', backgroundColor: 'rgba(248, 113, 113, 0.1)', padding: '0.65rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
                ⚠️ Warning: This will permanently remove this student record and all their associated daily coding snapshots.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setShowDeleteModal(false); setStudentToDelete(null); }}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteStudent}
                  disabled={submitting}
                  style={{
                    padding: '0.6rem 1.25rem',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BULK DELETE CONFIRMATION MODAL */}
        {showBulkDeleteModal && (
          <div className="modal-overlay-responsive">
            <div className="glass-panel modal-card-responsive" style={{ maxWidth: '440px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f87171', marginBottom: '1rem' }}>
                <Trash2 size={26} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Delete Selected Students</h3>
              </div>

              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                Are you sure you want to delete <strong style={{ color: 'var(--primary)' }}>{selectedStudentIds.size} selected student(s)</strong>?
              </p>
              <p style={{ fontSize: '0.825rem', color: '#f87171', backgroundColor: 'rgba(248, 113, 113, 0.1)', padding: '0.65rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
                ⚠️ Warning: This will permanently remove the selected student records and all their associated daily coding snapshots.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowBulkDeleteModal(false)} disabled={submitting}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkDelete}
                  disabled={submitting}
                  style={{
                    padding: '0.6rem 1.25rem',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Deleting...' : 'Confirm Bulk Delete'}
                </button>
              </div>
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
                  <option value="">Select Mentor</option>
                  {staffList
                    .filter((stf) => stf.is_active || stf.isActive)
                    .map((stf) => (
                      <option key={stf.id} value={stf.id}>
                        {stf.name}
                      </option>
                    ))}
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
                    onChange={(e) => {
                      const newBatchId = e.target.value;
                      setImportBatchId(newBatchId);
                      const b = batches.find((item) => item.id === newBatchId);
                      if (b && b.sections && b.sections.length > 0) {
                        setImportSectionId(b.sections[0].id);
                      } else {
                        setImportSectionId('');
                      }
                    }}
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
                    onChange={(e) => setImportSectionId(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="">Select Section</option>
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
                  accept=".csv,.txt,.tsv"
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
                      'Click to upload or drag & drop CSV spreadsheet'
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
                  {/* Filter Toolbar */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    {/* Mentor Filter Pills */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Mentor Filter:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleMentorFilter('ALL')}
                        style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: '16px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: selectedMentorFilters.has('ALL') ? 'var(--primary)' : 'rgba(255, 255, 255, 0.06)',
                          color: selectedMentorFilters.has('ALL') ? '#ffffff' : 'var(--text-secondary)',
                          border: selectedMentorFilters.has('ALL') ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                        }}
                      >
                        {selectedMentorFilters.has('ALL') ? '✓ ' : ''}All Students ({importRows.length})
                      </button>
                      {detectedMentors.map((mentor) => {
                        const count = importRows.filter((r) => r.cleanMentor === mentor).length;
                        const isSelected = selectedMentorFilters.has(mentor) && !selectedMentorFilters.has('ALL');
                        return (
                          <button
                            key={mentor}
                            type="button"
                            onClick={() => handleToggleMentorFilter(mentor)}
                            style={{
                              padding: '0.25rem 0.6rem',
                              borderRadius: '16px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: isSelected ? 'var(--primary)' : 'rgba(255, 255, 255, 0.06)',
                              color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                              border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                              cursor: 'pointer',
                            }}
                            title={`Click to toggle ${mentor}`}
                          >
                            {isSelected ? '✓ ' : ''}👤 {mentor} ({count})
                          </button>
                        );
                      })}
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

                  {/* Table Selection Helper */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0 0.25rem' }}>
                    <div>
                      Showing <strong>{getFilteredImportRows().length}</strong> student(s) &bull; Selected:{' '}
                      <strong style={{ color: 'var(--primary)' }}>
                        {getFilteredImportRows().filter((r) => r.selected && r.isValid).length}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleAllVisibleImportRows(true)}
                        style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.78rem', textDecoration: 'underline' }}
                      >
                        Select All Visible
                      </button>
                      <span>|</span>
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
                          <th style={{ padding: '0.6rem 0.75rem' }}>Dept</th>
                          <th style={{ padding: '0.6rem 0.75rem' }}>LeetCode Handle</th>
                          <th style={{ padding: '0.6rem 0.75rem' }}>Detected Mentor</th>
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
                            <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right' }}>
                              {row.isValid ? (
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
                    Ready to import <strong>{getFilteredImportRows().filter((r) => r.selected && r.isValid).length}</strong> student(s) into selected Batch.
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseImportModal}
                  disabled={isImporting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleExecuteImport}
                  disabled={isImporting || getFilteredImportRows().filter((r) => r.selected && r.isValid).length === 0}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', minWidth: '170px', justifyContent: 'center' }}
                >
                  {isImporting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      <span>Import Selected ({getFilteredImportRows().filter((r) => r.selected && r.isValid).length})</span>
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
