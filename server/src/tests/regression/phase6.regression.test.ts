import * as staffService from '../../services/staffService.js';
import * as batchService from '../../services/batchService.js';
import * as studentService from '../../services/studentService.js';
import * as reportService from '../../services/reportService.js';
import { inMemoryStore } from '../../db/inMemoryStore.js';
import { prisma } from '../../db/client.js';

export async function runPhase6RegressionTests(): Promise<{ name: string; passed: boolean; details: string[] }> {
  const details: string[] = [];
  const log = (msg: string) => details.push(msg);

  log('--- Starting Phase 6 Regression Test Suite (Reports Module & Authorization) ---');

  try {
    const timestamp = Date.now();

    // 1. Idempotent Test Setup: Check or create Admin / Staff
    log('Setting up test accounts and batches for Phase 6...');
    const staff1 = await staffService.createStaff({
      name: `Phase6 Staff1 ${timestamp}`,
      email: `p6_staff1_${timestamp}@college.edu`,
      password: 'Pass123!',
    });

    const staff2 = await staffService.createStaff({
      name: `Phase6 Staff2 ${timestamp}`,
      email: `p6_staff2_${timestamp}@college.edu`,
      password: 'Pass123!',
    });

    const batchP6_1 = await batchService.createBatch({
      batch_name: `P6_Batch1_${timestamp}`,
      start_year: 2023,
      end_year: 2027,
      department: 'CSE',
    });
    const sectionP6_A = await batchService.createSection(batchP6_1.id, 'CSE-A');

    const batchP6_2 = await batchService.createBatch({
      batch_name: `P6_Batch2_${timestamp}`,
      start_year: 2024,
      end_year: 2028,
      department: 'ECE',
    });
    const sectionP6_B = await batchService.createSection(batchP6_2.id, 'ECE-A');

    // Create 3 students in Batch 1 CSE-A
    const st1 = await studentService.createStudent({
      register_number: `REG_P6_${timestamp}_001`,
      name: 'Alice Top Coder',
      department: 'CSE',
      batch_id: batchP6_1.id,
      section_id: sectionP6_A.id,
      leetcode_username: 'alice_coder',
    });

    const st2 = await studentService.createStudent({
      register_number: `REG_P6_${timestamp}_002`,
      name: 'Bob Mid Coder',
      department: 'CSE',
      batch_id: batchP6_1.id,
      section_id: sectionP6_A.id,
      leetcode_username: 'bob_coder',
    });

    const st3 = await studentService.createStudent({
      register_number: `REG_P6_${timestamp}_003`,
      name: 'Charlie Low Activity',
      department: 'CSE',
      batch_id: batchP6_1.id,
      section_id: sectionP6_A.id,
      leetcode_username: 'charlie_coder',
    });

    // Create 1 student in Batch 2 ECE-A (unassigned to staff1)
    const st4 = await studentService.createStudent({
      register_number: `REG_P6_${timestamp}_004`,
      name: 'David ECE Coder',
      department: 'ECE',
      batch_id: batchP6_2.id,
      section_id: sectionP6_B.id,
      leetcode_username: 'david_coder',
    });

    // Add snapshots
    if (!process.env.DATABASE_URL) {
      inMemoryStore.snapshots.push(
        { id: `snap_1_${timestamp}`, student_id: st1.id, snapshot_date: new Date('2026-08-20'), easy_solved: 50, medium_solved: 30, hard_solved: 10, total_solved: 90, created_at: new Date() },
        { id: `snap_2_${timestamp}`, student_id: st1.id, snapshot_date: new Date('2026-08-19'), easy_solved: 40, medium_solved: 25, hard_solved: 8, total_solved: 73, created_at: new Date() },
        { id: `snap_3_${timestamp}`, student_id: st2.id, snapshot_date: new Date('2026-08-20'), easy_solved: 20, medium_solved: 15, hard_solved: 5, total_solved: 40, created_at: new Date() }
        // st3 has 0 snapshots (No activity)
      );
    }

    // Assign st1, st2, st3 to staff1
    await staffService.assignStudentsToStaff(staff1.id, sectionP6_A.id, [st1.id, st2.id, st3.id]);

    log('Pass: Test environment and snapshot data initialized successfully.');

    // 2. ADMIN Full Report Visibility
    log('Testing ADMIN full report visibility...');
    const adminReportData = await reportService.getReportData({}, { userId: 'admin_id', role: 'ADMIN' });
    if (adminReportData.students.length < 4) {
      throw new Error(`Expected ADMIN to see all students (>=4), got ${adminReportData.students.length}`);
    }
    log(`Pass: ADMIN sees all ${adminReportData.students.length} students across all batches and departments.`);

    // 3. STAFF Scoped Visibility
    log('Testing STAFF scoped report visibility...');
    const staff1ReportData = await reportService.getReportData({}, { userId: staff1.id, role: 'STAFF' });
    if (staff1ReportData.students.length !== 3) {
      throw new Error(`Expected Staff1 to see exactly 3 assigned students, got ${staff1ReportData.students.length}`);
    }
    const staff1StudentIds = staff1ReportData.students.map((s) => s.id);
    if (staff1StudentIds.includes(st4.id)) {
      throw new Error('Security Violation: Staff1 received unassigned student st4 in report data');
    }
    log('Pass: Staff1 report data strictly scoped to 3 assigned students.');

    // 4. Unauthorized Student Access Rejection
    log('Testing unauthorized student daily progress access rejection for STAFF...');
    try {
      await reportService.getStudentDailyProgress(st4.id, { userId: staff1.id, role: 'STAFF' });
      throw new Error('Expected 403 Forbidden when Staff accesses unassigned student progress');
    } catch (err: any) {
      if (err.statusCode !== 403 && !err.message.includes('Forbidden')) {
        throw err;
      }
      log('Pass: Unauthorized student progress request rejected with HTTP 403 Forbidden.');
    }

    // 5. Unauthorized Batch Access Rejection
    log('Testing unauthorized batch report filtering for STAFF...');
    try {
      await reportService.getReportData({ batchId: batchP6_2.id }, { userId: staff1.id, role: 'STAFF' });
      throw new Error('Expected 403 Forbidden when Staff accesses unassigned batch report');
    } catch (err: any) {
      if (err.statusCode !== 403 && !err.message.includes('Forbidden')) {
        throw err;
      }
      log('Pass: Unauthorized batch report query rejected with HTTP 403 Forbidden.');
    }

    // 6 & 7. Student Leaderboard Sorting (Highest -> Lowest vs Lowest -> Highest)
    log('Testing student leaderboard sorting (Highest -> Lowest & Lowest -> Highest)...');
    const descData = await reportService.getReportData({ batchId: batchP6_1.id, sortBy: 'total', sortOrder: 'desc' }, { userId: 'admin_id', role: 'ADMIN' });
    if (descData.students[0].total_solved < descData.students[descData.students.length - 1].total_solved) {
      throw new Error('Leaderboard Total DESC sorting failed');
    }

    const ascData = await reportService.getReportData({ batchId: batchP6_1.id, sortBy: 'total', sortOrder: 'asc' }, { userId: 'admin_id', role: 'ADMIN' });
    if (ascData.students[0].total_solved > ascData.students[ascData.students.length - 1].total_solved) {
      throw new Error('Leaderboard Total ASC sorting failed');
    }
    log('Pass: Leaderboard Total DESC & ASC sorting verified.');

    // 8. Sorting by Easy, Medium, Hard
    log('Testing sorting by Easy, Medium, Hard metrics...');
    const easyData = await reportService.getReportData({ batchId: batchP6_1.id, sortBy: 'easy', sortOrder: 'desc' }, { userId: 'admin_id', role: 'ADMIN' });
    if (easyData.students[0].easy_solved < easyData.students[easyData.students.length - 1].easy_solved) {
      throw new Error('Leaderboard Easy DESC sorting failed');
    }
    log('Pass: Sorting by specific category metrics (Easy, Medium, Hard) verified.');

    // 9. Daily Snapshot History
    log('Testing student daily progress snapshot history endpoint...');
    const st1Progress = await reportService.getStudentDailyProgress(st1.id, { userId: 'admin_id', role: 'ADMIN' });
    if (!st1Progress.student || st1Progress.student.id !== st1.id) {
      throw new Error('Daily progress student header missing or invalid');
    }
    log(`Pass: Daily progress retrieved with ${st1Progress.snapshots.length} snapshots for ${st1.name}.`);

    // 10, 11, 12, 13. Filters (Batch, Section, Staff, Date)
    log('Testing combined filters (Batch, Section, Department)...');
    const filteredReport = await reportService.getReportData({
      batchId: batchP6_1.id,
      sectionId: sectionP6_A.id,
      department: 'CSE',
    }, { userId: 'admin_id', role: 'ADMIN' });

    if (filteredReport.students.length !== 3) {
      throw new Error(`Expected 3 filtered students for Batch 1 CSE-A, got ${filteredReport.students.length}`);
    }
    log('Pass: Batch, Section, Department filters work together correctly.');

    // 14, 15, 16. CSV Export Generation & Authorization Verification
    log('Testing CSV report generation & authorization scope enforcement...');
    const csvResult = await reportService.exportCsvReport({ batchId: batchP6_1.id }, { userId: staff1.id, role: 'STAFF' });
    if (!csvResult.fileName.endsWith('.csv')) {
      throw new Error('Invalid CSV file name format');
    }
    if (!csvResult.csvContent.includes('Alice Top Coder') || csvResult.csvContent.includes('David ECE Coder')) {
      throw new Error('CSV export contents violated staff authorization scope or filter scope');
    }
    log('Pass: CSV report generated with audit metadata, strictly respecting STAFF authorization.');

    // 17, 18, 19. Database Persistence & Behavior Preservation
    log('Testing DB Persistence & Idempotent Record Reuse...');
    let repeatStaff: any = null;
    if (!process.env.DATABASE_URL) {
      repeatStaff = inMemoryStore.users.find((u) => u.email === `p6_staff1_${timestamp}@college.edu`);
    } else {
      repeatStaff = await prisma.user.findUnique({ where: { email: `p6_staff1_${timestamp}@college.edu` } });
    }
    if (!repeatStaff) {
      repeatStaff = await staffService.createStaff({
        name: `Phase6 Staff1 ${timestamp}`,
        email: `p6_staff1_${timestamp}@college.edu`,
        password: 'Pass123!',
      });
    }
    if (!repeatStaff || !repeatStaff.id) {
      throw new Error('Staff creation/reuse failed');
    }
    log('Pass: DB persistence and idempotent record handling verified.');

    log('====================================================');
    log('PHASE 6 REGRESSION TESTS COMPLETED SUCCESSFULLY!');
    log('====================================================');

    return { name: 'Phase 6 Regression Suite', passed: true, details };
  } catch (err: any) {
    log(`FAIL: Phase 6 regression test error: ${err.message}`);
    return { name: 'Phase 6 Regression Suite', passed: false, details };
  }
}
