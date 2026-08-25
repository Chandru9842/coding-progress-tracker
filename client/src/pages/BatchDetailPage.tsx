import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout.js';
import { useAuth } from '../context/AuthContext.js';
import { batchApi, studentApi, Batch, Student } from '../services/api.js';
import { ArrowLeft, FolderKanban, Layers, Users, Plus, Edit2, Trash2, Loader2, X, ExternalLink, GraduationCap, UserCheck } from 'lucide-react';

export const BatchDetailPage: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const navigate = useNavigate();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showSectionModal, setShowSectionModal] = useState<boolean>(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionName, setSectionName] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Allocation Batch Modals
  const [showAllocModal, setShowAllocModal] = useState<boolean>(false);
  const [allocSectionId, setAllocSectionId] = useState<string>('');
  const [allocName, setAllocName] = useState<string>('');

  const [showEditAllocModal, setShowEditAllocModal] = useState<boolean>(false);
  const [editAllocSectionId, setEditAllocSectionId] = useState<string>('');
  const [editAllocId, setEditAllocId] = useState<string>('');
  const [editAllocName, setEditAllocName] = useState<string>('');

  const [showDeleteAllocModal, setShowDeleteAllocModal] = useState<boolean>(false);
  const [deleteAllocSectionId, setDeleteAllocSectionId] = useState<string>('');
  const [deleteAllocId, setDeleteAllocId] = useState<string>('');
  const [deleteAllocName, setDeleteAllocName] = useState<string>('');
  const [deleteAllocStudentCount, setDeleteAllocStudentCount] = useState<number>(0);

  // Allocation Batch Detail View Modal
  const [showAllocDetailModal, setShowAllocDetailModal] = useState<boolean>(false);
  const [selectedAllocSection, setSelectedAllocSection] = useState<any>(null);
  const [selectedAllocBatch, setSelectedAllocBatch] = useState<any>(null);
  const [allocDetailStudents, setAllocDetailStudents] = useState<Student[]>([]);
  const [loadingAllocStudents, setLoadingAllocStudents] = useState<boolean>(false);

  const handleOpenAllocDetailModal = async (sec: any, ab: any) => {
    setSelectedAllocSection(sec);
    setSelectedAllocBatch(ab);
    setShowAllocDetailModal(true);
    try {
      setLoadingAllocStudents(true);
      const students = await studentApi.getStudents({
        sectionId: sec.id,
        allocationBatchId: ab.id,
      });
      setAllocDetailStudents(students);
    } catch (err) {
      console.error('Failed to load students for allocation batch:', err);
      setAllocDetailStudents([]);
    } finally {
      setLoadingAllocStudents(false);
    }
  };

  const fetchBatch = async () => {
    if (!batchId) return;
    try {
      setLoading(true);
      const data = await batchApi.getBatchById(batchId);
      setBatch(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load batch details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatch();
  }, [batchId]);

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId || !sectionName) return;

    try {
      setSubmitting(true);
      if (editingSectionId) {
        await batchApi.updateSection(editingSectionId, sectionName);
      } else {
        await batchApi.createSection(batchId, sectionName);
      }
      setShowSectionModal(false);
      setEditingSectionId(null);
      setSectionName('');
      fetchBatch();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save section.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAllocBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocSectionId || !allocName.trim()) return;
    try {
      setSubmitting(true);
      await batchApi.createAllocationBatch(allocSectionId, allocName.trim());
      setShowAllocModal(false);
      setAllocName('');
      setAllocSectionId('');
      fetchBatch();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create allocation batch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAllocBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAllocSectionId || !editAllocId || !editAllocName.trim()) return;
    try {
      setSubmitting(true);
      await batchApi.updateAllocationBatch(editAllocSectionId, editAllocId, editAllocName.trim());
      setShowEditAllocModal(false);
      setEditAllocName('');
      setEditAllocId('');
      setEditAllocSectionId('');
      fetchBatch();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update allocation batch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAllocBatch = async () => {
    if (!deleteAllocSectionId || !deleteAllocId) return;
    try {
      setSubmitting(true);
      await batchApi.deleteAllocationBatch(deleteAllocSectionId, deleteAllocId);
      setShowDeleteAllocModal(false);
      setDeleteAllocId('');
      setDeleteAllocSectionId('');
      setDeleteAllocName('');
      fetchBatch();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete allocation batch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSection = async (sectionId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete Section ${name}?`)) return;

    try {
      await batchApi.deleteSection(sectionId);
      fetchBatch();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete section.');
    }
  };

  return (
    <Layout title="Batch Details">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '850px' }}>
        <button
          className="btn-secondary"
          onClick={() => navigate('/batches')}
          style={{ width: 'fit-content', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Batches</span>
        </button>

        {loading && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Loader2 className="animate-spin" size={28} style={{ margin: '0 auto 0.75rem auto', color: 'var(--primary)' }} />
            <span>Loading batch details...</span>
          </div>
        )}

        {error && (
          <div className="glass-panel" style={{ padding: '1.5rem', color: '#f87171' }}>
            {error}
          </div>
        )}

        {!loading && batch && (
          <>
            {/* Header Info */}
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
                    <FolderKanban size={28} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{batch.batch_name}</h3>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{batch.department} Department</span>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setEditingSectionId(null);
                      setSectionName('');
                      setShowSectionModal(true);
                    }}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <Plus size={16} /> Add Section
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Intake Duration</span>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{batch.start_year} &ndash; {batch.end_year}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Total Sections</span>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{batch.sections?.length || 0}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Enrolled Students</span>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{batch._count?.students || 0}</span>
                </div>
              </div>
            </div>

            {/* Configured Sections */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Class / Section Configuration</h4>
              {batch.sections?.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No sections configured yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                  {batch.sections?.map((sec) => (
                    <div key={sec.id} style={{
                      padding: '1.25rem', borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)',
                      display: 'flex', flexDirection: 'column', gap: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                          Section {sec.name}
                        </span>
                        {isAdmin && (
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button
                              onClick={() => {
                                setEditingSectionId(sec.id);
                                setSectionName(sec.name);
                                setShowSectionModal(true);
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                              title="Edit Section"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteSection(sec.id, sec.name)}
                              style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                              title="Delete Section"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {sec._count?.students || 0} Enrolled Student(s)
                      </span>

                      {/* Allocation Batches list inside Section */}
                      <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                            Allocation Batches
                          </span>
                          {isAdmin && (
                            <button
                              onClick={() => {
                                setAllocSectionId(sec.id);
                                setAllocName('');
                                setShowAllocModal(true);
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                            >
                              + Add Allocation Batch
                            </button>
                          )}
                        </div>

                        {sec.allocation_batches && sec.allocation_batches.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                            {sec.allocation_batches.map((ab: any) => (
                              <div
                                key={ab.id}
                                onClick={() => handleOpenAllocDetailModal(sec, ab)}
                                style={{
                                  padding: '0.45rem 0.85rem', borderRadius: 'var(--radius-sm)',
                                  backgroundColor: 'rgba(99, 102, 241, 0.14)', border: '1px solid rgba(99, 102, 241, 0.3)',
                                  fontSize: '0.8rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem',
                                  cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                              >
                                <span style={{ fontWeight: 700 }}>{ab.name}</span>
                                <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.12)', color: 'var(--text-primary)', fontWeight: 600 }}>
                                  {ab._count?.students !== undefined ? ab._count.students : (ab.students?.length || 0)} Students
                                </span>
                                {ab.mentor_names ? (
                                  <span style={{
                                    fontSize: '0.72rem',
                                    padding: '0.12rem 0.5rem',
                                    borderRadius: '10px',
                                    backgroundColor: 'rgba(168, 85, 247, 0.2)',
                                    border: '1px solid rgba(168, 85, 247, 0.4)',
                                    color: '#c084fc',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }} title={`Mentor: ${ab.mentor_names}`}>
                                    👤 {ab.mentor_names}
                                  </span>
                                ) : (
                                  <span style={{
                                    fontSize: '0.7rem',
                                    padding: '0.1rem 0.4rem',
                                    borderRadius: '10px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    color: 'var(--text-muted)',
                                    fontWeight: 500
                                  }}>
                                    Unassigned
                                  </span>
                                )}
                                {isAdmin && (
                                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', marginLeft: '0.2rem' }}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditAllocSectionId(sec.id);
                                        setEditAllocId(ab.id);
                                        setEditAllocName(ab.name);
                                        setShowEditAllocModal(true);
                                      }}
                                      style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                                      title="Edit Batch Name"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteAllocSectionId(sec.id);
                                        setDeleteAllocId(ab.id);
                                        setDeleteAllocName(ab.name);
                                        setDeleteAllocStudentCount(ab._count?.students || 0);
                                        setShowDeleteAllocModal(true);
                                      }}
                                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                                      title="Delete Allocation Batch"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No sub-batches created (Default allocation)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* SECTION MODAL */}
      {showSectionModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '380px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem' }}>
              {editingSectionId ? 'Edit Section' : 'Add Section'}
            </h3>
            <form onSubmit={handleSaveSection}>
              <div className="form-group">
                <label className="form-label">Section Name (e.g. CSE-A)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="CSE-A"
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowSectionModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {editingSectionId ? 'Update Section' : 'Add Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ALLOCATION BATCH MODAL */}
      {showAllocModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '380px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem' }}>
              Create Allocation Batch
            </h3>
            <form onSubmit={handleCreateAllocBatch}>
              <div className="form-group">
                <label className="form-label">Allocation Batch Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Batch 4 or Morning Batch"
                  value={allocName}
                  onChange={(e) => setAllocName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowAllocModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  Create Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ALLOCATION BATCH MODAL */}
      {showEditAllocModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '380px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem' }}>
              Edit Allocation Batch
            </h3>
            <form onSubmit={handleUpdateAllocBatch}>
              <div className="form-group">
                <label className="form-label">Batch Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editAllocName}
                  onChange={(e) => setEditAllocName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowEditAllocModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE WARNING ALLOCATION BATCH MODAL */}
      {showDeleteAllocModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', color: '#f87171' }}>
              Delete Allocation Batch?
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Are you sure you want to delete <strong>"{deleteAllocName}"</strong>?
            </p>

            {deleteAllocStudentCount > 0 ? (
              <div style={{ padding: '0.85rem', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: '#f87171', marginBottom: '1.5rem' }}>
                <strong>Warning:</strong> Existing <strong>{deleteAllocStudentCount}</strong> student(s) are assigned to this batch. Deleting this batch will safely unassign them without deleting any student records or staff history.
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                This allocation batch is currently empty and will be permanently removed.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowDeleteAllocModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" style={{ backgroundColor: '#ef4444' }} onClick={handleDeleteAllocBatch} disabled={submitting}>
                Delete Batch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALLOCATION BATCH DETAILS MODAL */}
      {showAllocDetailModal && selectedAllocBatch && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', padding: '2rem', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Allocation Batch Details
                </span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  {selectedAllocBatch.name}
                </h3>
              </div>
              <button
                onClick={() => setShowAllocDetailModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Metadata Pills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.6)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Academic Intake</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{batch?.batch_name}</span>
              </div>
              <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.6)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Department</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{batch?.department}</span>
              </div>
              <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.6)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Section</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Section {selectedAllocSection?.name}</span>
              </div>
              <div style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.7rem', color: '#c084fc', display: 'block' }}>Assigned Mentor</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e9d5ff', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <UserCheck size={14} style={{ color: '#c084fc' }} />
                  {selectedAllocBatch?.mentor_names || (allocDetailStudents.length > 0 && allocDetailStudents.some((s) => s.mentor?.name) ? Array.from(new Set(allocDetailStudents.map((s) => s.mentor?.name).filter(Boolean))).join(', ') : 'Unassigned')}
                </span>
              </div>
              <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--primary)', display: 'block' }}>Enrolled Students</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {allocDetailStudents.length} Students
                </span>
              </div>
            </div>

            {/* Students List Table */}
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={16} style={{ color: 'var(--primary)' }} />
              Assigned Students ({allocDetailStudents.length})
            </h4>

            {loadingAllocStudents ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Loader2 className="animate-spin" size={20} style={{ margin: '0 auto 0.5rem auto' }} />
                <span>Loading batch students...</span>
              </div>
            ) : allocDetailStudents.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'rgba(30, 41, 59, 0.4)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                No students assigned to this allocation batch yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', marginBottom: '1.5rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center', width: '50px' }}>Rank</th>
                      <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Reg No</th>
                      <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Student Name</th>
                      <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Mentor</th>
                      <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>LeetCode</th>
                      <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocDetailStudents.map((st, index) => (
                      <tr key={st.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            minWidth: '22px',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                            backgroundColor: index < 3 ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                            color: index < 3 ? 'var(--primary)' : 'var(--text-secondary)',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                          }}>
                            {index + 1}
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600, color: 'var(--primary)' }}>{st.register_number}</td>
                        <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{st.name}</td>
                        <td style={{ padding: '0.6rem 0.8rem', color: 'var(--accent-staff)' }}>{st.mentor?.name || 'Unassigned'}</td>
                        <td style={{ padding: '0.6rem 0.8rem', color: 'var(--text-secondary)' }}>{st.leetcode_username ? `@${st.leetcode_username}` : '-'}</td>
                        <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>
                          <button
                            onClick={() => navigate(`/students/${st.id}`)}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem' }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              {isAdmin && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setShowAllocDetailModal(false);
                      setEditAllocSectionId(selectedAllocSection.id);
                      setEditAllocId(selectedAllocBatch.id);
                      setEditAllocName(selectedAllocBatch.name);
                      setShowEditAllocModal(true);
                    }}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <Edit2 size={14} style={{ marginRight: '0.4rem' }} /> Edit Batch Name
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setShowAllocDetailModal(false);
                      setDeleteAllocSectionId(selectedAllocSection.id);
                      setDeleteAllocId(selectedAllocBatch.id);
                      setDeleteAllocName(selectedAllocBatch.name);
                      setDeleteAllocStudentCount(allocDetailStudents.length);
                      setShowDeleteAllocModal(true);
                    }}
                    style={{ color: '#f87171', fontSize: '0.85rem' }}
                  >
                    <Trash2 size={14} style={{ marginRight: '0.4rem' }} /> Delete Batch
                  </button>
                </div>
              )}
              <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setShowAllocDetailModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
