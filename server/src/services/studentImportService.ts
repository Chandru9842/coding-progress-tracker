import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { UserRole } from '../types/index.js';
import { syncStudentLeetCode, extractLeetCodeUsername } from './leetcodeService.js';
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
  unsyncedStudentIds?: string[];
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

  // 3. Substring match if >= 3 chars (e.g., "Devi" matching "Mrs. K. Devi" or "Devi K")
  if (inputNorm.length >= 3) {
    const subMatch = staffList.find((s) => {
      const sNorm = normalizeForMatching(s.name);
      return sNorm.length >= 3 && (sNorm.includes(inputNorm) || inputNorm.includes(sNorm));
    });
    if (subMatch) return subMatch.id;
  }

  // 4. Contains match if input is at least 3 letters
  if (inputTrimmed.length >= 3) {
    const directSub = staffList.find((s) => {
      const sLower = s.name.toLowerCase();
      return sLower.includes(inputLower) || inputLower.includes(sLower);
    });
    if (directSub) return directSub.id;
  }

  // 5. Token-based matching (handles "Dr. A. Muthuraj" matching "Muthuraj", "A. Muthuraj", "Muthuraj A", "Devi", "K. Devi")
  if (inputTokens.length > 0) {
    let bestScore = 0;
    let bestStaffId: string | null = null;

    for (const stf of staffList) {
      const staffTokens = cleanTokens(stf.name);
      if (staffTokens.length === 0) continue;

      let matchCount = 0;
      for (const it of inputTokens) {
        if (it.length >= 3 && staffTokens.some((st) => st.includes(it) || it.includes(st))) {
          matchCount += 3;
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

  // Pre-fetch all sections & existing allocation batches for involved batches in one parallel roundtrip
  const batchIdsToFetch = Array.from(
    new Set([defaultBatchId, ...students.map((s) => s.batch_id).filter(Boolean)])
  ) as string[];

  let allSections: Array<{ id: string; batch_id: string; name: string }> = [];
  let allAllocBatches: Array<{ id: string; section_id: string; name: string }> = [];
  const existingStudentMap = new Map<string, { id: string; register_number: string; allocation_batch_id: string | null; sub_batch: string | null; current_year: string | null }>();

  if (!process.env.DATABASE_URL) {
    // In-memory mode (tests / fallback)
    allSections = inMemoryStore.sections;
    allAllocBatches = inMemoryStore.allocationBatches;
    if (defaultBatchId && !defaultSectionId) {
      const s = inMemoryStore.sections.find((sec) => sec.batch_id === defaultBatchId);
      if (s) defaultSectionId = s.id;
    }
  } else {
    const allRegNos = Array.from(
      new Set(
        students
          .map((s) => (s.register_number ? s.register_number.trim().toUpperCase() : ''))
          .filter(Boolean)
      )
    );

    const [dbSections, dbExistingStudents] = await Promise.all([
      prisma.section.findMany({
        where: batchIdsToFetch.length > 0 ? { batch_id: { in: batchIdsToFetch } } : undefined,
      }),
      allRegNos.length > 0
        ? prisma.student.findMany({
            where: { register_number: { in: allRegNos } },
            select: {
              id: true,
              register_number: true,
              allocation_batch_id: true,
              sub_batch: true,
              current_year: true,
            },
          })
        : Promise.resolve([]),
    ]);

    allSections = dbSections;
    for (const st of dbExistingStudents) {
      existingStudentMap.set(st.register_number.toUpperCase(), st);
    }

    if (defaultBatchId && !defaultSectionId) {
      const s = allSections.find((sec) => sec.batch_id === defaultBatchId);
      if (s) defaultSectionId = s.id;
    }

    const sectionIds = allSections.map((s) => s.id);
    if (sectionIds.length > 0) {
      allAllocBatches = await prisma.allocationBatch.findMany({
        where: { section_id: { in: sectionIds } },
      });
    }
  }

  const cleanSecStr = (s: string) =>
    s.toUpperCase().replace(/^(?:SECTION|SEC|CSE|IT|ECE|EEE|MECH|AIDS|AIML)[\s-_]*/i, '').replace(/[\s-_]/g, '');

  const resolveSection = (batchId: string, rowSecName?: string, explicitSecId?: string): string => {
    if (explicitSecId && explicitSecId !== 'ALL') return explicitSecId;
    if (rowSecName && batchId) {
      const targetClean = cleanSecStr(String(rowSecName));
      const matched = allSections.find(
        (s) => s.batch_id === batchId &&
          (s.name.toUpperCase() === String(rowSecName).trim().toUpperCase() ||
           cleanSecStr(s.name) === targetClean)
      );
      if (matched) return matched.id;
    }
    if (defaultSectionId && defaultSectionId !== 'ALL') return defaultSectionId;
    const firstSec = allSections.find((s) => s.batch_id === batchId);
    return firstSec?.id || '';
  };

  interface PreparedRow {
    rawRegNo: string;
    rawName: string;
    rawLeetCode: string;
    effectiveBatchId: string;
    effectiveSectionId: string;
    effectiveAllocBatchId: string | null;
    effectiveSubBatch: string | null;
    effectiveDept: string;
    effectiveCurrentYear?: string;
    resolvedMentorId: string | null;
    isExplicitlyUnassigned: boolean;
  }

  const preparedRows: PreparedRow[] = [];

  // 3. Resolve metadata and ensure any new allocation batches exist
  for (const row of students) {
    const rawRegNo = row.register_number ? row.register_number.trim().toUpperCase() : '';
    const rawName = row.name ? row.name.trim() : '';
    const rawLeetCode = extractLeetCodeUsername(row.leetcode_username || (row as any).cleanLeetCode || '');

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
    const rowSecName = (row as any).section_name || (row as any).section;
    const effectiveSectionId = resolveSection(effectiveBatchId, rowSecName, row.section_id);

    if (!effectiveBatchId || !effectiveSectionId) {
      failedCount++;
      errors.push({
        register_number: rawRegNo,
        error: 'No target Batch / Section could be resolved for student',
      });
      continue;
    }

    const effectiveDept = row.department || defaultDept;
    let effectiveAllocBatchId = row.allocation_batch_id || defaultAllocBatchId || null;
    let rawSubBatch = row.sub_batch || (row as any).allocation_batch || (row as any).batch_no || defaultSubBatch || null;

    let effectiveSubBatch: string | null = null;
    if (rawSubBatch) {
      const s = String(rawSubBatch).trim();
      const m = s.match(/^(?:batch|batc|b)[\s-_]*(\d+)$/i);
      effectiveSubBatch = m ? `Batch-${m[1]}` : s;
    }

    if (effectiveSectionId && effectiveSubBatch && !effectiveAllocBatchId) {
      const normAb = (val: string) => val.toLowerCase().replace(/[\s-_]/g, '').replace(/^batc(?=\d)/, 'batch');
      const targetNorm = normAb(effectiveSubBatch);
      let matchedAb = allAllocBatches.find(
        (ab) => ab.section_id === effectiveSectionId &&
          (ab.name.toLowerCase() === effectiveSubBatch!.toLowerCase() || normAb(ab.name) === targetNorm)
      );

      if (!matchedAb) {
        if (!process.env.DATABASE_URL) {
          const newAb = {
            id: `ab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            section_id: effectiveSectionId,
            name: effectiveSubBatch,
            created_at: new Date(),
          };
          inMemoryStore.allocationBatches.push(newAb as any);
          allAllocBatches.push(newAb);
          matchedAb = newAb;
        } else {
          try {
            matchedAb = await prisma.allocationBatch.create({
              data: {
                section_id: effectiveSectionId,
                name: effectiveSubBatch,
              },
            });
            allAllocBatches.push(matchedAb);
          } catch {
            matchedAb = (await prisma.allocationBatch.findFirst({
              where: {
                section_id: effectiveSectionId,
                name: { equals: effectiveSubBatch, mode: 'insensitive' },
              },
            })) || undefined;
            if (matchedAb) allAllocBatches.push(matchedAb);
          }
        }
      }

      if (matchedAb) {
        effectiveAllocBatchId = matchedAb.id;
        effectiveSubBatch = matchedAb.name;
      }
    }

    const effectiveCurrentYear = row.current_year || targetScope?.current_year || undefined;

    const isExplicitlyUnassigned =
      row.mentor_id === 'NONE' ||
      row.mentor_id === 'UNASSIGNED' ||
      (!row.mentor_id && (!row.mentor_name || row.mentor_name === 'Unassigned') && (targetScope?.mentor_id === 'NONE' || targetScope?.mentor_id === 'UNASSIGNED'));
    let resolvedMentorId: string | null = null;

    if (!isExplicitlyUnassigned) {
      if (row.mentor_id && row.mentor_id !== 'AUTO' && row.mentor_id !== 'NONE' && row.mentor_id !== 'UNASSIGNED') {
        resolvedMentorId = row.mentor_id;
      } else if (row.mentor_name && row.mentor_name !== 'Unassigned') {
        resolvedMentorId = findBestStaffMatch(row.mentor_name, staffList);
        if (!resolvedMentorId && targetScope?.mentor_id && targetScope.mentor_id !== 'AUTO' && targetScope.mentor_id !== 'NONE' && targetScope.mentor_id !== 'UNASSIGNED') {
          resolvedMentorId = targetScope.mentor_id;
        }
      } else if (targetScope?.mentor_id && targetScope.mentor_id !== 'AUTO' && targetScope.mentor_id !== 'NONE' && targetScope.mentor_id !== 'UNASSIGNED') {
        resolvedMentorId = targetScope.mentor_id;
      } else if (user.role === 'STAFF') {
        resolvedMentorId = user.userId;
      }
    }

    preparedRows.push({
      rawRegNo,
      rawName,
      rawLeetCode,
      effectiveBatchId,
      effectiveSectionId,
      effectiveAllocBatchId,
      effectiveSubBatch,
      effectiveDept,
      effectiveCurrentYear,
      resolvedMentorId,
      isExplicitlyUnassigned,
    });
  }

  // 4. Persist students and mentor assignments
  if (!process.env.DATABASE_URL) {
    // In-Memory Mode
    for (const item of preparedRows) {
      const existingIndex = inMemoryStore.students.findIndex(
        (st) => st.register_number.toUpperCase() === item.rawRegNo
      );

      let studentId = '';
      if (existingIndex >= 0) {
        const existing = inMemoryStore.students[existingIndex];
        studentId = existing.id;
        inMemoryStore.students[existingIndex] = {
          ...existing,
          name: item.rawName,
          department: item.effectiveDept,
          batch_id: item.effectiveBatchId,
          section_id: item.effectiveSectionId,
          allocation_batch_id: item.effectiveAllocBatchId || existing.allocation_batch_id,
          sub_batch: item.effectiveSubBatch || existing.sub_batch,
          current_year: item.effectiveCurrentYear || existing.current_year || '1',
          leetcode_username: item.rawLeetCode,
          mentor_id: item.resolvedMentorId || (existing as any)?.mentor_id || null,
        };
        updatedCount++;
      } else {
        studentId = `st_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        inMemoryStore.students.push({
          id: studentId,
          register_number: item.rawRegNo,
          name: item.rawName,
          department: item.effectiveDept,
          batch_id: item.effectiveBatchId,
          section_id: item.effectiveSectionId,
          allocation_batch_id: item.effectiveAllocBatchId || null,
          sub_batch: item.effectiveSubBatch || null,
          current_year: item.effectiveCurrentYear || '1',
          leetcode_username: item.rawLeetCode,
          mentor_id: item.resolvedMentorId || null,
          created_at: new Date(),
        });
        createdCount++;
      }

      // Mentor Assignment
      if (item.resolvedMentorId) {
        inMemoryStore.staffStudentAssignments = inMemoryStore.staffStudentAssignments.filter(
          (a) => a.student_id !== studentId
        );
        inMemoryStore.staffStudentAssignments.push({
          id: `ssa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          staff_id: item.resolvedMentorId,
          student_id: studentId,
          created_at: new Date(),
        });
      } else if (item.isExplicitlyUnassigned) {
        inMemoryStore.staffStudentAssignments = inMemoryStore.staffStudentAssignments.filter(
          (a) => a.student_id !== studentId
        );
      }

      newlyCreatedOrUpdatedIds.push(studentId);
      processedStudents.push({ register_number: item.rawRegNo, name: item.rawName, id: studentId });
    }
  } else {
    // Database Mode: Ultra-fast batch operations to prevent serverless function timeouts
    const toCreate: PreparedRow[] = [];
    const toUpdate: PreparedRow[] = [];

    for (const item of preparedRows) {
      if (existingStudentMap.has(item.rawRegNo)) {
        toUpdate.push(item);
      } else {
        toCreate.push(item);
      }
    }

    const studentIdByRegNo = new Map<string, string>();

    // 1. Bulk insert new students
    if (toCreate.length > 0) {
      try {
        await prisma.student.createMany({
          data: toCreate.map((item) => ({
            register_number: item.rawRegNo,
            name: item.rawName,
            department: item.effectiveDept,
            batch_id: item.effectiveBatchId,
            section_id: item.effectiveSectionId,
            allocation_batch_id: item.effectiveAllocBatchId || null,
            sub_batch: item.effectiveSubBatch || null,
            current_year: item.effectiveCurrentYear || '1',
            leetcode_username: item.rawLeetCode,
          })),
          skipDuplicates: true,
        });

        // Retrieve created IDs for mentor assignments and auto-sync
        const createdRecords = await prisma.student.findMany({
          where: { register_number: { in: toCreate.map((c) => c.rawRegNo) } },
          select: { id: true, register_number: true, name: true },
        });

        for (const rec of createdRecords) {
          studentIdByRegNo.set(rec.register_number.toUpperCase(), rec.id);
          newlyCreatedOrUpdatedIds.push(rec.id);
          processedStudents.push(rec);
          createdCount++;
        }
      } catch (createErr: any) {
        console.warn('[Import] Bulk createMany error, falling back to sequential create:', createErr?.message || createErr);
        for (const item of toCreate) {
          try {
            const rec = await prisma.student.create({
              data: {
                register_number: item.rawRegNo,
                name: item.rawName,
                department: item.effectiveDept,
                batch_id: item.effectiveBatchId,
                section_id: item.effectiveSectionId,
                allocation_batch_id: item.effectiveAllocBatchId || null,
                sub_batch: item.effectiveSubBatch || null,
                current_year: item.effectiveCurrentYear || '1',
                leetcode_username: item.rawLeetCode,
              },
            });
            studentIdByRegNo.set(item.rawRegNo, rec.id);
            newlyCreatedOrUpdatedIds.push(rec.id);
            processedStudents.push(rec);
            createdCount++;
          } catch (singleErr: any) {
            failedCount++;
            errors.push({ register_number: item.rawRegNo, error: singleErr?.message || 'Database error during create' });
          }
        }
      }
    }

    // 2. Fast batch update for existing students
    if (toUpdate.length > 0) {
      try {
        await prisma.$transaction(
          toUpdate.map((item) => {
            const existing = existingStudentMap.get(item.rawRegNo)!;
            return prisma.student.update({
              where: { id: existing.id },
              data: {
                name: item.rawName,
                department: item.effectiveDept,
                batch_id: item.effectiveBatchId,
                section_id: item.effectiveSectionId,
                allocation_batch_id: item.effectiveAllocBatchId || existing.allocation_batch_id,
                sub_batch: item.effectiveSubBatch || existing.sub_batch,
                ...(item.effectiveCurrentYear ? { current_year: item.effectiveCurrentYear } : {}),
                leetcode_username: item.rawLeetCode,
                updated_at: new Date(),
              },
            });
          })
        );
        for (const item of toUpdate) {
          const existing = existingStudentMap.get(item.rawRegNo)!;
          studentIdByRegNo.set(item.rawRegNo, existing.id);
          newlyCreatedOrUpdatedIds.push(existing.id);
          processedStudents.push({ id: existing.id, register_number: item.rawRegNo, name: item.rawName });
          updatedCount++;
        }
      } catch (updateErr: any) {
        console.warn('[Import] Bulk update transaction error, falling back to sequential update:', updateErr?.message || updateErr);
        for (const item of toUpdate) {
          try {
            const existing = existingStudentMap.get(item.rawRegNo)!;
            const rec = await prisma.student.update({
              where: { id: existing.id },
              data: {
                name: item.rawName,
                department: item.effectiveDept,
                batch_id: item.effectiveBatchId,
                section_id: item.effectiveSectionId,
                allocation_batch_id: item.effectiveAllocBatchId || existing.allocation_batch_id,
                sub_batch: item.effectiveSubBatch || existing.sub_batch,
                ...(item.effectiveCurrentYear ? { current_year: item.effectiveCurrentYear } : {}),
                leetcode_username: item.rawLeetCode,
                updated_at: new Date(),
              },
            });
            studentIdByRegNo.set(item.rawRegNo, rec.id);
            newlyCreatedOrUpdatedIds.push(rec.id);
            processedStudents.push(rec);
            updatedCount++;
          } catch (singleErr: any) {
            failedCount++;
            errors.push({ register_number: item.rawRegNo, error: singleErr?.message || 'Database error during update' });
          }
        }
      }
    }

    // 3. Ultra-fast bulk mentor assignment
    const assignmentsToInsert: Array<{ student_id: string; staff_id: string }> = [];
    const studentIdsToUnassign: string[] = [];
    const validStaffIds = new Set(staffList.map((s) => s.id));

    for (const item of preparedRows) {
      const studentId = studentIdByRegNo.get(item.rawRegNo);
      if (!studentId) continue;

      if (item.resolvedMentorId && validStaffIds.has(item.resolvedMentorId)) {
        assignmentsToInsert.push({
          student_id: studentId,
          staff_id: item.resolvedMentorId,
        });
      } else if (item.isExplicitlyUnassigned) {
        studentIdsToUnassign.push(studentId);
      }
    }

    const allAffectedStudentIds = Array.from(
      new Set([...assignmentsToInsert.map((a) => a.student_id), ...studentIdsToUnassign])
    );

    if (allAffectedStudentIds.length > 0) {
      try {
        await prisma.$transaction([
          prisma.staffStudentAssignment.deleteMany({
            where: { student_id: { in: allAffectedStudentIds } },
          }),
          ...(assignmentsToInsert.length > 0
            ? [
                prisma.staffStudentAssignment.createMany({
                  data: assignmentsToInsert,
                  skipDuplicates: true,
                }),
              ]
            : []),
        ]);
      } catch (assignBatchErr: any) {
        console.warn('[Import] Bulk mentor assignment transaction error, falling back to sequential:', assignBatchErr?.message || assignBatchErr);
        for (const a of assignmentsToInsert) {
          try {
            await prisma.staffStudentAssignment.deleteMany({ where: { student_id: a.student_id } });
            await prisma.staffStudentAssignment.create({ data: a });
          } catch {
            // Ignore single assignment error
          }
        }
      }
    }
  }

  // 4. Return all newly imported student IDs so the frontend AutoSyncDaemon can sync them smoothly
  const unsyncedStudentIds: string[] = newlyCreatedOrUpdatedIds;

  // Invalidate caches so lists and dashboard metrics update immediately
  serverCache.invalidate();

  // Trigger background Google Sheets sync asynchronously without holding the HTTP response
  if (newlyCreatedOrUpdatedIds.length > 0 && process.env.NODE_ENV !== 'test') {
    setTimeout(async () => {
      try {
        await syncAllActiveGoogleSheets();
      } catch (sheetErr: any) {
        console.warn(`[Import-Sync] Background Google Sheet sync note:`, sheetErr?.message || sheetErr);
      }
    }, 100);
  }

  return {
    message: `Successfully processed ${students.length} record(s): ${createdCount} created, ${updatedCount} updated, ${failedCount} failed.`,
    totalProcessed: students.length,
    createdCount,
    updatedCount,
    failedCount,
    unsyncedStudentIds,
    errors,
    students: processedStudents,
  };
}
