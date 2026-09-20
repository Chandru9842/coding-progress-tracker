import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout.js';
import { useAuth } from '../context/AuthContext.js';
import { statsApi, getCachedData } from '../services/api.js';
import { syncReportStudents } from '../api/reports.js';
import { DashboardStats } from '../types/index.js';
import {
  Users,
  FolderKanban,
  UserCheck,
  GraduationCap,
  AlertCircle,
  Loader2,
  Code2,
  Trophy,
  Zap,
  TrendingUp,
  RefreshCw,
  ChevronRight,
  Sparkles,
  Award,
} from 'lucide-react';
import { SyncStatus } from '../components/SyncStatus.js';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const cachedStats = getCachedData<DashboardStats>('stats_dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(cachedStats);
  const [loading, setLoading] = useState<boolean>(!cachedStats);
  const [error, setError] = useState<string | null>(null);
  const [syncingLeetCode, setSyncingLeetCode] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const fetchStats = async (bypassCache: boolean = false) => {
    try {
      if (!stats && !cachedStats && !bypassCache) {
        setLoading(true);
      }
      const data = await statsApi.getStats(bypassCache);
      setStats(data);
    } catch (err: unknown) {
      console.error('Failed to load dashboard statistics:', err);
      setError('Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    const handleSyncEvent = () => fetchStats(true);
    window.addEventListener('student-synced', handleSyncEvent);
    window.addEventListener('sheets-synced', handleSyncEvent);

    return () => {
      window.removeEventListener('student-synced', handleSyncEvent);
      window.removeEventListener('sheets-synced', handleSyncEvent);
    };
  }, []);

  const handleLiveLeetCodeSync = async () => {
    try {
      setSyncingLeetCode(true);
      setSyncMessage(null);
      setError(null);
      const res = await syncReportStudents();
      setSyncMessage(`⚡ Live LeetCode sync completed! ${res.successful ?? 'All'} student records synchronized.`);
      await fetchStats(true);
      window.dispatchEvent(new CustomEvent('student-synced'));
    } catch (err: any) {
      console.error('Failed to sync LeetCode stats:', err);
      setError('Failed to live sync LeetCode statistics. Please try again.');
    } finally {
      setSyncingLeetCode(false);
    }
  };

  const lc = (stats as any)?.leetcodeStats;

  return (
    <Layout title="Dashboard">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Welcome Banner with Action Buttons */}
        <div className="glass-panel" style={{
          padding: '2rem',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)',
          borderLeft: '4px solid var(--primary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
        }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>
              Welcome back, {user?.name}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              {user?.role === 'ADMIN'
                ? 'Administrator Overview & College-Wide Coding Performance'
                : 'Faculty Dashboard & Assigned Student Coding Analytics'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleLiveLeetCodeSync}
              disabled={syncingLeetCode || loading}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.15rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              }}
              title="Fetch fresh real-time LeetCode problem counts for all students"
            >
              <RefreshCw size={16} className={syncingLeetCode ? 'animate-spin' : ''} />
              <span>{syncingLeetCode ? 'Syncing LeetCode...' : '⚡ Sync Live LeetCode'}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.65rem 1rem',
                fontSize: '0.9rem',
              }}
            >
              <span>Detailed Reports</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Sync Success Feedback Notice */}
        {syncMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#34d399',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}>
            <Sparkles size={18} />
            <span>{syncMessage}</span>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '2rem',
            color: 'var(--text-secondary)',
          }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
            <span>Loading coding dashboard metrics...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#f87171',
          }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* Key LeetCode Progress Metrics Cards */}
        {!loading && lc && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Code2 size={20} style={{ color: '#fb923c' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                LeetCode Performance Overview
              </h3>
            </div>

            <div className="stats-grid-responsive" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.25rem',
            }}>
              {/* Card 1: Total Problems Solved */}
              <div className="glass-panel" style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                borderTop: '3px solid #10b981',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Total Problems Solved
                  </span>
                  <div style={{
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                  }}>
                    <Award size={20} />
                  </div>
                </div>
                <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#10b981', letterSpacing: '-0.02em' }}>
                  {(lc.totalSolved || 0).toLocaleString()}
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(52, 211, 153, 0.15)', color: '#34d399', fontWeight: 700 }}>
                    {lc.easySolved || 0} Easy
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(250, 204, 21, 0.15)', color: '#facc15', fontWeight: 700 }}>
                    {lc.mediumSolved || 0} Med
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(248, 113, 113, 0.15)', color: '#f87171', fontWeight: 700 }}>
                    {lc.hardSolved || 0} Hard
                  </span>
                </div>
              </div>

              {/* Card 2: Today's Solved (IST) */}
              <div className="glass-panel" style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                borderTop: '3px solid #6366f1',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Today's Solved (Midnight–Now)
                  </span>
                  <div style={{
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    color: 'var(--primary)',
                  }}>
                    <Zap size={20} />
                  </div>
                </div>
                <span style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
                  +{(lc.todaySolved || 0).toLocaleString()}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Fresh problems solved since 12:00 AM IST
                </span>
              </div>

              {/* Card 3: Active Coders */}
              <div className="glass-panel" style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                borderTop: '3px solid #06b6d4',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Active LeetCode Coders
                  </span>
                  <div style={{
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(6, 182, 212, 0.15)',
                    color: '#06b6d4',
                  }}>
                    <TrendingUp size={20} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    {lc.activeCoders || 0}
                  </span>
                  <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
                    / {lc.totalCoders || 0} students
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                  marginTop: '0.25rem',
                }}>
                  <div style={{
                    width: `${lc.totalCoders > 0 ? Math.round((lc.activeCoders / lc.totalCoders) * 100) : 0}%`,
                    height: '100%',
                    backgroundColor: '#06b6d4',
                    borderRadius: '3px',
                  }} />
                </div>
              </div>

              {/* Card 4: Coding Participation Rate */}
              <div className="glass-panel" style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                borderTop: '3px solid #ec4899',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Participation Rate
                  </span>
                  <div style={{
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(236, 72, 153, 0.15)',
                    color: '#ec4899',
                  }}>
                    <UserCheck size={20} />
                  </div>
                </div>
                <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#ec4899', letterSpacing: '-0.02em' }}>
                  {lc.totalCoders > 0 ? Math.round((lc.activeCoders / lc.totalCoders) * 100) : 0}%
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Active profiles with problems solved
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Top 5 Performers Leaderboard */}
        {!loading && lc?.topCoders && lc.topCoders.length > 0 && (
          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  padding: '0.45rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(234, 179, 8, 0.15)',
                  color: '#eab308',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Trophy size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Top LeetCode Performers
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Leading students ranked by overall solved problems
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/students')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <span>View All Students</span>
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="table-responsive-container">
              <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem 1rem', width: '60px', textAlign: 'center' }}>Rank</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Register No</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Student Name</th>
                    <th style={{ padding: '0.75rem 1rem' }}>LeetCode Handle</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Breakdown (E / M / H)</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Solved</th>
                  </tr>
                </thead>
                <tbody>
                  {lc.topCoders.map((student: any, idx: number) => {
                    const rankMedals = ['🥇', '🥈', '🥉'];
                    return (
                      <tr
                        key={student.id}
                        onClick={() => navigate(`/students/${student.id}`)}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)',
                        }}
                      >
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          {idx < 3 ? (
                            <span style={{ fontSize: '1.2rem' }}>{rankMedals[idx]}</span>
                          ) : (
                            <span style={{
                              display: 'inline-block',
                              minWidth: '24px',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              color: 'var(--text-secondary)',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                            }}>
                              #{idx + 1}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--primary)' }}>
                          {student.register_number}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {student.name}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(249, 115, 22, 0.1)',
                            color: '#fb923c',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                          }}>
                            @{student.leetcode_username}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '3px', backgroundColor: 'rgba(52, 211, 153, 0.12)', color: '#34d399', fontWeight: 600 }}>
                              {student.easy_solved || 0}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>/</span>
                            <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '3px', backgroundColor: 'rgba(250, 204, 21, 0.12)', color: '#facc15', fontWeight: 600 }}>
                              {student.medium_solved || 0}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>/</span>
                            <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '3px', backgroundColor: 'rgba(248, 113, 113, 0.12)', color: '#f87171', fontWeight: 600 }}>
                              {student.hard_solved || 0}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 800, fontSize: '1.1rem', color: '#10b981' }}>
                          {(student.total_solved || 0).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Academic / Faculty Operational Stats */}
        {!loading && stats && (
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Academic & Allocation Metrics
            </h3>

            {stats.role === 'ADMIN' ? (
              <div className="stats-grid-responsive" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.25rem',
              }}>
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Staff</span>
                    <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>
                      <Users size={20} />
                    </div>
                  </div>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.totalStaff}</span>
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Batches</span>
                    <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
                      <FolderKanban size={20} />
                    </div>
                  </div>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.totalBatches}</span>
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Students</span>
                    <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                      <GraduationCap size={20} />
                    </div>
                  </div>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.totalStudents}</span>
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Active Faculty</span>
                    <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(236, 72, 153, 0.15)', color: '#ec4899' }}>
                      <UserCheck size={20} />
                    </div>
                  </div>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.activeStaff}</span>
                </div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1.25rem',
              }}>
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Assigned Batches
                  </span>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {stats.assignedBatchesCount}
                  </span>
                </div>
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Students in Assigned Batches
                  </span>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {stats.totalStudentsInAssignedBatches}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Real-time Google Sheets Sync & Zero-Error Automation Status */}
        {!loading && <SyncStatus variant="card" />}
      </div>
    </Layout>
  );
};

