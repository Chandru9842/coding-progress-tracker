import axios from 'axios';
import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { isStaffAuthorizedForStudent, getAuthorizedStudentIdsForStaff } from './studentAuthorizationService.js';
import { syncGoogleSheetLink } from './googleSheetsService.js';
import { runMidnightAutoSync } from './cronService.js';
import { diagnosticLogService } from './diagnosticLogService.js';
import { syncErrorService } from './syncErrorService.js';

import { UserRole } from '../types/index.js';

export interface LeetCodeStats {
  username: string;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  totalSolved: number;
  ranking?: number;
  recentSubmissions?: {
    id: string;
    title: string;
    titleSlug: string;
    timestamp: number;
  }[];
}

export function getISTDateString(offsetDays: number = 0): string {
  const now = new Date();
  const d = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
  return formatter.format(d);
}

export function getISTDate(offsetDays: number = 0): Date {
  const istDateStr = getISTDateString(offsetDays);
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
            submitStatsGlobal {
              acSubmissionNum {
                difficulty
                count
              }
            }
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
          recentAcSubmissionList(username: $username, limit: 20) {
            id
            title
            titleSlug
            timestamp
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
      timeout: 2500,
    });

    const user = gqlRes.data?.data?.matchedUser;
    if (user) {
      const stats = user.submitStatsGlobal?.acSubmissionNum || user.submitStats?.acSubmissionNum;
      if (Array.isArray(stats) && stats.length > 0) {
        const getCount = (diff: string) => {
          const item = stats.find((s: any) => (s.difficulty || '').trim().toLowerCase() === diff.toLowerCase());
          return typeof item?.count === 'number' ? item.count : 0;
        };

        let easy = getCount('easy');
        let medium = getCount('medium');
        let hard = getCount('hard');
        let total = getCount('all');

        if (total === 0 || total < (easy + medium + hard)) {
          total = easy + medium + hard;
        }

        // If total is present but all specific difficulties were 0, check fuzzy matches
        if (total > 0 && (easy === 0 && medium === 0 && hard === 0)) {
          for (const s of stats) {
            const d = (s.difficulty || '').toLowerCase();
            if (d.includes('easy')) easy = s.count || 0;
            else if (d.includes('med')) medium = s.count || 0;
            else if (d.includes('hard')) hard = s.count || 0;
          }
        }

        // If still breakdown is 0 while total > 0, attribute total to easy
        if (total > 0 && (easy === 0 && medium === 0 && hard === 0)) {
          easy = total;
        }

        // Balance total with component breakdown
        if (total > (easy + medium + hard) && (easy + medium + hard) > 0) {
          easy += (total - (easy + medium + hard));
        }

        const recentSubmissions = Array.isArray(gqlRes.data?.data?.recentAcSubmissionList)
          ? gqlRes.data.data.recentAcSubmissionList.map((item: any) => ({
              id: String(item.id || ''),
              title: String(item.title || ''),
              titleSlug: String(item.titleSlug || ''),
              timestamp: Number(item.timestamp || 0),
            }))
          : undefined;

        const ranking = user.profile?.ranking || 0;
        return {
          username: cleanUsername,
          easySolved: easy,
          mediumSolved: medium,
          hardSolved: hard,
          totalSolved: total,
          ranking,
          recentSubmissions,
        };
      }
    }
  } catch (gqlErr: any) {
    console.warn(`Official LeetCode GraphQL fetch for @${cleanUsername} failed (${gqlErr.message}). Trying backup...`);
  }

  // 2. Try High-Availability Backup: Faisal Shohag Vercel LeetCode API
  try {
    const backupRes = await axios.get(`https://leetcode-api-faisalshohag.vercel.app/${cleanUsername}`, { timeout: 2000 });
    if (backupRes.data && (typeof backupRes.data.totalSolved === 'number' || Array.isArray(backupRes.data.matchedUserStats?.acSubmissionNum))) {
      let easy = typeof backupRes.data.easySolved === 'number' ? backupRes.data.easySolved : 0;
      let medium = typeof backupRes.data.mediumSolved === 'number' ? backupRes.data.mediumSolved : 0;
      let hard = typeof backupRes.data.hardSolved === 'number' ? backupRes.data.hardSolved : 0;
      let total = typeof backupRes.data.totalSolved === 'number' ? backupRes.data.totalSolved : 0;

      if (easy === 0 && medium === 0 && hard === 0 && Array.isArray(backupRes.data.matchedUserStats?.acSubmissionNum)) {
        const list = backupRes.data.matchedUserStats.acSubmissionNum;
        const findC = (d: string) => list.find((s: any) => (s.difficulty || '').toLowerCase() === d.toLowerCase())?.count || 0;
        easy = findC('easy');
        medium = findC('medium');
        hard = findC('hard');
        const allC = findC('all');
        if (allC > total) total = allC;
      }

      if (total === 0 || total < (easy + medium + hard)) {
        total = easy + medium + hard;
      }
      if (total > (easy + medium + hard) && (easy + medium + hard) > 0) {
        easy += (total - (easy + medium + hard));
      } else if (total > 0 && (easy === 0 && medium === 0 && hard === 0)) {
        easy = total;
      }

      return {
        username: cleanUsername,
        easySolved: easy,
        mediumSolved: medium,
        hardSolved: hard,
        totalSolved: total,
        ranking: backupRes.data.ranking || 0,
      };
    }
  } catch (backupErr: any) {
    console.warn(`Vercel LeetCode proxy fetch for @${cleanUsername} failed (${backupErr.message}). Trying tertiary...`);
  }

  // 3. Try Tertiary Backup: Alfa LeetCode Proxy
  try {
    const alfaRes = await axios.get(`https://alfa-leetcode-api.onrender.com/userProfile/${cleanUsername}`, { timeout: 2000 });
    if (alfaRes.data && typeof alfaRes.data.totalSolved === 'number') {
      let easy = typeof alfaRes.data.easySolved === 'number' ? alfaRes.data.easySolved : 0;
      let medium = typeof alfaRes.data.mediumSolved === 'number' ? alfaRes.data.mediumSolved : 0;
      let hard = typeof alfaRes.data.hardSolved === 'number' ? alfaRes.data.hardSolved : 0;
      let total = alfaRes.data.totalSolved;

      if (total === 0 || total < (easy + medium + hard)) {
        total = easy + medium + hard;
      }
      if (total > (easy + medium + hard) && (easy + medium + hard) > 0) {
        easy += (total - (easy + medium + hard));
      } else if (total > 0 && (easy === 0 && medium === 0 && hard === 0)) {
        easy = total;
      }

      return {
        username: cleanUsername,
        easySolved: easy,
        mediumSolved: medium,
        hardSolved: hard,
        totalSolved: total,
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
  const startTime = Date.now();

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
  let studentBatch: any = null;
  let studentSection: any = null;

  if (!process.env.DATABASE_URL) {
    student = inMemoryStore.students.find((s) => s.id === studentId);
    if (student) {
      studentBatch = inMemoryStore.batches.find((b) => b.id === student.batch_id);
      studentSection = inMemoryStore.sections.find((sec) => sec.id === student.section_id);
    }
  } else {
    student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { batch: true, section: true },
    });
    if (student) {
      studentBatch = student.batch;
      studentSection = student.section;
    }
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

  let stats: LeetCodeStats;
  let fetchError: string | null = null;
  let rawSource = 'official_graphql';

  try {
    stats = await fetchLeetCodeStats(student.leetcode_username);
    // Successfully parsed live profile -> resolve any previously recorded error
    syncErrorService.resolveError(student.id);
  } catch (apiErr: any) {
    fetchError = apiErr?.message || String(apiErr);
    console.warn(`[Zero-Error Fallback] Live LeetCode API unreachable for @${student.leetcode_username} (${fetchError}). Searching for previous snapshot to carry forward...`);

    // Record error in sync error service for admin review and retry
    syncErrorService.recordError({
      studentId: student.id,
      studentName: student.name,
      registerNumber: student.register_number,
      leetcodeUsername: student.leetcode_username,
      batchId: student.batch_id,
      batchName: studentBatch?.batch_name,
      department: studentBatch?.department,
      sectionId: student.section_id,
      sectionName: studentSection?.name,
      errorMessage: fetchError || 'Unknown fetch error',
    });

    let latestSnapshot: any = null;
    if (!process.env.DATABASE_URL) {
      const studentSnaps = inMemoryStore.snapshots
        .filter((s) => s.student_id === studentId)
        .sort((a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime());
      latestSnapshot = studentSnaps[0] || null;
    } else {
      latestSnapshot = await prisma.dailyCodingSnapshot.findFirst({
        where: { student_id: studentId },
        orderBy: { snapshot_date: 'desc' },
      });
    }

    if (latestSnapshot) {
      stats = {
        username: student.leetcode_username,
        easySolved: latestSnapshot.easy_solved,
        mediumSolved: latestSnapshot.medium_solved,
        hardSolved: latestSnapshot.hard_solved,
        totalSolved: latestSnapshot.total_solved,
      };
      rawSource = 'fallback_snapshot_cache';
      console.log(`[Zero-Error Fallback] Carried forward previous snapshot (${latestSnapshot.total_solved} solved) for @${student.leetcode_username}, guaranteeing 0% error.`);
    } else {
      stats = {
        username: student.leetcode_username,
        easySolved: 0,
        mediumSolved: 0,
        hardSolved: 0,
        totalSolved: 0,
      };
      rawSource = 'zero_default';
    }
  }

  const today = getISTDate();

  // Consistency Guard: Validate integers and guarantee easy + medium + hard === total
  stats.easySolved = Math.max(0, Math.floor(stats.easySolved || 0));
  stats.mediumSolved = Math.max(0, Math.floor(stats.mediumSolved || 0));
  stats.hardSolved = Math.max(0, Math.floor(stats.hardSolved || 0));
  stats.totalSolved = Math.max(0, Math.floor(stats.totalSolved || 0));

  if (stats.totalSolved === 0 && (stats.easySolved + stats.mediumSolved + stats.hardSolved) > 0) {
    stats.totalSolved = stats.easySolved + stats.mediumSolved + stats.hardSolved;
  }

  // If total > 0 but breakdown was 0, retrieve previous snapshot to carry breakdown forward with delta
  if (stats.totalSolved > 0 && stats.easySolved === 0 && stats.mediumSolved === 0 && stats.hardSolved === 0) {
    let prev: any = null;
    if (!process.env.DATABASE_URL) {
      const studentSnaps = inMemoryStore.snapshots
        .filter((s) => s.student_id === studentId)
        .sort((a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime());
      prev = studentSnaps[0] || null;
    } else {
      prev = await prisma.dailyCodingSnapshot.findFirst({
        where: { student_id: studentId },
        orderBy: { snapshot_date: 'desc' },
      });
    }

    if (prev && prev.total_solved > 0) {
      const delta = Math.max(0, stats.totalSolved - prev.total_solved);
      stats.mediumSolved = prev.medium_solved || 0;
      stats.hardSolved = prev.hard_solved || 0;
      stats.easySolved = (prev.easy_solved || 0) + delta;
    } else {
      stats.easySolved = stats.totalSolved;
    }
  }

  // Reconcile total and sum so they always mathematically match
  const sumDiff = stats.easySolved + stats.mediumSolved + stats.hardSolved;
  if (stats.totalSolved > sumDiff) {
    stats.easySolved += (stats.totalSolved - sumDiff);
  } else if (stats.totalSolved < sumDiff) {
    stats.totalSolved = sumDiff;
  }

  // Baseline preservation for midnight boundary (12:00 AM IST)
  const todayISTStr = getISTDateString(0);
  const todayMidnightMs = new Date(`${todayISTStr}T00:00:00+05:30`).getTime();
  const yesterdayDate = getISTDate(-1);

  if (stats.recentSubmissions && stats.recentSubmissions.length > 0) {
    const todaySolvedSlugs = new Set(
      stats.recentSubmissions
        .filter((s) => s.timestamp * 1000 >= todayMidnightMs)
        .map((s) => s.titleSlug)
    );
    const todaySolvedCount = todaySolvedSlugs.size;

    // If student solved problems today past 12:00 AM midnight, ensure yesterday's baseline snapshot exists
    if (todaySolvedCount > 0) {
      const midnightTotal = Math.max(0, stats.totalSolved - todaySolvedCount);
      if (process.env.DATABASE_URL) {
        try {
          const yestSnap = await prisma.dailyCodingSnapshot.findUnique({
            where: {
              student_id_snapshot_date: {
                student_id: studentId,
                snapshot_date: yesterdayDate,
              },
            },
          });
          if (!yestSnap) {
            await prisma.dailyCodingSnapshot.create({
              data: {
                student_id: studentId,
                snapshot_date: yesterdayDate,
                easy_solved: Math.max(0, stats.easySolved - todaySolvedCount),
                medium_solved: stats.mediumSolved,
                hard_solved: stats.hardSolved,
                total_solved: midnightTotal,
              },
            }).catch(() => {});
          }
        } catch (_) {}
      } else {
        const yestIndex = inMemoryStore.snapshots.findIndex(
          (s) => s.student_id === studentId && new Date(s.snapshot_date).toDateString() === yesterdayDate.toDateString()
        );
        if (yestIndex === -1) {
          inMemoryStore.snapshots.push({
            id: `snap_${Date.now()}_yest_${Math.random().toString(36).substring(2,6)}`,
            student_id: studentId,
            snapshot_date: yesterdayDate,
            easy_solved: Math.max(0, stats.easySolved - todaySolvedCount),
            medium_solved: stats.mediumSolved,
            hard_solved: stats.hardSolved,
            total_solved: midnightTotal,
            created_at: new Date(),
          });
        }
      }
    }
  }

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
        ? inMemoryStore.googleSheetLinks.filter(
            (l) =>
              l.is_active &&
              (!l.batch_ids || l.batch_ids.length === 0 || l.batch_ids.includes(student.batch_id) || Boolean(l.academic_year))
          )
        : await prisma.googleSheetLink.findMany({
            where: {
              is_active: true,
              OR: [
                { batch_ids: { has: student.batch_id } },
                { batch_ids: { isEmpty: true } },
                { academic_year: { not: null } },
              ],
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

  const latencyMs = Date.now() - startTime;
  diagnosticLogService.recordLog({
    targetType: 'LEETCODE_STUDENT',
    targetId: student.id,
    targetName: student.name,
    identifier: student.leetcode_username,
    batchId: student.batch_id,
    batchName: studentBatch?.batch_name,
    sectionId: student.section_id,
    sectionName: studentSection?.name,
    department: studentBatch?.department,
    latencyMs,
    status: fetchError ? 'FAILED' : 'SUCCESS',
    errorMessage: fetchError || undefined,
    details: fetchError
      ? `Sync encountered warning/error: ${fetchError}. Carried forward snapshot.`
      : `Synchronized ${stats.totalSolved} total solved (Easy: ${stats.easySolved}, Med: ${stats.mediumSolved}, Hard: ${stats.hardSolved})`,
    source: rawSource,
  });

  return {
    studentId,
    studentName: student.name,
    leetcodeUsername: student.leetcode_username,
    batchId: student.batch_id,
    stats,
    snapshot,
    latencyMs,
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
          (l) =>
            l.is_active &&
            (!l.batch_ids || l.batch_ids.length === 0 || l.batch_ids.some((bId) => uniqueBatchIds.includes(bId)) || Boolean(l.academic_year))
        )
      : await prisma.googleSheetLink.findMany({
          where: {
            is_active: true,
            OR: [
              { batch_ids: { hasSome: uniqueBatchIds } },
              { batch_ids: { isEmpty: true } },
              { academic_year: { not: null } },
            ],
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
  let batchInfo: any = null;

  if (!process.env.DATABASE_URL) {
    batchInfo = inMemoryStore.batches.find((b) => b.id === batchId);
    let list = inMemoryStore.students.filter((s) => s.batch_id === batchId && s.leetcode_username);
    if (user.role === 'STAFF') {
      const authorizedIds = await getAuthorizedStudentIdsForStaff(user.userId);
      list = list.filter((s) => authorizedIds.includes(s.id));
    }
    studentList = list.map((s) => ({ id: s.id, batch_id: s.batch_id }));
  } else {
    batchInfo = await prisma.batch.findUnique({ where: { id: batchId } });
    let where: any = { batch_id: batchId, leetcode_username: { not: null } };
    if (user.role === 'STAFF') {
      const authorizedIds = await getAuthorizedStudentIdsForStaff(user.userId);
      where.id = { in: authorizedIds };
    }
    const students = await prisma.student.findMany({ where, select: { id: true, batch_id: true } });
    studentList = students.map((s) => ({ id: s.id, batch_id: s.batch_id }));
  }

  const batchLabel = batchInfo?.batch_name || `Batch ${batchId}`;
  const stopTask = diagnosticLogService.startSyncTask(`batch_${batchId}`, `Sync Batch: ${batchLabel}`);

  let results: any[] = [];
  try {
    // Run student syncing concurrently (5 parallel workers)
    results = await runConcurrentTasks(studentList, 5, async (st) => {
      try {
        const res = await syncStudentLeetCode(st.id, user, { skipGoogleSheetSync: true });
        return { studentId: st.id, success: true, stats: res.stats };
      } catch (err: any) {
        return { studentId: st.id, success: false, error: err.message };
      }
    });

    // Trigger Google Sheet sync once for the batch
    await syncGoogleSheetsForBatchIds([batchId], user);
  } finally {
    stopTask();
  }

  const durationMs = Date.now() - startTime;
  const successfulCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;
  console.log(`[LeetCode Sync] Batch ${batchId} synced: ${successfulCount}/${studentList.length} succeeded in ${(durationMs / 1000).toFixed(2)}s`);

  diagnosticLogService.recordLog({
    targetType: 'LEETCODE_BATCH',
    targetId: batchId,
    targetName: batchLabel,
    batchId,
    batchName: batchLabel,
    department: batchInfo?.department,
    latencyMs: durationMs,
    status: failedCount > 0 ? (successfulCount === 0 ? 'FAILED' : 'WARNING') : 'SUCCESS',
    details: `Synchronized ${successfulCount}/${studentList.length} students in ${(durationMs / 1000).toFixed(2)}s. Average student latency: ${studentList.length > 0 ? Math.round(durationMs / studentList.length) : 0}ms.`,
    source: 'batch_worker_pool',
  });

  return {
    batchId,
    totalAttempted: studentList.length,
    successful: successfulCount,
    failed: failedCount,
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

  // Run student syncing concurrently with a pool of 10 workers for fast processing
  const results = await runConcurrentTasks(studentList, 10, async (st) => {
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

/**
 * Force refresh an entire section immediately, bypassing the global auto-sync queue.
 */
export async function syncSectionLeetCode(
  sectionId: string,
  user: { userId: string; role: UserRole }
) {
  const startTime = Date.now();
  let section: any = null;
  let batch: any = null;

  if (!process.env.DATABASE_URL) {
    section = inMemoryStore.sections.find((s) => s.id === sectionId);
    if (section) {
      batch = inMemoryStore.batches.find((b) => b.id === section.batch_id);
    }
  } else {
    section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: { batch: true },
    });
    if (section) {
      batch = section.batch;
    }
  }

  if (!section) {
    const err: any = new Error('Section not found');
    err.statusCode = 404;
    throw err;
  }

  const sectionLabel = section.name || sectionId;
  const batchLabel = batch?.batch_name || 'Batch';
  const stopTask = diagnosticLogService.startSyncTask(
    `sec_${sectionId}`,
    `Force Refresh: Section ${sectionLabel} (${batchLabel})`
  );

  try {
    const result = await syncFilteredStudentsLeetCode(
      { batchId: section.batch_id, sectionId },
      user
    );

    const latencyMs = Date.now() - startTime;
    diagnosticLogService.recordLog({
      targetType: 'LEETCODE_SECTION',
      targetId: sectionId,
      targetName: `Section ${sectionLabel} (Immediate Refresh)`,
      batchId: section.batch_id,
      batchName: batchLabel,
      sectionId,
      sectionName: sectionLabel,
      department: batch?.department,
      latencyMs,
      status: result.failed > 0 ? (result.successful === 0 ? 'FAILED' : 'WARNING') : 'SUCCESS',
      details: `⚡ Immediate force-refresh bypassed global queue: ${result.successful}/${result.totalAttempted} students synchronized in ${(latencyMs / 1000).toFixed(2)}s.`,
      source: 'manual_force_refresh',
    });

    return {
      sectionId,
      sectionName: sectionLabel,
      batchId: section.batch_id,
      batchName: batchLabel,
      department: batch?.department,
      ...result,
    };
  } finally {
    stopTask();
  }
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

  let snapshots = !process.env.DATABASE_URL
    ? inMemoryStore.snapshots
        .filter((s) => s.student_id === studentId)
        .sort((a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime())
    : await prisma.dailyCodingSnapshot.findMany({
        where: { student_id: studentId },
        orderBy: { snapshot_date: 'desc' },
      });

  // If student has 0 snapshots recorded, create an instant baseline snapshot in-memory or DB
  // so that the frontend always has an initial snapshot record instantly without waiting
  if (snapshots.length === 0) {
    const today = getISTDate();
    let student: any = null;
    if (!process.env.DATABASE_URL) {
      student = inMemoryStore.students.find((s) => s.id === studentId);
      if (student) {
        const baselineSnapshot = {
          id: `snap_${Date.now()}_init`,
          student_id: studentId,
          snapshot_date: today,
          easy_solved: 0,
          medium_solved: 0,
          hard_solved: 0,
          total_solved: 0,
          created_at: new Date(),
        };
        inMemoryStore.snapshots.push(baselineSnapshot);
        snapshots = [baselineSnapshot];
      }
    }
  }

  // Non-blocking Auto-Snapshot trigger:
  // If snapshots were missing or stale, trigger background sync without blocking the HTTP response!
  const todayISTStr = getISTDateString();
  const latest = snapshots[0];
  const latestDateStr = latest ? new Date(latest.snapshot_date).toISOString().split('T')[0] : '';
  const isMissingToday = !latest || latestDateStr !== todayISTStr;
  const isStale = isMissingToday || (Date.now() - new Date(latest.created_at || (latest as any).updated_at || 0).getTime() > 10 * 60 * 1000);

  if (isStale) {
    // Fire-and-forget background worker: Never block user navigation on slow external networks
    setImmediate(async () => {
      try {
        let student: any = null;
        if (!process.env.DATABASE_URL) {
          student = inMemoryStore.students.find((s) => s.id === studentId);
        } else {
          student = await prisma.student.findUnique({ where: { id: studentId } });
        }
        if (student?.leetcode_username) {
          console.log(`[Auto-Snapshot Background] Asynchronously updating stats for ${student.name} (@${student.leetcode_username})...`);
          await syncStudentLeetCode(studentId, user, { skipGoogleSheetSync: true });
        }
      } catch (err: any) {
        console.warn(`[Auto-Snapshot Background] Note for student ${studentId}:`, err?.message || err);
      }
    });
  }

  return snapshots;
}

export async function runPeriodicAutoSync(): Promise<{
  totalAttempted: number;
  successful: number;
  failed: number;
  durationSeconds?: number;
  timestamp: string;
}> {
  const startTime = Date.now();
  const stopTask = diagnosticLogService.startSyncTask('auto_sync_global', 'Global Auto-Sync (15-min cadence)');
  const adminContext = { userId: 'system-auto-sync', role: 'ADMIN' as const };
  let studentList: Array<{ id: string; batch_id: string }> = [];

  let results: any[] = [];
  try {
    if (!process.env.DATABASE_URL) {
      studentList = inMemoryStore.students.filter((s) => s.leetcode_username).map((s) => ({ id: s.id, batch_id: s.batch_id }));
    } else {
      const students = await prisma.student.findMany({
        where: { leetcode_username: { not: null } },
        select: { id: true, batch_id: true },
      });
      studentList = students.map((s) => ({ id: s.id, batch_id: s.batch_id }));
    }

    // Concurrent execution with pool of 10 workers for rapid execution
    results = await runConcurrentTasks(studentList, 10, async (st) => {
      try {
        await syncStudentLeetCode(st.id, adminContext, { skipGoogleSheetSync: true });
        return { studentId: st.id, success: true };
      } catch (err: any) {
        return { studentId: st.id, success: false, error: err?.message };
      }
    });

    const batchIds = studentList.map((s) => s.batch_id);
    await syncGoogleSheetsForBatchIds(batchIds, adminContext);
  } finally {
    stopTask();
  }

  const durationMs = Date.now() - startTime;
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  console.log(`[LeetCode AutoSync] Periodic auto-sync completed: ${successCount}/${studentList.length} in ${(durationMs / 1000).toFixed(2)}s`);

  diagnosticLogService.recordLog({
    targetType: 'LEETCODE_BATCH',
    targetId: 'global_auto_sync',
    targetName: 'Global Automated Sync',
    latencyMs: durationMs,
    status: failCount > 0 ? (successCount === 0 ? 'FAILED' : 'WARNING') : 'SUCCESS',
    details: `Automated cycle finished: ${successCount}/${studentList.length} students synchronized across all batches in ${(durationMs / 1000).toFixed(2)}s.`,
    source: 'periodic_auto_sync',
  });

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
  let result: {
    totalAttempted: number;
    successful: number;
    failed: number;
    durationSeconds?: number;
    timestamp: string;
  } = {
    totalAttempted: 0,
    successful: 0,
    failed: 0,
    durationSeconds: 0,
    timestamp: new Date().toISOString(),
  };

  try {
    result = await runPeriodicAutoSync();
  } catch (syncErr: any) {
    console.warn('[Sync] Student LeetCode sync notice during reconciliation:', syncErr?.message || syncErr);
  }

  const istDate = getISTDate().toISOString().split('T')[0];

  // Guaranteed execution: always sync linked Google Sheets even if individual student fetches had warnings
  try {
    await runMidnightAutoSync();
    console.log('[Sync] Linked Google Sheets updated during reconciliation.');
  } catch (sheetErr: any) {
    console.warn('[Sync] Google Sheets sync notice during reconciliation:', sheetErr?.message || sheetErr);
  }

  return {
    ...result,
    istDate,
  };
}

