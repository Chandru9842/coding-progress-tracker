import { Response } from 'express';
import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { AuthenticatedRequest } from '../types/index.js';
import { getBatchesForStaff } from '../services/batchService.js';
import { getAuthorizedStudentIdsForStaff } from '../services/studentAuthorizationService.js';
import { serverCache } from '../utils/serverCache.js';
import { toISTDateString } from '../services/reportService.js';
import { getISTDateString } from '../services/leetcodeService.js';

async function computeLeetCodeDashboardStats(authorizedStudentIds?: string[] | null) {
  const todayISTStr = getISTDateString(0);
  const yesterdayISTStr = getISTDateString(-1);

  if (authorizedStudentIds && authorizedStudentIds.length === 0) {
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

  if (!process.env.DATABASE_URL) {
    let studentList = inMemoryStore.students.filter((s) => s.leetcode_username);
    if (authorizedStudentIds) {
      const idSet = new Set(authorizedStudentIds);
      studentList = studentList.filter((s) => idSet.has(s.id));
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
      studentStatsList.push({
        id: st.id,
        name: st.name,
        register_number: st.register_number,
        leetcode_username: st.leetcode_username,
        department: st.department,
        batch_name: batch?.batch_name || 'Batch',
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

  // Database Mode
  const where: any = { leetcode_username: { not: null } };
  if (authorizedStudentIds && authorizedStudentIds.length > 0) {
    where.id = { in: authorizedStudentIds };
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

    studentStatsList.push({
      id: st.id,
      name: st.name,
      register_number: st.register_number,
      leetcode_username: st.leetcode_username,
      department: st.department,
      batch_name: st.batch?.batch_name || 'Batch',
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

    const cacheKey = `stats_${req.user.role}_${req.user.userId}`;
    const stats = await serverCache.wrap(cacheKey, 15000, async () => {
      if (req.user!.role === 'ADMIN') {
        let totalStaff = 0;
        let activeStaff = 0;
        let totalBatches = 0;
        let totalStudents = 0;

        if (!process.env.DATABASE_URL) {
          totalStaff = inMemoryStore.users.filter((u) => u.role === 'STAFF').length;
          activeStaff = inMemoryStore.users.filter((u) => u.role === 'STAFF' && u.is_active).length;
          totalBatches = inMemoryStore.batches.length;
          totalStudents = inMemoryStore.students.length;
        } else {
          const [tStaff, aStaff, tBatches, tStudents] = await Promise.all([
            prisma.user.count({ where: { role: 'STAFF' } }),
            prisma.user.count({ where: { role: 'STAFF', is_active: true } }),
            prisma.batch.count(),
            prisma.student.count(),
          ]);
          totalStaff = tStaff;
          activeStaff = aStaff;
          totalBatches = tBatches;
          totalStudents = tStudents;
        }

        const leetcodeStats = await computeLeetCodeDashboardStats(null);

        return {
          role: 'ADMIN',
          totalStaff,
          activeStaff,
          totalBatches,
          totalStudents,
          leetcodeStats,
        };
      } else {
        const [assignedBatches, authorizedStudentIds] = await Promise.all([
          getBatchesForStaff(req.user!.userId),
          getAuthorizedStudentIdsForStaff(req.user!.userId),
        ]);

        const leetcodeStats = await computeLeetCodeDashboardStats(authorizedStudentIds);

        return {
          role: 'STAFF',
          assignedBatchesCount: assignedBatches.length,
          totalStudentsInAssignedBatches: authorizedStudentIds.length,
          leetcodeStats,
        };
      }
    });

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve dashboard statistics' });
  }
}

