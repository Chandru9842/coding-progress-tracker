import ExcelJS from 'exceljs';
import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { UserRole } from '../types/index.js';
import { getBatchesForStaff } from './batchService.js';
import {
  isStaffAuthorizedForBatch,
  isStaffAuthorizedForSection,
  isStaffAuthorizedForAllocationBatch,
  isStaffAuthorizedForDepartment,
  isStaffAuthorizedForAcademicYear,
  isStaffAuthorizedForStudent,
  getAuthorizedStudentIdsForStaff,
} from './studentAuthorizationService.js';

export interface ReportFilterParams {
  academicYear?: string;
  department?: string;
  batchId?: string;
  sectionId?: string;
  allocationBatchId?: string;
  staffId?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: 'total' | 'easy' | 'medium' | 'hard';
  sortOrder?: 'asc' | 'desc';
  activityStatus?: 'all' | 'active' | 'no_activity';
  reportType?: string;
}

export async function getReportFilterOptions(user: { userId: string; role: UserRole }) {
  if (!process.env.DATABASE_URL) {
    let batches = inMemoryStore.batches;
    if (user.role === 'STAFF') {
      const staffBatches = await getBatchesForStaff(user.userId);
      const staffBatchIds = new Set(staffBatches.map((b) => b.id));
      batches = batches.filter((b) => staffBatchIds.has(b.id));
    }

    const academicYears = Array.from(
      new Set(batches.map((b) => `${b.start_year}–${b.end_year}`))
    ).sort();
    const departments = Array.from(
      new Set(batches.map((b) => b.department))
    ).sort();

    let staff = inMemoryStore.users
      .filter((u) => u.role === 'STAFF')
      .map((u) => ({ id: u.id, name: u.name, email: u.email }));

    if (user.role === 'STAFF') {
      staff = staff.filter((u) => u.id === user.userId);
    }

    return {
      academicYears,
      departments,
      batches: batches.map((b) => ({
        id: b.id,
        batch_name: b.batch_name,
        department: b.department,
        academicYear: `${b.start_year}–${b.end_year}`,
        sections: inMemoryStore.sections
          .filter((sec) => sec.batch_id === b.id)
          .map((sec) => ({
            id: sec.id,
            name: sec.name,
            allocation_batches: inMemoryStore.allocationBatches
              .filter((ab) => ab.section_id === sec.id)
              .map((ab) => ({ id: ab.id, name: ab.name })),
          })),
      })),
      staff,
    };
  }

  // DB Mode
  let batches = await prisma.batch.findMany({
    include: {
      sections: {
        include: {
          allocation_batches: {
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { start_year: 'desc' },
  });

  if (user.role === 'STAFF') {
    const staffBatches = await getBatchesForStaff(user.userId);
    const staffBatchIds = new Set(staffBatches.map((b) => b.id));
    batches = batches.filter((b) => staffBatchIds.has(b.id));
  }

  const academicYears = Array.from(
    new Set(batches.map((b) => `${b.start_year}–${b.end_year}`))
  ).sort();

  const departments = Array.from(
    new Set(batches.map((b) => b.department))
  ).sort();

  let staffWhere: any = { role: 'STAFF' };
  if (user.role === 'STAFF') {
    staffWhere.id = user.userId;
  }

  const staff = await prisma.user.findMany({
    where: staffWhere,
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });

  return {
    academicYears,
    departments,
    batches: batches.map((b) => ({
      id: b.id,
      batch_name: b.batch_name,
      department: b.department,
      academicYear: `${b.start_year}–${b.end_year}`,
      sections: b.sections.map((sec) => ({
        id: sec.id,
        name: sec.name,
        allocation_batches: sec.allocation_batches.map((ab) => ({ id: ab.id, name: ab.name })),
      })),
    })),
    staff,
  };
}

export function toISTDateString(d: Date | string): string {
  if (!d) return '';
  if (typeof d === 'string') {
    if (d.includes('T')) {
      const parsed = new Date(d);
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
      return formatter.format(parsed);
    }
    return d.substring(0, 10);
  }
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
  return formatter.format(d);
}

export function fillContinuousSnapshotTimeline<T extends { snapshot_date: Date | string; easy_solved: number; medium_solved: number; hard_solved: number; total_solved: number }>(
  rawSnapshots: T[]
): T[] {
  if (!rawSnapshots || rawSnapshots.length === 0) return [];

  const sorted = [...rawSnapshots].sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime());
  
  const minDateStr = toISTDateString(sorted[0].snapshot_date);
  const maxDateStr = toISTDateString(new Date());
  
  const mapByDate = new Map<string, T>();
  sorted.forEach((s) => {
    mapByDate.set(toISTDateString(s.snapshot_date), s);
  });

  const filled: T[] = [];
  let currDate = new Date(`${minDateStr}T00:00:00.000Z`);
  const endDate = new Date(`${maxDateStr}T00:00:00.000Z`);

  let lastKnownSnap = sorted[0];

  while (currDate <= endDate) {
    const dStr = toISTDateString(currDate);
    if (mapByDate.has(dStr)) {
      lastKnownSnap = mapByDate.get(dStr)!;
    }
    
    const snapCopy = {
      ...lastKnownSnap,
      snapshot_date: new Date(`${dStr}T00:00:00.000Z`),
    };
    filled.push(snapCopy as T);

    currDate.setUTCDate(currDate.getUTCDate() + 1);
  }

  return filled.sort((a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime());
}

export function calculateStudentPeriodStats(
  rawSnapshots: { snapshot_date: Date | string; easy_solved: number; medium_solved: number; hard_solved: number; total_solved: number }[],
  isPeriodFilter: boolean,
  fromDate?: string,
  toDate?: string
) {
  if (!rawSnapshots || rawSnapshots.length === 0) {
    return {
      easy_solved: 0,
      medium_solved: 0,
      hard_solved: 0,
      total_solved: 0,
      overall_easy: 0,
      overall_medium: 0,
      overall_hard: 0,
      overall_total: 0,
      has_activity: false,
    };
  }

  const timeline = fillContinuousSnapshotTimeline(rawSnapshots);
  const sortedAsc = [...timeline].sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime());
  const latest = sortedAsc[sortedAsc.length - 1];

  const overall_easy = latest.easy_solved || 0;
  const overall_medium = latest.medium_solved || 0;
  const overall_hard = latest.hard_solved || 0;
  const overall_total = latest.total_solved || 0;

  if (!isPeriodFilter || (!fromDate && !toDate)) {
    return {
      easy_solved: overall_easy,
      medium_solved: overall_medium,
      hard_solved: overall_hard,
      total_solved: overall_total,
      overall_easy,
      overall_medium,
      overall_hard,
      overall_total,
      has_activity: overall_total > 0,
    };
  }

  const fromDateStr = fromDate ? toISTDateString(fromDate) : '';
  const toDateStr = toDate ? toISTDateString(toDate) : '';

  const periodSnaps = sortedAsc.filter((s) => {
    const dStr = toISTDateString(s.snapshot_date);
    if (fromDateStr && dStr < fromDateStr) return false;
    if (toDateStr && dStr > toDateStr) return false;
    return true;
  });

  const priorBaselineSnap = fromDateStr
    ? [...sortedAsc].reverse().find((s) => toISTDateString(s.snapshot_date) < fromDateStr)
    : null;

  let periodEasy = 0;
  let periodMedium = 0;
  let periodHard = 0;

  if (priorBaselineSnap) {
    const endSnap = periodSnaps.length > 0 ? periodSnaps[periodSnaps.length - 1] : null;
    if (endSnap) {
      periodEasy = Math.max(0, (endSnap.easy_solved || 0) - (priorBaselineSnap.easy_solved || 0));
      periodMedium = Math.max(0, (endSnap.medium_solved || 0) - (priorBaselineSnap.medium_solved || 0));
      periodHard = Math.max(0, (endSnap.hard_solved || 0) - (priorBaselineSnap.hard_solved || 0));
    }
  } else if (periodSnaps.length > 0) {
    const firstSnap = periodSnaps[0];
    const lastSnap = periodSnaps[periodSnaps.length - 1];
    if (periodSnaps.length >= 2) {
      periodEasy = Math.max(0, (lastSnap.easy_solved || 0) - (firstSnap.easy_solved || 0));
      periodMedium = Math.max(0, (lastSnap.medium_solved || 0) - (firstSnap.medium_solved || 0));
      periodHard = Math.max(0, (lastSnap.hard_solved || 0) - (firstSnap.hard_solved || 0));
    } else {
      // If student was first created/synced during or after this period and only has 1 snapshot,
      // their starting baseline when entering the system was that snapshot (0 new solves in this period).
      periodEasy = 0;
      periodMedium = 0;
      periodHard = 0;
    }
  } else {
    periodEasy = 0;
    periodMedium = 0;
    periodHard = 0;
  }

  let periodTotal = periodEasy + periodMedium + periodHard;

  if (priorBaselineSnap) {
    const endSnap = periodSnaps.length > 0 ? periodSnaps[periodSnaps.length - 1] : null;
    if (endSnap) {
      const rawTotalDelta = Math.max(0, (endSnap.total_solved || 0) - (priorBaselineSnap.total_solved || 0));
      if (rawTotalDelta > periodTotal) {
        periodEasy += (rawTotalDelta - periodTotal);
        periodTotal = rawTotalDelta;
      }
    }
  } else if (periodSnaps.length >= 2) {
    const firstSnap = periodSnaps[0];
    const lastSnap = periodSnaps[periodSnaps.length - 1];
    const rawTotalDelta = Math.max(0, (lastSnap.total_solved || 0) - (firstSnap.total_solved || 0));
    if (rawTotalDelta > periodTotal) {
      periodEasy += (rawTotalDelta - periodTotal);
      periodTotal = rawTotalDelta;
    }
  }

  return {
    easy_solved: periodEasy,
    medium_solved: periodMedium,
    hard_solved: periodHard,
    total_solved: periodTotal,
    overall_easy,
    overall_medium,
    overall_hard,
    overall_total,
    has_activity: periodTotal > 0,
  };
}

export async function getReportData(
  filters: ReportFilterParams,
  user: { userId: string; role: UserRole }
) {
  const {
    academicYear,
    department,
    batchId,
    sectionId,
    allocationBatchId,
    staffId,
    fromDate,
    toDate,
    sortBy = 'total',
    sortOrder = 'desc',
    activityStatus = 'all',
  } = filters;

  // STAFF Scope Validation
  if (user.role === 'STAFF') {
    if (staffId && staffId !== user.userId) {
      const err: any = new Error('Forbidden: You are not authorized to view reports for other staff members');
      err.statusCode = 403;
      throw err;
    }
    if (batchId) {
      const isAuthBatch = await isStaffAuthorizedForBatch(user.userId, batchId);
      if (!isAuthBatch) {
        const err: any = new Error('Forbidden: You are not authorized to view reports for this batch');
        err.statusCode = 403;
        throw err;
      }
    }
    if (sectionId) {
      const isAuthSec = await isStaffAuthorizedForSection(user.userId, sectionId);
      if (!isAuthSec) {
        const err: any = new Error('Forbidden: You are not authorized to view reports for this section');
        err.statusCode = 403;
        throw err;
      }
    }
    if (allocationBatchId) {
      const isAuthAlloc = await isStaffAuthorizedForAllocationBatch(user.userId, allocationBatchId);
      if (!isAuthAlloc) {
        const err: any = new Error('Forbidden: You are not authorized to view reports for this allocation batch');
        err.statusCode = 403;
        throw err;
      }
    }
    if (department) {
      const isAuthDept = await isStaffAuthorizedForDepartment(user.userId, department);
      if (!isAuthDept) {
        const err: any = new Error('Forbidden: You are not authorized to view reports for this department');
        err.statusCode = 403;
        throw err;
      }
    }
    if (academicYear) {
      const isAuthAY = await isStaffAuthorizedForAcademicYear(user.userId, academicYear);
      if (!isAuthAY) {
        const err: any = new Error('Forbidden: You are not authorized to view reports for this academic year');
        err.statusCode = 403;
        throw err;
      }
    }
  }

  let authorizedStudentIds: string[] | null = null;
  if (user.role === 'STAFF') {
    authorizedStudentIds = await getAuthorizedStudentIdsForStaff(user.userId);
  } else if (staffId) {
    authorizedStudentIds = await getAuthorizedStudentIdsForStaff(staffId);
  }

  let studentsList: any[] = [];

  if (!process.env.DATABASE_URL) {
    let rawStudents = [...inMemoryStore.students];

    if (authorizedStudentIds !== null) {
      rawStudents = rawStudents.filter((st) => authorizedStudentIds!.includes(st.id));
    }

    if (batchId) {
      rawStudents = rawStudents.filter((st) => st.batch_id === batchId);
    }

    if (sectionId) {
      rawStudents = rawStudents.filter((st) => st.section_id === sectionId);
    }

    if (allocationBatchId) {
      rawStudents = rawStudents.filter((st) => st.allocation_batch_id === allocationBatchId || st.sub_batch === allocationBatchId);
    }

    if (department) {
      rawStudents = rawStudents.filter((st) => st.department.toLowerCase() === department.toLowerCase());
    }

    if (academicYear) {
      const years = academicYear.replace('–', '-').split('-');
      if (years.length === 2) {
        const start = parseInt(years[0].trim(), 10);
        const end = parseInt(years[1].trim(), 10);
        const matchingBatchIds = inMemoryStore.batches
          .filter((b) => b.start_year === start && b.end_year === end)
          .map((b) => b.id);
        rawStudents = rawStudents.filter((st) => matchingBatchIds.includes(st.batch_id));
      }
    }

    studentsList = rawStudents.map((st) => {
      const b = inMemoryStore.batches.find((batch) => batch.id === st.batch_id);
      const sec = inMemoryStore.sections.find((section) => section.id === st.section_id);
      const ab = inMemoryStore.allocationBatches.find((alloc) => alloc.id === st.allocation_batch_id);
      const ssa = inMemoryStore.staffStudentAssignments.find((a) => a.student_id === st.id);
      const mentorUser = ssa ? inMemoryStore.users.find((u) => u.id === ssa.staff_id) : null;

      const snaps = inMemoryStore.snapshots.filter((snap) => snap.student_id === st.id);
      const isPeriodFilter = !!(fromDate || toDate);
      const stats = calculateStudentPeriodStats(snaps, isPeriodFilter, fromDate, toDate);

      return {
        id: st.id,
        register_number: st.register_number,
        name: st.name,
        department: st.department,
        leetcode_username: st.leetcode_username,
        mentor_name: mentorUser ? mentorUser.name : 'Unassigned',
        batch_id: st.batch_id,
        section_id: st.section_id,
        allocation_batch_id: st.allocation_batch_id,
        batch: {
          id: st.batch_id,
          batch_name: b?.batch_name || 'Batch',
          academicYear: b ? `${b.start_year}–${b.end_year}` : '',
        },
        section: { id: st.section_id, name: sec?.name || 'A' },
        allocation_batch: ab ? { id: ab.id, name: ab.name } : (st.sub_batch ? { id: st.sub_batch, name: st.sub_batch } : null),
        easy_solved: stats.easy_solved,
        medium_solved: stats.medium_solved,
        hard_solved: stats.hard_solved,
        total_solved: stats.total_solved,
        overall_easy: stats.overall_easy,
        overall_medium: stats.overall_medium,
        overall_hard: stats.overall_hard,
        overall_total: stats.overall_total,
        has_activity: stats.has_activity,
      };
    });
  } else {
    // PostgreSQL Querying
    const where: any = {};

    if (authorizedStudentIds !== null) {
      where.id = { in: authorizedStudentIds };
    }

    if (batchId) {
      where.batch_id = batchId;
    }

    if (sectionId) {
      where.section_id = sectionId;
    }

    if (allocationBatchId) {
      const val = allocationBatchId.trim();
      const matchingAbs = await prisma.allocationBatch.findMany({
        where: {
          OR: [
            { id: val },
            { name: { equals: val, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true },
      });
      const abIds = matchingAbs.map((ab) => ab.id);
      const abNames = matchingAbs.map((ab) => ab.name);

      const allocConditions: any[] = [
        { allocation_batch_id: val },
        { sub_batch: { equals: val, mode: 'insensitive' } },
      ];
      if (abIds.length > 0) allocConditions.push({ allocation_batch_id: { in: abIds } });
      if (abNames.length > 0) allocConditions.push({ sub_batch: { in: abNames } });

      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: allocConditions },
        ];
        delete where.OR;
      } else {
        where.OR = allocConditions;
      }
    }

    if (department) {
      where.department = { equals: department.trim(), mode: 'insensitive' };
    }

    if (academicYear) {
      const years = academicYear.replace('–', '-').split('-');
      if (years.length === 2) {
        const start = parseInt(years[0].trim(), 10);
        const end = parseInt(years[1].trim(), 10);
        where.batch = {
          start_year: start,
          end_year: end,
        };
      }
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        batch: { select: { id: true, batch_name: true, start_year: true, end_year: true } },
        section: { select: { id: true, name: true } },
        allocation_batch: { select: { id: true, name: true } },
        staff_student_assignments: {
          include: {
            staff: { select: { id: true, name: true } },
          },
        },
        snapshots: {
          select: { snapshot_date: true, easy_solved: true, medium_solved: true, hard_solved: true, total_solved: true },
          orderBy: { snapshot_date: 'asc' },
        },
      },
      orderBy: { register_number: 'asc' },
    });

    const isPeriodFilter = !!(fromDate || toDate);

    studentsList = students.map((st) => {
      const stats = calculateStudentPeriodStats(st.snapshots, isPeriodFilter, fromDate, toDate);
      const mentor_name = st.staff_student_assignments?.[0]?.staff?.name || 'Unassigned';

      return {
        id: st.id,
        register_number: st.register_number,
        name: st.name,
        department: st.department,
        leetcode_username: st.leetcode_username,
        mentor_name,
        batch_id: st.batch_id,
        section_id: st.section_id,
        allocation_batch_id: st.allocation_batch_id,
        batch: {
          id: st.batch.id,
          batch_name: st.batch.batch_name,
          academicYear: `${st.batch.start_year}–${st.batch.end_year}`,
        },
        section: { id: st.section.id, name: st.section.name },
        allocation_batch: st.allocation_batch
          ? { id: st.allocation_batch.id, name: st.allocation_batch.name }
          : (st.sub_batch ? { id: st.sub_batch, name: st.sub_batch } : null),
        easy_solved: stats.easy_solved,
        medium_solved: stats.medium_solved,
        hard_solved: stats.hard_solved,
        total_solved: stats.total_solved,
        overall_easy: stats.overall_easy,
        overall_medium: stats.overall_medium,
        overall_hard: stats.overall_hard,
        overall_total: stats.overall_total,
        has_activity: stats.has_activity,
      };
    });
  }

  // Apply Activity Status Filter
  if (activityStatus === 'active') {
    studentsList = studentsList.filter((st) => st.has_activity);
  } else if (activityStatus === 'no_activity') {
    studentsList = studentsList.filter((st) => !st.has_activity);
  }

  // Apply Sorting
  studentsList.sort((a, b) => {
    if (sortBy === ('register_number' as any) || sortBy === ('reg_no' as any)) {
      const cmp = a.register_number.localeCompare(b.register_number, undefined, { numeric: true });
      return sortOrder === 'asc' ? cmp : -cmp;
    }
    if (sortBy === ('name' as any)) {
      const cmp = a.name.localeCompare(b.name);
      return sortOrder === 'asc' ? cmp : -cmp;
    }

    let keyA = 0;
    let keyB = 0;

    if (sortBy === 'easy') {
      keyA = a.easy_solved;
      keyB = b.easy_solved;
    } else if (sortBy === 'medium') {
      keyA = a.medium_solved;
      keyB = b.medium_solved;
    } else if (sortBy === 'hard') {
      keyA = a.hard_solved;
      keyB = b.hard_solved;
    } else {
      keyA = a.total_solved;
      keyB = b.total_solved;
    }

    if (keyA !== keyB) {
      return sortOrder === 'asc' ? keyA - keyB : keyB - keyA;
    }

    return a.register_number.localeCompare(b.register_number, undefined, { numeric: true });
  });

  // Calculate Summary Analytics
  const totalStudents = studentsList.length;
  const activeStudentsCount = studentsList.filter((st) => st.has_activity).length;
  const noActivityCount = totalStudents - activeStudentsCount;
  const totalEasy = studentsList.reduce((acc, curr) => acc + curr.easy_solved, 0);
  const totalMedium = studentsList.reduce((acc, curr) => acc + curr.medium_solved, 0);
  const totalHard = studentsList.reduce((acc, curr) => acc + curr.hard_solved, 0);
  const totalProblems = totalEasy + totalMedium + totalHard;

  const overallTotalEasy = studentsList.reduce((acc, curr) => acc + (curr.overall_easy || 0), 0);
  const overallTotalMedium = studentsList.reduce((acc, curr) => acc + (curr.overall_medium || 0), 0);
  const overallTotalHard = studentsList.reduce((acc, curr) => acc + (curr.overall_hard || 0), 0);
  const overallTotalProblems = overallTotalEasy + overallTotalMedium + overallTotalHard;

  return {
    summary: {
      totalStudents,
      activeStudentsCount,
      noActivityCount,
      totalProblems,
      totalEasy,
      totalMedium,
      totalHard,
      overallTotalProblems,
      overallTotalEasy,
      overallTotalMedium,
      overallTotalHard,
    },
    students: studentsList,
  };
}

export async function getStudentDailyProgress(
  studentId: string,
  user: { userId: string; role: UserRole },
  filters?: { fromDate?: string; toDate?: string }
) {
  if (user.role === 'STAFF') {
    const isAuth = await isStaffAuthorizedForStudent(user.userId, studentId);
    if (!isAuth) {
      const err: any = new Error('Forbidden: You are not authorized to view daily progress for this student');
      err.statusCode = 403;
      throw err;
    }
  }

  if (!process.env.DATABASE_URL) {
    const st = inMemoryStore.students.find((s) => s.id === studentId);
    let snaps = inMemoryStore.snapshots.filter((s) => s.student_id === studentId);
    if (filters?.fromDate) {
      snaps = snaps.filter((s) => new Date(s.snapshot_date) >= new Date(filters.fromDate!));
    }
    if (filters?.toDate) {
      snaps = snaps.filter((s) => new Date(s.snapshot_date) <= new Date(filters.toDate!));
    }
    snaps.sort((a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime());
    return {
      student: st ? { id: st.id, register_number: st.register_number, name: st.name } : null,
      snapshots: snaps,
    };
  }

  const st = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, register_number: true, name: true },
  });

  const where: any = { student_id: studentId };
  if (filters?.fromDate) {
    where.snapshot_date = { gte: new Date(filters.fromDate) };
  }
  if (filters?.toDate) {
    where.snapshot_date = { ...where.snapshot_date, lte: new Date(filters.toDate) };
  }

  const rawSnapshots = await prisma.dailyCodingSnapshot.findMany({
    where: { student_id: studentId },
    orderBy: { snapshot_date: 'desc' },
  });

  let snapshots = fillContinuousSnapshotTimeline(rawSnapshots);
  if (filters?.fromDate) {
    const fStr = toISTDateString(filters.fromDate);
    snapshots = snapshots.filter((s) => toISTDateString(s.snapshot_date) >= fStr);
  }
  if (filters?.toDate) {
    const tStr = toISTDateString(filters.toDate);
    snapshots = snapshots.filter((s) => toISTDateString(s.snapshot_date) <= tStr);
  }

  return { student: st, snapshots };
}

export function buildReportFileName(filters: ReportFilterParams, ext: 'csv' | 'xlsx' = 'csv'): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const todayStr = formatDate(now);

  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const yesterdayStr = formatDate(yest);

  const d7 = new Date(now);
  d7.setDate(d7.getDate() - 7);
  const last7Str = formatDate(d7);

  const d30 = new Date(now);
  d30.setDate(d30.getDate() - 30);
  const last30Str = formatDate(d30);

  const from = filters.fromDate ? filters.fromDate.trim() : '';
  const to = filters.toDate ? filters.toDate.trim() : '';

  let periodTag = 'all-time';

  if (!from && !to) {
    periodTag = 'all-time';
  } else if (from === todayStr && (to === todayStr || !to)) {
    periodTag = 'today';
  } else if (from === yesterdayStr && (to === yesterdayStr || !to)) {
    periodTag = 'yesterday';
  } else if (from === last7Str && (to === todayStr || !to)) {
    periodTag = 'last-7-days';
  } else if (from === last30Str && (to === todayStr || !to)) {
    periodTag = 'last-30-days';
  } else if (from || to) {
    periodTag = 'custom';
  }

  return `coding_report_${dateStr}_${periodTag}.${ext}`;
}

export async function exportExcelReport(
  filters: ReportFilterParams,
  user: { userId: string; role: UserRole }
) {
  const reportData = await getReportData(filters, user);
  const fileName = buildReportFileName(filters, 'xlsx');
  const isPeriodFilter = !!(filters.fromDate || filters.toDate);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Coding Progress Tracker';
  workbook.lastModifiedBy = 'Coding Progress Tracker';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Coding Leaderboard Report', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  if (isPeriodFilter) {
    worksheet.columns = [
      { header: 'Rank', key: 'rank', width: 8 },
      { header: 'Academic Year', key: 'academic_year', width: 16 },
      { header: 'Department', key: 'department', width: 16 },
      { header: 'Section', key: 'section', width: 14 },
      { header: 'Allocation Batch', key: 'allocation_batch', width: 18 },
      { header: 'Mentor', key: 'mentor', width: 22 },
      { header: 'Register No', key: 'register_no', width: 18 },
      { header: 'Student Name', key: 'student_name', width: 26 },
      { header: 'LeetCode ID', key: 'leetcode_id', width: 20 },
      { header: 'Period Easy', key: 'period_easy', width: 14 },
      { header: 'Period Medium', key: 'period_medium', width: 16 },
      { header: 'Period Hard', key: 'period_hard', width: 14 },
      { header: 'Period Total', key: 'period_total', width: 14 },
      { header: 'Overall Easy', key: 'overall_easy', width: 14 },
      { header: 'Overall Medium', key: 'overall_medium', width: 16 },
      { header: 'Overall Hard', key: 'overall_hard', width: 14 },
      { header: 'Overall Total', key: 'overall_total', width: 14 },
    ];

    reportData.students.forEach((st, index) => {
      worksheet.addRow({
        rank: index + 1,
        academic_year: st.batch.academicYear || st.batch.batch_name,
        department: st.department,
        section: st.section.name,
        allocation_batch: st.allocation_batch ? st.allocation_batch.name : '-',
        mentor: st.mentor_name || 'Unassigned',
        register_no: st.register_number,
        student_name: st.name,
        leetcode_id: st.leetcode_username || '-',
        period_easy: st.easy_solved,
        period_medium: st.medium_solved,
        period_hard: st.hard_solved,
        period_total: st.total_solved,
        overall_easy: st.overall_easy !== undefined ? st.overall_easy : st.easy_solved,
        overall_medium: st.overall_medium !== undefined ? st.overall_medium : st.medium_solved,
        overall_hard: st.overall_hard !== undefined ? st.overall_hard : st.hard_solved,
        overall_total: st.overall_total !== undefined ? st.overall_total : st.total_solved,
      });
    });
  } else {
    worksheet.columns = [
      { header: 'Rank', key: 'rank', width: 8 },
      { header: 'Academic Year', key: 'academic_year', width: 16 },
      { header: 'Department', key: 'department', width: 16 },
      { header: 'Section', key: 'section', width: 14 },
      { header: 'Allocation Batch', key: 'allocation_batch', width: 18 },
      { header: 'Mentor', key: 'mentor', width: 22 },
      { header: 'Register No', key: 'register_no', width: 18 },
      { header: 'Student Name', key: 'student_name', width: 26 },
      { header: 'LeetCode ID', key: 'leetcode_id', width: 20 },
      { header: 'Easy Solved', key: 'easy_solved', width: 14 },
      { header: 'Medium Solved', key: 'medium_solved', width: 16 },
      { header: 'Hard Solved', key: 'hard_solved', width: 14 },
      { header: 'Total Solved', key: 'total_solved', width: 14 },
    ];

    reportData.students.forEach((st, index) => {
      worksheet.addRow({
        rank: index + 1,
        academic_year: st.batch.academicYear || st.batch.batch_name,
        department: st.department,
        section: st.section.name,
        allocation_batch: st.allocation_batch ? st.allocation_batch.name : '-',
        mentor: st.mentor_name || 'Unassigned',
        register_no: st.register_number,
        student_name: st.name,
        leetcode_id: st.leetcode_username || '-',
        easy_solved: st.overall_easy !== undefined ? st.overall_easy : st.easy_solved,
        medium_solved: st.overall_medium !== undefined ? st.overall_medium : st.medium_solved,
        hard_solved: st.overall_hard !== undefined ? st.overall_hard : st.hard_solved,
        total_solved: st.overall_total !== undefined ? st.overall_total : st.total_solved,
      });
    });
  }

  // Format Header Row (Row 1)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Dark slate navy
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    };
  });

  // Auto-fit dynamic column widths based on longest string + generous padding
  const minWidthMap: Record<string, number> = {
    rank: 14,
    academic_year: 18,
    department: 18,
    section: 16,
    allocation_batch: 20,
    mentor: 26,
    register_no: 22,
    student_name: 32,
    leetcode_id: 26,
    easy_solved: 16,
    medium_solved: 18,
    hard_solved: 16,
    total_solved: 16,
    period_easy: 18,
    period_medium: 18,
    period_hard: 18,
    period_total: 18,
    overall_easy: 18,
    overall_medium: 18,
    overall_hard: 18,
    overall_total: 18,
  };

  worksheet.columns.forEach((column) => {
    const colKey = (column.key as string) || '';
    const minWidth = minWidthMap[colKey] || 16;
    let maxLength = column.header ? column.header.toString().length : 12;

    column.eachCell?.({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber > 1) {
        const valStr = cell.value !== null && cell.value !== undefined ? cell.value.toString() : '';
        if (valStr.length > maxLength) {
          maxLength = valStr.length;
        }
      }
    });

    // Add +6 padding and enforce generous minimum column width (at least 14)
    column.width = Math.max(maxLength + 6, minWidth, 14);
  });

  // Format Data Rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 22;
    const isEven = rowNumber % 2 === 0;

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF1E293B' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      // Alignment logic based on column key
      const colKey = worksheet.getColumn(colNumber).key;
      if (colKey === 'rank' || colKey === 'academic_year' || colKey === 'section') {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colKey === 'register_no') {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.numFmt = '@'; // Force text format
      } else if (
        colKey === 'easy_solved' ||
        colKey === 'medium_solved' ||
        colKey === 'hard_solved' ||
        colKey === 'total_solved' ||
        colKey === 'period_easy' ||
        colKey === 'period_medium' ||
        colKey === 'period_hard' ||
        colKey === 'period_total' ||
        colKey === 'overall_easy' ||
        colKey === 'overall_medium' ||
        colKey === 'overall_hard' ||
        colKey === 'overall_total'
      ) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0';
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();

  // Save audit log
  if (!process.env.DATABASE_URL) {
    inMemoryStore.generatedReports.push({
      id: `rep_${Date.now()}`,
      file_name: fileName,
      generated_by_staff_id: user.userId,
      report_type: 'EXCEL',
      generated_at: new Date(),
    });
  } else {
    const staffUser = await prisma.user.findUnique({ where: { id: user.userId } });
    const staffIdToSave = staffUser ? staffUser.id : (await prisma.user.findFirst({ where: { role: 'ADMIN' } }))?.id;

    if (staffIdToSave) {
      await prisma.generatedReport.create({
        data: {
          file_name: fileName,
          generated_by_staff_id: staffIdToSave,
          report_type: 'EXCEL',
        },
      });
    }
  }

  return {
    fileName,
    buffer,
    report: { file_name: fileName },
    totalRecords: reportData.students.length,
  };
}

export async function exportCsvReport(
  filters: ReportFilterParams,
  user: { userId: string; role: UserRole }
) {
  const reportData = await getReportData(filters, user);

  const fileName = buildReportFileName(filters, 'csv');

  const isPeriodFilter = !!(filters.fromDate || filters.toDate);

  let csvContent = '';

  if (isPeriodFilter) {
    csvContent = 'Rank,Academic Year,Department,Section,Allocation Batch,Mentor,Register No,Student Name,LeetCode ID,Period Easy,Period Medium,Period Hard,Period Total,Overall Easy,Overall Medium,Overall Hard,Overall Total\n';
    reportData.students.forEach((st, index) => {
      const row = [
        index + 1,
        `"${st.batch.academicYear || st.batch.batch_name}"`,
        `"${st.department}"`,
        `"${st.section.name}"`,
        `"${st.allocation_batch ? st.allocation_batch.name : ''}"`,
        `"${st.mentor_name || 'Unassigned'}"`,
        `"${st.register_number}"`,
        `"${st.name}"`,
        `"${st.leetcode_username || ''}"`,
        st.easy_solved,
        st.medium_solved,
        st.hard_solved,
        st.total_solved,
        st.overall_easy !== undefined ? st.overall_easy : st.easy_solved,
        st.overall_medium !== undefined ? st.overall_medium : st.medium_solved,
        st.overall_hard !== undefined ? st.overall_hard : st.hard_solved,
        st.overall_total !== undefined ? st.overall_total : st.total_solved,
      ].join(',');
      csvContent += row + '\n';
    });
  } else {
    csvContent = 'Rank,Academic Year,Department,Section,Allocation Batch,Mentor,Register No,Student Name,LeetCode ID,Easy Solved,Medium Solved,Hard Solved,Total Solved\n';
    reportData.students.forEach((st, index) => {
      const row = [
        index + 1,
        `"${st.batch.academicYear || st.batch.batch_name}"`,
        `"${st.department}"`,
        `"${st.section.name}"`,
        `"${st.allocation_batch ? st.allocation_batch.name : ''}"`,
        `"${st.mentor_name || 'Unassigned'}"`,
        `"${st.register_number}"`,
        `"${st.name}"`,
        `"${st.leetcode_username || ''}"`,
        st.overall_easy !== undefined ? st.overall_easy : st.easy_solved,
        st.overall_medium !== undefined ? st.overall_medium : st.medium_solved,
        st.overall_hard !== undefined ? st.overall_hard : st.hard_solved,
        st.overall_total !== undefined ? st.overall_total : st.total_solved,
      ].join(',');
      csvContent += row + '\n';
    });
  }

  if (!process.env.DATABASE_URL) {
    inMemoryStore.generatedReports.push({
      id: `rep_${Date.now()}`,
      file_name: fileName,
      generated_by_staff_id: user.userId,
      report_type: 'CSV',
      generated_at: new Date(),
    });
  } else {
    const staffUser = await prisma.user.findUnique({ where: { id: user.userId } });
    const staffIdToSave = staffUser ? staffUser.id : (await prisma.user.findFirst({ where: { role: 'ADMIN' } }))?.id;

    if (staffIdToSave) {
      await prisma.generatedReport.create({
        data: {
          file_name: fileName,
          generated_by_staff_id: staffIdToSave,
          report_type: 'CSV',
        },
      });
    }
  }

  return {
    fileName,
    csvContent,
    content: csvContent,
    report: { file_name: fileName },
    totalRecords: reportData.students.length,
  };
}

export async function getReportsList(user: { userId: string; role: UserRole }) {
  if (!process.env.DATABASE_URL) {
    const reps = inMemoryStore.generatedReports || [];
    if (user.role === 'STAFF') {
      return reps.filter((r: any) => r.generated_by_staff_id === user.userId);
    }
    return reps;
  }

  const where: any = {};
  if (user.role === 'STAFF') {
    where.generated_by_staff_id = user.userId;
  }

  const list = await prisma.generatedReport.findMany({
    where,
    orderBy: { generated_at: 'desc' },
  });

  return list;
}

export async function deleteReport(
  reportId: string,
  user: { userId: string; role: UserRole }
): Promise<{ message: string }> {
  if (!process.env.DATABASE_URL) {
    const idx = inMemoryStore.generatedReports.findIndex((r: any) => r.id === reportId);
    if (idx === -1) {
      const err: any = new Error('Report not found');
      err.statusCode = 404;
      throw err;
    }
    const rep = inMemoryStore.generatedReports[idx];
    if (user.role !== 'ADMIN' && rep.generated_by_staff_id !== user.userId) {
      const err: any = new Error('Forbidden: You can only delete your own generated reports');
      err.statusCode = 403;
      throw err;
    }
    inMemoryStore.generatedReports.splice(idx, 1);
    return { message: 'Report audit entry deleted successfully.' };
  }

  const existing = await prisma.generatedReport.findUnique({ where: { id: reportId } });
  if (!existing) {
    const err: any = new Error('Report not found');
    err.statusCode = 404;
    throw err;
  }
  if (user.role !== 'ADMIN' && existing.generated_by_staff_id !== user.userId) {
    const err: any = new Error('Forbidden: You can only delete your own generated reports');
    err.statusCode = 403;
    throw err;
  }

  await prisma.generatedReport.delete({ where: { id: reportId } });
  return { message: 'Report audit entry deleted successfully.' };
}

export async function bulkDeleteReports(
  reportIds: string[],
  user: { userId: string; role: UserRole }
): Promise<{ message: string; count: number }> {
  if (!reportIds || reportIds.length === 0) {
    return { message: 'No reports selected for deletion.', count: 0 };
  }

  if (!process.env.DATABASE_URL) {
    let deletedCount = 0;
    inMemoryStore.generatedReports = inMemoryStore.generatedReports.filter((r: any) => {
      if (reportIds.includes(r.id)) {
        if (user.role === 'ADMIN' || r.generated_by_staff_id === user.userId) {
          deletedCount++;
          return false;
        }
      }
      return true;
    });
    return { message: `Successfully deleted ${deletedCount} report audit log(s).`, count: deletedCount };
  }

  const where: any = {
    id: { in: reportIds },
  };
  if (user.role !== 'ADMIN') {
    where.generated_by_staff_id = user.userId;
  }

  const result = await prisma.generatedReport.deleteMany({ where });
  return { message: `Successfully deleted ${result.count} report audit log(s).`, count: result.count };
}

export async function clearAllReports(
  user: { userId: string; role: UserRole }
): Promise<{ message: string; count: number }> {
  if (!process.env.DATABASE_URL) {
    let deletedCount = 0;
    if (user.role === 'ADMIN') {
      deletedCount = inMemoryStore.generatedReports.length;
      inMemoryStore.generatedReports = [];
    } else {
      inMemoryStore.generatedReports = inMemoryStore.generatedReports.filter((r: any) => {
        if (r.generated_by_staff_id === user.userId) {
          deletedCount++;
          return false;
        }
        return true;
      });
    }
    return { message: `Cleared ${deletedCount} report audit log(s).`, count: deletedCount };
  }

  const where: any = {};
  if (user.role !== 'ADMIN') {
    where.generated_by_staff_id = user.userId;
  }

  const result = await prisma.generatedReport.deleteMany({ where });
  return { message: `Cleared ${result.count} report audit log(s).`, count: result.count };
}

// Aliases for controller compatibility
export const getReportFilters = getReportFilterOptions;
export const generateReport = exportCsvReport;
export const listReportsForUser = getReportsList;
