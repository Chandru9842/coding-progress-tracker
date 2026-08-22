import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout.js';
import { useAuth } from '../context/AuthContext.js';
import { User, Mail, Shield, Calendar, FileSpreadsheet, RefreshCw, CheckCircle2, AlertCircle, Plus, ExternalLink, Trash2, History, Pencil, Key, Save, X, Search, Edit2, Copy, Download, Code } from 'lucide-react';

import { authApi, googleSheetsApi, batchApi, staffApi, GoogleSheetLink, GoogleSheetLinkLog, Batch } from '../services/api.js';

export const SettingsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [sheetLinks, setSheetLinks] = useState<GoogleSheetLink[]>([]);
  const [assignedBatches, setAssignedBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [syncingLinkId, setSyncingLinkId] = useState<string | null>(null);
  const [syncingAllSheets, setSyncingAllSheets] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search & Creator Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [creatorFilter, setCreatorFilter] = useState<string>('ALL');

  // Edit Link Modal state
  const [editingLink, setEditingLink] = useState<GoogleSheetLink | null>(null);
  const [editLinkName, setEditLinkName] = useState<string>('');
  const [editSpreadsheetId, setEditSpreadsheetId] = useState<string>('');
  const [updatingLink, setUpdatingLink] = useState<boolean>(false);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [updatingProfile, setUpdatingProfile] = useState<boolean>(false);

  // Staff Assigned Scopes state
  const [staffSections, setStaffSections] = useState<Array<{ id: string; name: string; batch_id: string; academic_year: string; department: string; assignment_mode: 'ALL' | 'SELECTED'; allocation_batches: Array<{ id: string; name: string }> }>>([]);
  const [selectedStaffAcademicYear, setSelectedStaffAcademicYear] = useState<string>('');
  const [selectedStaffSectionId, setSelectedStaffSectionId] = useState<string>('');
  const [selectedStaffAllocBatchId, setSelectedStaffAllocBatchId] = useState<string>('ALL');

  // Link Modal state
  const [showLinkModal, setShowLinkModal] = useState<boolean>(false);
  const [linkName, setLinkName] = useState<string>('');
  const [spreadsheetId, setSpreadsheetId] = useState<string>('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());

  // Logs Modal state
  const [showLogsModal, setShowLogsModal] = useState<boolean>(false);
  const [selectedLogLink, setSelectedLogLink] = useState<GoogleSheetLink | null>(null);
  const [activeLogs, setActiveLogs] = useState<GoogleSheetLinkLog[]>([]);

  // Apps Script Setup Modal State
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);
  const [scriptModalLink, setScriptModalLink] = useState<GoogleSheetLink | null>(null);


  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [links, batches] = await Promise.all([
        googleSheetsApi.getLinks(),
        batchApi.getBatches(),
      ]);
      setSheetLinks(links);
      setAssignedBatches(batches);

      if (!isAdmin) {
        try {
          const staffScopeRes = await staffApi.getAssignedScopes();
          setStaffSections(staffScopeRes.sections || []);
        } catch (sErr) {
          console.error('Failed to fetch staff assigned scopes:', sErr);
        }
      }
    } catch (err: any) {
      console.error('Failed to load Google Sheets settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLinkModal = () => {
    setLinkName('');
    setSpreadsheetId('');

    if (isAdmin) {
      setSelectedDepartment('ALL');
      const availableYears = Array.from(new Set(assignedBatches.map((b) => `${b.start_year}–${b.end_year}`))).sort();
      setSelectedAcademicYear(availableYears[0] || '');
      setSelectedBatchIds(new Set());
    } else {
      const availableStaffYears = Array.from(new Set(staffSections.map((s) => s.academic_year))).sort();
      const firstYear = availableStaffYears[0] || '';
      setSelectedStaffAcademicYear(firstYear);

      const secsForFirstYear = staffSections.filter((s) => s.academic_year === firstYear);
      const firstSec = secsForFirstYear[0];
      setSelectedStaffSectionId(firstSec?.id || '');

      if (firstSec?.assignment_mode === 'ALL') {
        setSelectedStaffAllocBatchId('ALL');
      } else {
        setSelectedStaffAllocBatchId(firstSec?.allocation_batches[0]?.id || 'ALL');
      }
    }

    setShowLinkModal(true);
  };

  const handleOpenEditProfile = () => {
    setProfileForm({
      name: user?.name || '',
      email: user?.email || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setProfileMsg(null);
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);

    if (!profileForm.name || !profileForm.email) {
      setProfileMsg({ type: 'error', text: 'Full Name and Email Address are required.' });
      return;
    }

    if (profileForm.newPassword) {
      if (profileForm.newPassword !== profileForm.confirmPassword) {
        setProfileMsg({ type: 'error', text: 'New passwords do not match.' });
        return;
      }
    }

    try {
      setUpdatingProfile(true);
      await authApi.updateProfile({
        name: profileForm.name,
        email: profileForm.email,
        currentPassword: profileForm.currentPassword || undefined,
        newPassword: profileForm.newPassword || undefined,
      });

      await refreshUser();
      setProfileMsg({ type: 'success', text: 'Faculty profile and credentials updated successfully!' });
      setIsEditingProfile(false);
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update profile.' });
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!spreadsheetId) {
      setMessage({ type: 'error', text: 'Spreadsheet ID or Google Sheet URL is required.' });
      return;
    }

    if (isAdmin && !selectedAcademicYear) {
      setMessage({ type: 'error', text: 'Please select an Academic Year.' });
      return;
    }

    try {
      setSubmitting(true);
      let payload: any = {};

      if (isAdmin) {
        const generatedName = linkName.trim() || `${selectedAcademicYear} ${selectedDepartment !== 'ALL' ? selectedDepartment : 'All Departments'} Master Sheet`;
        payload = {
          name: generatedName,
          spreadsheet_id: spreadsheetId,
          academic_year: selectedAcademicYear,
          department: selectedDepartment,
          is_auto_sync_enabled: true,
          sync_students: true,
          sync_daily_progress: true,
        };
      } else {
        const targetSec = staffSections.find((s) => s.id === selectedStaffSectionId);
        const targetAlloc = targetSec?.allocation_batches.find((ab) => ab.id === selectedStaffAllocBatchId);
        const allocLabel = selectedStaffAllocBatchId === 'ALL' ? 'Entire Section' : (targetAlloc?.name || 'Batch');
        const generatedName = linkName.trim() || `${selectedStaffAcademicYear} ${targetSec?.name || 'Section'} ${allocLabel} Sheet`;

        payload = {
          name: generatedName,
          spreadsheet_id: spreadsheetId,
          academic_year: selectedStaffAcademicYear,
          department: targetSec?.department,
          section_id: selectedStaffSectionId,
          allocation_batch_id: selectedStaffAllocBatchId,
          batch_ids: targetSec?.batch_id ? [targetSec.batch_id] : [],
          is_auto_sync_enabled: true,
          sync_students: true,
          sync_daily_progress: true,
        };
      }

      const newLink = await googleSheetsApi.createLink(payload);

      setMessage({ type: 'success', text: `Google Sheet [${newLink.name}] linked and populated successfully!` });
      setShowLinkModal(false);
      setLinkName('');
      setSpreadsheetId('');
      setSelectedAcademicYear('');
      setSelectedDepartment('ALL');
      setSelectedBatchIds(new Set());
      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to link Google Sheet.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncLink = async (linkId: string) => {
    try {
      setSyncingLinkId(linkId);
      setMessage(null);
      const res = await googleSheetsApi.triggerSync(linkId);
      setMessage({ type: 'success', text: res.message || 'Sheet synchronized successfully.' });
      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to sync sheet.' });
    } finally {
      setSyncingLinkId(null);
    }
  };

  const handleCopySheetMatrix = async (link: GoogleSheetLink) => {
    try {
      setSyncingLinkId(link.id);
      setMessage(null);
      const res = await googleSheetsApi.triggerSync(link.id);
      const matrix = res.data?.matrix;
      if (matrix && matrix.headers && matrix.rows) {
        const tsv = [matrix.headers.join('\t'), ...matrix.rows.map((r: string[]) => r.join('\t'))].join('\n');
        await navigator.clipboard.writeText(tsv);
        setMessage({
          type: 'success',
          text: `📋 Copied formatted data matrix for ${matrix.studentCount} student(s) to clipboard! Paste directly into Cell A1 of your Google Sheet.`,
        });
      } else {
        setMessage({ type: 'success', text: 'Sheet matrix copied.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to copy sheet data matrix.' });
    } finally {
      setSyncingLinkId(null);
    }
  };

  const handleDownloadSheetCSV = async (link: GoogleSheetLink) => {
    try {
      setSyncingLinkId(link.id);
      setMessage(null);
      const res = await googleSheetsApi.triggerSync(link.id);
      const matrix = res.data?.matrix;
      if (matrix && matrix.headers && matrix.rows) {
        const csvContent = [
          matrix.headers.map((h: string) => `"${h.replace(/"/g, '""')}"`).join(','),
          ...matrix.rows.map((row: string[]) => row.map((cell: string) => `"${cell.replace(/"/g, '""')}"`).join(',')),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${link.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_data.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setMessage({
          type: 'success',
          text: `⬇ Downloaded CSV dataset for ${matrix.studentCount} student(s)! Import directly into Google Sheets (File -> Import).`,
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to download sheet CSV.' });
    } finally {
      setSyncingLinkId(null);
    }
  };


  const handleDeleteLink = async (linkId: string) => {
    if (!window.confirm('Deactivate this linked sheet? Historical sheet data will be preserved in Google Sheets.')) return;
    try {
      setMessage(null);
      await googleSheetsApi.deleteLink(linkId);
      setMessage({ type: 'success', text: 'Google Sheet link deactivated successfully.' });
      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to deactivate link.' });
    }
  };

  const handleSyncAllSheets = async () => {
    try {
      setSyncingAllSheets(true);
      setMessage(null);
      const res = await googleSheetsApi.syncAllLinks();
      setMessage({
        type: 'success',
        text: res.message || `Successfully synchronized ${res.successful || 0} Google Sheet link(s)!`,
      });
      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to sync all Google Sheets.' });
    } finally {
      setSyncingAllSheets(false);
    }
  };

  const handleOpenEditModal = (link: GoogleSheetLink) => {
    setEditingLink(link);
    setEditLinkName(link.name);
    setEditSpreadsheetId(link.spreadsheet_id || link.spreadsheet_url || '');
  };

  const handleSaveEditLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink) return;
    if (!editLinkName.trim() || !editSpreadsheetId.trim()) {
      setMessage({ type: 'error', text: 'Sheet Name and Spreadsheet ID / URL are required.' });
      return;
    }

    try {
      setUpdatingLink(true);
      setMessage(null);
      const updated = await googleSheetsApi.updateLink(editingLink.id, {
        name: editLinkName.trim(),
        spreadsheet_id: editSpreadsheetId.trim(),
      });
      setMessage({ type: 'success', text: `Google Sheet [${updated.name}] updated successfully!` });
      setEditingLink(null);
      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update Google Sheet link.' });
    } finally {
      setUpdatingLink(false);
    }
  };

  const handleViewLogs = async (link: GoogleSheetLink) => {
    try {
      setSelectedLogLink(link);
      const logs = await googleSheetsApi.getLogs(link.id);
      setActiveLogs(logs);
      setShowLogsModal(true);
    } catch (err: any) {
      alert('Failed to load logs');
    }
  };

  const creatorsList = Array.from(
    new Map(
      sheetLinks
        .filter((l) => l.owner)
        .map((l) => [l.owner!.id, l.owner!])
    ).values()
  );

  const filteredSheetLinks = sheetLinks.filter((link) => {
    if (creatorFilter !== 'ALL') {
      if (creatorFilter === 'ADMIN') {
        if (link.owner?.role !== 'ADMIN' && link.owner_user_id !== user?.id) return false;
      } else {
        if (link.owner_user_id !== creatorFilter) return false;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = link.name.toLowerCase().includes(q);
      const sheetIdMatch = (link.spreadsheet_id || '').toLowerCase().includes(q);
      const creatorMatch = (link.owner?.name || '').toLowerCase().includes(q) || (link.owner?.email || '').toLowerCase().includes(q);
      const scopeMatch = (link.academic_year || '').toLowerCase().includes(q) || (link.department || '').toLowerCase().includes(q);
      if (!nameMatch && !sheetIdMatch && !creatorMatch && !scopeMatch) return false;
    }

    return true;
  });

  const toggleBatchSelection = (bId: string) => {
    const next = new Set(selectedBatchIds);
    if (next.has(bId)) {
      next.delete(bId);
    } else {
      next.add(bId);
    }
    setSelectedBatchIds(next);
  };

  return (
    <Layout title="Account & Integration Settings">
      <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Profile Card */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.25rem', margin: 0 }}>
              Faculty Profile
            </h3>
            {!isEditingProfile && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleOpenEditProfile}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
              >
                <Pencil size={15} style={{ color: 'var(--primary)' }} />
                <span>Edit Profile & Password</span>
              </button>
            )}
          </div>

          {profileMsg && (
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              marginBottom: '1.25rem',
              backgroundColor: profileMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: profileMsg.type === 'success' ? '#10b981' : '#f87171',
              border: profileMsg.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              {profileMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{profileMsg.text}</span>
            </div>
          )}

          {isEditingProfile ? (
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address (Login ID)</label>
                  <input
                    type="email"
                    className="form-input"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Key size={16} style={{ color: 'var(--primary)' }} />
                  <span>Update Password (Optional)</span>
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Current Password</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Required if changing password"
                      value={profileForm.currentPassword}
                      onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Enter new password"
                      value={profileForm.newPassword}
                      onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Confirm New Password</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Confirm new password"
                      value={profileForm.confirmPassword}
                      onChange={(e) => setProfileForm({ ...profileForm, confirmPassword: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsEditingProfile(false)}
                  disabled={updatingProfile}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={updatingProfile}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Save size={16} />
                  <span>{updatingProfile ? 'Saving...' : 'Save Profile & Password'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <User size={20} style={{ color: 'var(--primary)' }} />
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Full Name</span>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Mail size={20} style={{ color: 'var(--primary)' }} />
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Email Address</span>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.email}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Shield size={20} style={{ color: 'var(--primary)' }} />
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Assigned Role</span>
                  <span className={`badge-role ${user?.role.toLowerCase()}`} style={{ marginTop: '0.25rem', display: 'inline-block' }}>
                    {user?.role}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Calendar size={20} style={{ color: 'var(--primary)' }} />
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Account Created</span>
                  <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Phase 7: Scoped Google Sheets Linking Section */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <FileSpreadsheet size={24} style={{ color: '#10b981' }} />
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Linked Google Sheets</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Link individual or combined Google Sheets for your assigned academic batches
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                id="btn-sync-all-google-sheets"
                className="btn btn-secondary"
                onClick={handleSyncAllSheets}
                disabled={syncingAllSheets || loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  color: '#818cf8',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  padding: '0.5rem 0.9rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
                title={isAdmin ? "Sync all active Google Sheets across all creators" : "Sync all active Google Sheets for your assigned scope"}
              >
                <RefreshCw size={15} className={syncingAllSheets ? 'animate-spin' : ''} />
                <span>{syncingAllSheets ? 'Syncing All Sheets...' : '⚡ Sync All Sheets'}</span>
              </button>

              <button className="btn btn-primary" onClick={handleOpenLinkModal} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={18} />
                <span>Link New Sheet</span>
              </button>
            </div>
          </div>

          {/* Search Bar & Creator Filter */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '1.25rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="input-search-google-sheets"
                type="text"
                className="form-input"
                placeholder="Search linked sheets by title, ID, batch, or creator..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.25rem', width: '100%', fontSize: '0.875rem' }}
              />
            </div>

            {isAdmin && (
              <div style={{ minWidth: '220px' }}>
                <select
                  id="select-creator-filter"
                  className="form-input"
                  value={creatorFilter}
                  onChange={(e) => setCreatorFilter(e.target.value)}
                  style={{ width: '100%', fontSize: '0.875rem' }}
                >
                  <option value="ALL">All Sheets (Admin & Staff)</option>
                  <option value="ADMIN">Admin Linked Sheets Only</option>
                  {creatorsList.map((c) => (
                    <option key={c.id} value={c.id}>
                      Created by {c.name} ({c.role})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {message && (
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              marginBottom: '1.25rem',
              backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
              color: message.type === 'success' ? '#34d399' : '#f87171',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{message.text}</span>
            </div>
          )}

          {/* Linked Sheets Directory */}
          {filteredSheetLinks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)' }}>
              <FileSpreadsheet size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p style={{ margin: 0, fontSize: '0.95rem' }}>
                {searchQuery || creatorFilter !== 'ALL' ? 'No Google Sheets match your search/filter criteria.' : 'No Google Sheets linked yet.'}
              </p>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {searchQuery || creatorFilter !== 'ALL' ? 'Try adjusting your search query or creator filter.' : 'Click "Link New Sheet" to attach a spreadsheet to your assigned batches.'}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredSheetLinks.map((link) => {
                const linkedBatchNames = assignedBatches
                  .filter((b) => link.batch_ids.includes(b.id))
                  .map((b) => b.batch_name)
                  .join(', ') || `${link.batch_ids.length} Batches`;

                return (
                  <div key={link.id} style={{
                    padding: '1.25rem',
                    borderRadius: '10px',
                    backgroundColor: link.is_active ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.2)',
                    border: `1px solid ${link.is_active ? 'var(--border-subtle)' : 'rgba(255,255,255,0.05)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    opacity: link.is_active ? 1 : 0.6,
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{link.name}</span>
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: link.is_active ? '#065f46' : '#334155',
                          color: '#ffffff',
                          fontWeight: 600,
                        }}>
                          {link.is_active ? 'Active Link' : 'Historical Link'}
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          padding: '0.18rem 0.55rem',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(99, 102, 241, 0.15)',
                          color: '#818cf8',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}>
                          <span>👤 Linked by: {link.owner?.name || 'Admin'} ({link.owner?.role || 'ADMIN'})</span>
                        </span>
                      </div>

                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <span>Scope: <strong>{linkedBatchNames}</strong></span>
                        <span>Sheet ID: <code style={{ fontSize: '0.8rem' }}>{link.spreadsheet_id}</code></span>
                      </div>

                      {link.last_sync_at && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                          Last Synced: {new Date(link.last_sync_at).toLocaleString()} ({link.last_sync_status || 'OK'})
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {link.spreadsheet_url && (
                        <a
                          href={link.spreadsheet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          <ExternalLink size={14} />
                          <span>Open</span>
                        </a>
                      )}

                      {link.is_active && (
                        <>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleSyncLink(link.id)}
                            disabled={syncingLinkId === link.id}
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <RefreshCw size={14} className={syncingLinkId === link.id ? 'animate-spin' : ''} />
                            <span>{syncingLinkId === link.id ? 'Syncing...' : 'Sync Now'}</span>
                          </button>

                          <button
                            className="btn btn-secondary"
                            onClick={() => handleCopySheetMatrix(link)}
                            disabled={syncingLinkId === link.id}
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                            title="Copy student data matrix directly to clipboard (Paste into Cell A1 of Google Sheet)"
                          >
                            <Copy size={14} />
                            <span>Copy Data (Cell A1)</span>
                          </button>

                          <button
                            className="btn btn-secondary"
                            onClick={() => handleDownloadSheetCSV(link)}
                            disabled={syncingLinkId === link.id}
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                            title="Download dataset as CSV file for Google Sheets import"
                          >
                            <Download size={14} />
                          </button>

                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              setScriptModalLink(link);
                              setShowScriptModal(true);
                            }}
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                            title="1-Click Google Apps Script Setup Code"
                          >
                            <Code size={14} />
                          </button>
                        </>
                      )}


                      <button
                        className="btn btn-secondary"
                        onClick={() => handleOpenEditModal(link)}
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                        title="Edit / Update Linked Sheet"
                      >
                        <Edit2 size={14} />
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => handleViewLogs(link)}
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                        title="View Sync History"
                      >
                        <History size={14} />
                      </button>

                      {link.is_active && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleDeleteLink(link.id)}
                          style={{ padding: '0.4rem 0.6rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          title="Deactivate Link"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Link New Sheet Modal */}
      {showLinkModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>
              Link Google Sheet to Academic Scope
            </h3>

            <form onSubmit={handleCreateLink} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {isAdmin ? (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Academic Year *
                    </label>
                    <select
                      className="form-input"
                      value={selectedAcademicYear}
                      onChange={(e) => {
                        setSelectedAcademicYear(e.target.value);
                        setSelectedDepartment('ALL');
                      }}
                      required
                      style={{ width: '100%' }}
                    >
                      <option value="" disabled>Select Academic Year</option>
                      {Array.from(new Set(assignedBatches.map((b) => `${b.start_year}–${b.end_year}`))).sort().map((yr) => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Department (Optional Filter)
                    </label>
                    <select
                      className="form-input"
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <option value="ALL">All Departments</option>
                      {Array.from(
                        new Set(
                          assignedBatches
                            .filter((b) => {
                              if (!selectedAcademicYear) return true;
                              return `${b.start_year}–${b.end_year}` === selectedAcademicYear;
                            })
                            .map((b) => b.department)
                        )
                      ).sort().map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  {staffSections.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No assigned academic responsibilities found. An administrator must assign batches or sections before you can link a sheet.
                    </div>
                  ) : (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                          Academic Year *
                        </label>
                        <select
                          className="form-input"
                          value={selectedStaffAcademicYear}
                          onChange={(e) => {
                            const newYear = e.target.value;
                            setSelectedStaffAcademicYear(newYear);
                            const secs = staffSections.filter((s) => s.academic_year === newYear);
                            const firstSec = secs[0];
                            setSelectedStaffSectionId(firstSec?.id || '');
                            if (firstSec?.assignment_mode === 'ALL') {
                              setSelectedStaffAllocBatchId('ALL');
                            } else {
                              setSelectedStaffAllocBatchId(firstSec?.allocation_batches[0]?.id || 'ALL');
                            }
                          }}
                          required
                          style={{ width: '100%' }}
                        >
                          {Array.from(new Set(staffSections.map((s) => s.academic_year))).sort().map((yr) => (
                            <option key={yr} value={yr}>{yr}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                          Section *
                        </label>
                        <select
                          className="form-input"
                          value={selectedStaffSectionId}
                          onChange={(e) => {
                            const newSecId = e.target.value;
                            setSelectedStaffSectionId(newSecId);
                            const targetSec = staffSections.find((s) => s.id === newSecId);
                            if (targetSec?.assignment_mode === 'ALL') {
                              setSelectedStaffAllocBatchId('ALL');
                            } else {
                              setSelectedStaffAllocBatchId(targetSec?.allocation_batches[0]?.id || 'ALL');
                            }
                          }}
                          required
                          style={{ width: '100%' }}
                        >
                          {staffSections
                            .filter((s) => !selectedStaffAcademicYear || s.academic_year === selectedStaffAcademicYear)
                            .map((sec) => (
                              <option key={sec.id} value={sec.id}>
                                {sec.name} ({sec.department})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                          Allocation Batch / Scope *
                        </label>
                        <select
                          className="form-input"
                          value={selectedStaffAllocBatchId}
                          onChange={(e) => setSelectedStaffAllocBatchId(e.target.value)}
                          required
                          style={{ width: '100%' }}
                        >
                          {(() => {
                            const currentSec = staffSections.find((s) => s.id === selectedStaffSectionId);
                            if (!currentSec) return null;

                            const options = [];
                            if (currentSec.assignment_mode === 'ALL') {
                              options.push(<option key="ALL" value="ALL">Entire Section (All Batches)</option>);
                            }
                            currentSec.allocation_batches.forEach((ab) => {
                              options.push(<option key={ab.id} value={ab.id}>{ab.name}</option>);
                            });

                            return options;
                          })()}
                        </select>
                      </div>
                    </>
                  )}
                </>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Sheet Description / Title (Optional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={isAdmin ? "e.g. 2023–2027 Master Progress Sheet" : "e.g. Assigned Batch Sheet"}
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Google Spreadsheet ID or URL *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Paste Spreadsheet ID or full URL (e.g. https://docs.google.com/spreadsheets/d/1BxiMVs.../edit)"
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Paste either the raw ID or full Google Sheet URL. The system will extract the exact valid link automatically.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowLinkModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Linking...' : 'Link & Populate Sheet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sync Logs Modal */}
      {showLogsModal && selectedLogLink && (
        <div className="modal-overlay-responsive">
          <div className="glass-panel modal-card-responsive" style={{ width: '100%', maxWidth: '600px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Sync History: {selectedLogLink.name}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Audit logs for Google Sheet ID [{selectedLogLink.spreadsheet_id}]
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '280px', overflowY: 'auto', marginBottom: '1.5rem' }}>
              {activeLogs.length === 0 ? (
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                  No sync history recorded yet.
                </div>
              ) : (
                activeLogs.map((log) => (
                  <div key={log.id} style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.85rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 700, color: log.status === 'SUCCESS' ? '#34d399' : '#f87171' }}>
                        [{log.status}]
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {new Date(log.synced_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>{log.details}</div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowLogsModal(false)}>
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Linked Sheet Modal */}
      {editingLink && (
        <div className="modal-overlay-responsive">
          <div className="glass-panel modal-card-responsive" style={{ width: '100%', maxWidth: '520px', padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                Edit / Update Linked Google Sheet
              </h3>
              <button
                type="button"
                onClick={() => setEditingLink(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditLink} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Sheet Custom Name / Title *
                </label>
                <input
                  id="input-edit-sheet-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Master Batch 2019-2023 Sheet"
                  value={editLinkName}
                  onChange={(e) => setEditLinkName(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Google Sheet Webhook URL / Spreadsheet ID *
                </label>
                <input
                  id="input-edit-spreadsheet-id"
                  type="text"
                  className="form-input"
                  placeholder="e.g. https://docs.google.com/spreadsheets/d/1BxiMVs0.../edit or 1BxiMVs0..."
                  value={editSpreadsheetId}
                  onChange={(e) => setEditSpreadsheetId(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                  Paste full Google Sheet URL or raw Spreadsheet ID.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingLink(null)}
                  disabled={updatingLink}
                >
                  Cancel
                </button>
                <button
                  id="btn-save-edit-sheet"
                  type="submit"
                  className="btn btn-primary"
                  disabled={updatingLink}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Save size={16} />
                  <span>{updatingLink ? 'Updating...' : 'Save & Update Link'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1-Click Apps Script Setup Modal */}
      {showScriptModal && scriptModalLink && (
        <div className="modal-overlay-responsive">
          <div className="glass-panel modal-card-responsive" style={{ width: '100%', maxWidth: '640px', padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Code size={20} style={{ color: '#10b981' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                  Live Apps Script Auto-Fill Setup
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.5' }}>
              Follow these 2 quick steps to let Google Sheet <strong>[{scriptModalLink.name}]</strong> auto-fill automatically whenever 12:00 AM IST sync runs or when you click <strong>Sync Now</strong>:
            </p>

            <ol style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <li>
                Open your Google Sheet: <a href={scriptModalLink.spreadsheet_url || '#'} target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', fontWeight: 600 }}>{scriptModalLink.name}</a>
              </li>
              <li>
                Click <strong>Extensions &rarr; Apps Script</strong> in Google Sheets, paste the code below, and click <strong>Deploy &rarr; New deployment &rarr; Web app</strong> (Execute as: <i>Me</i>, Access: <i>Anyone</i>):
              </li>
            </ol>

            <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
              <textarea
                readOnly
                rows={12}
                className="form-input"
                style={{ fontFamily: 'monospace', fontSize: '0.8rem', width: '100%', backgroundColor: '#0f172a', color: '#38bdf8', padding: '0.85rem' }}
                value={`function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.clear();
    if (data.headers) sheet.appendRow(data.headers);
    if (data.rows) {
      for (var i = 0; i < data.rows.length; i++) {
        sheet.appendRow(data.rows[i]);
      }
    }
    if (sheet.getLastColumn() > 0) {
      sheet.autoResizeColumns(1, sheet.getLastColumn());
    }
    return ContentService.createTextOutput("SUCCESS");
  } catch (err) {
    return ContentService.createTextOutput("ERROR: " + err.message);
  }
}`}
              />
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const code = `function doPost(e) {\n  try {\n    var data = JSON.parse(e.postData.contents);\n    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();\n    sheet.clear();\n    if (data.headers) sheet.appendRow(data.headers);\n    if (data.rows) {\n      for (var i = 0; i < data.rows.length; i++) {\n        sheet.appendRow(data.rows[i]);\n      }\n    }\n    if (sheet.getLastColumn() > 0) {\n      sheet.autoResizeColumns(1, sheet.getLastColumn());\n    }\n    return ContentService.createTextOutput("SUCCESS");\n  } catch (err) {\n    return ContentService.createTextOutput("ERROR: " + err.message);\n  }\n}`;
                  navigator.clipboard.writeText(code);
                  setMessage({ type: 'success', text: '📋 Apps Script code with Auto-Column Resizing copied!' });
                }}
                style={{ position: 'absolute', right: '0.5rem', top: '0.5rem', fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
              >
                Copy Script
              </button>
            </div>


            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setShowScriptModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>

  );
};
