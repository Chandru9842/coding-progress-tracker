import axios from 'axios';
import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { isStaffAuthorizedForStudent, getAuthorizedStudentIdsForStaff } from './studentAuthorizationService.js';
import { syncGoogleSheetLink } from './googleSheetsService.js';
import { runMidnightAutoSync } from './cronService.js';

import { UserRole } from '../types/index.js';

export interface LeetCodeStats {
  username: string;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  totalSolved: number;
  ranking?: number;
}

export function getISTDate(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
  const istDateStr = formatter.format(now); // Produces YYYY-MM-DD in IST
  return new Date(`${istDateStr}T00:00:00.000Z`);
}

// Fetch stats from LeetCode API or GraphQL endpoint with resilient fallback
export async function fetchLeetCodeStats(username: string): Promise<LeetCodeStats> {
  const cleanUsername = username.trim();

  // 1. Try Primary: Official LeetCode GraphQL Endpoint
  try {
    const gqlQuery = {
      query: `
        query getUserProfile($username: String!) {
          matchedUser(username: $username) {
            username
            submitStats {
              acSubmissionNum {
                difficulty
                count
              }
            }
            profile {
              ranking
            }
          }
        }
      `,
      variables: { username: cleanUsername },
    };

    const gqlRes = await axios.post('https://leetcode.com/graphql', gqlQuery, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': `https://leetcode.com/u/${cleanUsername}/`,
      },
      timeout: 5000,
    });

    const user = gqlRes.data?.data?.matchedUser;
    if (user && user.submitStats?.acSubmissionNum) {
      const stats = user.submitStats.acSubmissionNum;
      const easy = stats.find((s: any) => s.difficulty === 'Easy')?.count || 0;
      const medium = stats.find((s: any) => s.difficulty === 'Medium')?.count || 0;
      const hard = stats.find((s: any) => s.difficulty === 'Hard')?.count || 0;
      const total = stats.find((s: any) => s.difficulty === 'All')?.count || (easy + medium + hard);
      const ranking = user.profile?.ranking || 0;
      return {
        username: cleanUsername,
        easySolved: easy,
        mediumSolved: medium,
        hardSolved: hard,
        totalSolved: total,
        ranking,
      };
    }
  } catch (gqlErr: any) {
    console.warn(`Official LeetCode GraphQL fetch for @${cleanUsername} failed (${gqlErr.message}). Trying backup...`);
  }

  // 2. Try Secondary Backup: Alfa LeetCode Proxy
  try {
    const alfaRes = await axios.get(`https://alfa-leetcode-api.onrender.com/userProfile/${cleanUsername}`, { timeout: 4000 });
    if (alfaRes.data && typeof alfaRes.data.totalSolved === 'number') {
      return {
        username: cleanUsername,
        easySolved: alfaRes.data.easySolved || 0,
        mediumSolved: alfaRes.data.mediumSolved || 0,
        hardSolved: alfaRes.data.hardSolved || 0,
        totalSolved: alfaRes.data.totalSolved || 0,
        ranking: alfaRes.data.ranking || 0,
      };
    }
  } catch (alfaErr: any) {
    console.warn(`Alfa LeetCode proxy fetch for @${cleanUsername} failed (${alfaErr.message}).`);
  }

  // If connected to PostgreSQL database, NEVER overwrite real data with fake mock numbers
  if (process.env.DATABASE_URL) {
    const err: any = new Error(`Unable to reach live LeetCode stats endpoints for @${cleanUsername}. Please try again later.`);
    err.statusCode = 502;
    throw err;
  }

  // Resilient mock stats ONLY for offline unit testing without DB
  const hash = cleanUsername.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const easy = (hash % 80) + 20;
  const medium = (hash % 50) + 10;
  const hard = (hash % 15) + 2;
  return {
    username: cleanUsername,
    easySolved: easy,
    mediumSolved: medium,
    hardSolved: hard,
    totalSolved: easy + medium + hard,
  };
}

export async function syncStudentLeetCode(
  studentId: string,
  user: { userId: string; role: UserRole },
  options?: { skipGoogleSheetSync?: boolean }
) {
  // Authorization Check
  if (user.role === 'STAFF') {
    const isAuth = await isStaffAuthorizedForStudent(user.userId, studentId);
    if (!isAuth) {
      const err: any = new Error('Forbidden: You are not authorized to sync this student');
      err.statusCode = 403;
      throw err;
    }
  }

  let student: any = null;
  if (!process.env.DATABASE_URL) {
    student = inMemoryStore.students.find((s) => s.id === studentId);
  } else {
    student = await prisma.student.findUnique({ where: { id: studentId } });
  }

  if (!student) {
    const err: any = new Error('Student not found');
    err.statusCode = 404;
    throw err;
  }

  if (!student.leetcode_username) {
    const err: any = new Error('Student does not have a LeetCode username configured');
    err.statusCode = 400;
    throw err;
  }

  const stats = await fetchLeetCodeStats(student.leetcode_username);
  const today = getISTDate();

  let snapshot: any = null;
  if (!process.env.DATABASE_URL) {
    let existingIndex = inMemoryStore.snapshots.findIndex(
      (s) => s.student_id === studentId && new Date(s.snapshot_date).toDateString() === today.toDateString()
    );

    const snapshotObj = {
      id: existingIndex >= 0 ? inMemoryStore.snapshots[existingIndex].id : `snap_${Date.now()}_${Math.random().toString(36).substring(2,6)}`,
      student_id: studentId,
      snapshot_date: today,
      easy_solved: stats.easySolved,
      medium_solved: stats.mediumSolved,
      hard_solved: stats.hardSolved,
      total_solved: stats.totalSolved,
      created_at: new Date(),
    };

    if (existingIndex >= 0) {
      inMemoryStore.snapshots[existingIndex] = snapshotObj;
    } else {
      inMemoryStore.snapshots.push(snapshotObj);
    }
    snapshot = snapshotObj;
  } else {
    snapshot = await prisma.dailyCodingSnapshot.upsert({
      where: {
        student_id_snapshot_date: {
          student_id: studentId,
          snapshot_date: today,
        },
      },
      update: {
        easy_solved: stats.easySolved,
        medium_solved: stats.mediumSolved,
        hard_solved: stats.hardSolved,
        total_solved: stats.totalSolved,
      },
      create: {
        student_id: studentId,
        snapshot_date: today,
        easy_solved: stats.easySolved,
        medium_solved: stats.mediumSolved,
        hard_solved: stats.hardSolved,
        total_solved: stats.totalSolved,
      },
    });
  }

  // Trigger Google Sheet update for active links covering this student's batch with Failure Isolation (only if not deferred)
  if (!options?.skipGoogleSheetSync) {
    try {
      const activeLinks = !process.env.DATABASE_URL
        ? inMemoryStore.googleSheetLinks.filter((l) => l.is_active && l.batch_ids.includes(student.batch_id))
        : await prisma.googleSheetLink.findMany({
            where: {
              is_active: true,
              batch_ids: { has: student.batch_id },
            },
          });

      for (const link of activeLinks) {
        try {
          await syncGoogleSheetLink(link.id, user);
        } catch (sheetErr) {
          console.warn(`[Google Sheets Isolation Warning] Active link ${link.id} sync error:`, sheetErr);
        }
      }
    } catch (err) {
      console.warn('[Google Sheets Isolation Warning] Sync check skipped:', err);
    }
  }

  return {
    studentId,
    studentName: student.name,
    leetcodeUsername: student.leetcode_username,
    batchId: student.batch_id,
    stats,
    snapshot,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Concurrency worker helper to process asynchronous operations with a bounded concurrency pool.
 */
async function runConcurrentTasks<T, R>(
  items: T[],
  concurrency: number,
  taskFn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (true) {
      const index = currentIndex++;
      if (index >= items.length) break;
      results[index] = await taskFn(items[index], index);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Sync active linked Google Sheets for a set of batch IDs once at the end of a bulk sync operation.
 */
async function syncGoogleSheetsForBatchIds(batchIds: string[], user: { userId: string; role: UserRole }) {
  if (!batchIds || batchIds.length === 0) return;
  const uniqueBatchIds = Array.from(new Set(batchIds.filter(Boolean)));
  try {
    const activeLinks = !process.env.DATABASE_URL
      ? inMemoryStore.googleSheetLinks.filter(
          (l) => l.is_active && l.batch_ids.some((bId) => uniqueBatchIds.includes(bId))
        )
      : await prisma.googleSheetLink.findMany({
          where: {
            is_active: true,
            batch_ids: { hasSome: uniqueBatchIds },
          },
        });

    for (const link of activeLinks) {
      try {
        await syncGoogleSheetLink(link.id, user);
      } catch (sheetErr: any) {
        console.warn(`[Google Sheets Isolation Warning] Active link ${link.id} sync error:`, sheetErr?.message || sheetErr);
      }
    }
  } catch (err: any) {
    console.warn('[Google Sheets Isolation Warning] Batch sheet sync skipped:', err?.message || err);
  }
}

export async function syncBatchLeetCode(batchId: string, user: { userId: string; role: UserRole }) {
  const startTime = Date.now();
  let studentList: Array<{ id: string; batch_id: string }> = [];

  if (!process.env.DATABASE_URL) {
    let list = inMemoryStore.students.filter((s) => s.batch_id === batchId && s.leetcode_username);
    if (user.role === 'STAFF') {
      const authorizedIds = await getAuthorizedStudentIdsForStaff(user.userId);
      list = list.filter((s) => authorizedIds.includes(s.id));
    }
    studentList = list.map((s) => ({ id: s.id, batch_id: s.batch_id }));
  } else {
    let where: any = { batch_id: batchId, leetcode_username: { not: null } };
    if (user.role === 'STAFF') {
      const authorizedIds = await getAuthorizedStudentIdsForStaff(user.userId);
      where.id = { in: authorizedIds };
    }
    const students = await prisma.student.findMany({ where, select: { id: true, batch_id: true } });
    studentList = students.map((s) => ({ id: s.id, batch_id: s.batch_id }));
  }

  // Run student syncing concurrently (5 parallel workers)
  const results = await runConcurrentTasks(studentList, 5, async (st) => {
    try {
      const res = await syncStudentLeetCode(st.id, user, { skipGoogleSheetSync: true });
      return { studentId: st.id, success: true, stats: res.stats };
    } catch (err: any) {
      return { studentId: st.id, success: false, error: err.message };
    }
  });

  // Trigger Google Sheet sync once for the batch
  await syncGoogleSheetsForBatchIds([batchId], user);

  const durationMs = Date.now() - startTime;
  const successfulCount = results.filter((r) => r.success).length;
  console.log(`[LeetCode Sync] Batch ${batchId} synced: ${successfulCount}/${studentList.length} succeeded in ${(durationMs / 1000).toFixed(2)}s`);

  return {
    batchId,
    totalAttempted: studentList.length,
    successful: successfulCount,
    failed: results.filter((r) => !r.success).length,
    durationSeconds: Number((durationMs / 1000).toFixed(2)),
    results,
  };
}

export async function syncFilteredStudentsLeetCode(
  filters: {
    batchId?: string;
    sectionId?: string;
    department?: string;
    allocationBatchId?: string;
    staffId?: string;
  },
  user: { userId: string; role: UserRole }
) {
  const startTime = Date.now();
  let studentList: Array<{ id: string; batch_id: string }> = [];

  if (!process.env.DATABASE_URL) {
    let list = inMemoryStore.students.filter((s) => s.leetcode_username);
    if (user.role === 'STAFF') {
      const authorizedIds = await getAuthorizedStudentIdsForStaff(user.userId);
      list = list.filter((s) => authorizedIds.includes(s.id));
    }
    if (filters?.batchId) list = list.filter((s) => s.batch_id === filters.batchId);
    if (filters?.sectionId) list = list.filter((s) => s.section_id === filters.sectionId);
    if (filters?.department) list = list.filter((s) => s.department.toLowerCase() === filters.department!.toLowerCase());
    if (filters?.allocationBatchId) list = list.filter((s) => s.allocation_batch_id === filters.allocationBatchId || s.sub_batch === filters.allocationBatchId);
    studentList = list.map((s) => ({ id: s.id, batch_id: s.batch_id }));
  } else {
    const where: any = {
      leetcode_username: { not: null },
    };

    if (user.role === 'STAFF') {
      const authorizedIds = await getAuthorizedStudentIdsForStaff(user.userId);
      where.id = { in: authorizedIds };
    }

    if (filters?.batchId) where.batch_id = filters.batchId;
    if (filters?.sectionId) where.section_id = filters.sectionId;
    if (filters?.department) where.department = { contains: filters.department.trim(), mode: 'insensitive' };
    if (filters?.allocationBatchId) {
      where.OR = [
        { allocation_batch_id: filters.allocationBatchId },
        { sub_batch: filters.allocationBatchId },
      ];
    }
    if (filters?.staffId) {
      where.staff_student_assignments = {
        some: { staff_id: filters.staffId },
      };
    }

    const students = await prisma.student.findMany({ where, select: { id: true, batch_id: true } });
    studentList = students.map((s) => ({ id: s.id, batch_id: s.batch_id }));
  }

  // Run student syncing concurrently with a pool of 5 workers
  const results = await runConcurrentTasks(studentList, 5, async (st) => {
    try {
      const res = await syncStudentLeetCode(st.id, user, { skipGoogleSheetSync: true });
      return { studentId: st.id, success: true, stats: res.stats };
    } catch (err: any) {
      return { studentId: st.id, success: false, error: err.message };
    }
  });

  // Trigger Google Sheet sync once for all affected batches
  const batchIds = studentList.map((s) => s.batch_id);
  await syncGoogleSheetsForBatchIds(batchIds, user);

  const durationMs = Date.now() - startTime;
  const successfulCount = results.filter((r) => r.success).length;
  console.log(`[LeetCode Sync] Filtered sync completed: ${successfulCount}/${studentList.length} students succeeded in ${(durationMs / 1000).toFixed(2)}s`);

  return {
    totalAttempted: studentList.length,
    successful: successfulCount,
    failed: results.filter((r) => !r.success).length,
    durationSeconds: Number((durationMs / 1000).toFixed(2)),
    results,
  };
}

export async function getStudentSnapshots(studentId: string, user: { userId: string; role: UserRole }) {
  if (user.role === 'STAFF') {
    const isAuth = await isStaffAuthorizedForStudent(user.userId, studentId);
    if (!isAuth) {
      const err: any = new Error('Forbidden: You are not authorized to view this student');
      err.statusCode = 403;
      throw err;
    }
  }

  if (!process.env.DATABASE_URL) {
    return inMemoryStore.snapshots
      .filter((s) => s.student_id === studentId)
      .sort((a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime());
  } else {
    return await prisma.dailyCodingSnapshot.findMany({
      where: { student_id: studentId },
      orderBy: { snapshot_date: 'desc' },
    });
  }
}

export async function runPeriodicAutoSync(): Promise<{
  totalAttempted: number;
  successful: number;
  failed: number;
  durationSeconds?: number;
  timestamp: string;
}> {
  const startTime = Date.now();
  const adminContext = { userId: 'system-auto-sync', role: 'ADMIN' as const };
  let studentList: Array<{ id: string; batch_id: string }> = [];

  if (!process.env.DATABASE_URL) {
    studentList = inMemoryStore.students.filter((s) => s.leetcode_username).map((s) => ({ id: s.id, batch_id: s.batch_id }));
  } else {
    const students = await prisma.student.findMany({
      where: { leetcode_username: { not: null } },
      select: { id: true, batch_id: true },
    });
    studentList = students.map((s) => ({ id: s.id, batch_id: s.batch_id }));
  }

  // Concurrent execution with pool of 5 workers
  const results = await runConcurrentTasks(studentList, 5, async (st) => {
    try {
      await syncStudentLeetCode(st.id, adminContext, { skipGoogleSheetSync: true });
      return { studentId: st.id, success: true };
    } catch (err: any) {
      return { studentId: st.id, success: false, error: err?.message };
    }
  });

  const batchIds = studentList.map((s) => s.batch_id);
  await syncGoogleSheetsForBatchIds(batchIds, adminContext);

  const durationMs = Date.now() - startTime;
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  console.log(`[LeetCode AutoSync] Periodic auto-sync completed: ${successCount}/${studentList.length} in ${(durationMs / 1000).toFixed(2)}s`);

  return {
    totalAttempted: studentList.length,
    successful: successCount,
    failed: failCount,
    durationSeconds: Number((durationMs / 1000).toFixed(2)),
    timestamp: new Date().toISOString(),
  };
}

export async function runDailyMidnightReconciliation(): Promise<{
  totalAttempted: number;
  successful: number;
  failed: number;
  durationSeconds?: number;
  istDate: string;
  timestamp: string;
}> {
  const result = await runPeriodicAutoSync();
  const istDate = getISTDate().toISOString().split('T')[0];

  try {
    await runMidnightAutoSync();
  } catch (sheetErr: any) {
    console.error('[CRON] Failed to auto-sync linked Google Sheets during 12:00 AM IST reconciliation:', sheetErr?.message || sheetErr);
  }

  return {
    ...result,
    istDate,
  };
}

