import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { serverCache } from '../utils/serverCache.js';
import {
  isStaffAuthorizedForStudent,
  getAuthorizedStudentIdsForStaff,
} from './studentAuthorizationService.js';
import { UserRole } from '../types/index.js';

function attachMentorInfo(st: any) {
  if (!st) return st;
  if (!process.env.DATABASE_URL) {
    const ssa = inMemoryStore.staffStudentAssignments.find((a) => a.student_id === st.id);
    const mentorUser = ssa ? inMemoryStore.users.find((u) => u.id === ssa.staff_id) : null;
    return {
      ...st,
      mentor_id: mentorUser?.id || null,
      mentor: mentorUser ? { id: mentorUser.id, name: mentorUser.name, email: mentorUser.email } : null,
    };
  }

  const ssa = st.staff_student_assignments?.[0];
  const mentorUser = ssa?.staff;
  return {
    id: st.id,
    register_number: st.register_number,
    name: st.name,
    department: st.department,
    batch_id: st.batch_id,
    section_id: st.section_id,
    allocation_batch_id: st.allocation_batch_id,
    sub_batch: st.sub_batch,
    current_year: st.current_year,
    leetcode_username: st.leetcode_username,
    created_at: st.created_at,
    updated_at: st.updated_at,
    batch: st.batch,
    section: st.section,
    allocation_batch: st.allocation_batch,
    snapshots: st.snapshots,
    mentor_id: mentorUser?.id || null,
    mentor: mentorUser ? { id: mentorUser.id, name: mentorUser.name, email: mentorUser.email } : null,
  };
}

export async function getStudentsForUser(
  user: { userId: string; role: UserRole },
  filters?: {
    batchId?: string;
    sectionId?: string;
    department?: string;
    search?: string;
    allocationBatchId?: string;
    mentorId?: string;
    currentYear?: string;
  }
) {
  const cacheKey = `students_${user.userId}_${JSON.stringify(filters || {})}`;
  return serverCache.wrap(cacheKey, 15000, async () => {
    if (!process.env.DATABASE_URL) {
      let list = [...inMemoryStore.students];

      if (user.role === 'STAFF') {
        const authIds = await getAuthorizedStudentIdsForStaff(user.userId);
        list = list.filter((st) => authIds.includes(st.id));
      }

      if (filters?.batchId) {
        list = list.filter((st) => st.batch_id === filters.batchId);
      }
      if (filters?.sectionId) {
        list = list.filter((st) => st.section_id === filters.sectionId);
      }
      if (filters?.department) {
        list = list.filter((st) => st.department.toLowerCase().includes(filters.department!.toLowerCase()));
      }
      if (filters?.allocationBatchId) {
        const val = filters.allocationBatchId;
        list = list.filter((st) => st.allocation_batch_id === val || st.sub_batch === val);
      }
      if (filters?.currentYear) {
        const yr = filters.currentYear.trim().toLowerCase();
        list = list.filter((st) => (st.current_year || '').toLowerCase().includes(yr));
      }
      if (filters?.mentorId) {
        const mentorAssignments = inMemoryStore.staffStudentAssignments
          .filter((ssa) => ssa.staff_id === filters.mentorId)
          .map((ssa) => ssa.student_id);
        list = list.filter((st) => mentorAssignments.includes(st.id));
      }
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        list = list.filter(
          (st) =>
            st.name.toLowerCase().includes(s) ||
            st.register_number.toLowerCase().includes(s) ||
            (st.leetcode_username && st.leetcode_username.toLowerCase().includes(s))
        );
      }

      return list.map((st) => {
        const b = inMemoryStore.batches.find((batch) => batch.id === st.batch_id);
        const sec = inMemoryStore.sections.find((section) => section.id === st.section_id);
        const base = {
          ...st,
          batch: { id: st.batch_id, batch_name: b?.batch_name || 'Batch', department: st.department },
          section: { id: st.section_id, name: sec?.name || 'A' },
        };
        return attachMentorInfo(base);
      });
    }

    const andClauses: any[] = [];

    if (filters?.batchId) {
      andClauses.push({ batch_id: filters.batchId });
    }

    if (filters?.sectionId) {
      andClauses.push({ section_id: filters.sectionId });
    }

    if (filters?.department) {
      andClauses.push({ department: { contains: filters.department.trim(), mode: 'insensitive' } });
    }

    if (filters?.mentorId) {
      andClauses.push({
        staff_student_assignments: {
          some: { staff_id: filters.mentorId },
        },
      });
    }

    if (filters?.allocationBatchId) {
      const val = filters.allocationBatchId.trim();
      andClauses.push({
        OR: [
          { allocation_batch_id: val },
          { allocation_batch: { name: { equals: val, mode: 'insensitive' } } },
          { sub_batch: { equals: val, mode: 'insensitive' } },
        ],
      });
    }

    if (filters?.currentYear) {
      andClauses.push({
        current_year: { contains: filters.currentYear.trim(), mode: 'insensitive' },
      });
    }

    if (filters?.search) {
      const search = filters.search.trim();
      andClauses.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { register_number: { contains: search, mode: 'insensitive' } },
          { leetcode_username: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    // High-Performance Security Scoping for STAFF users:
    // Evaluated in a single PostgreSQL query via native foreign key relation indexes
    if (user.role === 'STAFF') {
      andClauses.push({
        OR: [
          { staff_student_assignments: { some: { staff_id: user.userId } } },
          { section: { staff_section_assignments: { some: { staff_id: user.userId, assignment_mode: 'ALL' } } } },
          { allocation_batch: { staff_section_assignments: { some: { staff_id: user.userId } } } },
          { batch: { staff_batch_assignments: { some: { staff_id: user.userId } } } },
        ],
      });
    }

    const where: any = andClauses.length > 0 ? { AND: andClauses } : {};

    const students = await prisma.student.findMany({
      where,
      include: {
        batch: { select: { id: true, batch_name: true, department: true } },
        section: { select: { id: true, name: true } },
        allocation_batch: { select: { id: true, name: true } },
        staff_student_assignments: {
          take: 1,
          select: {
            staff: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { register_number: 'asc' },
    });

    return students.map(attachMentorInfo);
  });
}

export async function getStudentByIdForUser(
  user: { userId: string; role: UserRole },
  studentId: string
) {
  // Security Enforcement for STAFF users
  if (user.role === 'STAFF') {
    const isAuthorized = await isStaffAuthorizedForStudent(user.userId, studentId);
    if (!isAuthorized) {
      const err: any = new Error('Forbidden: You are not authorized to view this student');
      err.statusCode = 403;
      throw err;
    }
  }

  if (!process.env.DATABASE_URL) {
    const st = inMemoryStore.students.find((s) => s.id === studentId);
    if (!st) {
      const notFoundErr: any = new Error('Student not found');
      notFoundErr.statusCode = 404;
      throw notFoundErr;
    }
    const b = inMemoryStore.batches.find((batch) => batch.id === st.batch_id);
    const sec = inMemoryStore.sections.find((section) => section.id === st.section_id);

    const base = {
      ...st,
      batch: { id: st.batch_id, batch_name: b?.batch_name || 'Batch', department: st.department },
      section: { id: st.section_id, name: sec?.name || 'A' },
      snapshots: inMemoryStore.snapshots.filter((snap) => snap.student_id === studentId),
    };
    return attachMentorInfo(base);
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      batch: { select: { id: true, batch_name: true, department: true } },
      section: { select: { id: true, name: true } },
      allocation_batch: { select: { id: true, name: true } },
      snapshots: { orderBy: { snapshot_date: 'desc' } },
      staff_student_assignments: {
        include: {
          staff: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!student) {
    const notFoundErr: any = new Error('Student not found');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  return attachMentorInfo(student);
}

async function validateActiveStaffMentor(mentorId?: string) {
  if (!mentorId) return;
  if (!process.env.DATABASE_URL) {
    const stf = inMemoryStore.users.find(
      (u) => u.id === mentorId && u.role === 'STAFF' && u.is_active
    );
    if (!stf) {
      const err: any = new Error('Invalid mentor: Selected mentor must be an active STAFF member');
      err.statusCode = 400;
      throw err;
    }
  } else {
    const stf = await prisma.user.findFirst({
      where: {
        id: mentorId,
        role: 'STAFF',
        is_active: true,
      },
    });
    if (!stf) {
      const err: any = new Error('Invalid mentor: Selected mentor must be an active STAFF member');
      err.statusCode = 400;
      throw err;
    }
  }
}

export async function createStudent(data: {
  register_number: string;
  name: string;
  department: string;
  batch_id: string;
  section_id: string;
  sub_batch?: string;
  allocation_batch_id?: string;
  current_year?: string;
  leetcode_username?: string;
  mentor_id?: string;
}) {
  const register_number = data.register_number.trim().toUpperCase();

  serverCache.invalidate('students_');
  serverCache.invalidate('stats_');
  serverCache.invalidate('batch');

  if (!data.leetcode_username || !data.leetcode_username.trim()) {
    const err: any = new Error('LeetCode username is required');
    err.statusCode = 400;
    throw err;
  }

  if (data.mentor_id) {
    await validateActiveStaffMentor(data.mentor_id);
  }

  // Resolve allocation_batch_id and sub_batch bidirectionally
  let resolvedAllocBatchId = data.allocation_batch_id || null;
  let resolvedSubBatch = data.sub_batch ? data.sub_batch.trim() : null;

  if (!process.env.DATABASE_URL) {
    if (resolvedAllocBatchId && !resolvedSubBatch) {
      const ab = inMemoryStore.allocationBatches.find((b) => b.id === resolvedAllocBatchId);
      if (ab) resolvedSubBatch = ab.name;
    } else if (!resolvedAllocBatchId && resolvedSubBatch) {
      const ab = inMemoryStore.allocationBatches.find(
        (b) => b.section_id === data.section_id && b.name.toLowerCase() === resolvedSubBatch!.toLowerCase()
      );
      if (ab) resolvedAllocBatchId = ab.id;
    }

    const existing = inMemoryStore.students.find((st) => st.register_number === register_number);
    if (existing) {
      const conflictErr: any = new Error(`Student with register number '${register_number}' already exists`);
      conflictErr.statusCode = 409;
      throw conflictErr;
    }

    const newStudent = {
      id: `st_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      register_number,
      name: data.name.trim(),
      department: data.department.trim(),
      batch_id: data.batch_id,
      section_id: data.section_id,
      sub_batch: resolvedSubBatch,
      allocation_batch_id: resolvedAllocBatchId,
      current_year: data.current_year || null,
      leetcode_username: data.leetcode_username?.trim() || null,
      mentor_id: data.mentor_id || null,
      created_at: new Date(),
    };
    inMemoryStore.students.push(newStudent);

    if (data.mentor_id) {
      inMemoryStore.staffStudentAssignments.push({
        id: `ssa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        staff_id: data.mentor_id,
        student_id: newStudent.id,
        created_at: new Date(),
      });
    }

    const b = inMemoryStore.batches.find((batch) => batch.id === data.batch_id);
    const sec = inMemoryStore.sections.find((section) => section.id === data.section_id);

    const base = {
      ...newStudent,
      batch: { id: data.batch_id, batch_name: b?.batch_name || 'Batch' },
      section: { id: data.section_id, name: sec?.name || 'A' },
    };
    return attachMentorInfo(base);
  }

  // PostgreSQL Mode: Optimized Atomic Creation
  try {
    const student = await prisma.student.create({
      data: {
        register_number,
        name: data.name.trim(),
        department: data.department.trim(),
        batch_id: data.batch_id,
        section_id: data.section_id,
        sub_batch: resolvedSubBatch,
        allocation_batch_id: resolvedAllocBatchId,
        current_year: data.current_year || null,
        leetcode_username: data.leetcode_username?.trim() || null,
        ...(data.mentor_id ? {
          staff_student_assignments: {
            create: {
              staff_id: data.mentor_id,
            },
          },
        } : {}),
      },
      include: {
        batch: { select: { id: true, batch_name: true, department: true } },
        section: { select: { id: true, name: true } },
        allocation_batch: { select: { id: true, name: true } },
        staff_student_assignments: {
          include: {
            staff: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    return attachMentorInfo(student);
  } catch (createErr: any) {
    if (createErr.code === 'P2002') {
      const conflictErr: any = new Error(`Student with register number '${register_number}' already exists`);
      conflictErr.statusCode = 409;
      throw conflictErr;
    }
    throw createErr;
  }
}

export async function updateStudent(
  studentId: string,
  data: {
    register_number?: string;
    name?: string;
    department?: string;
    batch_id?: string;
    section_id?: string;
    sub_batch?: string;
    allocation_batch_id?: string;
    current_year?: string;
    leetcode_username?: string;
    mentor_id?: string;
  }
) {
  serverCache.invalidate('students_');
  serverCache.invalidate('stats_');
  serverCache.invalidate('batch');

  const updateData: any = {};
  if (data.register_number) {
    const cleanReg = data.register_number.trim().toUpperCase();
    if (!process.env.DATABASE_URL) {
      const conflict = inMemoryStore.students.find((s) => s.register_number === cleanReg && s.id !== studentId);
      if (conflict) {
        const conflictErr: any = new Error(`Student with register number '${cleanReg}' already exists`);
        conflictErr.statusCode = 409;
        throw conflictErr;
      }
    } else {
      const conflict = await prisma.student.findFirst({
        where: { register_number: cleanReg, NOT: { id: studentId } },
      });
      if (conflict) {
        const conflictErr: any = new Error(`Student with register number '${cleanReg}' already exists`);
        conflictErr.statusCode = 409;
        throw conflictErr;
      }
    }
    updateData.register_number = cleanReg;
  }
  if (data.name) updateData.name = data.name.trim();
  if (data.department) updateData.department = data.department.trim();
  if (data.batch_id) updateData.batch_id = data.batch_id;
  if (data.section_id) updateData.section_id = data.section_id;

  let newAllocBatchId: string | null | undefined = data.allocation_batch_id;
  let newSubBatch: string | null | undefined = data.sub_batch;

  if (newAllocBatchId !== undefined || newSubBatch !== undefined) {
    if (newAllocBatchId) {
      const searchAlloc = newAllocBatchId;
      if (!process.env.DATABASE_URL) {
        let ab = inMemoryStore.allocationBatches.find((b) => b.id === searchAlloc);
        if (!ab) {
          ab = inMemoryStore.allocationBatches.find((b) => b.name.toLowerCase() === searchAlloc.toLowerCase());
        }
        if (ab) {
          newAllocBatchId = ab.id;
          newSubBatch = ab.name;
        }
      } else {
        let ab = await prisma.allocationBatch.findUnique({ where: { id: searchAlloc } }).catch(() => null);
        if (!ab) {
          const targetSecId = data.section_id || updateData.section_id;
          let whereAb: any = { name: { equals: searchAlloc, mode: 'insensitive' } };
          if (targetSecId) whereAb.section_id = targetSecId;
          ab = await prisma.allocationBatch.findFirst({ where: whereAb });
        }
        if (ab) {
          newAllocBatchId = ab.id;
          newSubBatch = ab.name;
        } else {
          newSubBatch = searchAlloc;
          newAllocBatchId = null;
        }
      }
    } else if (newSubBatch) {
      const targetSecId = data.section_id || updateData.section_id;
      if (!process.env.DATABASE_URL) {
        const ab = inMemoryStore.allocationBatches.find(
          (b) => (!targetSecId || b.section_id === targetSecId) && b.name.toLowerCase() === newSubBatch!.toLowerCase()
        );
        if (ab) {
          newAllocBatchId = ab.id;
          newSubBatch = ab.name;
        }
      } else {
        let whereAb: any = { name: { equals: newSubBatch.trim(), mode: 'insensitive' } };
        if (targetSecId) whereAb.section_id = targetSecId;
        const ab = await prisma.allocationBatch.findFirst({ where: whereAb });
        if (ab) {
          newAllocBatchId = ab.id;
          newSubBatch = ab.name;
        }
      }
    }

    if (newAllocBatchId !== undefined) updateData.allocation_batch_id = newAllocBatchId;
    if (newSubBatch !== undefined) updateData.sub_batch = newSubBatch || null;
  }

  if (data.current_year !== undefined) updateData.current_year = data.current_year;
  if (data.leetcode_username !== undefined) updateData.leetcode_username = data.leetcode_username ? data.leetcode_username.trim() : null;

  if (data.mentor_id !== undefined) {
    updateData.mentor_id = data.mentor_id || null;
    if (data.mentor_id) {
      await validateActiveStaffMentor(data.mentor_id);
    }
    if (!process.env.DATABASE_URL) {
      inMemoryStore.staffStudentAssignments = inMemoryStore.staffStudentAssignments.filter(
        (a) => a.student_id !== studentId
      );
      if (data.mentor_id) {
        inMemoryStore.staffStudentAssignments.push({
          id: `ssa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          staff_id: data.mentor_id,
          student_id: studentId,
          created_at: new Date(),
        });
      }
    } else {
      await prisma.staffStudentAssignment.deleteMany({
        where: { student_id: studentId },
      });
      if (data.mentor_id) {
        await prisma.staffStudentAssignment.create({
          data: {
            staff_id: data.mentor_id,
            student_id: studentId,
          },
        });
      }
    }
    delete updateData.mentor_id;
  }

  if (!process.env.DATABASE_URL) {
    const st = inMemoryStore.students.find((s) => s.id === studentId);
    if (!st) throw new Error('Student not found');
    Object.assign(st, updateData);

    const b = inMemoryStore.batches.find((batch) => batch.id === st.batch_id);
    const sec = inMemoryStore.sections.find((section) => section.id === st.section_id);

    const base = {
      ...st,
      batch: { id: st.batch_id, batch_name: b?.batch_name || 'Batch' },
      section: { id: st.section_id, name: sec?.name || 'A' },
    };
    return attachMentorInfo(base);
  }

  const updated = await prisma.student.update({
    where: { id: studentId },
    data: updateData,
    include: {
      batch: { select: { id: true, batch_name: true } },
      section: { select: { id: true, name: true } },
      staff_student_assignments: {
        include: {
          staff: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  return attachMentorInfo(updated);
}

export async function deleteStudent(studentId: string) {
  serverCache.invalidate('students_');
  serverCache.invalidate('stats_');
  serverCache.invalidate('batch');

  if (!process.env.DATABASE_URL) {
    inMemoryStore.students = inMemoryStore.students.filter((s) => s.id !== studentId);
    inMemoryStore.staffStudentAssignments = inMemoryStore.staffStudentAssignments.filter((sa) => sa.student_id !== studentId);
    return { message: 'Student deleted successfully' };
  }

  await prisma.student.delete({
    where: { id: studentId },
  });
  return { message: 'Student deleted successfully' };
}

export async function bulkDeleteStudents(studentIds: string[]) {
  serverCache.invalidate('students_');
  serverCache.invalidate('stats_');
  serverCache.invalidate('batch');

  if (!process.env.DATABASE_URL) {
    inMemoryStore.students = inMemoryStore.students.filter((s) => !studentIds.includes(s.id));
    inMemoryStore.staffStudentAssignments = inMemoryStore.staffStudentAssignments.filter((sa) => !studentIds.includes(sa.student_id));
    return { message: `${studentIds.length} students deleted successfully` };
  }

  await prisma.student.deleteMany({
    where: { id: { in: studentIds } },
  });
  return { message: `${studentIds.length} students deleted successfully` };
}

