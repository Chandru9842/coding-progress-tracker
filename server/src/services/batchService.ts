import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { serverCache } from '../utils/serverCache.js';

export async function getAllBatches() {
  return serverCache.wrap('all_batches', 15000, async () => {
    if (!process.env.DATABASE_URL) {
      return inMemoryStore.batches.map((b) => {
        const bSecs = inMemoryStore.sections.filter((s) => s.batch_id === b.id);
        const bStus = inMemoryStore.students.filter((st) => st.batch_id === b.id);
        return {
          ...b,
          sections: bSecs.map((sec) => ({
            ...sec,
            allocation_batches: inMemoryStore.allocationBatches
              .filter((ab) => ab.section_id === sec.id)
              .map((ab) => ({
                ...ab,
                _count: { students: inMemoryStore.students.filter((st) => st.allocation_batch_id === ab.id || st.sub_batch === ab.name).length },
              })),
            _count: { students: inMemoryStore.students.filter((st) => st.section_id === sec.id).length },
          })),
          _count: { students: bStus.length, sections: bSecs.length },
        };
      });
    }

    const batches = await prisma.batch.findMany({
      include: {
        sections: {
          select: {
            id: true,
            name: true,
            created_at: true,
            allocation_batches: {
              include: { _count: { select: { students: true } } },
              orderBy: { name: 'asc' },
            },
            _count: { select: { students: true } },
          },
        },
        _count: { select: { students: true, sections: true } },
      },
      orderBy: { start_year: 'desc' },
    });
    return batches;
  });
}

export async function getBatchesForStaff(staffId: string) {
  return serverCache.wrap(`staff_batches_${staffId}`, 15000, async () => {
    if (!process.env.DATABASE_URL) {
      const directBatchIds = inMemoryStore.staffBatchAssignments
        .filter((sba) => sba.staff_id === staffId)
        .map((sba) => sba.batch_id);

      const secAssignedIds = inMemoryStore.staffSectionAssignments
        .filter((ssa) => ssa.staff_id === staffId)
        .map((ssa) => ssa.section_id);
      const secBatchIds = inMemoryStore.sections
        .filter((sec) => secAssignedIds.includes(sec.id))
        .map((sec) => sec.batch_id);

      const stAssignedIds = inMemoryStore.staffStudentAssignments
        .filter((ssa) => ssa.staff_id === staffId)
        .map((ssa) => ssa.student_id);
      const stBatchIds = inMemoryStore.students
        .filter((st) => stAssignedIds.includes(st.id))
        .map((st) => st.batch_id);

      const allBatchIds = Array.from(new Set([...directBatchIds, ...secBatchIds, ...stBatchIds]));

      return inMemoryStore.batches
        .filter((b) => allBatchIds.includes(b.id))
        .map((b) => {
          const bSecs = inMemoryStore.sections.filter((s) => s.batch_id === b.id);
          const bStus = inMemoryStore.students.filter((st) => st.batch_id === b.id);
          return {
            ...b,
            sections: bSecs.map((sec) => ({
              ...sec,
              _count: { students: inMemoryStore.students.filter((st) => st.section_id === sec.id).length },
            })),
            _count: { students: bStus.length, sections: bSecs.length },
          };
        });
    }

    const batches = await prisma.batch.findMany({
      where: {
        OR: [
          { staff_batch_assignments: { some: { staff_id: staffId } } },
          { sections: { some: { staff_section_assignments: { some: { staff_id: staffId } } } } },
          { students: { some: { staff_student_assignments: { some: { staff_id: staffId } } } } },
        ],
      },
      include: {
        sections: {
          select: {
            id: true,
            name: true,
            created_at: true,
            allocation_batches: {
              include: { _count: { select: { students: true } } },
              orderBy: { name: 'asc' },
            },
            _count: { select: { students: true } },
          },
        },
        _count: { select: { students: true, sections: true } },
      },
      orderBy: { start_year: 'desc' },
    });

    return batches;
  });
}

export async function createBatch(data: {
  batch_name: string;
  start_year: number;
  end_year: number;
  department: string;
}) {
  if (Number(data.start_year) >= Number(data.end_year)) {
    throw new Error('Start year must be earlier than end year');
  }

  serverCache.invalidate('batch');
  serverCache.invalidate('all_batches');

  if (!process.env.DATABASE_URL) {
    const newBatch = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      batch_name: data.batch_name.trim(),
      start_year: Number(data.start_year),
      end_year: Number(data.end_year),
      department: data.department.trim(),
      created_at: new Date(),
    };
    inMemoryStore.batches.push(newBatch);
    return newBatch;
  }

  const batch = await prisma.batch.create({
    data: {
      batch_name: data.batch_name.trim(),
      start_year: Number(data.start_year),
      end_year: Number(data.end_year),
      department: data.department.trim(),
    },
  });
  return batch;
}

export async function updateBatch(
  batchId: string,
  data: {
    batch_name?: string;
    start_year?: number;
    end_year?: number;
    department?: string;
  }
) {
  const updateData: any = {};
  if (data.batch_name) updateData.batch_name = data.batch_name.trim();
  if (data.department) updateData.department = data.department.trim();
  if (data.start_year !== undefined) updateData.start_year = Number(data.start_year);
  if (data.end_year !== undefined) updateData.end_year = Number(data.end_year);

  if (updateData.start_year && updateData.end_year && updateData.start_year >= updateData.end_year) {
    throw new Error('Start year must be earlier than end year');
  }

  serverCache.invalidate('batch');
  serverCache.invalidate('all_batches');

  if (!process.env.DATABASE_URL) {
    const b = inMemoryStore.batches.find((b) => b.id === batchId);
    if (!b) throw new Error('Batch not found');
    Object.assign(b, updateData);
    return b;
  }

  const updated = await prisma.batch.update({
    where: { id: batchId },
    data: updateData,
  });
  return updated;
}

export async function deleteBatch(batchId: string) {
  serverCache.invalidate('batch');
  serverCache.invalidate('all_batches');

  if (!process.env.DATABASE_URL) {
    inMemoryStore.batches = inMemoryStore.batches.filter((b) => b.id !== batchId);
    inMemoryStore.sections = inMemoryStore.sections.filter((s) => s.batch_id !== batchId);
    return { message: 'Batch deleted successfully' };
  }

  await prisma.batch.delete({
    where: { id: batchId },
  });
  return { message: 'Batch deleted successfully' };
}

export async function getBatchById(batchId: string) {
  return serverCache.wrap(`batch_${batchId}`, 15000, async () => {
    if (!process.env.DATABASE_URL) {
      const b = inMemoryStore.batches.find((batch) => batch.id === batchId);
      if (!b) return null;
      const bSecs = inMemoryStore.sections.filter((s) => s.batch_id === b.id);
      const bStus = inMemoryStore.students.filter((st) => st.batch_id === b.id);
      return {
        ...b,
        sections: bSecs.map((sec) => ({
          ...sec,
          allocation_batches: inMemoryStore.allocationBatches
            .filter((ab) => ab.section_id === sec.id)
            .map((ab) => {
              const abStus = inMemoryStore.students.filter((st) => st.allocation_batch_id === ab.id || st.sub_batch === ab.name);
              const mentors = inMemoryStore.users.filter((u) =>
                inMemoryStore.staffStudentAssignments?.some((sa) => sa.staff_id === u.id && abStus.some((s) => s.id === sa.student_id))
              );
              return {
                ...ab,
                _count: { students: abStus.length },
                mentors: mentors.map((m) => ({ id: m.id, name: m.name, email: m.email })),
                mentor_names: mentors.map((m) => m.name).join(', '),
              };
            }),
          _count: { students: inMemoryStore.students.filter((st) => st.section_id === sec.id).length },
        })),
        staff_batch_assignments: [],
        _count: { students: bStus.length, sections: bSecs.length },
      };
    }

    // High-performance direct relational query without loading thousands of student rows
    const [batch, studentMentors] = await Promise.all([
      prisma.batch.findUnique({
        where: { id: batchId },
        include: {
          sections: {
            include: {
              allocation_batches: {
                include: {
                  _count: { select: { students: true } },
                  staff_section_assignments: {
                    include: {
                      staff: { select: { id: true, name: true, email: true } },
                    },
                  },
                },
                orderBy: { name: 'asc' },
              },
              staff_section_assignments: {
                include: {
                  staff: { select: { id: true, name: true, email: true } },
                },
              },
              _count: { select: { students: true } },
            },
            orderBy: { name: 'asc' },
          },
          staff_batch_assignments: {
            include: {
              staff: { select: { id: true, name: true, email: true } },
            },
          },
          _count: { select: { students: true, sections: true } },
        },
      }),
      prisma.staffStudentAssignment.findMany({
        where: {
          student: { batch_id: batchId, allocation_batch_id: { not: null } },
        },
        select: {
          staff: { select: { id: true, name: true, email: true } },
          student: { select: { allocation_batch_id: true } },
        },
      }),
    ]);

    if (!batch) return null;

    const mentorsByAlloc = new Map<string, Array<{ id: string; name: string; email: string }>>();
    studentMentors.forEach((sm) => {
      const abId = sm.student?.allocation_batch_id;
      if (abId && sm.staff) {
        if (!mentorsByAlloc.has(abId)) mentorsByAlloc.set(abId, []);
        mentorsByAlloc.get(abId)!.push(sm.staff);
      }
    });

    const enhancedSections = batch.sections.map((sec) => ({
      ...sec,
      allocation_batches: sec.allocation_batches.map((ab) => {
        const mentorsFromSection = ab.staff_section_assignments?.map((a) => a.staff) || [];
        const mentorsFromStudents = mentorsByAlloc.get(ab.id) || [];

        const uniqueMentorsMap = new Map<string, { id: string; name: string; email: string }>();
        [...mentorsFromSection, ...mentorsFromStudents].forEach((m) => {
          if (m && !uniqueMentorsMap.has(m.id)) {
            uniqueMentorsMap.set(m.id, m);
          }
        });
        const mentors = Array.from(uniqueMentorsMap.values());

        return {
          id: ab.id,
          section_id: ab.section_id,
          name: ab.name,
          created_at: ab.created_at,
          updated_at: ab.updated_at,
          _count: ab._count,
          mentors,
          mentor_names: mentors.map((m) => m.name).join(', '),
        };
      }),
    }));

    return {
      ...batch,
      sections: enhancedSections,
    };
  });
}

export async function createSection(batchId: string, name: string) {
  const sectionName = name.trim().toUpperCase();

  serverCache.invalidate('batch');
  serverCache.invalidate('all_batches');
  serverCache.invalidate('sections_');

  if (!process.env.DATABASE_URL) {
    const existing = inMemoryStore.sections.find((s) => s.batch_id === batchId && s.name === sectionName);
    if (existing) {
      const conflictErr: any = new Error(`Section '${sectionName}' already exists in this batch`);
      conflictErr.statusCode = 409;
      throw conflictErr;
    }

    const newSec = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      batch_id: batchId,
      name: sectionName,
      created_at: new Date(),
    };
    inMemoryStore.sections.push(newSec);
    return newSec;
  }

  const existing = await prisma.section.findUnique({
    where: {
      batch_id_name: {
        batch_id: batchId,
        name: sectionName,
      },
    },
  });

  if (existing) {
    const err: any = new Error(`Section '${sectionName}' already exists in this batch`);
    err.statusCode = 409;
    throw err;
  }

  const section = await prisma.section.create({
    data: {
      batch_id: batchId,
      name: sectionName,
    },
  });
  return section;
}

export async function updateSection(sectionId: string, name: string) {
  const sectionName = name.trim().toUpperCase();

  serverCache.invalidate('batch');
  serverCache.invalidate('all_batches');
  serverCache.invalidate('sections_');

  if (!process.env.DATABASE_URL) {
    const sec = inMemoryStore.sections.find((s) => s.id === sectionId);
    if (!sec) throw new Error('Section not found');
    sec.name = sectionName;
    return sec;
  }

  const existingSection = await prisma.section.findUnique({
    where: { id: sectionId },
  });

  if (!existingSection) {
    throw new Error('Section not found');
  }

  const duplicate = await prisma.section.findUnique({
    where: {
      batch_id_name: {
        batch_id: existingSection.batch_id,
        name: sectionName,
      },
    },
  });

  if (duplicate && duplicate.id !== sectionId) {
    const err: any = new Error(`Section '${sectionName}' already exists in this batch`);
    err.statusCode = 409;
    throw err;
  }

  const updated = await prisma.section.update({
    where: { id: sectionId },
    data: { name: sectionName },
  });
  return updated;
}

export async function deleteSection(sectionId: string) {
  serverCache.invalidate('batch');
  serverCache.invalidate('all_batches');
  serverCache.invalidate('sections_');
  serverCache.invalidate('alloc_batches_');

  if (!process.env.DATABASE_URL) {
    inMemoryStore.sections = inMemoryStore.sections.filter((s) => s.id !== sectionId);
    return { message: 'Section deleted successfully' };
  }

  await prisma.section.delete({
    where: { id: sectionId },
  });
  return { message: 'Section deleted successfully' };
}

export async function getSectionsByBatch(batchId: string) {
  return serverCache.wrap(`sections_${batchId}`, 15000, async () => {
    if (!process.env.DATABASE_URL) {
      return inMemoryStore.sections
        .filter((s) => s.batch_id === batchId)
        .map((sec) => ({
          ...sec,
          allocation_batches: inMemoryStore.allocationBatches
            .filter((ab) => ab.section_id === sec.id)
            .map((ab) => ({
              ...ab,
              _count: { students: inMemoryStore.students.filter((st) => st.allocation_batch_id === ab.id || st.sub_batch === ab.name).length },
            })),
          _count: { students: inMemoryStore.students.filter((st) => st.section_id === sec.id).length },
        }));
    }

    const sections = await prisma.section.findMany({
      where: { batch_id: batchId },
      include: {
        allocation_batches: {
          select: { id: true, name: true, _count: { select: { students: true } } },
          orderBy: { name: 'asc' },
        },
        _count: { select: { students: true } },
      },
      orderBy: { name: 'asc' },
    });
    return sections;
  });
}

export async function getAllocationBatchesBySection(sectionId: string) {
  return serverCache.wrap(`alloc_batches_${sectionId}`, 15000, async () => {
    if (!process.env.DATABASE_URL) {
      return inMemoryStore.allocationBatches
        .filter((ab) => ab.section_id === sectionId)
        .map((ab) => ({
          ...ab,
          _count: { students: inMemoryStore.students.filter((st) => st.allocation_batch_id === ab.id || st.sub_batch === ab.name).length },
        }));
    }

    const allocationBatches = await prisma.allocationBatch.findMany({
      where: { section_id: sectionId },
      include: {
        _count: { select: { students: true } },
      },
      orderBy: { name: 'asc' },
    });
    return allocationBatches;
  });
}

export async function createAllocationBatch(sectionId: string, name: string) {
  const cleanName = name.trim();

  serverCache.invalidate('batch');
  serverCache.invalidate('alloc_batches_');
  serverCache.invalidate('sections_');

  if (!process.env.DATABASE_URL) {
    const existing = inMemoryStore.allocationBatches.find(
      (ab) => ab.section_id === sectionId && ab.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      const err: any = new Error(`Allocation batch '${cleanName}' already exists in this section`);
      err.statusCode = 409;
      throw err;
    }
    const newAb = {
      id: `ab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      section_id: sectionId,
      name: cleanName,
      created_at: new Date(),
    };
    inMemoryStore.allocationBatches.push(newAb);
    return { ...newAb, _count: { students: 0 } };
  }

  const existing = await prisma.allocationBatch.findUnique({
    where: {
      section_id_name: {
        section_id: sectionId,
        name: cleanName,
      },
    },
  });

  if (existing) {
    const err: any = new Error(`Allocation batch '${cleanName}' already exists in this section`);
    err.statusCode = 409;
    throw err;
  }

  const allocationBatch = await prisma.allocationBatch.create({
    data: {
      section_id: sectionId,
      name: cleanName,
    },
    include: {
      _count: { select: { students: true } },
    },
  });

  return allocationBatch;
}

export async function updateAllocationBatch(allocationBatchId: string, name: string) {
  const cleanName = name.trim();
  if (!cleanName) {
    const err: any = new Error('Allocation batch name cannot be empty');
    err.statusCode = 400;
    throw err;
  }

  serverCache.invalidate('batch');
  serverCache.invalidate('alloc_batches_');
  serverCache.invalidate('sections_');

  if (!process.env.DATABASE_URL) {
    const targetAb = inMemoryStore.allocationBatches.find((ab) => ab.id === allocationBatchId);
    if (!targetAb) {
      const err: any = new Error('Allocation batch not found');
      err.statusCode = 404;
      throw err;
    }
    const oldName = targetAb.name;
    targetAb.name = cleanName;

    // Synchronize sub_batch string in student records
    inMemoryStore.students.forEach((st) => {
      if (st.allocation_batch_id === allocationBatchId || st.sub_batch === oldName) {
        st.sub_batch = cleanName;
      }
    });

    return {
      ...targetAb,
      _count: { students: inMemoryStore.students.filter((st) => st.allocation_batch_id === allocationBatchId || st.sub_batch === cleanName).length },
    };
  }

  const existing = await prisma.allocationBatch.findUnique({
    where: { id: allocationBatchId },
  });

  if (!existing) {
    const err: any = new Error('Allocation batch not found');
    err.statusCode = 404;
    throw err;
  }

  const oldName = existing.name;

  const updatedAb = await prisma.allocationBatch.update({
    where: { id: allocationBatchId },
    data: { name: cleanName },
    include: {
      _count: { select: { students: true } },
    },
  });

  // Keep sub_batch strings in sync across student records
  await prisma.student.updateMany({
    where: { OR: [{ allocation_batch_id: allocationBatchId }, { sub_batch: oldName }] },
    data: { sub_batch: cleanName },
  });

  return updatedAb;
}

export async function deleteAllocationBatch(allocationBatchId: string) {
  serverCache.invalidate('batch');
  serverCache.invalidate('alloc_batches_');
  serverCache.invalidate('sections_');

  if (!process.env.DATABASE_URL) {
    const targetAb = inMemoryStore.allocationBatches.find((ab) => ab.id === allocationBatchId);
    const abName = targetAb?.name;

    inMemoryStore.allocationBatches = inMemoryStore.allocationBatches.filter((ab) => ab.id !== allocationBatchId);

    // Unassign students from deleted batch safely
    inMemoryStore.students.forEach((st) => {
      if (st.allocation_batch_id === allocationBatchId || (abName && st.sub_batch === abName)) {
        st.allocation_batch_id = null;
        st.sub_batch = null;
      }
    });

    // Clear staff section assignments referring to this batch
    inMemoryStore.staffSectionAssignments.forEach((ssa) => {
      if (ssa.allocation_batch_id === allocationBatchId) {
        ssa.allocation_batch_id = null;
      }
    });

    return { message: 'Allocation batch deleted successfully. Associated students were safely unassigned.' };
  }

  const existing = await prisma.allocationBatch.findUnique({
    where: { id: allocationBatchId },
  });

  if (!existing) {
    return { message: 'Allocation batch already deleted' };
  }

  // Safely unassign students
  await prisma.student.updateMany({
    where: { OR: [{ allocation_batch_id: allocationBatchId }, { sub_batch: existing.name }] },
    data: { allocation_batch_id: null, sub_batch: null },
  });

  // Safely clear staff section assignment references
  await prisma.staffSectionAssignment.updateMany({
    where: { allocation_batch_id: allocationBatchId },
    data: { allocation_batch_id: null },
  });

  // Delete allocation batch record
  await prisma.allocationBatch.delete({
    where: { id: allocationBatchId },
  });

  return { message: 'Allocation batch deleted successfully. Associated students were safely unassigned.' };
}

export async function assignStudentsToAllocationBatch(sectionId: string, allocationBatchId: string, studentIds: string[]) {
  serverCache.invalidate('batch');
  serverCache.invalidate('alloc_batches_');
  serverCache.invalidate('sections_');
  serverCache.invalidate('students_');

  if (!process.env.DATABASE_URL) {
    const targetAb = inMemoryStore.allocationBatches.find((ab) => ab.id === allocationBatchId);
    inMemoryStore.students.forEach((st) => {
      if (studentIds.includes(st.id)) {
        st.allocation_batch_id = allocationBatchId;
        if (targetAb) st.sub_batch = targetAb.name;
      }
    });
    return;
  }

  const targetAb = await prisma.allocationBatch.findUnique({
    where: { id: allocationBatchId },
  });

  await prisma.student.updateMany({
    where: { id: { in: studentIds } },
    data: {
      allocation_batch_id: allocationBatchId,
      sub_batch: targetAb ? targetAb.name : undefined,
    },
  });
}
