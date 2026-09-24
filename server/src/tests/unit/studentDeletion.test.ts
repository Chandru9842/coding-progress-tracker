import { inMemoryStore } from '../../db/inMemoryStore.js';
import * as studentService from '../../services/studentService.js';
import * as studentController from '../../controllers/studentController.js';
import { serverCache } from '../../utils/serverCache.js';

export async function testStudentDeletionPersistence(): Promise<{ name: string; passed: boolean; message?: string; details?: string[] }> {
  const testName = 'Unit Test: Student Single & Bulk Deletion Persistence & Role Authorization';
  const details: string[] = [];

  try {
    const timestamp = Date.now();
    const testBatchId = `batch_del_${timestamp}`;
    const testSecId = `sec_del_${timestamp}`;
    const mentorStaffId = `staff_mentor_${timestamp}`;
    const otherStaffId = `staff_other_${timestamp}`;

    // Seed test setup in inMemoryStore
    inMemoryStore.batches.push({
      id: testBatchId,
      batch_name: 'Deletion Test Batch',
      start_year: 2023,
      end_year: 2027,
      department: 'CSE',
      created_at: new Date(),
    });

    inMemoryStore.sections.push({
      id: testSecId,
      batch_id: testBatchId,
      name: 'Sec Del',
      created_at: new Date(),
    });

    inMemoryStore.users.push(
      {
        id: mentorStaffId,
        name: 'Mentor Faculty',
        email: `mentor_${timestamp}@college.edu`,
        password_hash: 'hash',
        role: 'STAFF',
        is_active: true,
        created_at: new Date(),
      },
      {
        id: otherStaffId,
        name: 'Other Faculty',
        email: `other_${timestamp}@college.edu`,
        password_hash: 'hash',
        role: 'STAFF',
        is_active: true,
        created_at: new Date(),
      }
    );

    // Create 3 test students
    const s1Id = `st_del_1_${timestamp}`;
    const s2Id = `st_del_2_${timestamp}`;
    const s3Id = `st_del_3_${timestamp}`;

    inMemoryStore.students.push(
      {
        id: s1Id,
        register_number: `REG_DEL_1_${timestamp}`,
        name: 'Delete Target 1',
        department: 'CSE',
        batch_id: testBatchId,
        section_id: testSecId,
        mentor_id: mentorStaffId,
        created_at: new Date(),
      },
      {
        id: s2Id,
        register_number: `REG_DEL_2_${timestamp}`,
        name: 'Delete Target 2',
        department: 'CSE',
        batch_id: testBatchId,
        section_id: testSecId,
        mentor_id: mentorStaffId,
        created_at: new Date(),
      },
      {
        id: s3Id,
        register_number: `REG_DEL_3_${timestamp}`,
        name: 'Delete Target 3 (Unassigned)',
        department: 'CSE',
        batch_id: testBatchId,
        section_id: testSecId,
        mentor_id: null,
        created_at: new Date(),
      }
    );

    // Add assignments and snapshots for s1 and s2
    inMemoryStore.staffStudentAssignments.push(
      { id: `ssa_1_${timestamp}`, staff_id: mentorStaffId, student_id: s1Id, created_at: new Date() },
      { id: `ssa_2_${timestamp}`, staff_id: mentorStaffId, student_id: s2Id, created_at: new Date() }
    );

    inMemoryStore.snapshots.push(
      { id: `snap_1_${timestamp}`, student_id: s1Id, snapshot_date: new Date(), easy_solved: 5, medium_solved: 5, hard_solved: 0, total_solved: 10, created_at: new Date() },
      { id: `snap_2_${timestamp}`, student_id: s2Id, snapshot_date: new Date(), easy_solved: 10, medium_solved: 10, hard_solved: 2, total_solved: 22, created_at: new Date() }
    );

    // 1. Test Single Delete via service
    const del1Res = await studentService.deleteStudent(s1Id);
    if (!del1Res || !del1Res.message) {
      return { name: testName, passed: false, message: 'deleteStudent did not return success message' };
    }

    const s1StillInStore = inMemoryStore.students.some((s) => s.id === s1Id);
    const s1Snapshots = inMemoryStore.snapshots.some((s) => s.student_id === s1Id);
    const s1Assignments = inMemoryStore.staffStudentAssignments.some((a) => a.student_id === s1Id);

    if (s1StillInStore || s1Snapshots || s1Assignments) {
      return {
        name: testName,
        passed: false,
        message: 'deleteStudent failed to clean up student, snapshots, or assignments',
      };
    }
    details.push('Pass: deleteStudent purged student, snapshots, and assignments from memory.');

    // 2. Test Non-existent student deletion (must be idempotent & never throw)
    await studentService.deleteStudent('non_existent_student_id_xyz');
    details.push('Pass: deleteStudent on non-existent ID handled safely without throwing.');

    // 3. Test Bulk Delete via service
    const bulkRes = await studentService.bulkDeleteStudents([s2Id, s3Id]);
    if (!bulkRes || !bulkRes.message) {
      return { name: testName, passed: false, message: 'bulkDeleteStudents did not return success message' };
    }

    const s2StillInStore = inMemoryStore.students.some((s) => s.id === s2Id);
    const s3StillInStore = inMemoryStore.students.some((s) => s.id === s3Id);

    if (s2StillInStore || s3StillInStore) {
      return { name: testName, passed: false, message: 'bulkDeleteStudents failed to remove students from store' };
    }
    details.push('Pass: bulkDeleteStudents successfully purged multiple students.');

    // 4. Test Controller RBAC with mock requests
    // Re-seed one student for controller test
    const s4Id = `st_del_4_${timestamp}`;
    inMemoryStore.students.push({
      id: s4Id,
      register_number: `REG_DEL_4_${timestamp}`,
      name: 'Controller Delete Test',
      department: 'CSE',
      batch_id: testBatchId,
      section_id: testSecId,
      mentor_id: mentorStaffId,
      created_at: new Date(),
    });
    inMemoryStore.staffStudentAssignments.push({
      id: `ssa_4_${timestamp}`,
      staff_id: mentorStaffId,
      student_id: s4Id,
      created_at: new Date(),
    });

    // Other staff trying to delete s4 -> should be rejected with 403
    let statusSet = 0;
    let jsonResult: any = null;
    const mockResForbidden: any = {
      status: (code: number) => { statusSet = code; return mockResForbidden; },
      json: (data: any) => { jsonResult = data; },
    };

    await studentController.deleteStudent(
      { user: { userId: otherStaffId, role: 'STAFF' }, params: { studentId: s4Id } } as any,
      mockResForbidden
    );

    if (statusSet !== 403) {
      return { name: testName, passed: false, message: `Expected 403 for unauthorized staff delete, got ${statusSet}` };
    }
    details.push('Pass: Controller rejects unauthorized staff student deletion with 403.');

    // Admin deleting s4 -> should succeed with 200
    statusSet = 0;
    jsonResult = null;
    const mockResOk: any = {
      status: (code: number) => { statusSet = code; return mockResOk; },
      json: (data: any) => { jsonResult = data; },
    };

    await studentController.deleteStudent(
      { user: { userId: 'admin_user', role: 'ADMIN' }, params: { studentId: s4Id } } as any,
      mockResOk
    );

    if (statusSet !== 200) {
      return { name: testName, passed: false, message: `Expected 200 for admin delete, got ${statusSet}` };
    }
    details.push('Pass: Controller allows admin to delete student with 200.');

    return { name: testName, passed: true, details };
  } catch (err: any) {
    return { name: testName, passed: false, message: err?.message || String(err) };
  }
}
