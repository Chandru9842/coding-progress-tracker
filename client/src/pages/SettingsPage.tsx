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
  const [editWebhookUrl, setEditWebhookUrl] = useState<string>('');
  const [editDateScopeMode, setEditDateScopeMode] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'CUSTOM'>('ALL');
  const [editCustomStartDate, setEditCustomStartDate] = useState<string>('');
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
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [dateScopeMode, setDateScopeMode] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());

  const getTodayDateStr = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  const getYesterdayDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };

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

  const handleOpenLinkModal = async () => {
    setLinkName('');
    setSpreadsheetId('');
    setWebhookUrl('');
    setDateScopeMode('ALL');
    setCustomStartDate(getTodayDateStr());

    if (isAdmin) {
      setSelectedDepartment('ALL');
      const availableYears = Array.from(new Set(assignedBatches.map((b) => `${b.start_year}–${b.end_year}`))).sort();
      setSelectedAcademicYear(availableYears[0] || '');
      setSelectedBatchIds(new Set());
    } else {
      let currentStaffSections = staffSections;
      try {
        const staffScopeRes = await staffApi.getAssignedScopes();
        if (staffScopeRes.sections) {
          currentStaffSections = staffScopeRes.sections;
          setStaffSections(staffScopeRes.sections);
        }
      } catch (sErr) {
        console.error('Failed to refresh staff scopes:', sErr);
      }

      const availableStaffYears = Array.from(new Set(currentStaffSections.map((s) => s.academic_year))).sort();
      const firstYear = availableStaffYears[0] || '';
      setSelectedStaffAcademicYear(firstYear);

      const secsForFirstYear = currentStaffSections.filter((s) => s.academic_year === firstYear);
      const firstSec = secsForFirstYear[0];
      setSelectedStaffSectionId(firstSec?.id || '');

      setSelectedStaffAllocBatchId('ALL');
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

      let effectiveStartDate: string | null = null;
      if (dateScopeMode === 'TODAY') {
        effectiveStartDate = getTodayDateStr();
      } else if (dateScopeMode === 'YESTERDAY') {
        effectiveStartDate = getYesterdayDateStr();
      } else if (dateScopeMode === 'CUSTOM') {
        effectiveStartDate = customStartDate.trim() || getTodayDateStr();
      }

      if (isAdmin) {
        const generatedName = linkName.trim() || `${selectedAcademicYear} ${selectedDepartment !== 'ALL' ? selectedDepartment : 'All Departments'} Master Sheet`;
        payload = {
          name: generatedName,
          spreadsheet_id: spreadsheetId,
          webhook_url: webhookUrl.trim() || undefined,
          start_date: effectiveStartDate || undefined,
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
          webhook_url: webhookUrl.trim() || undefined,
          start_date: effectiveStartDate || undefined,
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
      setWebhookUrl('');
      setDateScopeMode('ALL');
      setCustomStartDate('');

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
    setEditWebhookUrl(link.webhook_url || '');

    if (!link.start_date) {
      setEditDateScopeMode('ALL');
      setEditCustomStartDate(getTodayDateStr());
    } else if (link.start_date === getTodayDateStr()) {
      setEditDateScopeMode('TODAY');
      setEditCustomStartDate(link.start_date);
    } else if (link.start_date === getYesterdayDateStr()) {
      setEditDateScopeMode('YESTERDAY');
      setEditCustomStartDate(link.start_date);
    } else {
      setEditDateScopeMode('CUSTOM');
      setEditCustomStartDate(link.start_date);
    }
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
      const val = editSpreadsheetId.trim();
      const whVal = editWebhookUrl.trim();

      let effectiveEditStartDate: string | null = null;
      if (editDateScopeMode === 'TODAY') {
        effectiveEditStartDate = getTodayDateStr();
      } else if (editDateScopeMode === 'YESTERDAY') {
        effectiveEditStartDate = getYesterdayDateStr();
      } else if (editDateScopeMode === 'CUSTOM') {
        effectiveEditStartDate = editCustomStartDate.trim() || getTodayDateStr();
      }

      let payload: any = {
        name: editLinkName.trim(),
        start_date: effectiveEditStartDate,
      };

      if (val.startsWith('https://script.google.com') || val.includes('/macros/s/')) {
        payload.webhook_url = val;
        payload.spreadsheet_id = editingLink.spreadsheet_id;
      } else {
        payload.spreadsheet_id = val;
        if (whVal) payload.webhook_url = whVal;
      }

      const updated = await googleSheetsApi.updateLink(editingLink.id, payload);
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

                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>Scope: <strong>{linkedBatchNames}</strong></span>
                        <span>Sheet ID: <code style={{ fontSize: '0.8rem' }}>{link.spreadsheet_id}</code></span>
                        {link.start_date ? (
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            fontWeight: 600,
                          }}>
                            🗓️ From {link.start_date} onwards
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(148, 163, 184, 0.12)',
                            color: '#94a3b8',
                            fontWeight: 500,
                          }}>
                            🌐 Full History
                          </span>
                        )}
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
        <div className="modal-overlay-responsive">
          <div className="glass-panel modal-card-responsive" style={{ width: '100%', maxWidth: '580px', padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                Link Google Sheet to Academic Scope
              </h3>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

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
                            } else if (firstSec?.allocation_batches && firstSec.allocation_batches.length > 0) {
                              setSelectedStaffAllocBatchId(firstSec.allocation_batches[0].id);
                            } else {
                              setSelectedStaffAllocBatchId('ALL');
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
                            } else if (targetSec?.allocation_batches && targetSec.allocation_batches.length > 0) {
                              setSelectedStaffAllocBatchId(targetSec.allocation_batches[0].id);
                            } else {
                              setSelectedStaffAllocBatchId('ALL');
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
                          <option value="ALL">Entire Section (All Students)</option>
                          {(() => {
                            const currentSec = staffSections.find((s) => s.id === selectedStaffSectionId);
                            if (!currentSec || !currentSec.allocation_batches) return null;
                            return currentSec.allocation_batches.map((ab) => (
                              <option key={ab.id} value={ab.id}>
                                {ab.name}
                              </option>
                            ));
                          })()}
                        </select>
                        {(() => {
                          const currentSec = staffSections.find((s) => s.id === selectedStaffSectionId);
                          if (currentSec && currentSec.assignment_mode !== 'ALL') {
                            return (
                              <div style={{ fontSize: '0.75rem', color: '#818cf8', marginTop: '0.35rem' }}>
                                📌 You are assigned to specific allocation batches in this section.
                              </div>
                            );
                          }
                          return null;
                        })()}
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
                  Google Spreadsheet Page URL or ID *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. https://docs.google.com/spreadsheets/d/1mBFsJPO7RTNb7Wjeip2v03MH7T9SQeAUPPggO5Mbah8/edit"
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Paste your main Google Sheet page URL. Clicking "Open Sheet" will open this page link.
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Apps Script Web App Webhook URL (Optional for 100% Background Auto-Sync)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. https://script.google.com/macros/s/AKfycb.../exec"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '0.35rem' }}>
                  Generated from Extensions &rarr; Apps Script &rarr; Deploy as Web App. Allows direct 100% automated daily background updates.
                </div>
              </div>

              {/* Date Scope / Start Date Selector */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  🗓️ Snapshot History & Start Date Scope
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    backgroundColor: dateScopeMode === 'ALL' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${dateScopeMode === 'ALL' ? '#6366f1' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: dateScopeMode === 'ALL' ? 600 : 400,
                  }}>
                    <input
                      type="radio"
                      name="dateScopeMode"
                      value="ALL"
                      checked={dateScopeMode === 'ALL'}
                      onChange={() => setDateScopeMode('ALL')}
                    />
                    <span>🌐 Full History (All Past Dates)</span>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    backgroundColor: dateScopeMode === 'TODAY' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${dateScopeMode === 'TODAY' ? '#6366f1' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: dateScopeMode === 'TODAY' ? 600 : 400,
                  }}>
                    <input
                      type="radio"
                      name="dateScopeMode"
                      value="TODAY"
                      checked={dateScopeMode === 'TODAY'}
                      onChange={() => setDateScopeMode('TODAY')}
                    />
                    <span>⚡ From Today ({getTodayDateStr()})</span>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    backgroundColor: dateScopeMode === 'YESTERDAY' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${dateScopeMode === 'YESTERDAY' ? '#6366f1' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: dateScopeMode === 'YESTERDAY' ? 600 : 400,
                  }}>
                    <input
                      type="radio"
                      name="dateScopeMode"
                      value="YESTERDAY"
                      checked={dateScopeMode === 'YESTERDAY'}
                      onChange={() => setDateScopeMode('YESTERDAY')}
                    />
                    <span>⏪ From Yesterday ({getYesterdayDateStr()})</span>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    backgroundColor: dateScopeMode === 'CUSTOM' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${dateScopeMode === 'CUSTOM' ? '#6366f1' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: dateScopeMode === 'CUSTOM' ? 600 : 400,
                  }}>
                    <input
                      type="radio"
                      name="dateScopeMode"
                      value="CUSTOM"
                      checked={dateScopeMode === 'CUSTOM'}
                      onChange={() => setDateScopeMode('CUSTOM')}
                    />
                    <span>🗓️ Custom Start Date</span>
                  </label>
                </div>

                {dateScopeMode === 'CUSTOM' && (
                  <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Select Starting Date:
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      value={customStartDate || getTodayDateStr()}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      style={{ width: '100%', maxWidth: '240px' }}
                    />
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {dateScopeMode === 'ALL' && 'Includes all historical date snapshot columns available in the database plus all upcoming days.'}
                  {dateScopeMode === 'TODAY' && `Starts clean with today's date column (${getTodayDateStr()}). Future daily snapshots will automatically be appended as new columns.`}
                  {dateScopeMode === 'YESTERDAY' && `Includes yesterday (${getYesterdayDateStr()}) and today, and appends future snapshots automatically.`}
                  {dateScopeMode === 'CUSTOM' && `Only includes date columns on or after ${customStartDate || 'selected start date'}. Upcoming days will be added automatically.`}
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
                  Google Spreadsheet Page URL or ID *
                </label>
                <input
                  id="input-edit-spreadsheet-id"
                  type="text"
                  className="form-input"
                  placeholder="e.g. https://docs.google.com/spreadsheets/d/1mBFsJPO7RT.../edit"
                  value={editSpreadsheetId}
                  onChange={(e) => setEditSpreadsheetId(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                  Main Google Sheet page URL (opened when clicking "Open Sheet").
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Apps Script Web App Webhook URL (Optional for 100% Background Sync)
                </label>
                <input
                  id="input-edit-webhook-url"
                  type="text"
                  className="form-input"
                  placeholder="e.g. https://script.google.com/macros/s/AKfycb.../exec"
                  value={editWebhookUrl}
                  onChange={(e) => setEditWebhookUrl(e.target.value)}
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '0.35rem', display: 'block' }}>
                  Generated from Extensions &rarr; Apps Script &rarr; Deploy as Web App.
                </span>
              </div>

              {/* Date Scope / Start Date Selector */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  🗓️ Snapshot History & Start Date Scope
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    backgroundColor: editDateScopeMode === 'ALL' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${editDateScopeMode === 'ALL' ? '#6366f1' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: editDateScopeMode === 'ALL' ? 600 : 400,
                  }}>
                    <input
                      type="radio"
                      name="editDateScopeMode"
                      value="ALL"
                      checked={editDateScopeMode === 'ALL'}
                      onChange={() => setEditDateScopeMode('ALL')}
                    />
                    <span>🌐 Full History (All Past Dates)</span>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    backgroundColor: editDateScopeMode === 'TODAY' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${editDateScopeMode === 'TODAY' ? '#6366f1' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: editDateScopeMode === 'TODAY' ? 600 : 400,
                  }}>
                    <input
                      type="radio"
                      name="editDateScopeMode"
                      value="TODAY"
                      checked={editDateScopeMode === 'TODAY'}
                      onChange={() => setEditDateScopeMode('TODAY')}
                    />
                    <span>⚡ From Today ({getTodayDateStr()})</span>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    backgroundColor: editDateScopeMode === 'YESTERDAY' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${editDateScopeMode === 'YESTERDAY' ? '#6366f1' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: editDateScopeMode === 'YESTERDAY' ? 600 : 400,
                  }}>
                    <input
                      type="radio"
                      name="editDateScopeMode"
                      value="YESTERDAY"
                      checked={editDateScopeMode === 'YESTERDAY'}
                      onChange={() => setEditDateScopeMode('YESTERDAY')}
                    />
                    <span>⏪ From Yesterday ({getYesterdayDateStr()})</span>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    backgroundColor: editDateScopeMode === 'CUSTOM' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${editDateScopeMode === 'CUSTOM' ? '#6366f1' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: editDateScopeMode === 'CUSTOM' ? 600 : 400,
                  }}>
                    <input
                      type="radio"
                      name="editDateScopeMode"
                      value="CUSTOM"
                      checked={editDateScopeMode === 'CUSTOM'}
                      onChange={() => setEditDateScopeMode('CUSTOM')}
                    />
                    <span>🗓️ Custom Start Date</span>
                  </label>
                </div>

                {editDateScopeMode === 'CUSTOM' && (
                  <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Select Starting Date:
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      value={editCustomStartDate || getTodayDateStr()}
                      onChange={(e) => setEditCustomStartDate(e.target.value)}
                      style={{ width: '100%', maxWidth: '240px' }}
                    />
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {editDateScopeMode === 'ALL' && 'Includes all historical date snapshot columns available in the database plus all upcoming days.'}
                  {editDateScopeMode === 'TODAY' && `Starts clean with today's date column (${getTodayDateStr()}). Future daily snapshots will automatically be appended as new columns.`}
                  {editDateScopeMode === 'YESTERDAY' && `Includes yesterday (${getYesterdayDateStr()}) and today, and appends future snapshots automatically.`}
                  {editDateScopeMode === 'CUSTOM' && `Only includes date columns on or after ${editCustomStartDate || 'selected start date'}. Upcoming days will be added automatically.`}
                </div>
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
                rows={16}
                className="form-input"
                style={{ fontFamily: 'monospace', fontSize: '0.8rem', width: '100%', backgroundColor: '#0f172a', color: '#38bdf8', padding: '0.85rem' }}
                value={`function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.clear();

    if (data.headers) {
      sheet.appendRow(data.headers);
      var headerRange = sheet.getRange(1, 1, 1, data.headers.length);
      headerRange.setBackground("#1E293B");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");
      headerRange.setFontFamily("Calibri");
      headerRange.setFontSize(11);
      headerRange.setHorizontalAlignment("center");
      headerRange.setVerticalAlignment("middle");
      sheet.setRowHeight(1, 30);
      sheet.setFrozenRows(1);
    }

    if (data.rows && data.rows.length > 0) {
      for (var i = 0; i < data.rows.length; i++) {
        sheet.appendRow(data.rows[i]);
      }

      var totalRows = data.rows.length;
      var totalCols = data.headers ? data.headers.length : sheet.getLastColumn();
      var dataRange = sheet.getRange(2, 1, totalRows, totalCols);
      dataRange.setFontFamily("Calibri");
      dataRange.setFontSize(10);
      dataRange.setVerticalAlignment("middle");

      // Format Register Number column (Col 7) as Text
      sheet.getRange(2, 7, totalRows, 1).setNumberFormat("@");

      // Alternate row colors & light borders
      for (var r = 2; r <= totalRows + 1; r++) {
        var rowBg = (r % 2 === 0) ? "#F8FAFC" : "#FFFFFF";
        sheet.getRange(r, 1, 1, totalCols).setBackground(rowBg);
        sheet.setRowHeight(r, 22);
      }
      dataRange.setBorder(true, true, true, true, true, true, "#E2E8F0", SpreadsheetApp.BorderStyle.SOLID);
    }

    // Auto-fit column widths with generous minimum padding
    var lastCol = sheet.getLastColumn();
    if (lastCol > 0) {
      sheet.autoResizeColumns(1, lastCol);
      var minWidths = [60, 130, 120, 110, 140, 180, 160, 220, 180];
      for (var col = 1; col <= lastCol; col++) {
        var currWidth = sheet.getColumnWidth(col);
        var minW = (col <= minWidths.length) ? minWidths[col - 1] : 100;
        sheet.setColumnWidth(col, Math.max(currWidth + 20, minW));
      }
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
                  const code = `function doPost(e) {\n  try {\n    var data = JSON.parse(e.postData.contents);\n    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();\n    sheet.clear();\n    if (data.headers) {\n      sheet.appendRow(data.headers);\n      var headerRange = sheet.getRange(1, 1, 1, data.headers.length);\n      headerRange.setBackground("#1E293B");\n      headerRange.setFontColor("#FFFFFF");\n      headerRange.setFontWeight("bold");\n      headerRange.setFontFamily("Calibri");\n      headerRange.setFontSize(11);\n      headerRange.setHorizontalAlignment("center");\n      headerRange.setVerticalAlignment("middle");\n      sheet.setRowHeight(1, 30);\n      sheet.setFrozenRows(1);\n    }\n    if (data.rows && data.rows.length > 0) {\n      for (var i = 0; i < data.rows.length; i++) {\n        sheet.appendRow(data.rows[i]);\n      }\n      var totalRows = data.rows.length;\n      var totalCols = data.headers ? data.headers.length : sheet.getLastColumn();\n      var dataRange = sheet.getRange(2, 1, totalRows, totalCols);\n      dataRange.setFontFamily("Calibri");\n      dataRange.setFontSize(10);\n      dataRange.setVerticalAlignment("middle");\n      sheet.getRange(2, 7, totalRows, 1).setNumberFormat("@");\n      for (var r = 2; r <= totalRows + 1; r++) {\n        var rowBg = (r % 2 === 0) ? "#F8FAFC" : "#FFFFFF";\n        sheet.getRange(r, 1, 1, totalCols).setBackground(rowBg);\n        sheet.setRowHeight(r, 22);\n      }\n      dataRange.setBorder(true, true, true, true, true, true, "#E2E8F0", SpreadsheetApp.BorderStyle.SOLID);\n    }\n    var lastCol = sheet.getLastColumn();\n    if (lastCol > 0) {\n      sheet.autoResizeColumns(1, lastCol);\n      var minWidths = [60, 130, 120, 110, 140, 180, 160, 220, 180];\n      for (var col = 1; col <= lastCol; col++) {\n        var currWidth = sheet.getColumnWidth(col);\n        var minW = (col <= minWidths.length) ? minWidths[col - 1] : 100;\n        sheet.setColumnWidth(col, Math.max(currWidth + 20, minW));\n      }\n    }\n    return ContentService.createTextOutput("SUCCESS");\n  } catch (err) {\n    return ContentService.createTextOutput("ERROR: " + err.message);\n  }\n}`;
                  navigator.clipboard.writeText(code);
                  setMessage({ type: 'success', text: '📋 Full Excel-Grade Apps Script copied!' });
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
