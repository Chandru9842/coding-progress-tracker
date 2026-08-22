import axios from 'axios';
import { prisma } from '../db/client.js';

import { inMemoryStore, InMemoryGoogleSheetLink } from '../db/inMemoryStore.js';
import { getBatchesForStaff } from './batchService.js';
import { getStaffAssignedScopes } from './staffService.js';
import { getAuthorizedStudentIdsForStaff } from './studentAuthorizationService.js';
import { toISTDateString } from './reportService.js';

export interface GoogleSheetLinkDTO {
  id: string;
  owner_user_id: string;
  name: string;
  spreadsheet_id: string;
  spreadsheet_name?: string | null;
  spreadsheet_url?: string | null;
  webhook_url?: string | null;
  academic_year?: string | null;
  department?: string | null;
  section_id?: string | null;
  allocation_batch_id?: string | null;
  batch_ids: string[];
  is_active: boolean;
  is_auto_sync_enabled: boolean;
  sync_students: boolean;
  sync_daily_progress: boolean;
  last_sync_at?: string | Date | null;
  last_sync_status?: string | null;
  last_sync_error?: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface CreateSheetLinkInput {
  name: string;
  spreadsheet_id: string;
  spreadsheet_name?: string;
  webhook_url?: string;
  academic_year?: string;
  department?: string;
  section_id?: string;
  allocation_batch_id?: string;
  batch_ids?: string[];
  is_auto_sync_enabled?: boolean;
  sync_students?: boolean;
  sync_daily_progress?: boolean;
}


export interface GoogleSheetMatrix {
  headers: string[];
  rows: string[][];
  studentCount: number;
  dateColumnsCount: number;
}

/**
 * Extracts pure Google Spreadsheet ID from raw ID or full Google Sheet URL.
 * Examples:
 * - "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" -> "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
 * - "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0" -> "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
 * - "docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit" -> "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  if (trimmed.includes('script.google.com') || trimmed.includes('/macros/s/')) {
    return '';
  }

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  const candidate = trimmed.split('/')[0].split('?')[0].split('#')[0].trim();
  return candidate.includes('.') || candidate.includes(':') || candidate.length < 10 ? '' : candidate;
}

export function sanitizeGoogleSheetLink<T extends { spreadsheet_id: string; spreadsheet_url?: string | null; webhook_url?: string | null }>(link: T): T {
  if (!link) return link;

  const rawId = link.spreadsheet_id || '';
  const cleanId = extractSpreadsheetId(rawId);

  if (cleanId) {
    link.spreadsheet_id = cleanId;
    link.spreadsheet_url = `https://docs.google.com/spreadsheets/d/${cleanId}/edit`;
  } else if (rawId.startsWith('https://script.google.com') || rawId.includes('/macros/s/')) {
    (link as any).webhook_url = rawId;
  }

  if (link.spreadsheet_url && link.spreadsheet_url.includes('script.google.com')) {
    link.spreadsheet_url = null;
  }

  return link;
}



/**
 * Builds the one-student-one-row / one-date-one-column Google Sheet data matrix.
 */
export function buildGoogleSheetMatrix(
  students: any[],
  snapshots: any[]
): GoogleSheetMatrix {
  const dateSet = new Set<string>();
  snapshots.forEach((snap) => {
    const dStr = toISTDateString(snap.snapshot_date);
    if (dStr) dateSet.add(dStr);
  });

  const sortedDates = Array.from(dateSet).sort();

  const formatDateHeader = (isoDate: string) => {
    const d = new Date(isoDate + 'T00:00:00.000Z');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const year = d.getUTCFullYear();
    return `${day}-${month}-${year}`;
  };

  const headers = [
    'Rank',
    'Academic Year',
    'Department',
    'Section',
    'Allocation Batch',
    'Mentor',
    'Register No',
    'Student Name',
    'LeetCode ID',
    ...sortedDates.map(formatDateHeader),
  ];

  const studentSnapshotsMap = new Map<string, any[]>();
  snapshots.forEach((snap) => {
    const list = studentSnapshotsMap.get(snap.student_id) || [];
    list.push(snap);
    studentSnapshotsMap.set(snap.student_id, list);
  });

  studentSnapshotsMap.forEach((snaps) => {
    snaps.sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime());
  });

  // Sort students strictly by Academic Year -> Department -> Section -> Allocation Batch -> Register Number
  const sortedStudents = [...students].sort((a, b) => {
    const ayA = a.batch ? a.batch.start_year : (a.start_year || 0);
    const ayB = b.batch ? b.batch.start_year : (b.start_year || 0);
    if (ayA !== ayB) return ayA - ayB;

    const deptA = a.batch ? a.batch.department : (a.department || '');
    const deptB = b.batch ? b.batch.department : (b.department || '');
    if (deptA !== deptB) return deptA.localeCompare(deptB);

    const secA = a.section ? a.section.name : (a.section_name || '');
    const secB = b.section ? b.section.name : (b.section_name || '');
    if (secA !== secB) return secA.localeCompare(secB);

    const abA = a.allocation_batch ? a.allocation_batch.name : (a.sub_batch || 'N/A');
    const abB = b.allocation_batch ? b.allocation_batch.name : (b.sub_batch || 'N/A');
    if (abA !== abB) return abA.localeCompare(abB);

    return (a.register_number || '').localeCompare(b.register_number || '');
  });

  const rows: string[][] = sortedStudents.map((st, idx) => {
    const rank = (idx + 1).toString();
    const ay = st.batch ? `${st.batch.start_year}–${st.batch.end_year}` : (st.academic_year || 'N/A');
    const dept = st.batch ? st.batch.department : (st.department || 'N/A');
    const sec = st.section ? `Section ${st.section.name}` : (st.section_name ? `Section ${st.section_name}` : 'N/A');
    const allocBatch = st.allocation_batch?.name || (st.sub_batch && st.sub_batch !== 'N/A' ? st.sub_batch : '-');
    const mentorName = st.mentor ? st.mentor.name : (st.mentor_name || 'Unassigned');

    const baseRow: string[] = [
      rank,
      ay,
      dept,
      sec,
      allocBatch,
      mentorName,
      st.register_number,
      st.name,
      st.leetcode_username || 'N/A',
    ];

    const studentSnaps = studentSnapshotsMap.get(st.id) || [];

    sortedDates.forEach((isoDate) => {
      const snapIndex = studentSnaps.findIndex(
        (s) => toISTDateString(s.snapshot_date) === isoDate
      );

      if (snapIndex === -1) {
        baseRow.push('-');
      } else {
        const currSnap = studentSnaps[snapIndex];
        const prevSnap = snapIndex > 0 ? studentSnaps[snapIndex - 1] : null;

        let easyToday = 0;
        let medToday = 0;
        let hardToday = 0;
        let totalToday = 0;

        if (prevSnap) {
          easyToday = Math.max(0, currSnap.easy_solved - prevSnap.easy_solved);
          medToday = Math.max(0, currSnap.medium_solved - prevSnap.medium_solved);
          hardToday = Math.max(0, currSnap.hard_solved - prevSnap.hard_solved);
          totalToday = easyToday + medToday + hardToday;
        } else {
          easyToday = 0;
          medToday = 0;
          hardToday = 0;
          totalToday = 0;
        }

        const cellContent = `Overall: E-${currSnap.easy_solved} | M-${currSnap.medium_solved} | H-${currSnap.hard_solved} | T-${currSnap.total_solved}\nToday: E-${easyToday} | M-${medToday} | H-${hardToday} | T-${totalToday}`;


        baseRow.push(cellContent);
      }
    });

    return baseRow;
  });

  return {
    headers,
    rows,
    studentCount: sortedStudents.length,
    dateColumnsCount: sortedDates.length,
  };
}

export async function createGoogleSheetLink(
  user: { userId: string; role: 'ADMIN' | 'STAFF' },
  input: CreateSheetLinkInput
): Promise<GoogleSheetLinkDTO> {
  const { name, spreadsheet_id: raw_spreadsheet_id, spreadsheet_name, academic_year, department, section_id, allocation_batch_id, is_auto_sync_enabled, sync_students, sync_daily_progress } = input;
  let batch_ids = input.batch_ids || [];

  if (!raw_spreadsheet_id || !name) {
    const err: any = new Error('Name and spreadsheet_id are required');
    err.statusCode = 400;
    throw err;
  }

  const cleanSpreadsheetId = extractSpreadsheetId(raw_spreadsheet_id);
  if (!cleanSpreadsheetId) {
    const err: any = new Error('Invalid Google Spreadsheet ID or URL format');
    err.statusCode = 400;
    throw err;
  }

  if (section_id) {
    if (!process.env.DATABASE_URL) {
      const sec = inMemoryStore.sections.find((s) => s.id === section_id);
      if (sec) batch_ids = [sec.batch_id];
    } else {
      const sec = await prisma.section.findUnique({ where: { id: section_id }, select: { batch_id: true } });
      if (sec) batch_ids = [sec.batch_id];
    }
  } else if (academic_year) {
    const years = academic_year.split(/[–-]/).map((y) => parseInt(y.trim()));
    if (years.length === 2 && !isNaN(years[0]) && !isNaN(years[1])) {
      const startYr = years[0];
      const endYr = years[1];

      if (!process.env.DATABASE_URL) {
        let matchingBatches = inMemoryStore.batches.filter((b) => b.start_year === startYr && b.end_year === endYr);
        if (department && department !== 'ALL' && department !== 'All Departments') {
          matchingBatches = matchingBatches.filter((b) => b.department.toLowerCase() === department.toLowerCase());
        }
        batch_ids = matchingBatches.map((b) => b.id);
      } else {
        let where: any = { start_year: startYr, end_year: endYr };
        if (department && department !== 'ALL' && department !== 'All Departments') {
          where.department = { equals: department, mode: 'insensitive' };
        }
        const matchingBatches = await prisma.batch.findMany({ where });
        batch_ids = matchingBatches.map((b) => b.id);
      }
    }
  }

  if (!batch_ids || batch_ids.length === 0) {
    const err: any = new Error(`No intake batches found for selected Academic Year [${academic_year || 'N/A'}] and Department [${department || 'All'}]`);
    err.statusCode = 400;
    throw err;
  }

  // Verification of Staff Scope (HTTP 403 Forbidden)
  if (user.role === 'STAFF') {
    const staffScopes = await getStaffAssignedScopes(user.userId);
    const assignedSectionIds = new Set(staffScopes.sections.map((s) => s.id));

    if (section_id && !assignedSectionIds.has(section_id)) {
      const err: any = new Error(`Forbidden: You are not authorized to link Google Sheets for unassigned section [${section_id}]`);
      err.statusCode = 403;
      throw err;
    }

    if (allocation_batch_id && allocation_batch_id !== 'ALL') {
      const targetSec = staffScopes.sections.find((s) => s.id === section_id);
      const isAllowedAlloc = targetSec?.allocation_batches.some((ab: any) => ab.id === allocation_batch_id);
      if (!isAllowedAlloc) {
        const err: any = new Error(`Forbidden: You are not authorized to link Google Sheets for unassigned allocation batch [${allocation_batch_id}]`);
        err.statusCode = 403;
        throw err;
      }
    }

    const assignedBatches = await getBatchesForStaff(user.userId);
    const assignedBatchIds = new Set(assignedBatches.map((b) => b.id));

    for (const bId of batch_ids) {
      if (!assignedBatchIds.has(bId)) {
        const err: any = new Error(`Forbidden: You are not authorized to link Google Sheets for unassigned batch ID [${bId}]`);
        err.statusCode = 403;
        throw err;
      }
    }
  }

  const spreadsheet_url = `https://docs.google.com/spreadsheets/d/${cleanSpreadsheetId}/edit`;

  if (!process.env.DATABASE_URL) {
    const newLink: InMemoryGoogleSheetLink = {
      id: `lnk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      owner_user_id: user.userId,
      name,
      spreadsheet_id: cleanSpreadsheetId,
      spreadsheet_name: spreadsheet_name || 'Linked Sheet',
      spreadsheet_url,
      academic_year: academic_year || null,
      department: department || null,
      section_id: section_id || null,
      allocation_batch_id: allocation_batch_id || null,
      batch_ids,
      is_active: true,
      is_auto_sync_enabled: is_auto_sync_enabled ?? false,
      sync_students: sync_students ?? true,
      sync_daily_progress: sync_daily_progress ?? true,
      last_sync_at: null,
      last_sync_status: null,
      last_sync_error: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    inMemoryStore.googleSheetLinks.unshift(newLink);

    // Automatically trigger initial population sync asynchronously
    setImmediate(() => {
      syncGoogleSheetLink(newLink.id, user).catch((syncErr) => {
        console.warn(`[Google Sheet Initial Sync Warning] Link ${newLink.id} initial population failed:`, syncErr.message);
      });
    });

    return newLink;
  }

  // DB Mode
  const created = await prisma.googleSheetLink.create({
    data: {
      owner_user_id: user.userId,
      name,
      spreadsheet_id: cleanSpreadsheetId,
      spreadsheet_name: spreadsheet_name || 'Linked Sheet',
      spreadsheet_url,
      academic_year: academic_year || null,
      department: department || null,
      section_id: section_id || null,
      allocation_batch_id: allocation_batch_id || null,
      batch_ids,
      is_active: true,
      is_auto_sync_enabled: is_auto_sync_enabled ?? false,
      sync_students: sync_students ?? true,
      sync_daily_progress: sync_daily_progress ?? true,
    },
  });

  // Automatically trigger initial population sync asynchronously
  setImmediate(() => {
    syncGoogleSheetLink(created.id, user).catch((syncErr) => {
      console.warn(`[Google Sheet Initial Sync Warning] Link ${created.id} initial population failed:`, syncErr.message);
    });
  });

  return sanitizeGoogleSheetLink(created);
}

export async function getGoogleSheetLinksForUser(
  user: { userId: string; role: 'ADMIN' | 'STAFF' }
): Promise<GoogleSheetLinkDTO[]> {
  if (!process.env.DATABASE_URL) {
    let links = inMemoryStore.googleSheetLinks;
    if (user.role !== 'ADMIN') {
      links = links.filter((l) => l.owner_user_id === user.userId);
    }
    return links.map((l) => {
      const ownerUser = inMemoryStore.users.find((u) => u.id === l.owner_user_id);
      return sanitizeGoogleSheetLink({
        ...l,
        owner: ownerUser
          ? { id: ownerUser.id, name: ownerUser.name, email: ownerUser.email, role: ownerUser.role }
          : { id: l.owner_user_id, name: 'System Admin', email: 'admin@college.edu', role: 'ADMIN' },
      });
    });
  }

  let links: any[] = [];
  if (user.role === 'ADMIN') {
    links = await prisma.googleSheetLink.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  } else {
    links = await prisma.googleSheetLink.findMany({
      where: { owner_user_id: user.userId },
      include: {
        owner: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  return links.map((l) => sanitizeGoogleSheetLink(l));
}

export async function getGoogleSheetLinkById(
  linkId: string,
  user: { userId: string; role: 'ADMIN' | 'STAFF' }
): Promise<GoogleSheetLinkDTO> {
  if (!process.env.DATABASE_URL) {
    const link = inMemoryStore.googleSheetLinks.find((l) => l.id === linkId);
    if (!link) {
      const err: any = new Error('Google Sheet Link not found');
      err.statusCode = 404;
      throw err;
    }
    if (user.role !== 'ADMIN' && link.owner_user_id !== user.userId) {
      const err: any = new Error('Forbidden: You do not own this Google Sheet Link');
      err.statusCode = 403;
      throw err;
    }
    const ownerUser = inMemoryStore.users.find((u) => u.id === link.owner_user_id);
    return sanitizeGoogleSheetLink({
      ...link,
      owner: ownerUser
        ? { id: ownerUser.id, name: ownerUser.name, email: ownerUser.email, role: ownerUser.role }
        : { id: link.owner_user_id, name: 'System Admin', email: 'admin@college.edu', role: 'ADMIN' },
    });
  }

  const link = await prisma.googleSheetLink.findUnique({
    where: { id: linkId },
    include: {
      owner: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  if (!link) {
    const err: any = new Error('Google Sheet Link not found');
    err.statusCode = 404;
    throw err;
  }

  if (user.role !== 'ADMIN' && link.owner_user_id !== user.userId) {
    const err: any = new Error('Forbidden: You do not own this Google Sheet Link');
    err.statusCode = 403;
    throw err;
  }

  return sanitizeGoogleSheetLink(link);
}

export async function updateGoogleSheetLink(
  linkId: string,
  user: { userId: string; role: 'ADMIN' | 'STAFF' },
  input: Partial<CreateSheetLinkInput>
): Promise<GoogleSheetLinkDTO> {
  if (!process.env.DATABASE_URL) {
    const linkIndex = inMemoryStore.googleSheetLinks.findIndex((l) => l.id === linkId);
    if (linkIndex === -1) {
      const err: any = new Error('Google Sheet Link not found');
      err.statusCode = 404;
      throw err;
    }
    const existing = inMemoryStore.googleSheetLinks[linkIndex];
    if (user.role !== 'ADMIN' && existing.owner_user_id !== user.userId) {
      const err: any = new Error('Forbidden: You do not own this Google Sheet Link');
      err.statusCode = 403;
      throw err;
    }

    const cleanSpreadsheetId = input.spreadsheet_id
      ? extractSpreadsheetId(input.spreadsheet_id)
      : existing.spreadsheet_id;

    const updated = {
      ...existing,
      name: input.name || existing.name,
      spreadsheet_id: cleanSpreadsheetId,
      spreadsheet_url: `https://docs.google.com/spreadsheets/d/${cleanSpreadsheetId}/edit`,
      academic_year: input.academic_year !== undefined ? input.academic_year : existing.academic_year,
      department: input.department !== undefined ? input.department : existing.department,
      section_id: input.section_id !== undefined ? input.section_id : existing.section_id,
      allocation_batch_id: input.allocation_batch_id !== undefined ? input.allocation_batch_id : existing.allocation_batch_id,
      batch_ids: input.batch_ids || existing.batch_ids,
      updated_at: new Date(),
    };

    inMemoryStore.googleSheetLinks[linkIndex] = updated;
    const ownerUser = inMemoryStore.users.find((u) => u.id === updated.owner_user_id);
    return sanitizeGoogleSheetLink({
      ...updated,
      owner: ownerUser
        ? { id: ownerUser.id, name: ownerUser.name, email: ownerUser.email, role: ownerUser.role }
        : undefined,
    });
  }

  // DB Mode
  const existing = await prisma.googleSheetLink.findUnique({ where: { id: linkId } });
  if (!existing) {
    const err: any = new Error('Google Sheet Link not found');
    err.statusCode = 404;
    throw err;
  }
  if (user.role !== 'ADMIN' && existing.owner_user_id !== user.userId) {
    const err: any = new Error('Forbidden: You do not own this Google Sheet Link');
    err.statusCode = 403;
    throw err;
  }

  let cleanSpreadsheetId = input.spreadsheet_id
    ? extractSpreadsheetId(input.spreadsheet_id)
    : existing.spreadsheet_id;

  if (!cleanSpreadsheetId && existing.spreadsheet_id) {
    cleanSpreadsheetId = existing.spreadsheet_id;
  }

  const spreadsheetUrl = cleanSpreadsheetId ? `https://docs.google.com/spreadsheets/d/${cleanSpreadsheetId}/edit` : existing.spreadsheet_url;


  let batch_ids = input.batch_ids || existing.batch_ids;

  if (input.section_id) {
    const sec = await prisma.section.findUnique({ where: { id: input.section_id }, select: { batch_id: true } });
    if (sec) batch_ids = [sec.batch_id];
  } else if (input.academic_year) {
    const years = input.academic_year.split(/[–-]/).map((y) => parseInt(y.trim()));
    if (years.length === 2 && !isNaN(years[0]) && !isNaN(years[1])) {
      let where: any = { start_year: years[0], end_year: years[1] };
      if (input.department && input.department !== 'ALL' && input.department !== 'All Departments') {
        where.department = { equals: input.department, mode: 'insensitive' };
      }
      const matchingBatches = await prisma.batch.findMany({ where });
      if (matchingBatches.length > 0) {
        batch_ids = matchingBatches.map((b) => b.id);
      }
    }
  }

  const updated = await prisma.googleSheetLink.update({
    where: { id: linkId },
    data: {
      name: input.name || existing.name,
      spreadsheet_id: cleanSpreadsheetId,
      spreadsheet_name: input.spreadsheet_name || existing.spreadsheet_name,
      spreadsheet_url: spreadsheetUrl,
      academic_year: input.academic_year !== undefined ? input.academic_year : existing.academic_year,
      department: input.department !== undefined ? input.department : existing.department,
      section_id: input.section_id !== undefined ? input.section_id : existing.section_id,
      allocation_batch_id: input.allocation_batch_id !== undefined ? input.allocation_batch_id : existing.allocation_batch_id,
      batch_ids,
    },
    include: {
      owner: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return sanitizeGoogleSheetLink(updated);
}

export async function syncAllGoogleSheetLinks(
  user: { userId: string; role: 'ADMIN' | 'STAFF' }
) {
  const links = await getGoogleSheetLinksForUser(user);
  const activeLinks = links.filter((l) => l.is_active);

  const results: any[] = [];
  for (const link of activeLinks) {
    try {
      const res = await syncGoogleSheetLink(link.id, user);
      results.push({ linkId: link.id, name: link.name, success: true, rowsSynced: res.rowsSynced });
    } catch (err: any) {
      results.push({ linkId: link.id, name: link.name, success: false, error: err.message });
    }
  }

  return {
    totalAttempted: activeLinks.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}

export async function syncGoogleSheetLink(
  linkId: string,
  user: { userId: string; role: 'ADMIN' | 'STAFF' }
): Promise<{
  success: boolean;
  rowsSynced: number;
  dateColumnsCount: number;
  syncedAt: Date;
  details: string;
  matrix: GoogleSheetMatrix;
}> {
  const link = await getGoogleSheetLinkById(linkId, user);

  let studentRows: any[] = [];
  let snapshotRows: any[] = [];

  let activeBatchIds = [...link.batch_ids];

  if (link.academic_year) {
    const years = link.academic_year.split(/[–-]/).map((y) => parseInt(y.trim()));
    if (years.length === 2 && !isNaN(years[0]) && !isNaN(years[1])) {
      const startYr = years[0];
      const endYr = years[1];

      if (!process.env.DATABASE_URL) {
        let matchingBatches = inMemoryStore.batches.filter((b) => b.start_year === startYr && b.end_year === endYr);
        if (link.department && link.department !== 'ALL' && link.department !== 'All Departments') {
          matchingBatches = matchingBatches.filter((b) => b.department.toLowerCase() === link.department?.toLowerCase());
        }
        if (matchingBatches.length > 0) {
          activeBatchIds = matchingBatches.map((b) => b.id);
        }
      } else {
        let where: any = { start_year: startYr, end_year: endYr };
        if (link.department && link.department !== 'ALL' && link.department !== 'All Departments') {
          where.department = { equals: link.department, mode: 'insensitive' };
        }
        const matchingBatches = await prisma.batch.findMany({ where });
        if (matchingBatches.length > 0) {
          activeBatchIds = matchingBatches.map((b) => b.id);
        }
      }
    }
  }

  if (!process.env.DATABASE_URL) {
    studentRows = inMemoryStore.students.filter((s) => activeBatchIds.includes(s.batch_id));

    if (link.section_id) {
      studentRows = studentRows.filter((s) => s.section_id === link.section_id);
    }

    if (link.allocation_batch_id && link.allocation_batch_id !== 'ALL') {
      const targetAb = inMemoryStore.allocationBatches.find((ab) => ab.id === link.allocation_batch_id);
      const targetName = targetAb?.name || link.allocation_batch_id;
      studentRows = studentRows.filter((s) => s.allocation_batch_id === link.allocation_batch_id || s.sub_batch === targetName);
    }

    if (user.role === 'STAFF') {
      const authorizedList = await getAuthorizedStudentIdsForStaff(user.userId);
      if (authorizedList.length > 0) {
        const authorizedStudentIds = new Set(authorizedList);
        studentRows = studentRows.filter((s) => authorizedStudentIds.has(s.id));
      }
    }


    studentRows = studentRows.map((st) => ({
      ...st,
      batch: inMemoryStore.batches.find((b) => b.id === st.batch_id),
      section: inMemoryStore.sections.find((sec) => sec.id === st.section_id),
      allocation_batch: inMemoryStore.allocationBatches.find((ab) => ab.id === st.allocation_batch_id),
      mentor: inMemoryStore.users.find((u) => u.id === st.mentor_id),
    }));

    const studentIds = new Set(studentRows.map((s) => s.id));
    snapshotRows = inMemoryStore.snapshots.filter((snap) => studentIds.has(snap.student_id));
  } else {
    let whereClause: any = {
      batch_id: { in: activeBatchIds },
    };

    if (link.section_id) {
      whereClause.section_id = link.section_id;
    }

    if (link.allocation_batch_id && link.allocation_batch_id !== 'ALL') {
      const targetAb = await prisma.allocationBatch.findUnique({
        where: { id: link.allocation_batch_id },
        select: { name: true },
      });
      const targetName = targetAb?.name || link.allocation_batch_id;

      whereClause.OR = [
        { allocation_batch_id: link.allocation_batch_id },
        { sub_batch: targetName },
      ];
    }

    if (user.role === 'STAFF') {
      const authorizedIds = await getAuthorizedStudentIdsForStaff(user.userId);
      if (authorizedIds.length > 0) {
        whereClause.id = { in: authorizedIds };
      }
    }


    studentRows = await prisma.student.findMany({
      where: whereClause,
      include: {
        batch: true,
        section: true,
        allocation_batch: true,
        staff_student_assignments: {
          include: {
            staff: { select: { id: true, name: true, email: true } },
          },
        },
        snapshots: true,
      },
    });

    studentRows = studentRows.map((st) => ({
      ...st,
      mentor: st.staff_student_assignments?.[0]?.staff || null,
    }));

    const stIds = studentRows.map((s) => s.id);
    snapshotRows = await prisma.dailyCodingSnapshot.findMany({
      where: { student_id: { in: stIds } },
    });
  }

  const matrix = buildGoogleSheetMatrix(studentRows, snapshotRows);
  const now = new Date();
  const details = `Idempotently synchronized ${matrix.studentCount} student rows (one row per student) and ${matrix.dateColumnsCount} date columns for linked batches [${link.batch_ids.join(', ')}] into Google Sheet ID [${link.spreadsheet_id}].`;

  // Dispatch Webhook POST if Google Apps Script URL or webhook_url is linked
  const webhookUrl = (link as any).webhook_url || (link.spreadsheet_id && (link.spreadsheet_id.startsWith('https://script.google.com') || link.spreadsheet_id.includes('/macros/s/')) ? link.spreadsheet_id : null);
  if (webhookUrl) {
    try {
      await axios.post(webhookUrl, {
        headers: matrix.headers,
        rows: matrix.rows,
        studentCount: matrix.studentCount,
        updatedAt: now.toISOString(),
      });
      console.log(`[GOOGLE_SHEETS] Successfully posted matrix data to Apps Script Webhook [${webhookUrl}]`);
    } catch (whErr: any) {
      console.error('[GOOGLE_SHEETS] Apps Script Webhook POST warning:', whErr?.message || whErr);
    }
  }



  if (!process.env.DATABASE_URL) {
    const memLink = inMemoryStore.googleSheetLinks.find((l) => l.id === linkId);
    if (memLink) {
      memLink.last_sync_at = now;
      memLink.last_sync_status = 'SUCCESS';
      memLink.last_sync_error = null;
      memLink.updated_at = now;
    }

    inMemoryStore.googleSheetLinkLogs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sheet_link_id: linkId,
      status: 'SUCCESS',
      rows_synced: matrix.studentCount,
      details,
      error_message: null,
      synced_at: now,
    });
  } else {
    await prisma.googleSheetLink.update({
      where: { id: linkId },
      data: {
        last_sync_at: now,
        last_sync_status: 'SUCCESS',
        last_sync_error: null,
      },
    });

    await prisma.googleSheetLinkSyncLog.create({
      data: {
        sheet_link_id: linkId,
        status: 'SUCCESS',
        rows_synced: matrix.studentCount,
        details,
        synced_at: now,
      },
    });
  }

  return {
    success: true,
    rowsSynced: matrix.studentCount,
    dateColumnsCount: matrix.dateColumnsCount,
    syncedAt: now,
    details,
    matrix,
  };
}

export async function deleteGoogleSheetLink(
  linkId: string,
  user: { userId: string; role: 'ADMIN' | 'STAFF' }
): Promise<{ message: string }> {
  await getGoogleSheetLinkById(linkId, user);

  if (!process.env.DATABASE_URL) {
    const memLink = inMemoryStore.googleSheetLinks.find((l) => l.id === linkId);
    if (memLink) {
      memLink.is_active = false;
    }
    return { message: 'Google Sheet Link deactivated successfully. Spreadsheet data remains preserved.' };
  }

  await prisma.googleSheetLink.update({
    where: { id: linkId },
    data: { is_active: false },
  });

  return { message: 'Google Sheet Link deactivated successfully. Spreadsheet data remains preserved.' };
}

export async function getGoogleSheetLinkLogs(
  linkId: string,
  user: { userId: string; role: 'ADMIN' | 'STAFF' }
): Promise<any[]> {
  await getGoogleSheetLinkById(linkId, user);

  if (!process.env.DATABASE_URL) {
    return inMemoryStore.googleSheetLinkLogs.filter((l) => l.sheet_link_id === linkId);
  }

  return prisma.googleSheetLinkSyncLog.findMany({
    where: { sheet_link_id: linkId },
    orderBy: { synced_at: 'desc' },
  });
}
