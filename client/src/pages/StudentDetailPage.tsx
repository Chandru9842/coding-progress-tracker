import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout.js';
import { useAuth } from '../context/AuthContext.js';
import { studentApi, syncApi, Student, DailySnapshot } from '../services/api.js';
import { ArrowLeft, User, ShieldAlert, Code2, GraduationCap, Layers, Loader2, Activity, RefreshCw, CheckCircle2, Trash2 } from 'lucide-react';

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

  const fetchDetailAndSnapshots = async () => {
    if (!studentId) return;
    try {
      setLoading(true);
      const data = await studentApi.getStudentById(studentId);
      setStudent(data);

      const snapData = await syncApi.getSnapshots(studentId);
      setSnapshots(snapData);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('403 Forbidden: You are not authorized to view this student\'s profile.');
      } else {
        setError(err.response?.data?.error || 'Failed to load student details.');
      }
    } finally {
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
      const res = await syncApi.syncStudent(studentId);
      setSyncMessage(`Successfully synchronized LeetCode data for @${student.leetcode_username}`);

      // Refresh student and snapshots
      const snapData = await syncApi.getSnapshots(studentId);
      setSnapshots(snapData);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to sync LeetCode data');
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
      setDeleteError(err.response?.data?.error || 'Failed to delete student');
    } finally {
      setDeleting(false);
    }
  };

  const latestSnapshot = snapshots.length > 0 ? snapshots[0] : null;

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
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Access Restricted</h3>
            <p style={{ fontSize: '0.9rem', color: '#fca5a5' }}>{error}</p>
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
                  <span>{syncMessage}</span>
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
                  <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 700, textTransform: 'uppercase' }}>Easy</span>
                  <h4 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.25rem' }}>{latestSnapshot.easy_solved}</h4>
                </div>
                <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#facc15', fontWeight: 700, textTransform: 'uppercase' }}>Medium</span>
                  <h4 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.25rem' }}>{latestSnapshot.medium_solved}</h4>
                </div>
                <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase' }}>Hard</span>
                  <h4 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.25rem' }}>{latestSnapshot.hard_solved}</h4>
                </div>
                <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center', backgroundColor: 'rgba(99, 102, 241, 0.15)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>Total Solved</span>
                  <h4 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--primary)' }}>{latestSnapshot.total_solved}</h4>
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
            {snapshots.length > 0 && (
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Activity size={20} style={{ color: 'var(--primary)' }} />
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Daily Snapshot History</h4>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Track daily problem-solving progress & cumulative totals
                  </span>
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
                      {snapshots.map((snap, idx) => {
                        const prevSnap = snapshots[idx + 1];
                        const dailyEasy = prevSnap ? Math.max(0, snap.easy_solved - prevSnap.easy_solved) : 0;
                        const dailyMedium = prevSnap ? Math.max(0, snap.medium_solved - prevSnap.medium_solved) : 0;
                        const dailyHard = prevSnap ? Math.max(0, snap.hard_solved - prevSnap.hard_solved) : 0;
                        const dailyTotal = prevSnap ? Math.max(0, snap.total_solved - prevSnap.total_solved) : 0;

                        return (
                          <tr key={snap.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                              {(() => {
                                const dStr = typeof snap.snapshot_date === 'string' ? snap.snapshot_date : new Date(snap.snapshot_date).toISOString();
                                const parts = dStr.split('T')[0].split('-');
                                return parts.length === 3 ? `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}/${parts[0]}` : new Date(snap.snapshot_date).toLocaleDateString();
                              })()}
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
                            <td style={{ padding: '0.75rem', color: '#4ade80' }}>{snap.easy_solved}</td>
                            <td style={{ padding: '0.75rem', color: '#facc15' }}>{snap.medium_solved}</td>
                            <td style={{ padding: '0.75rem', color: '#f87171' }}>{snap.hard_solved}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>{snap.total_solved}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
