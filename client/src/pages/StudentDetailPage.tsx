import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout.js';
import { useAuth } from '../context/AuthContext.js';
import { studentApi, syncApi, Student, DailySnapshot } from '../services/api.js';
import { ArrowLeft, User, ShieldAlert, Code2, GraduationCap, Layers, Loader2, Activity, RefreshCw, CheckCircle2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { SyncStatus } from '../components/SyncStatus.js';

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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 10;

  const fetchDetailAndSnapshots = async () => {
    if (!studentId) return;
    try {
      setLoading(true);
      const [data, snapData] = await Promise.all([
        studentApi.getStudentById(studentId),
        syncApi.getSnapshots(studentId),
      ]);
      setStudent(data);
      setSnapshots(snapData);

      // Check if student has a LeetCode username and needs an auto-sync:
      // (1) Has 0 snapshots
      // (2) Or latest snapshot is not from today (YYYY-MM-DD IST)
      const latestSnap = snapData && snapData.length > 0 ? snapData[0] : null;
      const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      const latestDateStr = latestSnap ? new Date(latestSnap.snapshot_date).toISOString().split('T')[0] : '';
      const needsDailySync = data?.leetcode_username && (!latestSnap || latestDateStr !== todayIST);

      if (needsDailySync) {
        try {
          console.log(`[Auto-Snapshot] Auto-updating live LeetCode stats for ${data.name} (@${data.leetcode_username})...`);
          await syncApi.syncStudent(studentId);
          const [refreshedData, refreshedSnaps] = await Promise.all([
            studentApi.getStudentById(studentId),
            syncApi.getSnapshots(studentId),
          ]);
          setStudent(refreshedData);
          setSnapshots(refreshedSnaps);
          window.dispatchEvent(new CustomEvent('student-synced'));
          window.dispatchEvent(new CustomEvent('sheets-synced'));
        } catch (autoErr: any) {
          console.warn('[Auto-Snapshot] Auto snapshot fetch note:', autoErr?.message || autoErr);
        }
      }
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
      await syncApi.syncStudent(studentId);
      setSyncMessage(`Successfully synchronized LeetCode data and updated linked Google Sheets for @${student.leetcode_username}`);

      // Refresh student and snapshots
      const [data, snapData] = await Promise.all([
        studentApi.getStudentById(studentId),
        syncApi.getSnapshots(studentId),
      ]);
      setStudent(data);
      setSnapshots(snapData);
      window.dispatchEvent(new CustomEvent('student-synced'));
      window.dispatchEvent(new CustomEvent('sheets-synced'));
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
                  <SyncStatus variant="badge" />

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
              (() => {
                const latestEasy = latestSnapshot.easy_solved + Math.max(0, latestSnapshot.total_solved - (latestSnapshot.easy_solved + latestSnapshot.medium_solved + latestSnapshot.hard_solved));
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                    <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 700, textTransform: 'uppercase' }}>Easy</span>
                      <h4 style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.25rem' }}>{latestEasy}</h4>
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
                );
              })()
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
            {snapshots.length > 0 && (() => {
              const totalPages = Math.max(1, Math.ceil(snapshots.length / PAGE_SIZE));
              const validPage = Math.min(Math.max(1, currentPage), totalPages);
              const startIndex = (validPage - 1) * PAGE_SIZE;
              const endIndex = Math.min(startIndex + PAGE_SIZE, snapshots.length);
              const currentSnapshots = snapshots.slice(startIndex, endIndex);

              const getPageNumbers = () => {
                const pages: number[] = [];
                if (totalPages <= 7) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  let start = Math.max(2, validPage - 1);
                  let end = Math.min(totalPages - 1, validPage + 1);
                  if (start > 2) pages.push(-1);
                  for (let i = start; i <= end; i++) pages.push(i);
                  if (end < totalPages - 1) pages.push(-2);
                  pages.push(totalPages);
                }
                return pages;
              };

              return (
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Activity size={20} style={{ color: 'var(--primary)' }} />
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Daily Snapshot History</h4>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Showing {startIndex + 1}–{endIndex} of {snapshots.length} daily snapshots
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
                        {currentSnapshots.map((snap, pageIdx) => {
                          const globalIdx = startIndex + pageIdx;
                          const prevSnap = snapshots[globalIdx + 1];
                          const dailyTotal = prevSnap ? Math.max(0, snap.total_solved - prevSnap.total_solved) : 0;
                          let dailyEasy = prevSnap ? Math.max(0, snap.easy_solved - prevSnap.easy_solved) : 0;
                          let dailyMedium = prevSnap ? Math.max(0, snap.medium_solved - prevSnap.medium_solved) : 0;
                          let dailyHard = prevSnap ? Math.max(0, snap.hard_solved - prevSnap.hard_solved) : 0;

                          if (dailyTotal > (dailyEasy + dailyMedium + dailyHard)) {
                            dailyEasy += (dailyTotal - (dailyEasy + dailyMedium + dailyHard));
                          }

                          const snapEasy = snap.easy_solved + Math.max(0, snap.total_solved - (snap.easy_solved + snap.medium_solved + snap.hard_solved));

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
                              <td style={{ padding: '0.75rem', color: '#4ade80' }}>{snapEasy}</td>
                              <td style={{ padding: '0.75rem', color: '#facc15' }}>{snap.medium_solved}</td>
                              <td style={{ padding: '0.75rem', color: '#f87171' }}>{snap.hard_solved}</td>
                              <td style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>{snap.total_solved}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Google-like Pagination Bar (10 items per page with arrow navigation) */}
                  {totalPages > 1 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '1.25rem',
                      paddingTop: '1rem',
                      borderTop: '1px solid var(--border-subtle)',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Page <strong style={{ color: 'var(--text-primary)' }}>{validPage}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{totalPages}</strong> ({snapshots.length} total entries)
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {/* Previous Arrow Button */}
                        <button
                          type="button"
                          id="btn-prev-snapshots"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={validPage <= 1}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.825rem',
                            fontWeight: 600,
                            borderRadius: 'var(--radius-sm, 6px)',
                            border: '1px solid var(--border-subtle, #334155)',
                            backgroundColor: validPage <= 1 ? 'rgba(30, 41, 59, 0.4)' : 'rgba(30, 41, 59, 0.9)',
                            color: validPage <= 1 ? '#64748b' : '#f8fafc',
                            cursor: validPage <= 1 ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <ChevronLeft size={16} />
                          <span>Previous 10</span>
                        </button>

                        {/* Numbered Page Buttons (Google Pages style) */}
                        {getPageNumbers().map((pageNum, idx) => {
                          if (pageNum < 0) {
                            return (
                              <span key={`ellipsis-${idx}`} style={{ padding: '0.4rem 0.5rem', color: 'var(--text-muted)' }}>
                                ...
                              </span>
                            );
                          }
                          const isActive = pageNum === validPage;
                          return (
                            <button
                              key={`page-${pageNum}`}
                              type="button"
                              id={`btn-page-${pageNum}`}
                              onClick={() => setCurrentPage(pageNum)}
                              style={{
                                minWidth: '34px',
                                height: '34px',
                                padding: '0 0.5rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.825rem',
                                fontWeight: isActive ? 700 : 500,
                                borderRadius: 'var(--radius-sm, 6px)',
                                border: isActive ? '1px solid #6366f1' : '1px solid var(--border-subtle, #334155)',
                                backgroundColor: isActive ? '#6366f1' : 'rgba(30, 41, 59, 0.7)',
                                color: isActive ? '#ffffff' : '#cbd5e1',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {pageNum}
                            </button>
                          );
                        })}

                        {/* Next Arrow Button */}
                        <button
                          type="button"
                          id="btn-next-snapshots"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={validPage >= totalPages}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.825rem',
                            fontWeight: 600,
                            borderRadius: 'var(--radius-sm, 6px)',
                            border: '1px solid var(--border-subtle, #334155)',
                            backgroundColor: validPage >= totalPages ? 'rgba(30, 41, 59, 0.4)' : 'rgba(30, 41, 59, 0.9)',
                            color: validPage >= totalPages ? '#64748b' : '#f8fafc',
                            cursor: validPage >= totalPages ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>Next 10</span>
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

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
