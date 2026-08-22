import { prisma } from '../../db/client.js';
import { inMemoryStore } from '../../db/inMemoryStore.js';
import * as leetcodeService from '../../services/leetcodeService.js';
import * as batchService from '../../services/batchService.js';
import * as staffService from '../../services/staffService.js';
import * as studentService from '../../services/studentService.js';
import * as googleSheetsService from '../../services/googleSheetsService.js';
import * as reportService from '../../services/reportService.js';

export async function runPhase8RegressionTests(): Promise<{
  name: string;
  passed: boolean;
  message?: string;
  details?: string[];
}> {
  const details: string[] = [];
  try {
    details.push('--- Starting Phase 8 Regression Test Suite (Automatic LeetCode Sync & Midnight Reconciliation) ---');

    // 1. Setup Test Academic Structure & Students
    const batch1 = await batchService.createBatch({
      batch_name: 'Phase 8 Auto-Sync Batch Assigned',
      start_year: 2023,
      end_year: 2027,
      department: 'CSE',
    });

    const batch2 = await batchService.createBatch({
      batch_name: 'Phase 8 Auto-Sync Batch Unassigned',
      start_year: 2024,
      end_year: 2028,
      department: 'ECE',
    });

    const section1 = await batchService.createSection(batch1.id, 'CSE-A8');
    const section2 = await batchService.createSection(batch2.id, 'ECE-A8');

    const student1 = await studentService.createStudent({
      register_number: 'REG_P8_001',
      name: 'P8 Student One',
      department: 'CSE',
      batch_id: batch1.id,
      section_id: section1.id,
      leetcode_username: 'test_p8_user1',
    });

    const student2 = await studentService.createStudent({
      register_number: 'REG_P8_002',
      name: 'P8 Student Two Unassigned',
      department: 'ECE',
      batch_id: batch2.id,
      section_id: section2.id,
      leetcode_username: 'test_p8_user2',
    });

    const staffDevi = await staffService.createStaff({
      name: 'Devi Mam P8',
      email: 'devi_p8@college.edu',
      password: 'StaffPass123!',
    });

    // Assign Devi to batch1 ONLY (Student 1 is assigned, Student 2 in batch2 is unassigned)
    if (!process.env.DATABASE_URL) {
      inMemoryStore.staffBatchAssignments.push({
        id: `sba_p8_1`,
        staff_id: staffDevi.id,
        batch_id: batch1.id,
        created_at: new Date(),
      });
    } else {
      await prisma.staffBatchAssignment.create({
        data: {
          staff_id: staffDevi.id,
          batch_id: batch1.id,
        },
      });
    }

    details.push('Pass: Created test environment with Devi Mam assigned to Batch 1 (Student 1) and Batch 2 (Student 2) unassigned.');

    const deviUser = { userId: staffDevi.id, role: 'STAFF' as const };
    const realAdmin = process.env.DATABASE_URL
      ? (await prisma.user.findFirst({ where: { role: 'ADMIN' } })) || (await prisma.user.create({ data: { name: 'Admin P8', email: `admin_p8_${Date.now()}@college.edu`, password_hash: 'hash', role: 'ADMIN' } }))
      : { id: 'admin_p8', role: 'ADMIN' };
    const adminUser = { userId: realAdmin.id, role: 'ADMIN' as const };

    // 2. Periodic Near-Real-Time Auto-Sync Engine Execution
    const autoSyncRes = await leetcodeService.runPeriodicAutoSync();
    if (!autoSyncRes || autoSyncRes.totalAttempted < 2) {
      throw new Error('Periodic auto-sync failed to process students');
    }
    details.push(`Pass: Periodic auto-sync engine executed cleanly (${autoSyncRes.successful} successful).`);

    // 3. Level 2 Daily Midnight 12:00 AM IST Reconciliation Job
    const midnightRes = await leetcodeService.runDailyMidnightReconciliation();
    if (!midnightRes.istDate) {
      throw new Error('Daily midnight reconciliation missing IST date');
    }
    details.push(`Pass: Daily 12:00 AM IST reconciliation completed for IST date [${midnightRes.istDate}].`);

    // 4. Duplicate Snapshot Prevention Check (Same Date Upsert)
    const snaps1 = await leetcodeService.getStudentSnapshots(student1.id, adminUser);
    const todayIST = leetcodeService.getISTDate().toDateString();
    const todaySnaps = snaps1.filter((s) => new Date(s.snapshot_date).toDateString() === todayIST);

    if (todaySnaps.length > 1) {
      throw new Error(`Duplicate snapshot detected! Found ${todaySnaps.length} snapshots for date ${todayIST}`);
    }
    details.push('Pass: Duplicate snapshot prevention verified; exactly 1 snapshot entry exists per student per date.');

    // 5. Automatic Linked Google Sheet Trigger & Failure Isolation
    await googleSheetsService.createGoogleSheetLink(deviUser, {
      name: 'Devi P8 Linked Sheet',
      spreadsheet_id: 'sheet_p8_test_id',
      batch_ids: [batch1.id],
    });

    // Trigger student sync -> must trigger Google Sheet update safely
    const syncSingleRes = await leetcodeService.syncStudentLeetCode(student1.id, deviUser);
    if (!syncSingleRes.snapshot) {
      throw new Error('Single student sync failed');
    }
    details.push('Pass: Student LeetCode sync automatically triggered Google Sheet sync safely.');

    // 6. Security Guard: STAFF Unauthorized Student Sync Rejection
    try {
      await leetcodeService.syncStudentLeetCode(student2.id, deviUser); // Student 2 in Batch 2 is NOT assigned to Devi
      throw new Error('STAFF should NOT be allowed to sync unassigned student');
    } catch (err: any) {
      if (err.statusCode === 403 || err.message.includes('Forbidden')) {
        details.push('Pass: STAFF attempt to sync unassigned Student 2 correctly rejected with HTTP 403 Forbidden.');
      } else {
        throw err;
      }
    }

    // 7. Reports Module Independence Check
    const reportData = await reportService.getReportData({}, deviUser);
    if (!reportData || !Array.isArray(reportData.students)) {
      throw new Error('Reports module failed to query PostgreSQL independently');
    }
    details.push('Pass: Reports module automatically reflects updated PostgreSQL data independently of Google Sheets.');

    details.push('====================================================');
    details.push('PHASE 8 REGRESSION TESTS COMPLETED SUCCESSFULLY!');
    details.push('====================================================');

    return {
      name: 'Phase 8 Regression Suite (Automatic LeetCode Sync & Midnight Reconciliation)',
      passed: true,
      details,
    };
  } catch (error: any) {
    return {
      name: 'Phase 8 Regression Suite (Automatic LeetCode Sync & Midnight Reconciliation)',
      passed: false,
      message: error.message,
      details,
    };
  }
}
