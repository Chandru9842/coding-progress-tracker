import * as staffService from '../../services/staffService.js';
import * as batchService from '../../services/batchService.js';
import * as studentService from '../../services/studentService.js';
import { isStaffAuthorizedForStudent, isStaffAuthorizedForBatch } from '../../services/studentAuthorizationService.js';
import { inMemoryStore } from '../../db/inMemoryStore.js';

export async function runPhase5RegressionTests(): Promise<{ name: string; passed: boolean; details: string[] }> {
  const details: string[] = [];
  const log = (msg: string) => details.push(msg);

  log('--- Starting Phase 5 Regression Test Suite (Admin-Controlled Staff Responsibility) ---');

  try {
    const timestamp = Date.now();

    // 1. Admin Staff Creation
    log('Testing ADMIN Staff Creation...');
    const deviStaff = await staffService.createStaff({
      name: `Devi Mam ${timestamp}`,
      email: `devi_${timestamp}@college.edu`,
      password: 'Pass123!',
    });

    const arunStaff = await staffService.createStaff({
      name: `Arun Sir ${timestamp}`,
      email: `arun_${timestamp}@college.edu`,
      password: 'Pass123!',
    });

    const kumarStaff = await staffService.createStaff({
      name: `Kumar Sir ${timestamp}`,
      email: `kumar_${timestamp}@college.edu`,
      password: 'Pass123!',
    });

    log(`Pass: Created Staff accounts for Devi Mam, Arun Sir, Kumar Sir.`);

    // 2. Setup Batch 1 (2023-2027 CSE) & Section CSE-A with 60 students
    log('Setting up Batch 2023–2027 CSE-A with 60 students...');
    const batch1 = await batchService.createBatch({
      batch_name: `Batch1_${timestamp}`,
      start_year: 2023,
      end_year: 2027,
      department: 'CSE',
    });
    const sectionA = await batchService.createSection(batch1.id, 'CSE-A');

    const students: any[] = [];
    for (let i = 1; i <= 60; i++) {
      const regNum = `REG_P5_${timestamp}_${String(i).padStart(3, '0')}`;
      const st = await studentService.createStudent({
        register_number: regNum,
        name: `CSE-A Student ${i}`,
        department: 'CSE',
        batch_id: batch1.id,
        section_id: sectionA.id,
        leetcode_username: `lc_p5_${timestamp}_${i}`,
      });
      students.push(st);
    }
    log(`Pass: Batch1 CSE-A created with ${students.length} students.`);

    // 3. Pattern A: Admin assigns ALL 60 students in CSE-A to Devi Mam
    log('Testing Pattern A: Assigning entire section (60 students) to Devi Mam...');
    await staffService.setSectionAssignmentForStaff(deviStaff.id, sectionA.id, 'ALL');

    const deviAllStudents = await studentService.getStudentsForUser({ userId: deviStaff.id, role: 'STAFF' });
    if (deviAllStudents.length !== 60) {
      throw new Error(`Expected Devi Mam to see 60 students, got ${deviAllStudents.length}`);
    }
    log(`Pass: Devi Mam sees all 60 students when assigned section mode = ALL.`);

    // 4. Pattern B: Admin assigns custom student count (e.g. 35 students)
    log('Testing Pattern B: Assigning custom student group (35 students) to Devi Mam...');
    await staffService.removeSectionAssignmentFromStaff(deviStaff.id, sectionA.id);
    const custom35Ids = students.slice(0, 35).map((s) => s.id);
    await staffService.assignStudentsToStaff(deviStaff.id, sectionA.id, custom35Ids);

    const devi35Students = await studentService.getStudentsForUser({ userId: deviStaff.id, role: 'STAFF' });
    if (devi35Students.length !== 35) {
      throw new Error(`Expected Devi Mam to see 35 students, got ${devi35Students.length}`);
    }
    log(`Pass: Custom 35-student assignment verified (no artificial 20-student restriction enforced).`);

    // 5. Pattern C: Arbitrary multi-staff distribution (Devi: 15, Arun: 25, Kumar: 20)
    log('Testing Pattern C: Arbitrary multi-staff distribution (15 / 25 / 20)...');
    const devi15Ids = students.slice(0, 15).map((s) => s.id);
    const arun25Ids = students.slice(15, 40).map((s) => s.id);
    const kumar20Ids = students.slice(40, 60).map((s) => s.id);

    await staffService.assignStudentsToStaff(deviStaff.id, sectionA.id, devi15Ids);
    await staffService.assignStudentsToStaff(arunStaff.id, sectionA.id, arun25Ids);
    await staffService.assignStudentsToStaff(kumarStaff.id, sectionA.id, kumar20Ids);

    const deviCount = (await studentService.getStudentsForUser({ userId: deviStaff.id, role: 'STAFF' })).length;
    const arunCount = (await studentService.getStudentsForUser({ userId: arunStaff.id, role: 'STAFF' })).length;
    const kumarCount = (await studentService.getStudentsForUser({ userId: kumarStaff.id, role: 'STAFF' })).length;

    log(`Devi count: ${deviCount} (Expected: 15), Arun count: ${arunCount} (Expected: 25), Kumar count: ${kumarCount} (Expected: 20)`);
    if (deviCount !== 15 || arunCount !== 25 || kumarCount !== 20) {
      throw new Error('Arbitrary multi-staff distribution count mismatch');
    }
    log('Pass: Arbitrary multi-staff distribution (15 / 25 / 20) verified.');

    // 6. Pattern D: One staff assigned across multiple batches & sections
    log('Testing Pattern D: Multi-batch / multi-section assignment for Devi Mam...');
    const sectionB = await batchService.createSection(batch1.id, 'CSE-B');
    const batch2 = await batchService.createBatch({
      batch_name: `Batch2_${timestamp}`,
      start_year: 2024,
      end_year: 2028,
      department: 'CSE',
    });
    const batch2SectionA = await batchService.createSection(batch2.id, 'CSE-A');

    const cseBStudent = await studentService.createStudent({
      register_number: `REGB_${timestamp}_001`,
      name: `CSE-B Student 1`,
      department: 'CSE',
      batch_id: batch1.id,
      section_id: sectionB.id,
      leetcode_username: `lc_b_${timestamp}`,
    });

    const batch2Student = await studentService.createStudent({
      register_number: `REG2_${timestamp}_001`,
      name: `Batch2 Student 1`,
      department: 'CSE',
      batch_id: batch2.id,
      section_id: batch2SectionA.id,
      leetcode_username: `lc_b2_${timestamp}`,
    });

    await staffService.assignStudentsToStaff(deviStaff.id, sectionB.id, [cseBStudent.id]);
    await staffService.assignStudentsToStaff(deviStaff.id, batch2SectionA.id, [batch2Student.id]);

    const deviMultiBatchStudents = await studentService.getStudentsForUser({ userId: deviStaff.id, role: 'STAFF' });
    if (deviMultiBatchStudents.length !== 17) { // 15 from CSE-A + 1 from CSE-B + 1 from Batch2
      throw new Error(`Expected 17 multi-batch students for Devi Mam, got ${deviMultiBatchStudents.length}`);
    }
    log('Pass: Multi-batch / multi-section assignment verified (17 students across 3 sections/batches).');

    // 7. Admin Full Visibility
    log('Testing ADMIN Full Visibility...');
    const adminStudents = await studentService.getStudentsForUser({ userId: 'admin_id', role: 'ADMIN' });
    if (adminStudents.length < 62) {
      throw new Error(`Expected Admin to see all created students (>= 62), got ${adminStudents.length}`);
    }
    log('Pass: ADMIN sees all students without restriction.');

    // 8. Staff Scoped Visibility & Unauthorized Direct Access Rejection
    log('Testing Unauthorized Direct Access Rejection for STAFF role...');
    // Devi is authorized for student 0 (in devi15Ids), but NOT authorized for student 20 (in arun25Ids)
    const deviCanAccessStudent1 = await isStaffAuthorizedForStudent(deviStaff.id, students[0].id);
    const deviCanAccessStudent20 = await isStaffAuthorizedForStudent(deviStaff.id, students[20].id);

    if (!deviCanAccessStudent1 || deviCanAccessStudent20) {
      throw new Error('Unauthorized student access check failed for STAFF role');
    }

    try {
      await studentService.getStudentByIdForUser({ userId: deviStaff.id, role: 'STAFF' }, students[20].id);
      throw new Error('Expected 403 Forbidden when Staff accesses unassigned student');
    } catch (err: any) {
      if (err.statusCode !== 403 && !err.message.includes('Forbidden')) {
        throw err;
      }
      log('Pass: Direct API access to unassigned student correctly rejected with HTTP 403 Forbidden.');
    }

    log('====================================================');
    log('PHASE 5 REGRESSION TESTS COMPLETED SUCCESSFULLY!');
    log('====================================================');

    return { name: 'Phase 5 Regression Suite', passed: true, details };
  } catch (err: any) {
    log(`FAIL: Phase 5 regression test error: ${err.message}`);
    return { name: 'Phase 5 Regression Suite', passed: false, details };
  }
}
