import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';

export async function isStaffAuthorizedForStudent(
  staffId: string,
  studentId: string
): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    const direct = inMemoryStore.staffStudentAssignments.some((sa) => sa.staff_id === staffId && sa.student_id === studentId);
    if (direct) return true;

    const student = inMemoryStore.students.find((s) => s.id === studentId);
    if (!student) return false;

    const secAssign = inMemoryStore.staffSectionAssignments.find((sa) => {
      if (sa.staff_id !== staffId || sa.section_id !== student.section_id) return false;
      if (sa.assignment_mode === 'ALL') return true;
      if (sa.allocation_batch_id && sa.allocation_batch_id === student.allocation_batch_id) return true;
      return false;
    });
    if (secAssign) return true;

    const batchAssign = inMemoryStore.staffBatchAssignments.find(
      (ba) => ba.staff_id === staffId && ba.batch_id === student.batch_id
    );
    return !!batchAssign;
  }

  // 1. Direct Student Assignment check
  const directAssignment = await prisma.staffStudentAssignment.findUnique({
    where: {
      staff_id_student_id: {
        staff_id: staffId,
        student_id: studentId,
      },
    },
  });

  if (directAssignment) {
    return true;
  }

  // 2. Fetch student's section_id, batch_id & allocation_batch_id
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { section_id: true, batch_id: true, allocation_batch_id: true, sub_batch: true },
  });

  if (!student) {
    return false;
  }

  // 3. Section Assignment check (Mode: ALL or matching allocation_batch_id)
  const sectionAssignments = await prisma.staffSectionAssignment.findMany({
    where: {
      staff_id: staffId,
      section_id: student.section_id,
    },
  });

  const matchingSec = sectionAssignments.find((sa) => {
    if (sa.assignment_mode === 'ALL') return true;
    if (sa.allocation_batch_id && student.allocation_batch_id && sa.allocation_batch_id === student.allocation_batch_id) return true;
    return false;
  });

  if (matchingSec) {
    return true;
  }

  // 4. Batch Assignment check (Staff assigned to whole Batch)
  const batchAssignment = await prisma.staffBatchAssignment.findFirst({
    where: {
      staff_id: staffId,
      batch_id: student.batch_id,
    },
  });

  return !!batchAssignment;
}

export async function isStaffAuthorizedForBatch(
  staffId: string,
  batchId: string
): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    const isDirectBatch = inMemoryStore.staffBatchAssignments.some((s) => s.staff_id === staffId && s.batch_id === batchId);
    if (isDirectBatch) return true;

    const assignedSecIds = inMemoryStore.staffSectionAssignments.filter((s) => s.staff_id === staffId).map((s) => s.section_id);
    const hasSecInBatch = inMemoryStore.sections.some((sec) => assignedSecIds.includes(sec.id) && sec.batch_id === batchId);
    if (hasSecInBatch) return true;

    const assignedStudentIds = inMemoryStore.staffStudentAssignments.filter((s) => s.staff_id === staffId).map((s) => s.student_id);
    const hasStudentInBatch = inMemoryStore.students.some((st) => assignedStudentIds.includes(st.id) && st.batch_id === batchId);
    return hasStudentInBatch;
  }

  const directBatch = await prisma.staffBatchAssignment.findFirst({
    where: { staff_id: staffId, batch_id: batchId },
  });
  if (directBatch) return true;

  const sectionAssigned = await prisma.staffSectionAssignment.findFirst({
    where: {
      staff_id: staffId,
      section: { batch_id: batchId },
    },
  });
  if (sectionAssigned) return true;

  const studentAssigned = await prisma.staffStudentAssignment.findFirst({
    where: {
      staff_id: staffId,
      student: { batch_id: batchId },
    },
  });
  return !!studentAssigned;
}

export async function isStaffAuthorizedForSection(
  staffId: string,
  sectionId: string
): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    const secAssign = inMemoryStore.staffSectionAssignments.find(
      (sa) => sa.staff_id === staffId && sa.section_id === sectionId
    );
    if (secAssign) return true;

    const directBatch = inMemoryStore.sections.find((s) => s.id === sectionId);
    if (directBatch) {
      const bAssign = inMemoryStore.staffBatchAssignments.find((ba) => ba.staff_id === staffId && ba.batch_id === directBatch.batch_id);
      if (bAssign) return true;
    }

    const assignedSts = inMemoryStore.staffStudentAssignments.filter((s) => s.staff_id === staffId).map((s) => s.student_id);
    return inMemoryStore.students.some((st) => assignedSts.includes(st.id) && st.section_id === sectionId);
  }

  const sectionAssignment = await prisma.staffSectionAssignment.findFirst({
    where: { staff_id: staffId, section_id: sectionId },
  });
  if (sectionAssignment) return true;

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { batch_id: true },
  });
  if (!section) return false;

  const batchAssignment = await prisma.staffBatchAssignment.findFirst({
    where: { staff_id: staffId, batch_id: section.batch_id },
  });
  if (batchAssignment) return true;

  const studentAssignment = await prisma.staffStudentAssignment.findFirst({
    where: {
      staff_id: staffId,
      student: { section_id: sectionId },
    },
  });
  return !!studentAssignment;
}

export async function getAuthorizedStudentIdsForStaff(
  staffId: string
): Promise<string[]> {
  if (!process.env.DATABASE_URL) {
    const studentIds = new Set<string>();

    const direct = inMemoryStore.staffStudentAssignments.filter((sa) => sa.staff_id === staffId);
    direct.forEach((sa) => studentIds.add(sa.student_id));

    const secAssigns = inMemoryStore.staffSectionAssignments.filter((sa) => sa.staff_id === staffId);
    secAssigns.forEach((sa) => {
      if (sa.assignment_mode === 'ALL') {
        const secStudents = inMemoryStore.students.filter((st) => st.section_id === sa.section_id);
        secStudents.forEach((st) => studentIds.add(st.id));
      } else if (sa.allocation_batch_id) {
        const secStudents = inMemoryStore.students.filter(
          (st) => st.section_id === sa.section_id && st.allocation_batch_id === sa.allocation_batch_id
        );
        secStudents.forEach((st) => studentIds.add(st.id));
      }
    });

    const batchAssigns = inMemoryStore.staffBatchAssignments.filter((sa) => sa.staff_id === staffId);
    const batchIds = batchAssigns.map((ba) => ba.batch_id);

    const batchStudents = inMemoryStore.students.filter((st) => batchIds.includes(st.batch_id));
    batchStudents.forEach((st) => studentIds.add(st.id));

    return Array.from(studentIds);
  }

  const studentIds = new Set<string>();

  // 1. Fetch direct student assignments
  const directAssignments = await prisma.staffStudentAssignment.findMany({
    where: { staff_id: staffId },
    select: { student_id: true },
  });

  directAssignments.forEach((assignment) => {
    studentIds.add(assignment.student_id);
  });

  // 2. Fetch section assignments (ALL or specific allocation_batch_id)
  const sectionAssignments = await prisma.staffSectionAssignment.findMany({
    where: { staff_id: staffId },
    select: { section_id: true, assignment_mode: true, allocation_batch_id: true },
  });

  for (const sa of sectionAssignments) {
    if (sa.assignment_mode === 'ALL') {
      const sectionStudents = await prisma.student.findMany({
        where: { section_id: sa.section_id },
        select: { id: true },
      });
      sectionStudents.forEach((st) => studentIds.add(st.id));
    } else if (sa.allocation_batch_id) {
      const batchStudents = await prisma.student.findMany({
        where: {
          section_id: sa.section_id,
          allocation_batch_id: sa.allocation_batch_id,
        },
        select: { id: true },
      });
      batchStudents.forEach((st) => studentIds.add(st.id));
    }
  }

  // 3. Fetch batch assignments (Staff assigned to whole Batch)
  const batchAssignments = await prisma.staffBatchAssignment.findMany({
    where: { staff_id: staffId },
    select: { batch_id: true },
  });

  if (batchAssignments.length > 0) {
    const batchIds = batchAssignments.map((b) => b.batch_id);
    const batchStudents = await prisma.student.findMany({
      where: {
        batch_id: { in: batchIds },
      },
      select: { id: true },
    });

    batchStudents.forEach((student) => {
      studentIds.add(student.id);
    });
  }

  return Array.from(studentIds);
}

export async function isStaffAuthorizedForAllocationBatch(
  staffId: string,
  allocationBatchId: string
): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    const secAssign = inMemoryStore.staffSectionAssignments.find((sa) => {
      if (sa.staff_id !== staffId) return false;
      if (sa.assignment_mode === 'ALL') return true;
      if (sa.allocation_batch_id === allocationBatchId) return true;
      return false;
    });
    if (secAssign) return true;

    const ab = inMemoryStore.allocationBatches.find((a) => a.id === allocationBatchId);
    if (ab) {
      const sec = inMemoryStore.sections.find((s) => s.id === ab.section_id);
      if (sec) {
        const bAssign = inMemoryStore.staffBatchAssignments.find((ba) => ba.staff_id === staffId && ba.batch_id === sec.batch_id);
        if (bAssign) return true;
      }
    }

    const assignedSts = inMemoryStore.staffStudentAssignments.filter((s) => s.staff_id === staffId).map((s) => s.student_id);
    return inMemoryStore.students.some((st) => assignedSts.includes(st.id) && (st.allocation_batch_id === allocationBatchId || st.sub_batch === allocationBatchId));
  }

  const sectionAssignment = await prisma.staffSectionAssignment.findFirst({
    where: {
      staff_id: staffId,
      OR: [
        { assignment_mode: 'ALL', section: { allocation_batches: { some: { id: allocationBatchId } } } },
        { allocation_batch_id: allocationBatchId },
      ],
    },
  });
  if (sectionAssignment) return true;

  const allocBatch = await prisma.allocationBatch.findUnique({
    where: { id: allocationBatchId },
    include: { section: true },
  });

  if (allocBatch) {
    const batchAssignment = await prisma.staffBatchAssignment.findFirst({
      where: { staff_id: staffId, batch_id: allocBatch.section.batch_id },
    });
    if (batchAssignment) return true;
  }

  const studentAssignment = await prisma.staffStudentAssignment.findFirst({
    where: {
      staff_id: staffId,
      student: { OR: [{ allocation_batch_id: allocationBatchId }, { sub_batch: allocationBatchId }] },
    },
  });

  return !!studentAssignment;
}

export async function isStaffAuthorizedForDepartment(
  staffId: string,
  department: string
): Promise<boolean> {
  const authorizedIds = await getAuthorizedStudentIdsForStaff(staffId);
  if (authorizedIds.length === 0) return false;

  if (!process.env.DATABASE_URL) {
    return inMemoryStore.students.some((st) => authorizedIds.includes(st.id) && st.department.toLowerCase() === department.toLowerCase());
  }

  const count = await prisma.student.count({
    where: {
      id: { in: authorizedIds },
      department: { equals: department.trim(), mode: 'insensitive' },
    },
  });
  return count > 0;
}

export async function isStaffAuthorizedForAcademicYear(
  staffId: string,
  academicYear: string
): Promise<boolean> {
  const authorizedIds = await getAuthorizedStudentIdsForStaff(staffId);
  if (authorizedIds.length === 0) return false;

  const years = academicYear.replace('–', '-').split('-');
  if (years.length !== 2) return true;
  const start = parseInt(years[0].trim(), 10);
  const end = parseInt(years[1].trim(), 10);

  if (!process.env.DATABASE_URL) {
    const matchingBatchIds = inMemoryStore.batches
      .filter((b) => b.start_year === start && b.end_year === end)
      .map((b) => b.id);
    return inMemoryStore.students.some((st) => authorizedIds.includes(st.id) && matchingBatchIds.includes(st.batch_id));
  }

  const count = await prisma.student.count({
    where: {
      id: { in: authorizedIds },
      batch: { start_year: start, end_year: end },
    },
  });
  return count > 0;
}
