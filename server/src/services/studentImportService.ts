import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { UserRole } from '../types/index.js';
import { syncStudentLeetCode } from './leetcodeService.js';

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
    .replace(/^(dr|mr|mrs|ms|prof)\.?\s*/i, '')
    .replace(/[^a-z0-9]/g, '');
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

  // 1. Fetch available staff list for mentor matching
  let staffList: Array<{ id: string; name: string; email: string }> = [];
  if (!process.env.DATABASE_URL) {
    staffList = inMemoryStore.users
      .filter((u) => u.role === 'STAFF' && u.is_active)
      .map((u) => ({ id: u.id, name: u.name, email: u.email }));
  } else {
    staffList = await prisma.user.findMany({
      where: { role: 'STAFF', is_active: true },
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
    const effectiveSectionId = row.section_id || defaultSectionId;
    const effectiveDept = row.department || defaultDept;
    const effectiveAllocBatchId = row.allocation_batch_id || defaultAllocBatchId || null;
    const effectiveSubBatch = row.sub_batch || defaultSubBatch || null;
    const effectiveCurrentYear = row.current_year || targetScope?.current_year || undefined;

    if (!effectiveBatchId || !effectiveSectionId) {
      failedCount++;
      errors.push({
        register_number: rawRegNo,
        error: 'No target Batch / Section could be resolved for student',
      });
      continue;
    }

    // Resolve Mentor
    let resolvedMentorId: string | null = row.mentor_id || null;
    if (!resolvedMentorId && row.mentor_name) {
      const rawMName = row.mentor_name.trim();
      const normInput = normalizeForMatching(rawMName);

      // Exact match
      const matched = staffList.find(
        (stf) =>
          normalizeForMatching(stf.name) === normInput ||
          normalizeForMatching(stf.name).includes(normInput) ||
          normInput.includes(normalizeForMatching(stf.name))
      );

      if (matched) {
        resolvedMentorId = matched.id;
      }
    }

    // Default to current logged-in staff if they are STAFF role and no mentor was specified
    if (!resolvedMentorId && user.role === 'STAFF') {
      resolvedMentorId = user.userId;
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
            created_at: new Date(),
          });
          createdCount++;
        }

        // Mentor Assignment
        if (resolvedMentorId) {
          const assignIdx = inMemoryStore.staffStudentAssignments.findIndex(
            (a) => a.student_id === studentId
          );
          if (assignIdx >= 0) {
            inMemoryStore.staffStudentAssignments[assignIdx].staff_id = resolvedMentorId;
          } else {
            inMemoryStore.staffStudentAssignments.push({
              id: `ssa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              staff_id: resolvedMentorId,
              student_id: studentId,
              created_at: new Date(),
            });
          }
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

        // Mentor Assignment
        if (resolvedMentorId && studentRecord) {
          const existingAssign = await prisma.staffStudentAssignment.findFirst({
            where: { student_id: studentRecord.id },
          });

          if (existingAssign) {
            await prisma.staffStudentAssignment.update({
              where: { id: existingAssign.id },
              data: { staff_id: resolvedMentorId },
            });
          } else {
            await prisma.staffStudentAssignment.create({
              data: {
                student_id: studentRecord.id,
                staff_id: resolvedMentorId,
              },
            });
          }
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

  // 4. Trigger initial background LeetCode fetch for imported students (asynchronous non-blocking)
  if (newlyCreatedOrUpdatedIds.length > 0) {
    const authContext = { userId: user.userId, role: user.role };
    Promise.allSettled(
      newlyCreatedOrUpdatedIds.slice(0, 30).map((stId) => syncStudentLeetCode(stId, authContext))
    ).catch(() => {});
  }

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
