import { api } from '../services/api.js';

export interface GenerateReportRequest {
  reportType: 'SUMMARY' | 'PROGRESS_LOG' | 'SECTION_COMPARISON';
  batchId?: string;
  sectionId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface ReportItem {
  id: string;
  report_type: string;
  file_name: string;
  generated_at: string;
  batch?: { id: string; batch_name: string } | null;
  section?: { id: string; name: string } | null;
  generated_by?: { id: string; name: string; email: string };
}

export interface ReportFilterOptions {
  academicYears: string[];
  departments: string[];
  batches: Array<{
    id: string;
    batch_name: string;
    department: string;
    academicYear: string;
    sections: Array<{
      id: string;
      name: string;
      allocation_batches?: Array<{ id: string; name: string }>;
    }>;
  }>;
  staff: Array<{ id: string; name: string; email: string }>;
}

export interface StudentReportItem {
  id: string;
  register_number: string;
  name: string;
  department: string;
  leetcode_username?: string | null;
  batch_id: string;
  section_id: string;
  allocation_batch_id?: string | null;
  batch: { id: string; batch_name: string; academicYear: string };
  section: { id: string; name: string };
  allocation_batch?: { id: string; name: string } | null;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  total_solved: number;
  overall_easy: number;
  overall_medium: number;
  overall_hard: number;
  overall_total: number;
  has_activity: boolean;
}

export interface ReportDataResponse {
  summary: {
    totalStudents: number;
    activeStudentsCount: number;
    noActivityCount: number;
    totalEasy: number;
    totalMedium: number;
    totalHard: number;
    totalProblems: number;
    overallTotalEasy: number;
    overallTotalMedium: number;
    overallTotalHard: number;
    overallTotalProblems: number;
  };
  students: StudentReportItem[];
}

export async function getReportFilters(): Promise<ReportFilterOptions> {
  const response = await api.get('/reports/filters');
  return response.data;
}

export async function getReportData(params?: {
  academicYear?: string;
  department?: string;
  batchId?: string;
  sectionId?: string;
  allocationBatchId?: string;
  staffId?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: 'total' | 'easy' | 'medium' | 'hard' | 'register_number' | 'name';
  sortOrder?: 'asc' | 'desc';
  activityStatus?: 'all' | 'active' | 'no_activity';
}): Promise<ReportDataResponse> {
  const response = await api.get('/reports/data', { params });
  return response.data;
}

export async function syncReportStudents(data?: {
  batchId?: string;
  sectionId?: string;
  department?: string;
  allocationBatchId?: string;
  staffId?: string;
}) {
  const response = await api.post('/sync/report-filtered', data || {});
  return response.data;
}

export async function getStudentDailyProgress(
  studentId: string,
  params?: { fromDate?: string; toDate?: string }
) {
  const response = await api.get(`/reports/student/${studentId}/daily-progress`, { params });
  return response.data;
}

function extractFileNameFromResponse(response: any, fallbackName?: string): string {
  const disposition = response.headers ? (response.headers['content-disposition'] || response.headers['Content-Disposition']) : undefined;
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  const todayStr = new Date().toISOString().split('T')[0];
  let safeName = fallbackName || `coding_report_${todayStr}_all-time.xlsx`;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(safeName)) {
    safeName = `coding_report_${todayStr}_report.xlsx`;
  }
  return safeName;
}

function triggerBrowserDownload(data: any, fileName: string) {
  let finalFileName = fileName;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const todayStr = new Date().toISOString().split('T')[0];

  if (!finalFileName || uuidRegex.test(finalFileName)) {
    finalFileName = `coding_report_${todayStr}_download.xlsx`;
  }

  const isExcel = finalFileName.toLowerCase().endsWith('.xlsx');
  const mimeType = isExcel
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'text/csv;charset=utf-8;';

  const blob = new Blob([data], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 100);
}

export async function exportExcelReport(data: {
  academicYear?: string;
  department?: string;
  batchId?: string;
  sectionId?: string;
  allocationBatchId?: string;
  staffId?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: 'total' | 'easy' | 'medium' | 'hard' | 'register_number' | 'name';
  sortOrder?: 'asc' | 'desc';
  activityStatus?: 'all' | 'active' | 'no_activity';
}) {
  const response = await api.post('/reports/export-excel', data, {
    responseType: 'blob',
  });

  const fileName = extractFileNameFromResponse(
    response,
    `coding_report_${new Date().toISOString().split('T')[0]}_export.xlsx`
  );

  triggerBrowserDownload(response.data, fileName);

  return { fileName };
}

export async function exportCsvReport(data: {
  academicYear?: string;
  department?: string;
  batchId?: string;
  sectionId?: string;
  allocationBatchId?: string;
  staffId?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: 'total' | 'easy' | 'medium' | 'hard' | 'register_number' | 'name';
  sortOrder?: 'asc' | 'desc';
  activityStatus?: 'all' | 'active' | 'no_activity';
}) {
  const response = await api.post('/reports/export-csv', data, {
    responseType: 'blob',
  });

  const fileName = extractFileNameFromResponse(
    response,
    `coding_report_${new Date().toISOString().split('T')[0]}_export.csv`
  );

  triggerBrowserDownload(response.data, fileName);

  return { fileName };
}

export async function generateReport(data: GenerateReportRequest) {
  const response = await api.post('/reports/generate', data);
  return response.data;
}

export async function getReportsList(): Promise<ReportItem[]> {
  const response = await api.get('/reports');
  return response.data.reports || [];
}

export async function downloadReportFile(reportId: string, fileName?: string) {
  const response = await api.get(`/reports/${reportId}/download`, {
    responseType: 'blob',
  });

  const resolvedFileName = extractFileNameFromResponse(
    response,
    fileName || `coding_report_${new Date().toISOString().split('T')[0]}_download.xlsx`
  );

  triggerBrowserDownload(response.data, resolvedFileName);

  return { fileName: resolvedFileName };
}

export async function syncGoogleSheets(data: { webhookUrl?: string; batchId?: string; sectionId?: string }) {
  const response = await api.post('/reports/sync-sheets', data);
  return response.data;
}

export async function deleteReportItem(reportId: string): Promise<{ message: string }> {
  const response = await api.delete(`/reports/${reportId}`);
  return response.data;
}

export async function bulkDeleteReportItems(reportIds: string[]): Promise<{ message: string; count: number }> {
  const response = await api.post('/reports/bulk-delete', { reportIds });
  return response.data;
}

export async function clearAllReportItems(): Promise<{ message: string; count: number }> {
  const response = await api.delete('/reports/clear-all');
  return response.data;
}

