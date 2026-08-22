import { prisma } from '../../db/client.js';
import { inMemoryStore } from '../../db/inMemoryStore.js';
import * as leetcodeService from '../../services/leetcodeService.js';
import * as batchService from '../../services/batchService.js';
import * as studentService from '../../services/studentService.js';

export async function runPhase4RegressionTests(): Promise<{ name: string; passed: boolean; details: string[] }> {
  const details: string[] = [];
  const log = (msg: string) => details.push(msg);

  log('--- Starting Phase 4 Regression Test Suite (LeetCode Sync Engine) ---');

  try {
    // Setup test student
    let testBatchId = 'b_phase4_1';
    let testSecId = 'sec_phase4_1';
    let testStudentId = 'st_phase4_1';

    if (!process.env.DATABASE_URL) {
      inMemoryStore.students.push({
        id: testStudentId,
        register_number: 'REG_P4_001',
        name: 'Phase4 Student',
        department: 'CSE',
        batch_id: testBatchId,
        section_id: testSecId,
        leetcode_username: 'test_coder_p4',
        created_at: new Date(),
      });
    } else {
      const b = await batchService.createBatch({
        batch_name: `P4_Batch_${Date.now()}`,
        start_year: 2023,
        end_year: 2027,
        department: 'CSE',
      });
      const s = await batchService.createSection(b.id, 'CSE-P4');
      const st = await studentService.createStudent({
        register_number: `REG_P4_${Date.now()}`,
        name: 'Phase4 Student',
        department: 'CSE',
        batch_id: b.id,
        section_id: s.id,
        leetcode_username: 'test_coder_p4',
      });
      testBatchId = b.id;
      testSecId = s.id;
      testStudentId = st.id;
    }

    // 1. Fetch LeetCode Stats Test
    log('Testing LeetCode stats fetch adapter...');
    const stats = await leetcodeService.fetchLeetCodeStats('test_coder_p4');
    if (!stats || typeof stats.totalSolved !== 'number') {
      log('FAIL: fetchLeetCodeStats returned invalid structure.');
      return { name: 'Phase 4 Regression Suite', passed: false, details };
    }
    log(`Pass: Fetched stats for @${stats.username} (Easy: ${stats.easySolved}, Medium: ${stats.mediumSolved}, Hard: ${stats.hardSolved}, Total: ${stats.totalSolved}).`);

    // 2. Single Student Sync Test
    log('Testing single student sync operation...');
    const realAdmin = process.env.DATABASE_URL
      ? (await prisma.user.findFirst({ where: { role: 'ADMIN' } })) || { id: 'admin_1', role: 'ADMIN' }
      : { id: 'admin_1', role: 'ADMIN' };
    const adminUser = { userId: realAdmin.id, role: 'ADMIN' as const };
    const syncRes = await leetcodeService.syncStudentLeetCode(testStudentId, adminUser);

    if (!syncRes.snapshot || syncRes.snapshot.total_solved !== stats.totalSolved) {
      log('FAIL: Student sync snapshot creation failed or total solved mismatch.');
      return { name: 'Phase 4 Regression Suite', passed: false, details };
    }
    log('Pass: Single student sync succeeded and logged daily snapshot.');

    // 3. Upsert Logic & Unique Constraint Check
    log('Testing Daily Snapshot upsert logic (same date update)...');
    const syncRes2 = await leetcodeService.syncStudentLeetCode(testStudentId, adminUser);
    const studentSnaps = await leetcodeService.getStudentSnapshots(testStudentId, adminUser);

    if (studentSnaps.length !== 1) {
      log(`FAIL: Expected 1 upserted snapshot for date, found ${studentSnaps.length}.`);
      return { name: 'Phase 4 Regression Suite', passed: false, details };
    }
    log('Pass: Snapshot upsert logic verified; duplicate date entries prevented.');

    // 4. Batch Multi-Student Sync Test
    log('Testing multi-student batch sync operation...');
    const batchSyncRes = await leetcodeService.syncBatchLeetCode(testBatchId, adminUser);
    if (batchSyncRes.successful < 1) {
      log('FAIL: Batch sync returned zero successful syncs.');
      return { name: 'Phase 4 Regression Suite', passed: false, details };
    }
    log(`Pass: Batch sync completed successfully (${batchSyncRes.successful} synced).`);

    // 5. Authorization Scoping Test
    log('Testing STAFF unauthorized sync restriction...');
    const unauthorizedStaff = { userId: 'staff_unauth_p4', role: 'STAFF' as const };
    let unauthError = false;
    try {
      await leetcodeService.syncStudentLeetCode(testStudentId, unauthorizedStaff);
    } catch (err: any) {
      if (err.statusCode === 403) unauthError = true;
    }

    if (!unauthError) {
      log('FAIL: Unauthorized STAFF sync attempt did not return 403 Forbidden.');
      return { name: 'Phase 4 Regression Suite', passed: false, details };
    }
    log('Pass: Unauthorized STAFF sync attempt correctly rejected with 403 Forbidden.');

    log('====================================================');
    log('PHASE 4 REGRESSION TESTS COMPLETED SUCCESSFULLY!');
    log('====================================================');

    return { name: 'Phase 4 Regression Suite', passed: true, details };
  } catch (err: any) {
    log(`FAIL: Error executing Phase 4 Regression suite: ${err.message}`);
    return { name: 'Phase 4 Regression Suite', passed: false, details };
  }
}
