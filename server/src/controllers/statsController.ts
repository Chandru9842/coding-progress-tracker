import { Response } from 'express';
import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { AuthenticatedRequest } from '../types/index.js';
import { getBatchesForStaff } from '../services/batchService.js';
import { getAuthorizedStudentIdsForStaff } from '../services/studentAuthorizationService.js';
import { serverCache } from '../utils/serverCache.js';
import { toISTDateString } from '../services/reportService.js';
import { getISTDateString } from '../services/leetcodeService.js';

export interface DashboardFilters {
  department?: string;
  batchId?: string;
  sectionId?: string;
  allocationBatchId?: string;
  mentorId?: string;
  currentYear?: string;
}

async function computeLeetCodeDashboardStats(
  user: { userId: string; role: 'ADMIN' | 'STAFF' },
  filters?: DashboardFilters
) {
  const todayISTStr = getISTDateString(0);
  const yesterdayISTStr = getISTDateString(-1);

  if (!process.env.DATABASE_URL) {
    let studentList = inMemoryStore.students.filter((s) => s.leetcode_username);

    if (user.role === 'STAFF') {
      const authIds = await getAuthorizedStudentIdsForStaff(user.userId);
      const authSet = new Set(authIds);
      studentList = studentList.filter((s) => authSet.has(s.id));
    }

    if (filters?.department) {
      const d = filters.department.trim().toLowerCase();
      studentList = studentList.filter((s) => s.department && s.department.toLowerCase().includes(d));
    }
    if (filters?.batchId) {
      studentList = studentList.filter((s) => s.batch_id === filters.batchId);
    }
    if (filters?.sectionId) {
      studentList = studentList.filter((s) => s.section_id === filters.sectionId);
    }
    if (filters?.allocationBatchId) {
      const val = filters.allocationBatchId.trim().toLowerCase();
      studentList = studentList.filter((s) => {
        if (s.allocation_batch_id === filters.allocationBatchId) return true;
        if (s.sub_batch && s.sub_batch.toLowerCase() === val) return true;
        const ab = inMemoryStore.allocationBatches.find((a) => a.id === s.allocation_batch_id);
        return ab && ab.name.toLowerCase() === val;
      });
    }
    if (filters?.mentorId) {
      if (filters.mentorId === 'UNASSIGNED' || filters.mentorId === 'NONE') {
        const assignedIds = new Set(inMemoryStore.staffStudentAssignments.map((a) => a.student_id));
        studentList = studentList.filter((s) => !assignedIds.has(s.id) && !s.mentor_id);
      } else {
        const mentorAssignments = inMemoryStore.staffStudentAssignments
          .filter((a) => a.staff_id === filters.mentorId)
          .map((a) => a.student_id);
        const mSet = new Set(mentorAssignments);
        studentList = studentList.filter((s) => mSet.has(s.id) || s.mentor_id === filters.mentorId);
      }
    }
    if (filters?.currentYear) {
      const yr = filters.currentYear.trim().toLowerCase();
      studentList = studentList.filter((s) => (s.current_year || '').toLowerCase().includes(yr));
    }

    let totalSolved = 0;
    let easySolved = 0;
    let mediumSolved = 0;
    let hardSolved = 0;
    let todaySolved = 0;
    let activeCoders = 0;
    const studentStatsList: any[] = [];

    for (const st of studentList) {
      const stSnaps = inMemoryStore.snapshots
        .filter((s) => s.student_id === st.id)
        .sort((a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime());

      const latest = stSnaps[0];
      const tSolved = latest?.total_solved || 0;
      const eSolved = latest?.easy_solved || 0;
      const mSolved = latest?.medium_solved || 0;
      const hSolved = latest?.hard_solved || 0;

      if (tSolved > 0) activeCoders++;
      totalSolved += tSolved;
      easySolved += eSolved;
      mediumSolved += mSolved;
      hardSolved += hSolved;

      const todaySnap = stSnaps.find((s) => toISTDateString(s.snapshot_date) === todayISTStr);
      const yesterdaySnap = stSnaps.find((s) => toISTDateString(s.snapshot_date) === yesterdayISTStr);
      if (todaySnap && yesterdaySnap) {
        todaySolved += Math.max(0, todaySnap.total_solved - yesterdaySnap.total_solved);
      }

      const batch = inMemoryStore.batches.find((b) => b.id === st.batch_id);
      const ssa = inMemoryStore.staffStudentAssignments.find((a) => a.student_id === st.id);
      const mentorUser = ssa ? inMemoryStore.users.find((u) => u.id === ssa.staff_id) : null;

      studentStatsList.push({
        id: st.id,
        name: st.name,
        register_number: st.register_number,
        leetcode_username: st.leetcode_username,
        department: st.department,
        batch_name: batch?.batch_name || 'Batch',
        mentor_name: mentorUser?.name || undefined,
        total_solved: tSolved,
        easy_solved: eSolved,
        medium_solved: mSolved,
        hard_solved: hSolved,
      });
    }

    studentStatsList.sort((a, b) => b.total_solved - a.total_solved);
    const topCoders = studentStatsList.slice(0, 5);

    return {
      totalSolved,
      easySolved,
      mediumSolved,
      hardSolved,
      todaySolved,
      activeCoders,
      totalCoders: studentList.length,
      topCoders,
    };
  }

  // Database Mode (PostgreSQL via Prisma)
  const where: any = {};

  if (user.role === 'STAFF') {
    const authorizedStudentIds = await getAuthorizedStudentIdsForStaff(user.userId);
    if (authorizedStudentIds.length === 0) {
      return {
        totalSolved: 0,
        easySolved: 0,
        mediumSolved: 0,
        hardSolved: 0,
        todaySolved: 0,
        activeCoders: 0,
        totalCoders: 0,
        topCoders: [],
      };
    }
    where.id = { in: authorizedStudentIds };
  }

  if (filters?.department) {
    where.department = { contains: filters.department.trim(), mode: 'insensitive' };
  }
  if (filters?.batchId) {
    where.batch_id = filters.batchId;
  }
  if (filters?.sectionId) {
    where.section_id = filters.sectionId;
  }
  if (filters?.allocationBatchId) {
    const val = filters.allocationBatchId.trim();
    where.OR = [
      { allocation_batch_id: val },
      { allocation_batch: { name: { equals: val, mode: 'insensitive' } } },
      { sub_batch: { equals: val, mode: 'insensitive' } },
    ];
  }
  if (filters?.mentorId) {
    if (filters.mentorId === 'UNASSIGNED' || filters.mentorId === 'NONE') {
      where.staff_student_assignments = { none: {} };
    } else {
      where.staff_student_assignments = { some: { staff_id: filters.mentorId } };
    }
  }
  if (filters?.currentYear) {
    where.current_year = { contains: filters.currentYear.trim(), mode: 'insensitive' };
  }

  const students = await prisma.student.findMany({
    where,
    select: {
      id: true,
      name: true,
      register_number: true,
      leetcode_username: true,
      department: true,
      batch: { select: { batch_name: true } },
      staff_student_assignments: {
        include: {
          staff: { select: { id: true, name: true } },
        },
      },
      snapshots: {
        orderBy: { snapshot_date: 'desc' },
        take: 3,
        select: {
          snapshot_date: true,
          total_solved: true,
          easy_solved: true,
          medium_solved: true,
          hard_solved: true,
        },
      },
    },
  });

  let totalSolved = 0;
  let easySolved = 0;
  let mediumSolved = 0;
  let hardSolved = 0;
  let todaySolved = 0;
  let activeCoders = 0;
  const studentStatsList: any[] = [];

  for (const st of students) {
    const latest = st.snapshots[0];
    const tSolved = latest?.total_solved || 0;
    const eSolved = latest?.easy_solved || 0;
    const mSolved = latest?.medium_solved || 0;
    const hSolved = latest?.hard_solved || 0;

    if (tSolved > 0) activeCoders++;
    totalSolved += tSolved;
    easySolved += eSolved;
    mediumSolved += mSolved;
    hardSolved += hSolved;

    const todaySnap = st.snapshots.find((s) => toISTDateString(s.snapshot_date) === todayISTStr);
    const yesterdaySnap = st.snapshots.find((s) => toISTDateString(s.snapshot_date) === yesterdayISTStr);
    if (todaySnap && yesterdaySnap) {
      todaySolved += Math.max(0, todaySnap.total_solved - yesterdaySnap.total_solved);
    }

    const mentorName = st.staff_student_assignments?.[0]?.staff?.name;

    if (st.leetcode_username) {
      studentStatsList.push({
        id: st.id,
        name: st.name,
        register_number: st.register_number,
        leetcode_username: st.leetcode_username,
        department: st.department,
        batch_name: st.batch?.batch_name || 'Batch',
        mentor_name: mentorName || undefined,
        total_solved: tSolved,
        easy_solved: eSolved,
        medium_solved: mSolved,
        hard_solved: hSolved,
      });
    }
  }

  studentStatsList.sort((a, b) => b.total_solved - a.total_solved);
  const topCoders = studentStatsList.slice(0, 5);

  return {
    totalSolved,
    easySolved,
    mediumSolved,
    hardSolved,
    todaySolved,
    activeCoders,
    totalCoders: students.length,
    topCoders,
  };
}

export async function getDashboardStats(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      department,
      batchId,
      sectionId,
      allocationBatchId,
      mentorId,
      currentYear,
    } = req.query as Record<string, string | undefined>;

    // Staff auto-default:
    // If user is STAFF and NO mentorId was explicitly supplied,
    // default to their own ID if they have directly mentored students
    let effectiveMentorId = mentorId;
    if (req.user.role === 'STAFF' && effectiveMentorId === undefined) {
      let staffMentoredCount = 0;
      if (!process.env.DATABASE_URL) {
        staffMentoredCount = inMemoryStore.staffStudentAssignments.filter(
          (a) => a.staff_id === req.user!.userId
        ).length;
      } else {
        staffMentoredCount = await prisma.staffStudentAssignment.count({
          where: { staff_id: req.user.userId },
        });
      }
      if (staffMentoredCount > 0) {
        effectiveMentorId = req.user.userId;
      }
    }

    const filters: DashboardFilters = {
      department: department?.trim() || undefined,
      batchId: batchId?.trim() || undefined,
      sectionId: sectionId?.trim() || undefined,
      allocationBatchId: allocationBatchId?.trim() || undefined,
      mentorId: (effectiveMentorId && effectiveMentorId !== 'ALL') ? effectiveMentorId.trim() : undefined,
      currentYear: currentYear?.trim() || undefined,
    };

    const filterHash = JSON.stringify(filters);
    const cacheKey = `stats_${req.user.role}_${req.user.userId}_${filterHash}`;

    const stats = await serverCache.wrap(cacheKey, 15000, async () => {
      const leetcodeStats = await computeLeetCodeDashboardStats(
        { userId: req.user!.userId, role: req.user!.role as 'ADMIN' | 'STAFF' },
        filters
      );

      if (req.user!.role === 'ADMIN') {
        let totalStaff = 0;
        let activeStaff = 0;
        let totalBatches = 0;

        if (!process.env.DATABASE_URL) {
          totalStaff = inMemoryStore.users.filter((u) => u.role === 'STAFF').length;
          activeStaff = inMemoryStore.users.filter((u) => u.role === 'STAFF' && u.is_active).length;
          totalBatches = inMemoryStore.batches.length;
        } else {
          const [tStaff, aStaff, tBatches] = await Promise.all([
            prisma.user.count({ where: { role: 'STAFF' } }),
            prisma.user.count({ where: { role: 'STAFF', is_active: true } }),
            prisma.batch.count(),
          ]);
          totalStaff = tStaff;
          activeStaff = aStaff;
          totalBatches = tBatches;
        }

        return {
          role: 'ADMIN',
          totalStaff,
          activeStaff,
          totalBatches,
          totalStudents: leetcodeStats.totalCoders,
          activeFilters: { ...filters, mentorId: effectiveMentorId },
          leetcodeStats,
        };
      } else {
        const assignedBatches = await getBatchesForStaff(req.user!.userId);

        return {
          role: 'STAFF',
          assignedBatchesCount: assignedBatches.length,
          totalStudentsInAssignedBatches: leetcodeStats.totalCoders,
          activeFilters: { ...filters, mentorId: effectiveMentorId },
          leetcodeStats,
        };
      }
    });

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve dashboard statistics' });
  }
}

