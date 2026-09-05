import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { UserRole } from '../types/index.js';
import { syncStudentLeetCode } from './leetcodeService.js';
import { syncAllActiveGoogleSheets } from './googleSheetsService.js';
import { serverCache } from '../utils/serverCache.js';

export interface BulkImportStudentRow {
  register_number: string;
  name: string;
  department?: string;
  batch_id?: string;
  section_id?: string;
  allocation_batch_id?: string;
  sub_batch?: string;
  current_year?: string;
  leetcode_username: string;
  mentor_name?: string;
  mentor_id?: string;
}

export interface BulkImportInput {
  students: BulkImportStudentRow[];
  targetScope?: {
    batch_id?: string;
    section_id?: string;
    allocation_batch_id?: string;
    sub_batch?: string;
    current_year?: string;
    department?: string;
    mentor_id?: string;
  };
}

export interface BulkImportResult {
  message: string;
  totalProcessed: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  errors: Array<{ register_number: string; error: string }>;
  students: any[];
}

/**
 * Normalizes string for fuzzy staff matching (removes Dr, Mr, Mrs, dots, spaces)
 */
function normalizeForMatching(str: string): string {
  return str
    .toLowerCase()
    .replace(/^(dr|mr|mrs|ms|prof|er)\.?\s*/i, '')
    .replace(/[^a-z0-9]/g, '');
}

function cleanTokens(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/^(dr|mr|mrs|ms|prof|er)\.?\s*/i, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0 && !['dr', 'mr', 'mrs', 'ms', 'prof', 'er'].includes(t));
}

export function findBestStaffMatch(
  rawInput: string,
  staffList: Array<{ id: string; name: string; email: string }>
): string | null {
  if (!rawInput || staffList.length === 0) return null;
  const inputTrimmed = rawInput.trim();
  const inputLower = inputTrimmed.toLowerCase();
  const inputNorm = normalizeForMatching(inputTrimmed);
  const inputTokens = cleanTokens(inputTrimmed);

  // 1. Direct case-insensitive match
  const direct = staffList.find((s) => s.name.trim().toLowerCase() === inputLower);
  if (direct) return direct.id;

  // 2. Normalized match (stripped titles, dots, spaces)
  const normMatch = staffList.find((s) => {
    const sNorm = normalizeForMatching(s.name);
    return sNorm === inputNorm;
  });
  if (normMatch) return normMatch.id;

  // 3. Substring match if long enough (>= 4 chars)
  if (inputNorm.length >= 4) {
    const subMatch = staffList.find((s) => {
      const sNorm = normalizeForMatching(s.name);
      return sNorm.length >= 4 && (sNorm.includes(inputNorm) || inputNorm.includes(sNorm));
    });
    if (subMatch) return subMatch.id;
  }

  // 4. Token-based matching (handles "Dr. A. Muthuraj" matching "Muthuraj", "A. Muthuraj", "Muthuraj A")
  if (inputTokens.length > 0) {
    let bestScore = 0;
    let bestStaffId: string | null = null;

    for (const stf of staffList) {
      const staffTokens = cleanTokens(stf.name);
      if (staffTokens.length === 0) continue;

      let matchCount = 0;
      for (const it of inputTokens) {
        if (it.length >= 3 && staffTokens.some((st) => st.includes(it) || it.includes(st))) {
          matchCount += 2;
        } else if (it.length < 3 && staffTokens.includes(it)) {
          matchCount += 1;
        }
      }

      // Check email prefix
      const emailPrefix = stf.email.split('@')[0].toLowerCase();
      for (const it of inputTokens) {
        if (it.length >= 3 && emailPrefix.includes(it)) {
          matchCount += 2;
        }
      }

      if (matchCount > bestScore) {
        bestScore = matchCount;
        bestStaffId = stf.id;
      }
    }

    if (bestScore >= 2 && bestStaffId) {
      return bestStaffId;
    }
  }

  return null;
}

export async function bulkImportStudents(
  input: BulkImportInput,
  user: { userId: string; role: UserRole }
): Promise<BulkImportResult> {
  const { students, targetScope } = input;

  if (!students || !Array.isArray(students) || students.length === 0) {
    const err: any = new Error('No students provided for import');
    err.statusCode = 400;
    throw err;
  }

  let createdCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  const errors: Array<{ register_number: string; error: string }> = [];
  const processedStudents: any[] = [];
  const newlyCreatedOrUpdatedIds: string[] = [];

  // 1. Fetch available staff list (all active staff and admin users created by admin)
  let staffList: Array<{ id: string; name: string; email: string }> = [];
  if (!process.env.DATABASE_URL) {
    staffList = inMemoryStore.users
      .filter((u) => u.is_active)
      .map((u) => ({ id: u.id, name: u.name, email: u.email }));
  } else {
    staffList = await prisma.user.findMany({
      where: { is_active: true },
      select: { id: true, name: true, email: true },
    });
  }

  // 2. Fetch default batch / section if targetScope not completely specified
  let defaultBatchId = targetScope?.batch_id || '';
  let defaultSectionId = targetScope?.section_id || '';
  let defaultAllocBatchId = targetScope?.allocation_batch_id || '';
  let defaultSubBatch = targetScope?.sub_batch || '';
  let defaultDept = targetScope?.department || 'CSE';

  if (!defaultBatchId) {
    if (!process.env.DATABASE_URL) {
      const b = inMemoryStore.batches[0];
      if (b) {
        defaultBatchId = b.id;
        defaultDept = b.department || defaultDept;
      }
    } else {
      const b = await prisma.batch.findFirst({ orderBy: { created_at: 'desc' } });
      if (b) {
        defaultBatchId = b.id;
        defaultDept = b.department || defaultDept;
      }
    }
  }

  if (defaultBatchId && !defaultSectionId) {
    if (!process.env.DATABASE_URL) {
      const s = inMemoryStore.sections.find((sec) => sec.batch_id === defaultBatchId);
      if (s) defaultSectionId = s.id;
    } else {
      const s = await prisma.section.findFirst({ where: { batch_id: defaultBatchId } });
      if (s) defaultSectionId = s.id;
    }
  }

  // 3. Process each student row
  for (const row of students) {
    const rawRegNo = row.register_number ? row.register_number.trim().toUpperCase() : '';
    const rawName = row.name ? row.name.trim() : '';
    let rawLeetCode = row.leetcode_username ? row.leetcode_username.trim() : '';

    // Clean LeetCode username
    if (rawLeetCode.includes('leetcode.com') || rawLeetCode.includes('leetcode.cn')) {
      rawLeetCode = rawLeetCode.split('?')[0].split('#')[0].replace(/\/+$/, '');
      const parts = rawLeetCode.split('/').filter(Boolean);
      rawLeetCode = parts[parts.length - 1] || '';
      if (rawLeetCode === '_' && parts.length > 1) {
        rawLeetCode = parts[parts.length - 2] || '';
      }
    }
    if (rawLeetCode.startsWith('@')) {
      rawLeetCode = rawLeetCode.substring(1).trim();
    }

    if (!rawRegNo) {
      failedCount++;
      errors.push({ register_number: 'N/A', error: 'Missing Register Number' });
      continue;
    }

    if (!rawName) {
      failedCount++;
      errors.push({ register_number: rawRegNo, error: 'Missing Student Name' });
      continue;
    }

    if (!rawLeetCode) {
      failedCount++;
      errors.push({ register_number: rawRegNo, error: 'Missing LeetCode Username' });
      continue;
    }

    const effectiveBatchId = row.batch_id || defaultBatchId;
    let effectiveSectionId = (row.section_id && row.section_id !== 'ALL') ? row.section_id : defaultSectionId;

    // Smart resolution if effectiveSectionId is 'ALL' or missing
    if (!effectiveSectionId || effectiveSectionId === 'ALL') {
      const rowSecName = (row as any).section_name || (row as any).section;
      if (rowSecName && effectiveBatchId) {
        const cleanSecStr = (s: string) =>
          s.toUpperCase().replace(/^(?:SECTION|SEC|CSE|IT|ECE|EEE|MECH|AIDS|AIML)[\s-_]*/i, '').replace(/[\s-_]/g, '');
        const targetClean = cleanSecStr(String(rowSecName));

        if (!process.env.DATABASE_URL) {
          const matched = inMemoryStore.sections.find(
            (s) => s.batch_id === effectiveBatchId &&
              (s.name.toUpperCase() === String(rowSecName).trim().toUpperCase() ||
               cleanSecStr(s.name) === targetClean)
          );
          if (matched) effectiveSectionId = matched.id;
        } else {
          const sections = await prisma.section.findMany({ where: { batch_id: effectiveBatchId } });
          const matched = sections.find(
            (s) => s.name.toUpperCase() === String(rowSecName).trim().toUpperCase() ||
              cleanSecStr(s.name) === targetClean
          );
          if (matched) effectiveSectionId = matched.id;
        }
      }

      // If still ALL or missing, fall back to first section of batch
      if ((!effectiveSectionId || effectiveSectionId === 'ALL') && effectiveBatchId) {
        if (!process.env.DATABASE_URL) {
          const firstSec = inMemoryStore.sections.find((s) => s.batch_id === effectiveBatchId);
          if (firstSec) effectiveSectionId = firstSec.id;
        } else {
          const firstSec = await prisma.section.findFirst({ where: { batch_id: effectiveBatchId } });
          if (firstSec) effectiveSectionId = firstSec.id;
        }
      }
    }

    const effectiveDept = row.department || defaultDept;
    let effectiveAllocBatchId = row.allocation_batch_id || defaultAllocBatchId || null;
    let rawSubBatch = row.sub_batch || (row as any).allocation_batch || (row as any).batch_no || defaultSubBatch || null;

    // Normalize sub_batch (e.g. "batc5" -> "Batch-5", "batch-1" -> "Batch-1")
    let effectiveSubBatch: string | null = null;
    if (rawSubBatch) {
      const s = String(rawSubBatch).trim();
      const m = s.match(/^(?:batch|batc|b)[\s-_]*(\d+)$/i);
      effectiveSubBatch = m ? `Batch-${m[1]}` : s;
    }

    // Auto-resolve or create Allocation Batch in target section
    if (effectiveSectionId && effectiveSubBatch && !effectiveAllocBatchId) {
      if (!process.env.DATABASE_URL) {
        const norm = (val: string) => val.toLowerCase().replace(/[\s-_]/g, '').replace(/^batc(?=\d)/, 'batch');
        const targetNorm = norm(effectiveSubBatch);
        const existingAb = inMemoryStore.allocationBatches.find(
          (ab) => ab.section_id === effectiveSectionId &&
            (ab.name.toLowerCase() === effectiveSubBatch!.toLowerCase() || norm(ab.name) === targetNorm)
        );
        if (existingAb) {
          effectiveAllocBatchId = existingAb.id;
          effectiveSubBatch = existingAb.name;
        } else {
          const newAb = {
            id: `ab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            section_id: effectiveSectionId,
            name: effectiveSubBatch,
            created_at: new Date(),
          };
          inMemoryStore.allocationBatches.push(newAb);
          effectiveAllocBatchId = newAb.id;
        }
      } else {
        let existingAb = await prisma.allocationBatch.findFirst({
          where: {
            section_id: effectiveSectionId,
            name: { equals: effectiveSubBatch, mode: 'insensitive' },
          },
        });
        if (!existingAb) {
          try {
            existingAb = await prisma.allocationBatch.create({
              data: {
                section_id: effectiveSectionId,
                name: effectiveSubBatch,
              },
            });
          } catch {
            existingAb = await prisma.allocationBatch.findFirst({
              where: {
                section_id: effectiveSectionId,
                name: { equals: effectiveSubBatch, mode: 'insensitive' },
              },
            });
          }
        }
        if (existingAb) {
          effectiveAllocBatchId = existingAb.id;
          effectiveSubBatch = existingAb.name;
        }
      }
    }

    const effectiveCurrentYear = row.current_year || targetScope?.current_year || undefined;

    if (!effectiveBatchId || !effectiveSectionId) {
      failedCount++;
      errors.push({
        register_number: rawRegNo,
        error: 'No target Batch / Section could be resolved for student',
      });
      continue;
    }

    // Resolve Mentor:
    // 1. Explicit unassignment ('NONE')
    // 2. Direct row.mentor_id (from mapped staff selector or explicit selection)
    // 3. targetScope.mentor_id (if admin explicitly picked a mentor in the top dropdown)
    // 4. Matched from row.mentor_name using smart fuzzy matching
    // 5. Default to logged-in user if role === 'STAFF' and no mentor resolved
    const isExplicitlyUnassigned = row.mentor_id === 'NONE' || (!row.mentor_id && targetScope?.mentor_id === 'NONE');
    let resolvedMentorId: string | null = null;

    if (!isExplicitlyUnassigned) {
      if (row.mentor_id && row.mentor_id !== 'AUTO') {
        resolvedMentorId = row.mentor_id;
      } else if (targetScope?.mentor_id && targetScope.mentor_id !== 'AUTO') {
        resolvedMentorId = targetScope.mentor_id;
      } else if (row.mentor_name) {
        resolvedMentorId = findBestStaffMatch(row.mentor_name, staffList);
      } else if (user.role === 'STAFF') {
        resolvedMentorId = user.userId;
      }
    }

    try {
      if (!process.env.DATABASE_URL) {
        // In-Memory Mode
        let existingIndex = inMemoryStore.students.findIndex(
          (st) => st.register_number.toUpperCase() === rawRegNo
        );

        let studentId = '';
        if (existingIndex >= 0) {
          const existing = inMemoryStore.students[existingIndex];
          studentId = existing.id;
          inMemoryStore.students[existingIndex] = {
            ...existing,
            name: rawName,
            department: effectiveDept,
            batch_id: effectiveBatchId,
            section_id: effectiveSectionId,
            allocation_batch_id: effectiveAllocBatchId || existing.allocation_batch_id,
            sub_batch: effectiveSubBatch || existing.sub_batch,
            current_year: effectiveCurrentYear || existing.current_year || '1',
            leetcode_username: rawLeetCode,
            mentor_id: resolvedMentorId || (existing as any)?.mentor_id || null,
          };
          updatedCount++;
        } else {
          studentId = `st_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          inMemoryStore.students.push({
            id: studentId,
            register_number: rawRegNo,
            name: rawName,
            department: effectiveDept,
            batch_id: effectiveBatchId,
            section_id: effectiveSectionId,
            allocation_batch_id: effectiveAllocBatchId || null,
            sub_batch: effectiveSubBatch || null,
            current_year: effectiveCurrentYear || '1',
            leetcode_username: rawLeetCode,
            mentor_id: resolvedMentorId || null,
            created_at: new Date(),
          });
          createdCount++;
        }

        // Mentor Assignment (clean replacement)
        if (resolvedMentorId) {
          inMemoryStore.staffStudentAssignments = inMemoryStore.staffStudentAssignments.filter(
            (a) => a.student_id !== studentId
          );
          inMemoryStore.staffStudentAssignments.push({
            id: `ssa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            staff_id: resolvedMentorId,
            student_id: studentId,
            created_at: new Date(),
          });
        } else if (isExplicitlyUnassigned) {
          inMemoryStore.staffStudentAssignments = inMemoryStore.staffStudentAssignments.filter(
            (a) => a.student_id !== studentId
          );
        }

        newlyCreatedOrUpdatedIds.push(studentId);
        processedStudents.push({ register_number: rawRegNo, name: rawName, id: studentId });
      } else {
        // Database Mode (PostgreSQL via Prisma)
        const existing = await prisma.student.findFirst({
          where: { register_number: { equals: rawRegNo, mode: 'insensitive' } },
        });

        let studentRecord: any = null;

        if (existing) {
          studentRecord = await prisma.student.update({
            where: { id: existing.id },
            data: {
              name: rawName,
              department: effectiveDept,
              batch_id: effectiveBatchId,
              section_id: effectiveSectionId,
              allocation_batch_id: effectiveAllocBatchId || existing.allocation_batch_id,
              sub_batch: effectiveSubBatch || existing.sub_batch,
              ...(effectiveCurrentYear ? { current_year: effectiveCurrentYear } : {}),
              leetcode_username: rawLeetCode,
              updated_at: new Date(),
            },
          });
          updatedCount++;
        } else {
          studentRecord = await prisma.student.create({
            data: {
              register_number: rawRegNo,
              name: rawName,
              department: effectiveDept,
              batch_id: effectiveBatchId,
              section_id: effectiveSectionId,
              allocation_batch_id: effectiveAllocBatchId || null,
              sub_batch: effectiveSubBatch || null,
              current_year: effectiveCurrentYear || '1',
              leetcode_username: rawLeetCode,
            },
          });
          createdCount++;
        }

        // Mentor Assignment (clean replacement)
        if (resolvedMentorId && studentRecord) {
          await prisma.staffStudentAssignment.deleteMany({
            where: { student_id: studentRecord.id },
          });

          await prisma.staffStudentAssignment.create({
            data: {
              student_id: studentRecord.id,
              staff_id: resolvedMentorId,
            },
          });
        } else if (isExplicitlyUnassigned && studentRecord) {
          await prisma.staffStudentAssignment.deleteMany({
            where: { student_id: studentRecord.id },
          });
        }

        if (studentRecord) {
          newlyCreatedOrUpdatedIds.push(studentRecord.id);
          processedStudents.push(studentRecord);
        }
      }
    } catch (dbErr: any) {
      failedCount++;
      errors.push({ register_number: rawRegNo, error: dbErr?.message || 'Database error during save' });
    }
  }

  // 4. Trigger initial background LeetCode fetch for all imported students
  if (newlyCreatedOrUpdatedIds.length > 0) {
    const authContext = { userId: user.userId, role: user.role };
    (async () => {
      console.log(`[Import-Sync] Starting background LeetCode fetch for ${newlyCreatedOrUpdatedIds.length} imported student(s)...`);
      for (const stId of newlyCreatedOrUpdatedIds) {
        try {
          await syncStudentLeetCode(stId, authContext, { skipGoogleSheetSync: true });
        } catch {
          // Ignore individual background sync errors
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      // Once all imported students are synced, push once to all active Google Sheets!
      try {
        await syncAllActiveGoogleSheets();
        console.log(`[Import-Sync] Completed bulk Google Sheet synchronization for imported students.`);
      } catch (sheetErr: any) {
        console.warn(`[Import-Sync] Google Sheet bulk sync note:`, sheetErr?.message || sheetErr);
      }
    })().catch(() => {});
  }

  // Invalidate caches so lists and dashboard metrics update immediately
  serverCache.invalidate();

  return {
    message: `Successfully processed ${students.length} record(s): ${createdCount} created, ${updatedCount} updated, ${failedCount} failed.`,
    totalProcessed: students.length,
    createdCount,
    updatedCount,
    failedCount,
    errors,
    students: processedStudents,
  };
}
