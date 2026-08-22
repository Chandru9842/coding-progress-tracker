import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout.js';
import { studentApi, syncApi, Student, DailySnapshot } from '../services/api.js';
import { ArrowLeft, User, ShieldAlert, Code2, GraduationCap, Layers, Loader2, Activity, RefreshCw, CheckCircle2 } from 'lucide-react';

export const StudentDetailPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const [student, setStudent] = useState<Student | null>(null);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
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

                {student.leetcode_username && (
                  <button
                    className="btn-primary"
                    onClick={handleSyncNow}
                    disabled={syncing}
                    style={{ fontSize: '0.85rem' }}
                  >
                    {syncing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                    <span>{syncing ? 'Syncing...' : 'Sync LeetCode Data'}</span>
                  </button>
                )}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <Activity size={20} style={{ color: 'var(--primary)' }} />
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Daily Snapshot History</h4>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.75rem' }}>Date</th>
                        <th style={{ padding: '0.75rem' }}>Easy Solved</th>
                        <th style={{ padding: '0.75rem' }}>Medium Solved</th>
                        <th style={{ padding: '0.75rem' }}>Hard Solved</th>
                        <th style={{ padding: '0.75rem' }}>Total Solved</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshots.map((snap) => (
                        <tr key={snap.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                            {(() => {
                              const dStr = typeof snap.snapshot_date === 'string' ? snap.snapshot_date : new Date(snap.snapshot_date).toISOString();
                              const parts = dStr.split('T')[0].split('-');
                              return parts.length === 3 ? `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}/${parts[0]}` : new Date(snap.snapshot_date).toLocaleDateString();
                            })()}
                          </td>
                          <td style={{ padding: '0.75rem', color: '#4ade80' }}>{snap.easy_solved}</td>
                          <td style={{ padding: '0.75rem', color: '#facc15' }}>{snap.medium_solved}</td>
                          <td style={{ padding: '0.75rem', color: '#f87171' }}>{snap.hard_solved}</td>
                          <td style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>{snap.total_solved}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};
