import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout.js';
import { useAuth } from '../context/AuthContext.js';
import { statsApi } from '../services/api.js';
import { DashboardStats } from '../types/index.js';
import { Users, FolderKanban, UserCheck, GraduationCap, AlertCircle, Loader2 } from 'lucide-react';
import { SyncStatus } from '../components/SyncStatus.js';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await statsApi.getStats();
        setStats(data);
      } catch (err: unknown) {
        console.error('Failed to load dashboard statistics:', err);
        setError('Unable to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <Layout title="Dashboard">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Welcome Banner */}
        <div className="glass-panel" style={{
          padding: '2rem',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.8) 100%)',
          borderLeft: '4px solid var(--primary)',
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Welcome, {user?.name}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            {user?.role === 'ADMIN'
              ? 'Administrator Overview & System Statistics'
              : 'Faculty Dashboard & Assigned Batch Management'}
          </p>
        </div>

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
            <span>Loading dashboard statistics...</span>
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

        {/* Stats view for ADMIN */}
        {!loading && stats && stats.role === 'ADMIN' && (
          <div className="stats-grid-responsive" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1.25rem',
          }}>
            {/* Card 1: Total Staff */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Total Staff
                </span>
                <div style={{
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--primary)',
                }}>
                  <Users size={20} />
                </div>
              </div>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {stats.totalStaff}
              </span>
            </div>

            {/* Card 2: Total Batches */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Total Batches
                </span>
                <div style={{
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(6, 182, 212, 0.15)',
                  color: '#06b6d4',
                }}>
                  <FolderKanban size={20} />
                </div>
              </div>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {stats.totalBatches}
              </span>
            </div>

            {/* Card 3: Total Students */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Total Students
                </span>
                <div style={{
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                }}>
                  <GraduationCap size={20} />
                </div>
              </div>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {stats.totalStudents}
              </span>
            </div>

            {/* Card 4: Active Staff */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Active Staff
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
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {stats.activeStaff}
              </span>
            </div>
          </div>
        )}

        {/* Stats view for STAFF */}
        {!loading && stats && stats.role === 'STAFF' && (
          <div>
            {stats.assignedBatchesCount === 0 ? (
              <div className="glass-panel" style={{
                padding: '3rem 2rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
              }}>
                <FolderKanban size={48} style={{ opacity: 0.4, marginBottom: '1rem', color: 'var(--text-muted)' }} />
                <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  No batches assigned yet.
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  An Administrator will assign batches to your faculty account once academic setup is completed.
                </p>
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
