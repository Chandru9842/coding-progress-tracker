import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout.js';
import { useAuth } from '../context/AuthContext.js';
import { studentApi, batchApi, staffApi, syncApi, Student, Batch, StaffUser } from '../services/api.js';
import { Users, UserPlus, Search, Edit2, Trash2, Loader2, Filter, RefreshCw, X, CheckCircle2, UserCheck, ShieldAlert } from 'lucide-react';

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
              <button
                className="btn-primary"
                onClick={handleOpenCreateModal}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <UserPlus size={16} />
                <span>Add Student Record</span>
              </button>
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
                    <td colSpan={canManage ? 11 : 9} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
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
    </Layout>
  );
};
