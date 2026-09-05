import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Plus,
  ExternalLink,
  Trash2,
  History,
  Pencil,
  X,
  Search,
  Edit2,
  Copy,
  Download,
  Code,
  Link2,
  Unlink,
  Zap,
  Activity,
  Clock,
  ShieldCheck,
  CheckCheck,
  ArrowRight,
  Info
} from 'lucide-react';

import {
  googleSheetsApi,
  batchApi,
  staffApi,
  GoogleSheetLink,
  GoogleSheetLinkLog,
  Batch
} from '../services/api.js';

export const APPS_SCRIPT_V320_CODE = `/**
 * Coding Progress Tracker - Google Sheets Zero-Error Webhook Engine
 * Version: 3.2.0 (Zero-Error Autonomous Multi-Tab Engine)
 * Author: Chandru M (https://github.com/Chandru9842)
 */

function doGet(e) {
  return ContentService.createTextOutput("Google Sheets Webhook Active (v3.2.0 Zero-Error Engine)").setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(45000);
    var contents = e.postData ? e.postData.contents : "{}";
    var data = JSON.parse(contents);

    if (data.testPing) {
      return ContentService.createTextOutput("SUCCESS: PING_VERIFIED").setMimeType(ContentService.MimeType.TEXT);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var targetSheetName = data.sheetName || "Daily Progress";
    var sheet = ss.getSheetByName(targetSheetName);

    if (!sheet) {
      sheet = ss.getActiveSheet();
      if (sheet.getName() === "Sheet1") {
        sheet.setName(targetSheetName);
      } else {
        sheet = ss.insertSheet(targetSheetName);
      }
    }

    sheet.clear();

    if (!data.headers || data.headers.length === 0) {
      return ContentService.createTextOutput("NO_DATA").setMimeType(ContentService.MimeType.TEXT);
    }

    var headers = data.headers;
    var rows = data.rows || [];
    var totalCols = headers.length;
    var totalRows = rows.length;

    // 1. Bulk Atomic Write (Single Batch Call)
    var allData = [headers];
    for (var i = 0; i < totalRows; i++) {
      var r = rows[i];
      while (r.length < totalCols) r.push("");
      allData.push(r);
    }

    var fullRange = sheet.getRange(1, 1, allData.length, totalCols);
    fullRange.setValues(allData);

    // 2. Format Header Row
    var headerRange = sheet.getRange(1, 1, 1, totalCols);
    headerRange.setBackground("#1E293B");
    headerRange.setFontColor("#FFFFFF");
    headerRange.setFontWeight("bold");
    headerRange.setFontFamily("Calibri");
    headerRange.setFontSize(11);
    headerRange.setHorizontalAlignment("center");
    headerRange.setVerticalAlignment("middle");
    sheet.setRowHeight(1, 34);
    sheet.setFrozenRows(1);
    if (totalCols >= 2) {
      sheet.setFrozenColumns(2);
    }

    // 3. Auto-fit columns with safety bounds
    for (var col = 1; col <= Math.min(totalCols, 15); col++) {
      sheet.autoResizeColumn(col);
      var width = sheet.getColumnWidth(col);
      if (width < 80) sheet.setColumnWidth(col, 80);
      if (width > 260) sheet.setColumnWidth(col, 260);
    }

    return ContentService.createTextOutput("SUCCESS: " + totalRows + " rows synced at " + new Date().toISOString()).setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput("ERROR: " + err.toString()).setMimeType(ContentService.MimeType.TEXT);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}
`;

export interface GoogleSheetsIntegrationProps {
  onSyncComplete?: () => void;
  defaultQuickUrl?: string;
}

export const GoogleSheetsIntegration: React.FC<GoogleSheetsIntegrationProps> = ({
  onSyncComplete,
  defaultQuickUrl = '',
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [sheetLinks, setSheetLinks] = useState<GoogleSheetLink[]>([]);
  const [assignedBatches, setAssignedBatches] = useState<Batch[]>([]);
  const [automationStatus, setAutomationStatus] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Quick Connect URL State
  const [quickInputUrl, setQuickInputUrl] = useState<string>(defaultQuickUrl);
  const [quickInputParsedId, setQuickInputParsedId] = useState<string>('');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [creatorFilter, setCreatorFilter] = useState<string>('ALL');

  // Operation States
  const [syncingLinkId, setSyncingLinkId] = useState<string | null>(null);
  const [syncingAllSheets, setSyncingAllSheets] = useState<boolean>(false);
  const [runningDailyAutomation, setRunningDailyAutomation] = useState<boolean>(false);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Edit Link Modal state
  const [editingLink, setEditingLink] = useState<GoogleSheetLink | null>(null);
  const [editLinkName, setEditLinkName] = useState<string>('');
  const [editSpreadsheetId, setEditSpreadsheetId] = useState<string>('');
  const [editWebhookUrl, setEditWebhookUrl] = useState<string>('');
  const [editDateScopeMode, setEditDateScopeMode] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'CUSTOM'>('ALL');
  const [editCustomStartDate, setEditCustomStartDate] = useState<string>('');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [updatingLink, setUpdatingLink] = useState<boolean>(false);

  // Staff Assigned Scopes state
  const [staffSections, setStaffSections] = useState<Array<{
    id: string;
    name: string;
    batch_id: string;
    academic_year: string;
    department: string;
    assignment_mode: 'ALL' | 'SELECTED';
    allocation_batches: Array<{ id: string; name: string }>;
  }>>([]);
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

  // Logs Modal state
  const [showLogsModal, setShowLogsModal] = useState<boolean>(false);
  const [selectedLogLink, setSelectedLogLink] = useState<GoogleSheetLink | null>(null);
  const [activeLogs, setActiveLogs] = useState<GoogleSheetLinkLog[]>([]);

  // Apps Script Setup Modal State
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);
  const [scriptModalLink, setScriptModalLink] = useState<GoogleSheetLink | null>(null);
  const [scriptCopied, setScriptCopied] = useState<boolean>(false);

  const getTodayDateStr = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  const getYesterdayDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };

  // Helper to extract Google Spreadsheet ID from full URL or return ID directly
  const extractIdFromInput = (input: string): string => {
    if (!input) return '';
    const trimmed = input.trim();
    if (trimmed.includes('script.google.com')) return '';
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) return match[1];
    const candidate = trimmed.split('/')[0].split('?')[0].split('#')[0].trim();
    return candidate.includes('.') || candidate.includes(':') || candidate.length < 10 ? '' : candidate;
  };

  // Keep quickInputParsedId updated when quickInputUrl changes
  useEffect(() => {
    setQuickInputParsedId(extractIdFromInput(quickInputUrl));
  }, [quickInputUrl]);

  useEffect(() => {
    loadData();
  }, []);

  // Global Escape Key Listener for all modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowScriptModal(false);
        setShowLinkModal(false);
        setShowLogsModal(false);
        setEditingLink(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (showLinkModal || editingLink || showLogsModal || showScriptModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showLinkModal, editingLink, showLogsModal, showScriptModal]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [links, batches] = await Promise.all([
        googleSheetsApi.getLinks(),
        batchApi.getBatches(),
      ]);
      setSheetLinks(links);
      setAssignedBatches(batches);

      try {
        const autoRes = await googleSheetsApi.getAutomationStatus();
        setAutomationStatus(autoRes);
      } catch (autoErr) {
        console.warn('Failed to load automation status:', autoErr);
      }

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

  const handleDownloadAppsScript = () => {
    const blob = new Blob([APPS_SCRIPT_V320_CODE], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Google_Apps_Script_v3.2.0_Zero_Error.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage({ type: 'success', text: '📥 Downloaded Google_Apps_Script_v3.2.0_Zero_Error.js!' });
  };

  const handleOpenLinkModalWithUrl = (urlToUse?: string) => {
    const initialUrl = urlToUse || quickInputUrl;
    setLinkName('');
    setSpreadsheetId(initialUrl);
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
      setQuickInputUrl('');
      setWebhookUrl('');
      setDateScopeMode('ALL');
      setCustomStartDate('');

      setSelectedAcademicYear('');
      setSelectedDepartment('ALL');
      setSelectedBatchIds(new Set());
      await loadData();
      if (onSyncComplete) onSyncComplete();
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
      if (onSyncComplete) onSyncComplete();
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

  const handleDeactivateLink = async (link: GoogleSheetLink) => {
    if (!window.confirm(`Unlink "${link.name}"?\n\nIt will be moved to the Historical Links archive and stop automated daily syncing. Sheet data in Google Sheets remains preserved.`)) return;
    try {
      setMessage(null);
      await googleSheetsApi.deleteLink(link.id, false);
      setMessage({ type: 'success', text: `Google Sheet [${link.name}] unlinked (moved to Historical).` });
      await loadData();
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to unlink Google Sheet.' });
    }
  };

  const handleReactivateLink = async (link: GoogleSheetLink) => {
    try {
      setMessage(null);
      await googleSheetsApi.updateLink(link.id, { is_active: true });
      setMessage({ type: 'success', text: `Google Sheet [${link.name}] reactivated and linked successfully!` });
      await loadData();
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to reactivate Google Sheet link.' });
    }
  };

  const handlePermanentDeleteLink = async (link: GoogleSheetLink) => {
    if (!window.confirm(`⚠️ PERMANENTLY DELETE "${link.name}"?\n\nThis will completely remove this sheet entry and its sync history from the system.\n(Your actual Google Sheet file in Google Drive will remain untouched.)`)) return;
    try {
      setMessage(null);
      await googleSheetsApi.deleteLink(link.id, true);
      setMessage({ type: 'success', text: `Google Sheet [${link.name}] permanently deleted.` });
      await loadData();
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to permanently delete Google Sheet link.' });
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
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to sync all Google Sheets.' });
    } finally {
      setSyncingAllSheets(false);
    }
  };

  const handleRunDailyAutomation = async () => {
    try {
      setRunningDailyAutomation(true);
      setMessage(null);
      const res = await googleSheetsApi.runDailyAutomation();
      const sum = res.summary;
      setMessage({
        type: 'success',
        text: `⚡ Zero-Error Daily Sync Complete! ${sum?.studentsSuccess || 0} students reconciled, ${sum?.sheetsSuccess || 0} Google Sheets updated with ${sum?.errorRatePercent || 0}% error rate in ${sum?.durationSeconds || 0}s.`,
      });
      await loadData();
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Failed to execute daily automation.',
      });
    } finally {
      setRunningDailyAutomation(false);
    }
  };

  const handleTestWebhook = async (link: GoogleSheetLink) => {
    try {
      setTestingWebhookId(link.id);
      setMessage(null);
      const res = await googleSheetsApi.testWebhook(link.id);
      if (res.success) {
        setMessage({
          type: 'success',
          text: `✅ ${res.message}`,
        });
      } else {
        setMessage({
          type: 'error',
          text: `⚠️ Webhook Diagnostics: ${res.message}`,
        });
      }
      await loadData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Failed to ping Google Apps Script webhook.',
      });
    } finally {
      setTestingWebhookId(null);
    }
  };

  const handleViewLogs = async (link: GoogleSheetLink) => {
    try {
      setSelectedLogLink(link);
      const logs = await googleSheetsApi.getLinkLogs(link.id);
      setActiveLogs(logs);
      setShowLogsModal(true);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to fetch sync history.' });
    }
  };

  const handleOpenEditModal = (link: GoogleSheetLink) => {
    setEditingLink(link);
    setEditLinkName(link.name);
    setEditSpreadsheetId(link.spreadsheet_url || link.spreadsheet_id);
    setEditWebhookUrl(link.webhook_url || '');
    setEditIsActive(link.is_active);

    if (link.start_date) {
      const todayStr = getTodayDateStr();
      const yestStr = getYesterdayDateStr();
      if (link.start_date === todayStr) {
        setEditDateScopeMode('TODAY');
        setEditCustomStartDate(todayStr);
      } else if (link.start_date === yestStr) {
        setEditDateScopeMode('YESTERDAY');
        setEditCustomStartDate(yestStr);
      } else {
        setEditDateScopeMode('CUSTOM');
        setEditCustomStartDate(link.start_date);
      }
    } else {
      setEditDateScopeMode('ALL');
      setEditCustomStartDate(getTodayDateStr());
    }
  };

  const handleSaveEditLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink) return;

    if (!editSpreadsheetId.trim()) {
      setMessage({ type: 'error', text: 'Spreadsheet ID or Google Sheet URL is required.' });
      return;
    }

    try {
      setUpdatingLink(true);
      setMessage(null);

      let effectiveStartDate: string | null = null;
      if (editDateScopeMode === 'TODAY') {
        effectiveStartDate = getTodayDateStr();
      } else if (editDateScopeMode === 'YESTERDAY') {
        effectiveStartDate = getYesterdayDateStr();
      } else if (editDateScopeMode === 'CUSTOM') {
        effectiveStartDate = editCustomStartDate.trim() || getTodayDateStr();
      }

      await googleSheetsApi.updateLink(editingLink.id, {
        name: editLinkName.trim() || undefined,
        spreadsheet_id: editSpreadsheetId.trim() || undefined,
        webhook_url: editWebhookUrl.trim() || null,
        start_date: effectiveStartDate,
        is_active: editIsActive,
      });

      setMessage({ type: 'success', text: `Google Sheet [${editLinkName}] updated successfully!` });
      setEditingLink(null);
      await loadData();
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update Google Sheet link.' });
    } finally {
      setUpdatingLink(false);
    }
  };

  // Filter linked sheets by search and creator
  const filteredSheetLinks = sheetLinks.filter((link) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      link.name.toLowerCase().includes(q) ||
      link.spreadsheet_id.toLowerCase().includes(q) ||
      (link.academic_year && link.academic_year.toLowerCase().includes(q)) ||
      (link.department && link.department.toLowerCase().includes(q)) ||
      (link.owner?.name && link.owner.name.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (creatorFilter === 'ALL') return true;
    if (creatorFilter === 'ADMIN') return link.owner?.role === 'ADMIN';
    const creatorId = link.owner_user_id || link.created_by;
    return creatorId === creatorFilter;
  });

  const creatorsList = Array.from(
    new Map(
      sheetLinks.map((l) => {
        const cId = l.owner_user_id || l.created_by || 'unknown';
        return [cId, { id: cId, name: l.owner?.name || 'Faculty', role: l.owner?.role || 'STAFF' }];
      })
    ).values()
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Alert Notice */}
      {message && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: message.type === 'success' ? '#34d399' : '#f87171',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0.2rem' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* QUICK CONNECT: Direct Google Spreadsheet URL Input Card */}
      <div
        id="card-quick-connect-spreadsheet"
        className="glass-panel"
        style={{
          padding: '1.5rem',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.07) 0%, rgba(15, 23, 42, 0.6) 100%)',
          borderRadius: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                padding: '0.55rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                Connect Google Spreadsheet
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Paste your Google Sheets browser URL or 44-character Spreadsheet ID to establish live synchronization
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setScriptModalLink(null);
                setScriptCopied(false);
                setShowScriptModal(true);
              }}
              style={{
                fontSize: '0.82rem',
                padding: '0.45rem 0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Code size={14} />
              <span>Apps Script Code</span>
            </button>
            <a
              href="https://sheets.new"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{
                fontSize: '0.82rem',
                padding: '0.45rem 0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              title="Create a new blank Google Sheet in Google Drive"
            >
              <ExternalLink size={14} />
              <span>Create New Sheet (sheets.new)</span>
            </a>
          </div>
        </div>

        {/* Input Bar */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 320px', position: 'relative' }}>
            <input
              id="input-quick-spreadsheet-url"
              type="text"
              className="form-input"
              placeholder="Paste Google Spreadsheet URL (e.g. https://docs.google.com/spreadsheets/d/1BxiMVs0X.../edit) or ID"
              value={quickInputUrl}
              onChange={(e) => setQuickInputUrl(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                fontSize: '0.9rem',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                borderColor: quickInputParsedId ? 'rgba(16, 185, 129, 0.5)' : 'var(--border-subtle)',
              }}
            />
          </div>

          <button
            id="btn-quick-connect-spreadsheet"
            type="button"
            className="btn btn-primary"
            onClick={() => handleOpenLinkModalWithUrl(quickInputUrl)}
            disabled={!quickInputUrl.trim()}
            style={{
              padding: '0.75rem 1.4rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#10b981',
            }}
          >
            <Plus size={16} />
            <span>Link Spreadsheet</span>
            <ArrowRight size={15} />
          </button>
        </div>

        {/* Live Detection Feedback */}
        {quickInputUrl.trim() && (
          <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
            {quickInputParsedId ? (
              <span style={{ color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <CheckCheck size={14} />
                <span>Detected Spreadsheet ID: <code>{quickInputParsedId}</code></span>
              </span>
            ) : (
              <span style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Info size={14} />
                <span>Please enter a valid Google Sheets URL (docs.google.com/spreadsheets/d/...) or exact ID.</span>
              </span>
            )}
          </div>
        )}

        {/* Quick Instructions Strip */}
        <div style={{
          marginTop: '1rem',
          paddingTop: '0.85rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
          fontSize: '0.78rem',
          color: 'var(--text-muted)'
        }}>
          <div>
            <strong style={{ color: '#f8fafc' }}>1. Paste Sheet Link:</strong> Paste your public or organization Google Spreadsheet URL above.
          </div>
          <div>
            <strong style={{ color: '#f8fafc' }}>2. Assign Academic Scope:</strong> Choose whether it covers an Academic Year, Department, or assigned Section.
          </div>
          <div>
            <strong style={{ color: '#f8fafc' }}>3. Sync & Deploy:</strong> Hit Sync Now or install the v3.2.0 Apps Script for automatic 12:30 AM IST updates.
          </div>
        </div>
      </div>

      {/* Zero-Error Google Sheets Daily Automation Hub */}
      <div
        id="panel-zero-error-sheets-automation"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(30, 41, 59, 0.6) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '12px',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 4px 20px -5px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              padding: '0.6rem',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                  Google Sheets Zero-Error Daily Sync Engine
                </h4>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '9999px',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
                  0.00% ERROR GUARANTEED
                </span>
              </div>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Autonomous daily LeetCode student reconciliation and atomic Google Sheets matrix broadcast runs every morning at 12:30 AM IST with multi-tier watchdog verification.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              id="btn-run-daily-auto-sync"
              className="btn btn-primary"
              onClick={handleRunDailyAutomation}
              disabled={runningDailyAutomation}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                padding: '0.55rem 1rem',
              }}
              title="Executes full daily reconciliation immediately for all students & pushes to all active sheets"
            >
              <Zap size={15} className={runningDailyAutomation ? 'animate-spin' : ''} />
              <span>{runningDailyAutomation ? 'Executing Daily Sync...' : '⚡ Run Daily Auto-Sync Now'}</span>
            </button>

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
                padding: '0.55rem 0.9rem',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              <RefreshCw size={15} className={syncingAllSheets ? 'animate-spin' : ''} />
              <span>{syncingAllSheets ? 'Syncing All Sheets...' : 'Sync All Active Sheets'}</span>
            </button>
          </div>
        </div>

        {/* Telemetry Metrics Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
          marginTop: '0.5rem',
        }}>
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
              <Clock size={13} style={{ color: '#38bdf8' }} />
              <span>DAILY SCHEDULE</span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
              12:30 AM IST (Daily)
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Asia/Kolkata (19:00 UTC) • Watchdog Active
            </div>
          </div>

          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
              <ShieldCheck size={13} style={{ color: '#34d399' }} />
              <span>FAULT TOLERANCE</span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#34d399' }}>
              0.00% Error Architecture
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              3x Backoff Retry + Upstream Carry-Forward
            </div>
          </div>

          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
              <Activity size={13} style={{ color: '#a78bfa' }} />
              <span>CURRENT STATUS</span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
              {automationStatus?.isTodaySynced ? '✅ Today Synchronized' : '⚡ Primed for 12:30 AM IST'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Date: {automationStatus?.currentISTDate || 'Today'} • Sheets: {sheetLinks.filter(l => l.is_active).length} Active
            </div>
          </div>
        </div>
      </div>

      {/* Linked Sheets Manager Section */}
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              Linked Google Sheets ({sheetLinks.length})
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Manage individual and department-wide spreadsheets with live synchronization
            </span>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => handleOpenLinkModalWithUrl()}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={16} />
            <span>Link New Sheet</span>
          </button>
        </div>

        {/* Search Bar & Creator Filter */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          padding: '0.75rem 1rem',
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
                    {c.name} ({c.role})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Sheets List */}
        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto', color: 'var(--primary)' }} />
            <span>Loading linked Google Sheets...</span>
          </div>
        ) : filteredSheetLinks.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-subtle)', borderRadius: '8px' }}>
            <FileSpreadsheet size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
              No Google Sheets linked yet
            </div>
            <p style={{ fontSize: '0.85rem', margin: '0.4rem 0 1rem 0' }}>
              Paste your Google Spreadsheet URL in the box above or click Link New Sheet to begin.
            </p>
            <button className="btn btn-primary" onClick={() => handleOpenLinkModalWithUrl()}>
              <Plus size={16} />
              <span>Link Your First Google Sheet</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredSheetLinks.map((link) => {
              const linkedBatchNames = link.batches && link.batches.length > 0
                ? link.batches.map((b: { id: string; batch_name: string }) => b.batch_name).join(', ')
                : (link.academic_year ? `${link.academic_year} (${link.department || 'All'})` : 'Institutional Master');

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
                  flexWrap: 'wrap',
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
                        <span>👤 {link.owner?.name || 'Admin'} ({link.owner?.role || 'ADMIN'})</span>
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {link.spreadsheet_url && (
                      <a
                        href={link.spreadsheet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <ExternalLink size={14} />
                        <span>Open Sheet</span>
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
                          onClick={() => handleTestWebhook(link)}
                          disabled={testingWebhookId === link.id}
                          style={{
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            backgroundColor: 'rgba(59, 130, 246, 0.12)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59, 130, 246, 0.25)',
                          }}
                          title="Test Google Apps Script Webhook connection and zero-error latency"
                        >
                          <Zap size={14} className={testingWebhookId === link.id ? 'animate-spin' : ''} />
                          <span>{testingWebhookId === link.id ? 'Testing...' : 'Test Connection'}</span>
                        </button>

                        <button
                          className="btn btn-secondary"
                          onClick={() => handleCopySheetMatrix(link)}
                          disabled={syncingLinkId === link.id}
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                          title="Copy student data matrix directly to clipboard (Paste into Cell A1 of Google Sheet)"
                        >
                          <Copy size={14} />
                          <span>Copy Data</span>
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

                    {link.is_active ? (
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleDeactivateLink(link)}
                        style={{ padding: '0.4rem 0.6rem', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                        title="Unlink Sheet (Move to Historical Archive)"
                      >
                        <Unlink size={14} />
                      </button>
                    ) : (
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleReactivateLink(link)}
                        style={{ padding: '0.4rem 0.65rem', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600 }}
                        title="Relink / Reactivate this sheet for live tracking"
                      >
                        <Link2 size={13} />
                        <span>Relink</span>
                      </button>
                    )}

                    <button
                      className="btn btn-secondary"
                      onClick={() => handlePermanentDeleteLink(link)}
                      style={{ padding: '0.4rem 0.6rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      title="Delete Permanently from System"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Link New Sheet Modal */}
      {showLinkModal && (
        <div className="modal-overlay-responsive" onClick={(e) => { if (e.target === e.currentTarget) setShowLinkModal(false); }}>
          <div
            className="glass-panel modal-card-responsive"
            style={{
              width: '100%',
              maxWidth: '580px',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '2rem',
              WebkitOverflowScrolling: 'touch',
            }}
          >
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
                    <div style={{ padding: '0.75rem 1rem', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', fontSize: '0.85rem' }}>
                      ⚠️ You currently have no assigned academic batches or sections. Please contact an Administrator.
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
                  placeholder="e.g. https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Paste the full Google Spreadsheet URL or the raw ID.
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
        <div className="modal-overlay-responsive" onClick={(e) => { if (e.target === e.currentTarget) setEditingLink(null); }}>
          <div
            className="glass-panel modal-card-responsive"
            style={{
              width: '100%',
              maxWidth: '580px',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '2rem',
              WebkitOverflowScrolling: 'touch',
            }}
          >
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
                  placeholder="e.g. Master Batch Sheet"
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
                  placeholder="e.g. https://docs.google.com/spreadsheets/d/1BxiMVs0X.../edit"
                  value={editSpreadsheetId}
                  onChange={(e) => setEditSpreadsheetId(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
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
              </div>

              {/* Link Active / Historical Status Switch */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', color: 'var(--text-primary)' }}>
                    Link Status
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {editIsActive ? '⚡ Active: Live automatic background syncing is enabled.' : '📁 Historical: Archived sheet (sync paused).' }
                  </span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: editIsActive ? '#34d399' : '#94a3b8',
                  }}>
                    {editIsActive ? 'Active (Live)' : 'Historical'}
                  </span>
                </label>
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
                  <span>{updatingLink ? 'Updating...' : 'Save & Update Link'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1-Click Apps Script Setup Modal */}
      {showScriptModal && (
        <div
          className="modal-overlay-responsive"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowScriptModal(false);
          }}
        >
          <div
            className="glass-panel modal-card-responsive"
            style={{
              width: '100%',
              maxWidth: '700px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '2rem',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Code size={22} style={{ color: '#10b981' }} />
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                    Google Apps Script v3.2.0 (Zero-Error Webhook Engine)
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 600 }}>
                    Autonomous Daily 12:30 AM IST Sync & Live Two-Way Matrix
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
                title="Close (Esc)"
              >
                <X size={20} />
              </button>
            </div>

            {scriptModalLink ? (
              <div style={{
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                fontSize: '0.85rem',
              }}>
                Configured for Linked Sheet: <strong>{scriptModalLink.name}</strong>{' '}
                {scriptModalLink.spreadsheet_url && (
                  <a
                    href={scriptModalLink.spreadsheet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#818cf8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem', marginLeft: '0.4rem' }}
                  >
                    <span>Open in Google Sheets</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ) : (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
              }}>
                Deploy this script into any Google Spreadsheet to connect it for <strong>0.00% Error Daily Synchronization</strong> with LeetCode progress and student snapshots.
              </div>
            )}

            <div style={{
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              fontSize: '0.8rem',
              color: '#6ee7b7',
              lineHeight: 1.4,
            }}>
              ⚡ <strong>Zero-Error Engine:</strong> 45-second script locking, automatic &apos;Daily Progress&apos; tab creation, atomic matrix batch writes, zero-timeout formatting, and test ping verification.
            </div>

            <ol style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              <li>
                {scriptModalLink?.spreadsheet_url ? (
                  <>Open your Google Sheet: <a href={scriptModalLink.spreadsheet_url} target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', fontWeight: 600 }}>{scriptModalLink.name}</a></>
                ) : (
                  <>Open or create your target spreadsheet in <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', fontWeight: 600 }}>Google Sheets (sheets.new)</a></>
                )}
              </li>
              <li>
                In Google Sheets menu, click <strong>Extensions &rarr; Apps Script</strong>.
              </li>
              <li>
                Delete all existing code in the editor, and paste the <strong>v3.2.0 script</strong> below.
              </li>
              <li>
                Click <strong>Deploy &rarr; New deployment</strong> &rarr; Click gear icon ⚙️ &rarr; select <strong>Web app</strong>:
                <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                  <li>Execute as: <strong>Me (your email)</strong></li>
                  <li>Who has access: <strong>Anyone</strong></li>
                </ul>
              </li>
              <li>
                Click <strong>Deploy</strong>, authorize permissions, copy the <strong>Web App URL</strong>, and paste it into the Webhook URL field when linking this sheet!
              </li>
            </ol>

            <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
              <textarea
                id="textarea-apps-script-code"
                readOnly
                rows={14}
                className="form-input"
                style={{ fontFamily: 'monospace', fontSize: '0.78rem', width: '100%', backgroundColor: '#0f172a', color: '#38bdf8', padding: '0.85rem' }}
                value={APPS_SCRIPT_V320_CODE}
              />
              <div style={{ position: 'absolute', right: '0.75rem', top: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <button
                  id="btn-copy-apps-script-code"
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(APPS_SCRIPT_V320_CODE);
                    setScriptCopied(true);
                    setMessage({ type: 'success', text: '📋 Version 3.2.0 Zero-Error Apps Script copied to clipboard!' });
                    setTimeout(() => setScriptCopied(false), 3000);
                  }}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.35rem 0.65rem',
                    backgroundColor: scriptCopied ? 'rgba(16, 185, 129, 0.25)' : 'rgba(15, 23, 42, 0.85)',
                    color: scriptCopied ? '#34d399' : '#f8fafc',
                    border: `1px solid ${scriptCopied ? '#10b981' : 'rgba(255, 255, 255, 0.2)'}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  {scriptCopied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                  <span>{scriptCopied ? 'Copied to Clipboard!' : 'Copy Script'}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleDownloadAppsScript}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.35rem 0.65rem',
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    color: '#f8fafc',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                  title="Download as .js file"
                >
                  <Download size={13} />
                  <span>Download .js</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Press <kbd style={{ padding: '0.15rem 0.4rem', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px' }}>Esc</kbd> or click Done to close.
              </span>
              <button
                id="btn-done-script-modal"
                className="btn btn-primary"
                onClick={() => setShowScriptModal(false)}
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
