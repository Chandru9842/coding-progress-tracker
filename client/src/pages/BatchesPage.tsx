import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout.js';
import { useAuth } from '../context/AuthContext.js';
import { batchApi, Batch } from '../services/api.js';
import { FolderKanban, Plus, Layers, Edit2, Trash2, Loader2, X, Search } from 'lucide-react';

export const BatchesPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const navigate = useNavigate();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [batchSearchQuery, setBatchSearchQuery] = useState<string>('');

  // Modal States
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [batchForm, setBatchForm] = useState({ batch_name: '', start_year: 2023, end_year: 2027, department: 'CSE' });
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const data = await batchApi.getAllBatches();
      setBatches(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingBatchId(null);
    setBatchForm({ batch_name: '', start_year: 2023, end_year: 2027, department: 'CSE' });
    setShowBatchModal(true);
  };

  const handleOpenEditModal = (batch: Batch) => {
    setEditingBatchId(batch.id);
    setBatchForm({
      batch_name: batch.batch_name,
      start_year: batch.start_year,
      end_year: batch.end_year,
      department: batch.department,
    });
    setShowBatchModal(true);
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingBatchId) {
        await batchApi.updateBatch(editingBatchId, batchForm);
      } else {
        await batchApi.createBatch(batchForm);
      }
      setShowBatchModal(false);
      fetchBatches();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save batch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBatch = async (batchId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete Batch ${name}? All associated sections will be deleted.`)) return;

    try {
      await batchApi.deleteBatch(batchId);
      fetchBatches();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete batch');
    }
  };

  const filteredBatches = batches.filter((batch) => {
    if (!batchSearchQuery.trim()) return true;
    const q = batchSearchQuery.toLowerCase().trim();

    const nameMatch = batch.batch_name.toLowerCase().includes(q);
    const deptMatch = batch.department.toLowerCase().includes(q);
    const yearMatch = `${batch.start_year}-${batch.end_year}`.includes(q) || `${batch.start_year}`.includes(q) || `${batch.end_year}`.includes(q);
    const sectionMatch = batch.sections?.some((sec) => sec.name.toLowerCase().includes(q));

    return nameMatch || deptMatch || yearMatch || sectionMatch;
  });

  return (
    <Layout title="Intake Batches & Sections">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Academic Intake Batches</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Dynamic batch management and section configuration.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Search Bar Input */}
            <div style={{ position: 'relative', minWidth: '280px' }}>
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
                placeholder="Search batches, departments, or sections..."
                value={batchSearchQuery}
                onChange={(e) => setBatchSearchQuery(e.target.value)}
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
              {batchSearchQuery && (
                <button
                  onClick={() => setBatchSearchQuery('')}
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

            {isAdmin && (
              <button className="btn-primary" onClick={handleOpenCreateModal}>
                <Plus size={18} />
                <span>Create New Batch</span>
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto 0.5rem auto', color: 'var(--primary)' }} />
            <span>Loading intake batches...</span>
          </div>
        )}

        {error && (
          <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#f87171', borderRadius: 'var(--radius-sm)' }}>
            {error}
          </div>
        )}

        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {filteredBatches.length === 0 ? (
              <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
                {batchSearchQuery ? (
                  <>No intake batches match <strong>"{batchSearchQuery}"</strong>.</>
                ) : (
                  <>No batches yet. Click "Create New Batch" to get started.</>
                )}
              </div>
            ) : (
              filteredBatches.map((batch) => (
                <div key={batch.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div
                      onClick={() => navigate(`/batches/${batch.id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
                    >
                      <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
                        <FolderKanban size={20} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{batch.batch_name}</h4>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{batch.department} Department</span>
                      </div>
                    </div>
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          onClick={() => handleOpenEditModal(batch)}
                          className="touch-target"
                          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.4rem' }}
                          title="Edit Batch"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteBatch(batch.id, batch.batch_name)}
                          className="touch-target"
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0.4rem' }}
                          title="Delete Batch"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Intake Duration: {batch.start_year} &ndash; {batch.end_year}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                        Configured Sections ({batch.sections?.length || 0})
                      </span>
                      <button
                        onClick={() => navigate(`/batches/${batch.id}`)}
                        className="touch-target"
                        style={{ fontSize: '0.75rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '0.25rem 0.5rem' }}
                      >
                        Manage &rarr;
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {batch.sections?.length === 0 ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No sections added yet</span>
                      ) : (
                        batch.sections?.map((sec) => (
                          <div
                            key={sec.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              padding: '0.25rem 0.6rem',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.8rem',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <Layers size={12} color="var(--primary)" />
                            <span>Section {sec.name}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* CREATE / EDIT BATCH MODAL */}
      {showBatchModal && (
        <div className="modal-overlay-responsive">
          <div className="glass-panel modal-card-responsive" style={{ width: '100%', maxWidth: '440px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem' }}>
              {editingBatchId ? 'Edit Intake Batch' : 'Create Intake Batch'}
            </h3>
            <form onSubmit={handleSaveBatch}>
              <div className="form-group">
                <label className="form-label">Batch Name (e.g. 2023–2027)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="2023–2027"
                  value={batchForm.batch_name}
                  onChange={(e) => setBatchForm({ ...batchForm, batch_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Department</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="CSE"
                  value={batchForm.department}
                  onChange={(e) => setBatchForm({ ...batchForm, department: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Start Year</label>
                  <input
                    type="number"
                    className="form-input"
                    value={batchForm.start_year}
                    onChange={(e) => setBatchForm({ ...batchForm, start_year: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Year</label>
                  <input
                    type="number"
                    className="form-input"
                    value={batchForm.end_year}
                    onChange={(e) => setBatchForm({ ...batchForm, end_year: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowBatchModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {editingBatchId ? 'Update Batch' : 'Create Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};
