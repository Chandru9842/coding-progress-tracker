import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout.js';
import { staffApi, batchApi, studentApi, StaffListItem, StaffDetail, Batch, Student } from '../services/api.js';
import { UserPlus, UserCheck, UserX, Key, Settings2, Search, Loader2, Check, X, ShieldAlert, Pencil, Trash2 } from 'lucide-react';

export const StaffManagementPage: React.FC = () => {
  const [staffList, setStaffList] = useState<StaffListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState<boolean>(false);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);

  // Selected Staff for actions
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [staffDetail, setStaffDetail] = useState<StaffDetail | null>(null);

  // Form States - Create Staff
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', confirmPassword: '', isActive: true });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form States - Edit Staff
  const [editForm, setEditForm] = useState({ id: '', name: '', email: '', password: '', confirmPassword: '', assignedBatchIds: [] as string[] });
  const [editError, setEditError] = useState<string | null>(null);

  // Form States - Delete Staff
  const [staffToDelete, setStaffToDelete] = useState<StaffListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Form States - Reset Password
  const [newPassword, setNewPassword] = useState('');

  // Assignment Modal States
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [sectionStudents, setSectionStudents] = useState<Student[]>([]);
  const [allocationBatches, setAllocationBatches] = useState<any[]>([]);
  const [selectedAllocationBatchId, setSelectedAllocationBatchId] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [assignmentMode, setAssignmentMode] = useState<'ALL' | 'ALLOCATION_BATCH' | 'SELECTED'>('ALL');
  const [assignedBatchIds, setAssignedBatchIds] = useState<Set<string>>(new Set());

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const [staffData, batchData] = await Promise.all([
        staffApi.getAllStaff(),
        batchApi.getAllBatches().catch(() => []),
      ]);
      setStaffList(staffData);
      setAllBatches(batchData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load staff list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // Handlers for Create Staff
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!createForm.name || !createForm.email || !createForm.password) {
      setFormError('Name, email, and password are required.');
      return;
    }

    if (createForm.password !== createForm.confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      await staffApi.createStaff({
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        isActive: createForm.isActive,
      });
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', password: '', confirmPassword: '', isActive: true });
      fetchStaff();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create staff member.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handlers for Edit Staff
  const handleOpenEdit = (staff: StaffListItem) => {
    const currentBatchIds = staff.assignedBatches ? staff.assignedBatches.map((b) => b.id) : [];
    setEditForm({
      id: staff.id,
      name: staff.name,
      email: staff.email,
      password: '',
      confirmPassword: '',
      assignedBatchIds: currentBatchIds,
    });
    setEditError(null);
    setShowEditModal(true);
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    if (!editForm.name || !editForm.email) {
      setEditError('Name and email are required.');
      return;
    }

    if (editForm.password && editForm.password !== editForm.confirmPassword) {
      setEditError('Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      await staffApi.updateStaff(editForm.id, {
        name: editForm.name,
        email: editForm.email,
        password: editForm.password || undefined,
        assignedBatchIds: editForm.assignedBatchIds,
      });
      setShowEditModal(false);
      fetchStaff();

    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Failed to update staff member.');
    } finally {
      setSubmitting(false);
    }
  };



  // Handlers for Delete Staff
  const handleOpenDelete = (staff: StaffListItem) => {
    setStaffToDelete(staff);
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!staffToDelete) return;
    const deletingId = staffToDelete.id;
    setStaffList((prev) => prev.filter((s) => s.id !== deletingId));
    setShowDeleteModal(false);
    setStaffToDelete(null);
    try {
      await staffApi.deleteStaff(deletingId);
    } catch (err: any) {
      fetchStaff();
    }
  };

  // Toggle Active Status
  const handleToggleStatus = async (staff: StaffListItem) => {
    setStaffList((prev) =>
      prev.map((s) => (s.id === staff.id ? { ...s, isActive: !s.isActive } : s))
    );
    try {
      await staffApi.updateStatus(staff.id, !staff.isActive);
    } catch (err: any) {
      fetchStaff();
    }
  };


  // Open Reset Password
  const handleOpenPasswordReset = (staffId: string) => {
    setSelectedStaffId(staffId);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId || !newPassword) return;

    try {
      setSubmitting(true);
      await staffApi.resetPassword(selectedStaffId, newPassword);
      setShowPasswordModal(false);
      alert('Password reset successfully.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Manage Assignments Modal
  const handleOpenAssignments = async (staffId: string) => {
    try {
      setSelectedStaffId(staffId);
      setLoading(true);
      const [detail, batches] = await Promise.all([
        staffApi.getStaffById(staffId),
        batchApi.getAllBatches(),
      ]);

      setStaffDetail(detail);
      setAllBatches(batches);
      setAssignedBatchIds(new Set(detail.assignedBatches.map((b) => b.id)));

      if (batches.length > 0) {
        setSelectedBatchId(batches[0].id);
        if (batches[0].sections && batches[0].sections.length > 0) {
          setSelectedSectionId(batches[0].sections[0].id);
        }
      }

      setShowAssignmentModal(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to load assignment data');
    } finally {
      setLoading(false);
    }
  };

  // Load students when batch / section changes in assignment modal
  useEffect(() => {
    if (!showAssignmentModal || !selectedSectionId) return;

    const loadSectionData = async () => {
      try {
        const [students, allocBatches] = await Promise.all([
          studentApi.getStudents({ sectionId: selectedSectionId }),
          batchApi.getAllocationBatches(selectedSectionId).catch(() => []),
        ]);
        setSectionStudents(students);
        setAllocationBatches(allocBatches);

        // Check current section assignment mode for selected staff
        const secAssign = staffDetail?.assignedSections.find((s) => s.section_id === selectedSectionId);
        if (secAssign && secAssign.assignment_mode === 'ALL') {
          setAssignmentMode('ALL');
          setSelectedStudentIds(new Set(students.map((s) => s.id)));
        } else {
          setAssignmentMode('SELECTED');
          const directIds = new Set(
            staffDetail?.directStudentAssignments
              .filter((ds) => ds.section_id === selectedSectionId)
              .map((ds) => ds.id) || []
          );
          setSelectedStudentIds(directIds);
        }
      } catch (err) {
        console.error('Failed to load section data:', err);
      }
    };

    loadSectionData();
  }, [selectedSectionId, showAssignmentModal, staffDetail]);

  // Save Batch Assignments
  const handleSaveBatches = async () => {
    if (!selectedStaffId) return;
    try {
      setSubmitting(true);
      await staffApi.assignBatches(selectedStaffId, Array.from(assignedBatchIds));
      alert('Assigned batches updated!');
      fetchStaff();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update batch assignments');
    } finally {
      setSubmitting(false);
    }
  };

  // Save Section / Student Responsibility Assignment
  const handleSaveSectionAssignment = async () => {
    if (!selectedStaffId || !selectedSectionId) return;

    try {
      setSubmitting(true);
      if (assignmentMode === 'ALL') {
        await staffApi.assignSection(selectedStaffId, selectedSectionId, 'ALL');
      } else {
        await staffApi.assignSection(selectedStaffId, selectedSectionId, 'SELECTED', Array.from(selectedStudentIds));
      }
      alert('Section responsibility assignment saved!');
      // Refresh detail
      const updatedDetail = await staffApi.getStaffById(selectedStaffId);
      setStaffDetail(updatedDetail);
      fetchStaff();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save section assignment');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStudents = sectionStudents.filter((s) => {
    if (!studentSearch) return true;
    const term = studentSearch.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      s.register_number.toLowerCase().includes(term) ||
      (s.leetcode_username && s.leetcode_username.toLowerCase().includes(term))
    );
  });

  const filteredStaffList = staffList.filter((staff) => {
    if (!staffSearchQuery.trim()) return true;
    const q = staffSearchQuery.toLowerCase().trim();
    return (
      staff.name.toLowerCase().includes(q) ||
      staff.email.toLowerCase().includes(q)
    );
  });

  return (
    <Layout title="Staff Management">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Header Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Faculty Staff Accounts</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Manage faculty member credentials, status, batch allocations, and student responsibility rules.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Search Input Bar */}
            <div style={{ position: 'relative', minWidth: '260px' }}>
              <Search
                size={17}
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Search staff by name or email..."
                value={staffSearchQuery}
                onChange={(e) => setStaffSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem 0.55rem 2.3rem',
                  backgroundColor: 'var(--bg-input, #0f172a)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-main)',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
              {staffSearchQuery && (
                <button
                  onClick={() => setStaffSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
              <UserPlus size={18} />
              <span>Create Staff</span>
            </button>
          </div>
        </div>

        {/* Staff Table */}
        {loading && !showAssignmentModal && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto 0.5rem auto', color: 'var(--primary)' }} />
            <span>Loading staff accounts...</span>
          </div>
        )}

        {error && (
          <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#f87171', borderRadius: 'var(--radius-sm)' }}>
            {error}
          </div>
        )}

        {!loading && (
          <div className="glass-panel" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '1rem' }}>Name</th>
                  <th style={{ padding: '1rem' }}>Email</th>
                  <th style={{ padding: '1rem' }}>Status</th>
                  <th style={{ padding: '1rem' }}>Assigned Batches</th>
                  <th style={{ padding: '1rem' }}>Assigned Students</th>
                  <th style={{ padding: '1rem' }}>Created Date</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaffList.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {staffSearchQuery ? (
                        <>No staff accounts match <strong>"{staffSearchQuery}"</strong>.</>
                      ) : (
                        <>No staff accounts found. Click "Create Staff" to add a faculty member.</>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredStaffList.map((staff) => (
                    <tr key={staff.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{staff.name}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{staff.email}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: staff.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: staff.isActive ? '#10b981' : '#f87171',
                          border: staff.isActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                        }}>
                          {staff.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-primary)' }}>
                        {staff.assignedBatchesCount} Batch(es)
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-primary)' }}>
                        {staff.assignedStudentsCount} Student(s)
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                        {new Date(staff.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <button
                            className="btn-secondary"
                            onClick={() => handleOpenAssignments(staff.id)}
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                            title="Manage Assignments"
                          >
                            <Settings2 size={15} />
                            <span>Assignments</span>
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => handleOpenEdit(staff)}
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                            title="Edit Name, Email or Password"
                          >
                            <Pencil size={15} color="#818cf8" />
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => handleToggleStatus(staff)}
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                            title={staff.isActive ? 'Disable Staff Account' : 'Enable Staff Account'}
                          >
                            {staff.isActive ? <UserX size={15} color="#f87171" /> : <UserCheck size={15} color="#10b981" />}
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => handleOpenPasswordReset(staff.id)}
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                            title="Reset / Update Password"
                          >
                            <Key size={15} />
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => handleOpenDelete(staff)}
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                            title="Delete Staff Account"
                          >
                            <Trash2 size={15} color="#ef4444" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE STAFF MODAL */}
      {showCreateModal && (
        <div className="modal-overlay-responsive">
          <div className="glass-panel modal-card-responsive" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Create Staff Account</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>


            {formError && (
              <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateStaff}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Dr. Muthuraj"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="muthuraj@college.edu"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••••••"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••••••"
                  value={createForm.confirmPassword}
                  onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={createForm.isActive}
                  onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                />
                <label htmlFor="isActiveCheck" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Enable account immediately
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STAFF MODAL */}
      {showEditModal && (
        <div className="modal-overlay-responsive">
          <div className="glass-panel modal-card-responsive" style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Edit Staff Account</h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>


            {editError && (
              <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdateStaff}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Intake Batches</label>
                
                {/* List of currently assigned batch pills */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                  {editForm.assignedBatchIds.length === 0 ? (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      No intake batches assigned yet. Select a batch below to add assignment.
                    </span>
                  ) : (
                    editForm.assignedBatchIds.map((bId) => {
                      const b = allBatches.find((batch) => batch.id === bId);
                      const secNames = b?.sections?.map((s) => `Section ${s.name}`).join(', ');
                      const allocBatchNames = b?.sections?.flatMap((s) => s.allocation_batches || [])?.map((ab) => ab.name).join(', ');

                      return (
                        <div
                          key={bId}
                          style={{
                            padding: '0.75rem 1rem',
                            backgroundColor: 'rgba(99, 102, 241, 0.08)',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>
                              {b ? `${b.batch_name} (${b.department})` : 'Assigned Batch'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditForm({
                                  ...editForm,
                                  assignedBatchIds: editForm.assignedBatchIds.filter((id) => id !== bId),
                                });
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#f87171',
                                cursor: 'pointer',
                                padding: '0.2rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                fontSize: '0.75rem',
                              }}
                              title="Remove Batch Assignment"
                            >
                              <X size={14} />
                              <span>Remove</span>
                            </button>
                          </div>

                          {/* Section & Allocation Batch Breakdown */}
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <div>
                              <strong style={{ color: 'var(--text-muted)' }}>Sections:</strong> {secNames || 'None created'}
                            </div>
                            {allocBatchNames && (
                              <div>
                                <strong style={{ color: 'var(--text-muted)' }}>Allocation Batches:</strong> {allocBatchNames}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Dropdown menu to add a new batch assignment */}
                {allBatches.filter((b) => !editForm.assignedBatchIds.includes(b.id)).length > 0 && (
                  <select
                    className="form-input"
                    value=""
                    onChange={(e) => {
                      const newBId = e.target.value;
                      if (newBId && !editForm.assignedBatchIds.includes(newBId)) {
                        setEditForm({
                          ...editForm,
                          assignedBatchIds: [...editForm.assignedBatchIds, newBId],
                        });
                      }
                    }}
                  >
                    <option value="">+ Add a Batch Assignment...</option>
                    {allBatches
                      .filter((b) => !editForm.assignedBatchIds.includes(b.id))
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          + {b.batch_name} ({b.department})
                        </option>
                      ))}
                  </select>
                )}

                <div style={{ marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setShowEditModal(false);
                      handleOpenAssignments(editForm.id);
                    }}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                  >
                    <Settings2 size={14} />
                    <span>Manage Detailed Section & Allocation Batch Rules</span>
                  </button>
                </div>
              </div>



              <div className="form-group">
                <label className="form-label">New Password (Optional - leave blank to keep current password)</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter new password to update"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                />
              </div>


              {editForm.password && (
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Confirm new password"
                    value={editForm.confirmPassword}
                    onChange={(e) => setEditForm({ ...editForm, confirmPassword: e.target.value })}
                    required
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE STAFF CONFIRMATION MODAL */}
      {showDeleteModal && staffToDelete && (
        <div className="modal-overlay-responsive">
          <div className="glass-panel modal-card-responsive" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f87171', marginBottom: '1rem' }}>
              <ShieldAlert size={26} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Delete Staff Account</h3>
            </div>


            {deleteError && (
              <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {deleteError}
              </div>
            )}

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              Are you sure you want to delete staff account <strong style={{ color: 'var(--text-primary)' }}>{staffToDelete.name}</strong> (<span style={{ fontFamily: 'monospace' }}>{staffToDelete.email}</span>)?
            </p>
            <p style={{ fontSize: '0.825rem', color: '#f87171', backgroundColor: 'rgba(248, 113, 113, 0.1)', padding: '0.65rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
              ⚠️ Warning: This will permanently remove this staff account and all their assigned batch/section mappings.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={submitting}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
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

      {/* RESET PASSWORD MODAL */}
      {showPasswordModal && (
        <div className="modal-overlay-responsive">
          <div className="glass-panel modal-card-responsive" style={{ maxWidth: '400px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Reset Password</h3>

            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE ASSIGNMENTS MODAL */}
      {showAssignmentModal && staffDetail && (
        <div className="modal-overlay-responsive">
          <div className="glass-panel modal-card-responsive" style={{
            width: '100%', maxWidth: '850px', display: 'flex', flexDirection: 'column', padding: '2rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Manage Assignments</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Staff Member: <strong style={{ color: 'var(--text-primary)' }}>{staffDetail.name}</strong> ({staffDetail.email})
                </p>
              </div>
              <button onClick={() => setShowAssignmentModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>

            {/* Section 1: Assigned Batches */}
            <div style={{ marginBottom: '2rem', backgroundColor: 'rgba(15, 23, 42, 0.5)', padding: '1.25rem', borderRadius: 'var(--radius-sm)' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--primary)' }}>1. Assigned Intake Batches</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                {allBatches.map((batch) => {
                  const isAssigned = assignedBatchIds.has(batch.id);
                  return (
                    <label key={batch.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.5rem 0.85rem', borderRadius: 'var(--radius-sm)',
                      backgroundColor: isAssigned ? 'var(--primary-light)' : 'rgba(255, 255, 255, 0.05)',
                      border: isAssigned ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer', fontSize: '0.9rem',
                    }}>
                      <input
                        type="checkbox"
                        checked={isAssigned}
                        onChange={(e) => {
                          const next = new Set(assignedBatchIds);
                          if (e.target.checked) next.add(batch.id);
                          else next.delete(batch.id);
                          setAssignedBatchIds(next);
                        }}
                      />
                      <span>{batch.batch_name} ({batch.department})</span>
                    </label>
                  );
                })}
              </div>
              <button className="btn-secondary" onClick={handleSaveBatches} disabled={submitting} style={{ fontSize: '0.85rem' }}>
                Save Batch Allocations
              </button>
            </div>

            {/* Section 2: Student Responsibility Distribution */}
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', padding: '1.25rem', borderRadius: 'var(--radius-sm)' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--accent-staff)' }}>2. Student Responsibility Distribution</h4>

              {/* Batch & Section selector */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="form-label">Select Batch</label>
                  <select
                    className="form-input"
                    value={selectedBatchId}
                    onChange={(e) => {
                      setSelectedBatchId(e.target.value);
                      const b = allBatches.find((x) => x.id === e.target.value);
                      if (b && b.sections && b.sections.length > 0) {
                        setSelectedSectionId(b.sections[0].id);
                      } else {
                        setSelectedSectionId('');
                      }
                    }}
                  >
                    {allBatches.map((b) => (
                      <option key={b.id} value={b.id}>{b.batch_name} - {b.department}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Select Section</label>
                  <select
                    className="form-input"
                    value={selectedSectionId}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                  >
                    {allBatches.find((b) => b.id === selectedBatchId)?.sections?.map((sec) => (
                      <option key={sec.id} value={sec.id}>Section {sec.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Scope Mode Selector */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  className={assignmentMode === 'ALL' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => {
                    setAssignmentMode('ALL');
                    setSelectedStudentIds(new Set(sectionStudents.map((s) => s.id)));
                  }}
                  style={{ fontSize: '0.85rem' }}
                >
                  Entire Section
                </button>
                <button
                  type="button"
                  className={assignmentMode === 'ALLOCATION_BATCH' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => {
                    setAssignmentMode('ALLOCATION_BATCH');
                    if (allocationBatches.length > 0) {
                      const firstAb = allocationBatches[0];
                      setSelectedAllocationBatchId(firstAb.id);
                      const matching = sectionStudents.filter(
                        (st) => st.allocation_batch_id === firstAb.id || st.sub_batch === firstAb.name
                      );
                      setSelectedStudentIds(new Set(matching.map((s) => s.id)));
                    }
                  }}
                  style={{ fontSize: '0.85rem' }}
                >
                  Allocation Batch
                </button>
                <button
                  type="button"
                  className={assignmentMode === 'SELECTED' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setAssignmentMode('SELECTED')}
                  style={{ fontSize: '0.85rem' }}
                >
                  Specific Students
                </button>
              </div>

              {/* Allocation Batch dropdown selector */}
              {assignmentMode === 'ALLOCATION_BATCH' && (
                <div style={{ marginTop: '1rem', marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 'var(--radius-sm)' }}>
                  <label className="form-label">Select Allocation Batch</label>
                  {allocationBatches.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      No Allocation Batches created in this section yet. Create them in Manage Sections.
                    </div>
                  ) : (
                    <select
                      className="form-input"
                      value={selectedAllocationBatchId}
                      onChange={(e) => {
                        const abId = e.target.value;
                        setSelectedAllocationBatchId(abId);
                        const targetAb = allocationBatches.find((ab) => ab.id === abId);
                        const matching = sectionStudents.filter(
                          (st) => st.allocation_batch_id === abId || (targetAb && st.sub_batch === targetAb.name)
                        );
                        setSelectedStudentIds(new Set(matching.map((s) => s.id)));
                      }}
                    >
                      {allocationBatches.map((ab) => (
                        <option key={ab.id} value={ab.id}>
                          {ab.name} ({sectionStudents.filter((st) => st.allocation_batch_id === ab.id || st.sub_batch === ab.name).length} Students)
                        </option>
                      ))}
                    </select>
                  )}
                  <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                    Selected for Assignment: {selectedStudentIds.size} Students
                  </div>
                </div>
              )}

              {/* Roster & Search if SELECTED mode */}
              {assignmentMode === 'SELECTED' && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ position: 'relative', width: '280px' }}>
                      <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Search student or register no..."
                        style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                      />
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Selected: <span style={{ color: 'var(--primary)' }}>{selectedStudentIds.size}</span> / {sectionStudents.length} Students
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Count:</span>
                    {[20, 24, 60, 120].map((count) => (
                      <button
                        key={count}
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                        onClick={() => setSelectedStudentIds(new Set(sectionStudents.slice(0, count).map((s) => s.id)))}
                        title={`Select first ${count} students`}
                      >
                        First {count}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                      onClick={() => setSelectedStudentIds(new Set(filteredStudents.map((s) => s.id)))}
                    >
                      Select All ({sectionStudents.length})
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                      onClick={() => setSelectedStudentIds(new Set())}
                    >
                      Clear Selection
                    </button>
                  </div>

                  <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                    {filteredStudents.length === 0 ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No students in this section.
                      </div>
                    ) : (
                      filteredStudents.map((student) => {
                        const isChecked = selectedStudentIds.has(student.id);
                        return (
                          <div
                            key={student.id}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '0.6rem 0.85rem', borderBottom: '1px solid var(--border-subtle)',
                              backgroundColor: isChecked ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                            }}
                          >
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', flex: 1 }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const next = new Set(selectedStudentIds);
                                  if (e.target.checked) next.add(student.id);
                                  else next.delete(student.id);
                                  setSelectedStudentIds(next);
                                }}
                              />
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{student.register_number}</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{student.name}</span>
                            </label>
                            {student.leetcode_username && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                @{student.leetcode_username}
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button className="btn-primary" onClick={handleSaveSectionAssignment} disabled={submitting}>
                  Save Responsibility Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
