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

  const periodTotal = periodEasy + periodMedium + periodHard;

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

export function buildReportFileName(filters: ReportFilterParams): string {
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

  return `coding_report_${dateStr}_${periodTag}.csv`;
}

export async function exportCsvReport(
  filters: ReportFilterParams,
  user: { userId: string; role: UserRole }
) {
  const reportData = await getReportData(filters, user);

  const fileName = buildReportFileName(filters);

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

// Aliases for controller compatibility
export const getReportFilters = getReportFilterOptions;
export const generateReport = exportCsvReport;
export const listReportsForUser = getReportsList;
