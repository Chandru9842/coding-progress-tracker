import bcrypt from 'bcryptjs';
import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';

export async function getAllStaff(activeOnly: boolean = false) {
  if (!process.env.DATABASE_URL) {
    return inMemoryStore.users
      .filter((u) => u.role === 'STAFF' && (!activeOnly || u.is_active))
      .map((s) => {
        const bAssigns = inMemoryStore.staffBatchAssignments.filter((sba) => sba.staff_id === s.id);
        const stAssigns = inMemoryStore.staffStudentAssignments.filter((ssa) => ssa.staff_id === s.id);
        return {
          id: s.id,
          name: s.name,
          email: s.email,
          isActive: s.is_active,
          createdAt: s.created_at.toISOString(),
          assignedBatchesCount: bAssigns.length,
          assignedStudentsCount: stAssigns.length,
          assignedBatches: bAssigns.map((ba) => {
            const b = inMemoryStore.batches.find((batch) => batch.id === ba.batch_id);
            return { id: ba.batch_id, batch_name: b?.batch_name || 'Batch' };
          }),
        };
      });
  }

  const where: any = { role: 'STAFF' };
  if (activeOnly) {
    where.is_active = true;
  }

  const staffList = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      is_active: true,
      created_at: true,
      staff_batch_assignments: {
        include: {
          batch: { select: { id: true, batch_name: true } },
        },
      },
      staff_student_assignments: { select: { id: true } },
      staff_section_assignments: { select: { id: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  return staffList.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    isActive: s.is_active,
    createdAt: s.created_at.toISOString(),
    assignedBatchesCount: s.staff_batch_assignments.length,
    assignedStudentsCount: s.staff_student_assignments.length,
    assignedBatches: s.staff_batch_assignments.map((b) => b.batch),
  }));
}

export async function getStaffById(staffId: string) {
  if (!process.env.DATABASE_URL) {
    const s = inMemoryStore.users.find((u) => u.id === staffId && u.role === 'STAFF');
    if (!s) return null;

    const bAssigns = inMemoryStore.staffBatchAssignments.filter((sba) => sba.staff_id === s.id);
    const secAssigns = inMemoryStore.staffSectionAssignments.filter((ssa) => ssa.staff_id === s.id);
    const stAssigns = inMemoryStore.staffStudentAssignments.filter((ssa) => ssa.staff_id === s.id);

    return {
      id: s.id,
      name: s.name,
      email: s.email,
      isActive: s.is_active,
      createdAt: s.created_at.toISOString(),
      assignedBatchesCount: bAssigns.length,
      assignedStudentsCount: stAssigns.length,
      assignedBatches: bAssigns.map((ba) => {
        const b = inMemoryStore.batches.find((batch) => batch.id === ba.batch_id);
        return { id: ba.batch_id, batch_name: b?.batch_name || 'Batch' };
      }),
      assignedSections: secAssigns.map((sa) => {
        const sec = inMemoryStore.sections.find((section) => section.id === sa.section_id);
        return {
          id: sa.id,
          section_id: sa.section_id,
          assignment_mode: sa.assignment_mode,
          section: { id: sa.section_id, name: sec?.name || 'A', batch_id: sec?.batch_id || '' },
        };
      }),
      directStudentAssignments: stAssigns.map((sa) => {
        const st = inMemoryStore.students.find((student) => student.id === sa.student_id);
        return {
          id: sa.student_id,
          register_number: st?.register_number || '',
          name: st?.name || '',
          section_id: st?.section_id || '',
        };
      }),
    };
  }

  const staff = await prisma.user.findUnique({
    where: { id: staffId, role: 'STAFF' },
    select: {
      id: true,
      name: true,
      email: true,
      is_active: true,
      created_at: true,
      staff_batch_assignments: {
        include: {
          batch: { select: { id: true, batch_name: true } },
        },
      },
      staff_section_assignments: {
        include: {
          section: { select: { id: true, name: true, batch_id: true } },
        },
      },
      staff_student_assignments: {
        include: {
          student: { select: { id: true, register_number: true, name: true, section_id: true } },
        },
      },
    },
  });

  if (!staff) return null;

  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    isActive: staff.is_active,
    createdAt: staff.created_at.toISOString(),
    assignedBatchesCount: staff.staff_batch_assignments.length,
    assignedStudentsCount: staff.staff_student_assignments.length,
    assignedBatches: staff.staff_batch_assignments.map((b) => b.batch),
    assignedSections: staff.staff_section_assignments,
    directStudentAssignments: staff.staff_student_assignments.map((sa) => sa.student),
  };
}

export async function createStaff(data: {
  name: string;
  email: string;
  password?: string;
  isActive?: boolean;
}) {
  const emailNorm = data.email.trim().toLowerCase();
  const passwordToUse = data.password || 'StaffPass123!';
  const hashedPassword = await bcrypt.hash(passwordToUse, 10);

  if (!process.env.DATABASE_URL) {
    if (inMemoryStore.users.some((u) => u.email === emailNorm)) {
      throw new Error('A user with this email address already exists');
    }

    const newStaffUser = {
      id: `staff_${Date.now()}_${Math.random()}`,
      name: data.name.trim(),
      email: emailNorm,
      password_hash: hashedPassword,
      role: 'STAFF' as const,
      is_active: data.isActive !== undefined ? data.isActive : true,
      created_at: new Date(),
    };
    inMemoryStore.users.push(newStaffUser);

    return {
      id: newStaffUser.id,
      name: newStaffUser.name,
      email: newStaffUser.email,
      isActive: newStaffUser.is_active,
      createdAt: newStaffUser.created_at.toISOString(),
      assignedBatchesCount: 0,
      assignedStudentsCount: 0,
      assignedBatches: [],
    };
  }

  const existing = await prisma.user.findUnique({
    where: { email: emailNorm },
  });

  if (existing) {
    throw new Error('A user with this email address already exists');
  }

  const newStaff = await prisma.user.create({
    data: {
      name: data.name.trim(),
      email: emailNorm,
      password_hash: hashedPassword,
      role: 'STAFF',
      is_active: data.isActive !== undefined ? data.isActive : true,
    },
  });

  return {
    id: newStaff.id,
    name: newStaff.name,
    email: newStaff.email,
    isActive: newStaff.is_active,
    createdAt: newStaff.created_at.toISOString(),
    assignedBatchesCount: 0,
    assignedStudentsCount: 0,
    assignedBatches: [],
  };
}

export async function updateStaffStatus(staffId: string, isActive: boolean) {
  if (!process.env.DATABASE_URL) {
    const s = inMemoryStore.users.find((u) => u.id === staffId && u.role === 'STAFF');
    if (!s) throw new Error('Staff not found');
    s.is_active = isActive;
    return s;
  }

  const updated = await prisma.user.update({
    where: { id: staffId, role: 'STAFF' },
    data: { is_active: isActive },
  });
  return updated;
}

export async function resetStaffPassword(staffId: string, password: string) {
  const hashedPassword = await bcrypt.hash(password, 10);
  if (!process.env.DATABASE_URL) {
    const s = inMemoryStore.users.find((u) => u.id === staffId && u.role === 'STAFF');
    if (s) s.password_hash = hashedPassword;
    return { message: 'Password reset successfully' };
  }

  await prisma.user.update({
    where: { id: staffId, role: 'STAFF' },
    data: { password_hash: hashedPassword },
  });
  return { message: 'Password reset successfully' };
}

export async function updateStaffDetails(
  staffId: string,
  data: { name?: string; email?: string; password?: string; assignedBatchIds?: string[] }
) {
  const updateData: any = {};
  if (data.name) updateData.name = data.name.trim();
  if (data.email) updateData.email = data.email.trim().toLowerCase();
  if (data.password && data.password.trim()) {
    updateData.password_hash = await bcrypt.hash(data.password.trim(), 10);
  }

  if (!process.env.DATABASE_URL) {
    const s = inMemoryStore.users.find((u) => u.id === staffId && u.role === 'STAFF');
    if (!s) throw new Error('Staff member not found');
    if (updateData.email && updateData.email !== s.email) {
      if (inMemoryStore.users.some((u) => u.email === updateData.email && u.id !== staffId)) {
        throw new Error('A user with this email address already exists');
      }
    }
    Object.assign(s, updateData);
    if (data.assignedBatchIds !== undefined) {
      assignBatchesToStaff(staffId, data.assignedBatchIds);
    }
    return s;
  }

  if (updateData.email) {
    const existing = await prisma.user.findFirst({
      where: { email: updateData.email, NOT: { id: staffId } },
    });
    if (existing) {
      throw new Error('A user with this email address already exists');
    }
  }

  const updated = await prisma.user.update({
    where: { id: staffId, role: 'STAFF' },
    data: updateData,
  });

  if (data.assignedBatchIds !== undefined) {
    await assignBatchesToStaff(staffId, data.assignedBatchIds);
  }

  return updated;
}


export async function deleteStaff(staffId: string) {
  if (!process.env.DATABASE_URL) {
    const idx = inMemoryStore.users.findIndex((u) => u.id === staffId && u.role === 'STAFF');
    if (idx === -1) throw new Error('Staff member not found');
    inMemoryStore.users.splice(idx, 1);
    inMemoryStore.staffBatchAssignments = inMemoryStore.staffBatchAssignments.filter((a) => a.staff_id !== staffId);
    inMemoryStore.staffSectionAssignments = inMemoryStore.staffSectionAssignments.filter((a) => a.staff_id !== staffId);
    inMemoryStore.staffStudentAssignments = inMemoryStore.staffStudentAssignments.filter((a) => a.staff_id !== staffId);
    return { message: 'Staff member deleted successfully' };
  }

  const existing = await prisma.user.findUnique({
    where: { id: staffId, role: 'STAFF' },
  });

  if (!existing) {
    throw new Error('Staff member not found');
  }

  await prisma.user.delete({
    where: { id: staffId },
  });

  return { message: 'Staff member deleted successfully' };
}

export async function bulkDeleteStaff(staffIds: string[]) {
  if (!process.env.DATABASE_URL) {
    inMemoryStore.users = inMemoryStore.users.filter((u) => !staffIds.includes(u.id));
    inMemoryStore.staffBatchAssignments = inMemoryStore.staffBatchAssignments.filter((a) => !staffIds.includes(a.staff_id));
    inMemoryStore.staffSectionAssignments = inMemoryStore.staffSectionAssignments.filter((a) => !staffIds.includes(a.staff_id));
    inMemoryStore.staffStudentAssignments = inMemoryStore.staffStudentAssignments.filter((a) => !staffIds.includes(a.staff_id));
    return { count: staffIds.length };
  }

  const result = await prisma.user.deleteMany({
    where: {
      id: { in: staffIds },
      role: 'STAFF',
    },
  });

  return { count: result.count };
}


export async function assignBatchesToStaff(staffId: string, batchIds: string[]) {
  if (!process.env.DATABASE_URL) {
    inMemoryStore.staffBatchAssignments = inMemoryStore.staffBatchAssignments.filter((sba) => sba.staff_id !== staffId);
    batchIds.forEach((bId) => {
      inMemoryStore.staffBatchAssignments.push({
        id: `sba_${Date.now()}_${Math.random()}`,
        staff_id: staffId,
        batch_id: bId,
        created_at: new Date(),
      });
    });
    return { message: 'Batch assignments updated successfully' };
  }

  await prisma.staffBatchAssignment.deleteMany({
    where: { staff_id: staffId },
  });

  const createData = batchIds.map((batch_id) => ({
    staff_id: staffId,
    batch_id,
  }));

  await prisma.staffBatchAssignment.createMany({
    data: createData,
    skipDuplicates: true,
  });

  return { message: 'Batch assignments updated successfully' };
}

export async function setSectionAssignmentForStaff(
  staffId: string,
  sectionId: string,
  assignmentMode: 'ALL' | 'SELECTED'
) {
  if (!process.env.DATABASE_URL) {
    const existing = inMemoryStore.staffSectionAssignments.find((ssa) => ssa.staff_id === staffId && ssa.section_id === sectionId);
    if (existing) {
      existing.assignment_mode = assignmentMode;
    } else {
      inMemoryStore.staffSectionAssignments.push({
        id: `ssa_${Date.now()}_${Math.random()}`,
        staff_id: staffId,
        section_id: sectionId,
        assignment_mode: assignmentMode,
        created_at: new Date(),
      });
    }
    return { message: 'Section assignment updated successfully' };
  }

  const existing = await prisma.staffSectionAssignment.findFirst({
    where: {
      staff_id: staffId,
      section_id: sectionId,
    },
  });

  if (existing) {
    await prisma.staffSectionAssignment.update({
      where: { id: existing.id },
      data: { assignment_mode: assignmentMode },
    });
  } else {
    await prisma.staffSectionAssignment.create({
      data: {
        staff_id: staffId,
        section_id: sectionId,
        assignment_mode: assignmentMode,
      },
    });
  }

  return { message: 'Section assignment updated successfully' };
}

export async function removeSectionAssignmentFromStaff(staffId: string, sectionId: string) {
  if (!process.env.DATABASE_URL) {
    inMemoryStore.staffSectionAssignments = inMemoryStore.staffSectionAssignments.filter(
      (ssa) => !(ssa.staff_id === staffId && ssa.section_id === sectionId)
    );
    return { message: 'Section assignment removed successfully' };
  }

  await prisma.staffSectionAssignment.deleteMany({
    where: {
      staff_id: staffId,
      section_id: sectionId,
    },
  });

  return { message: 'Section assignment removed successfully' };
}

export async function assignStudentsToStaff(staffId: string, sectionId: string, studentIds: string[]) {
  if (!process.env.DATABASE_URL) {
    // Clear any existing section assignment mode for this staff & section
    inMemoryStore.staffSectionAssignments = inMemoryStore.staffSectionAssignments.filter(
      (ssa) => !(ssa.staff_id === staffId && ssa.section_id === sectionId)
    );

    if (studentIds.length > 0) {
      inMemoryStore.staffSectionAssignments.push({
        id: `ssa_${Date.now()}_${Math.random()}`,
        staff_id: staffId,
        section_id: sectionId,
        assignment_mode: 'SELECTED',
        created_at: new Date(),
      });
    }

    const secStudentIds = inMemoryStore.students.filter((st) => st.section_id === sectionId).map((st) => st.id);
    inMemoryStore.staffStudentAssignments = inMemoryStore.staffStudentAssignments.filter(
      (ssa) => !(ssa.staff_id === staffId && secStudentIds.includes(ssa.student_id))
    );

    studentIds.forEach((stId) => {
      inMemoryStore.staffStudentAssignments.push({
        id: `sst_${Date.now()}_${Math.random()}`,
        staff_id: staffId,
        student_id: stId,
        created_at: new Date(),
      });
    });
    return { message: 'Student assignments updated successfully' };
  }

  // Clear any existing section-wide 'ALL' assignment when assigning specific students
  await prisma.staffSectionAssignment.deleteMany({
    where: {
      staff_id: staffId,
      section_id: sectionId,
    },
  });

  const existingSectionStudents = await prisma.student.findMany({
    where: { section_id: sectionId },
    select: { id: true },
  });
  const sectionStudentIds = existingSectionStudents.map((s) => s.id);

  await prisma.staffStudentAssignment.deleteMany({
    where: {
      staff_id: staffId,
      student_id: { in: sectionStudentIds },
    },
  });

  if (studentIds.length > 0) {
    const createData = studentIds.map((student_id) => ({
      staff_id: staffId,
      student_id,
    }));

    await prisma.staffStudentAssignment.createMany({
      data: createData,
      skipDuplicates: true,
    });

    await prisma.staffSectionAssignment.create({
      data: {
        staff_id: staffId,
        section_id: sectionId,
        assignment_mode: 'SELECTED',
      },
    });
  }

  return { message: 'Student assignments updated successfully' };
}

export async function removeStudentAssignmentFromStaff(staffId: string, studentId: string) {
  if (!process.env.DATABASE_URL) {
    inMemoryStore.staffStudentAssignments = inMemoryStore.staffStudentAssignments.filter(
      (ssa) => !(ssa.staff_id === staffId && ssa.student_id === studentId)
    );
    return { message: 'Student assignment removed successfully' };
  }

  await prisma.staffStudentAssignment.deleteMany({
    where: {
      staff_id: staffId,
      student_id: studentId,
    },
  });

  return { message: 'Student assignment removed successfully' };
}

export async function getStaffAssignedScopes(staffId: string) {
  if (!process.env.DATABASE_URL) {
    const secAssigns = inMemoryStore.staffSectionAssignments.filter((ssa) => ssa.staff_id === staffId);
    const batchAssigns = inMemoryStore.staffBatchAssignments.filter((sba) => sba.staff_id === staffId);
    const studentAssigns = inMemoryStore.staffStudentAssignments.filter((ssa) => ssa.staff_id === staffId);

    const sectionIds = Array.from(new Set(secAssigns.map((sa) => sa.section_id)));
    const batchIds = Array.from(new Set(batchAssigns.map((ba) => ba.batch_id)));
    const studentIds = Array.from(new Set(studentAssigns.map((sa) => sa.student_id)));

    const assignedStudents = inMemoryStore.students.filter((st) => studentIds.includes(st.id));
    const studentSecIds = assignedStudents.map((st) => st.section_id).filter(Boolean);
    const studentBatchIds = assignedStudents.map((st) => st.batch_id).filter(Boolean);

    const allSecIds = Array.from(new Set([...sectionIds, ...studentSecIds]));
    const allBatchIds = Array.from(new Set([...batchIds, ...studentBatchIds]));

    const batches = inMemoryStore.batches.filter((b) => allBatchIds.includes(b.id));
    const sections = inMemoryStore.sections.filter((s) => allSecIds.includes(s.id));
    const allocBatches = inMemoryStore.allocationBatches.filter((ab) => allSecIds.includes(ab.section_id));

    return {
      sections: sections.map((sec) => {
        const b = batches.find((batch) => batch.id === sec.batch_id);
        const secAssign = secAssigns.find((sa) => sa.section_id === sec.id);
        const mode = secAssign?.assignment_mode || (secAssigns.length === 0 ? 'ALL' : 'SELECTED');
        const abList = allocBatches.filter((ab) => ab.section_id === sec.id);
        const studentSubBatches = Array.from(
          new Set(
            inMemoryStore.students
              .filter((st) => st.section_id === sec.id && st.sub_batch)
              .map((st) => st.sub_batch as string)
          )
        );

        const mergedMap = new Map<string, { id: string; name: string }>();
        abList.forEach((ab) => mergedMap.set(ab.name, { id: ab.id, name: ab.name }));
        studentSubBatches.forEach((sb) => {
          if (!mergedMap.has(sb)) {
            mergedMap.set(sb, { id: sb, name: sb });
          }
        });

        return {
          id: sec.id,
          name: sec.name,
          batch_id: sec.batch_id,
          academic_year: b ? `${b.start_year}–${b.end_year}` : 'N/A',
          department: b ? b.department : 'N/A',
          assignment_mode: mode,
          allocation_batches: Array.from(mergedMap.values()),
        };
      }),
    };
  }

  // DB Mode
  const [secAssigns, batchAssigns, studentAssigns] = await Promise.all([
    prisma.staffSectionAssignment.findMany({
      where: { staff_id: staffId },
      include: {
        section: {
          include: {
            batch: true,
            allocation_batches: true,
          },
        },
        allocation_batch: true,
      },
    }),
    prisma.staffBatchAssignment.findMany({
      where: { staff_id: staffId },
      include: {
        batch: {
          include: {
            sections: {
              include: {
                allocation_batches: true,
              },
            },
          },
        },
      },
    }),
    prisma.staffStudentAssignment.findMany({
      where: { staff_id: staffId },
      include: {
        student: {
          include: {
            batch: true,
            section: {
              include: {
                allocation_batches: true,
              },
            },
            allocation_batch: true,
          },
        },
      },
    }),
  ]);

  const assignedSectionsMap = new Map<string, any>();

  const registerSection = (sec: any, batch: any, mode: 'ALL' | 'SELECTED', allocBatch?: any) => {
    if (!sec || !batch) return;
    const existing = assignedSectionsMap.get(sec.id) || {
      id: sec.id,
      name: sec.name,
      batch_id: sec.batch_id,
      academic_year: `${batch.start_year}–${batch.end_year}`,
      department: batch.department,
      assignment_mode: mode,
      allocation_batches_map: new Map<string, any>(),
      all_section_allocation_batches: sec.allocation_batches || [],
    };

    if (mode === 'ALL') {
      existing.assignment_mode = 'ALL';
    }

    if (allocBatch) {
      existing.allocation_batches_map.set(allocBatch.name || allocBatch.id, { id: allocBatch.id, name: allocBatch.name });
    }

    assignedSectionsMap.set(sec.id, existing);
  };

  secAssigns.forEach((sa) => {
    registerSection(sa.section, sa.section?.batch, sa.assignment_mode, sa.allocation_batch);
  });

  batchAssigns.forEach((ba) => {
    ba.batch?.sections?.forEach((sec) => {
      registerSection(sec, ba.batch, 'ALL');
    });
  });

  studentAssigns.forEach((sa) => {
    if (sa.student?.section && sa.student?.batch) {
      let matchedAlloc: any = sa.student.allocation_batch || null;
      if (!matchedAlloc && sa.student.sub_batch && sa.student.section?.allocation_batches) {
        matchedAlloc = sa.student.section.allocation_batches.find((ab: any) => ab.name === sa.student.sub_batch) || null;
      }
      if (!matchedAlloc && sa.student.sub_batch) {
        matchedAlloc = { id: sa.student.sub_batch, name: sa.student.sub_batch };
      }
      registerSection(sa.student.section, sa.student.batch, 'SELECTED', matchedAlloc);
    }
  });

  const sectionIds = Array.from(assignedSectionsMap.keys());
  const [dbAllocBatches, studentsWithSubBatches] = await Promise.all([
    prisma.allocationBatch.findMany({
      where: { section_id: { in: sectionIds } },
    }),
    prisma.student.findMany({
      where: { section_id: { in: sectionIds }, sub_batch: { not: null } },
      select: { section_id: true, sub_batch: true },
      distinct: ['section_id', 'sub_batch'],
    }),
  ]);

  const formattedSections = Array.from(assignedSectionsMap.values()).map((sec) => {
    const allocMap = new Map<string, { id: string; name: string }>();

    // 1. Add explicitly assigned allocation batches
    Array.from(sec.allocation_batches_map.values()).forEach((ab: any) => {
      if (ab?.name) allocMap.set(ab.name, { id: ab.id, name: ab.name });
    });

    // 2. Add section database allocation batches
    dbAllocBatches
      .filter((ab) => ab.section_id === sec.id)
      .forEach((ab) => {
        if (!allocMap.has(ab.name)) {
          allocMap.set(ab.name, { id: ab.id, name: ab.name });
        }
      });

    // 3. Add student sub_batch strings (e.g. Batch-1, Batch-2, Batch-3)
    studentsWithSubBatches
      .filter((st) => st.section_id === sec.id && st.sub_batch)
      .forEach((st) => {
        const sb = st.sub_batch as string;
        if (!allocMap.has(sb)) {
          allocMap.set(sb, { id: sb, name: sb });
        }
      });

    return {
      id: sec.id,
      name: sec.name,
      batch_id: sec.batch_id,
      academic_year: sec.academic_year,
      department: sec.department,
      assignment_mode: sec.assignment_mode,
      allocation_batches: Array.from(allocMap.values()),
    };
  });

  return {
    sections: formattedSections,
  };
}
