import assert from 'assert';
import {
  toISTDateString,
  fillContinuousSnapshotTimeline,
  calculateStudentPeriodStats,
  getStudentDailyProgress,
} from '../../services/reportService.js';
import { inMemoryStore } from '../../db/inMemoryStore.js';

export async function runDatePresetProgressTests(): Promise<{
  name: string;
  passed: boolean;
  message?: string;
  details?: string[];
}> {
  const details: string[] = [];
  try {
    details.push('--- Starting Date Preset & Period Progress Test Suite ---');

    // Test 1: toISTDateString format validation
    const date1 = new Date('2026-09-08T00:00:00.000Z');
    const istStr1 = toISTDateString(date1);
    assert.strictEqual(istStr1, '2026-09-08', 'Expected 2026-09-08 in IST');

    const pureStr = '2026-09-07';
    assert.strictEqual(toISTDateString(pureStr), '2026-09-07', 'Pure YYYY-MM-DD should remain unchanged');
    details.push('Pass: toISTDateString accurately handles Date objects and ISO strings in Asia/Kolkata timezone.');

    // Test 2: calculateStudentPeriodStats for "Today" and "Yesterday"
    // Timeline:
    // 2026-09-05: 10 solved (E: 5, M: 3, H: 2)
    // 2026-09-06: 14 solved (E: 7, M: 4, H: 3) -> +4 that day
    // 2026-09-07 (Yesterday): 18 solved (E: 9, M: 6, H: 3) -> +4 that day
    // 2026-09-08 (Today): 23 solved (E: 12, M: 7, H: 4) -> +5 that day
    const mockSnapshots = [
      { snapshot_date: new Date('2026-09-05T00:00:00.000Z'), easy_solved: 5, medium_solved: 3, hard_solved: 2, total_solved: 10 },
      { snapshot_date: new Date('2026-09-06T00:00:00.000Z'), easy_solved: 7, medium_solved: 4, hard_solved: 3, total_solved: 14 },
      { snapshot_date: new Date('2026-09-07T00:00:00.000Z'), easy_solved: 9, medium_solved: 6, hard_solved: 3, total_solved: 18 },
      { snapshot_date: new Date('2026-09-08T00:00:00.000Z'), easy_solved: 12, medium_solved: 7, hard_solved: 4, total_solved: 23 },
    ];

    // Query for "Today" (2026-09-08 to 2026-09-08)
    const todayStats = calculateStudentPeriodStats(mockSnapshots, true, '2026-09-08', '2026-09-08');
    assert.strictEqual(todayStats.total_solved, 5, 'Today total solved should be 23 - 18 = 5');
    assert.strictEqual(todayStats.easy_solved, 3, 'Today easy solved should be 12 - 9 = 3');
    assert.strictEqual(todayStats.medium_solved, 1, 'Today medium solved should be 7 - 6 = 1');
    assert.strictEqual(todayStats.hard_solved, 1, 'Today hard solved should be 4 - 3 = 1');
    assert.strictEqual(todayStats.easy_solved + todayStats.medium_solved + todayStats.hard_solved, todayStats.total_solved, 'Sum must match total');
    assert.strictEqual(todayStats.overall_total, 23, 'Overall total should be 23');
    assert.strictEqual(todayStats.has_activity, true);
    details.push('Pass: calculateStudentPeriodStats correctly computes Today progress (5 new problems solved).');

    // Query for "Yesterday" (2026-09-07 to 2026-09-07)
    const yesterdayStats = calculateStudentPeriodStats(mockSnapshots, true, '2026-09-07', '2026-09-07');
    assert.strictEqual(yesterdayStats.total_solved, 4, 'Yesterday total solved should be 18 - 14 = 4');
    assert.strictEqual(yesterdayStats.easy_solved, 2, 'Yesterday easy solved should be 9 - 7 = 2');
    assert.strictEqual(yesterdayStats.medium_solved, 2, 'Yesterday medium solved should be 6 - 4 = 2');
    assert.strictEqual(yesterdayStats.hard_solved, 0, 'Yesterday hard solved should be 3 - 3 = 0');
    assert.strictEqual(yesterdayStats.overall_total, 23, 'Overall total remains 23');
    details.push('Pass: calculateStudentPeriodStats correctly computes Yesterday progress (4 new problems solved).');

    // Query for "Custom Range" (2026-09-06 to 2026-09-08)
    const customStats = calculateStudentPeriodStats(mockSnapshots, true, '2026-09-06', '2026-09-08');
    assert.strictEqual(customStats.total_solved, 13, 'Custom range total should be 23 - 10 = 13');
    assert.strictEqual(customStats.overall_total, 23);
    details.push('Pass: calculateStudentPeriodStats correctly computes Custom Range progress (13 new problems solved across 3 days).');

    // Query for "All Time" (no dates)
    const allTimeStats = calculateStudentPeriodStats(mockSnapshots, false);
    assert.strictEqual(allTimeStats.total_solved, 23, 'All time total solved should be 23');
    assert.strictEqual(allTimeStats.easy_solved, 12);
    assert.strictEqual(allTimeStats.medium_solved, 7);
    assert.strictEqual(allTimeStats.hard_solved, 4);
    details.push('Pass: calculateStudentPeriodStats correctly returns All-Time cumulative totals.');

    // Test 3: getStudentDailyProgress with deltas
    const testStudentId = 'test_student_progress_1';
    inMemoryStore.students.push({
      id: testStudentId,
      register_number: 'TEST_PROG_01',
      name: 'Progress Test Student',
      department: 'CSE',
      batch_id: 'batch_test_1',
      section_id: 'sec_test_1',
      leetcode_username: 'prog_student',
      sub_batch: 'Batch 1',
      created_at: new Date(),
    } as any);

    mockSnapshots.forEach((snap, idx) => {
      inMemoryStore.snapshots.push({
        id: `snap_prog_${idx}`,
        student_id: testStudentId,
        snapshot_date: snap.snapshot_date,
        easy_solved: snap.easy_solved,
        medium_solved: snap.medium_solved,
        hard_solved: snap.hard_solved,
        total_solved: snap.total_solved,
        created_at: snap.snapshot_date,
      } as any);
    });

    const progressRes = await getStudentDailyProgress(
      testStudentId,
      { userId: 'admin_1', role: 'ADMIN' },
      { fromDate: '2026-09-07', toDate: '2026-09-08' }
    );

    assert(progressRes.snapshots.length >= 2, 'Should return filtered snapshots');
    const todaySnap = progressRes.snapshots.find((s) => s.formatted_date === '2026-09-08');
    assert(todaySnap, 'Should contain today snapshot');
    assert.strictEqual(todaySnap.daily_solved, 5, 'Daily solved for today should be 5');
    assert.strictEqual(todaySnap.daily_easy, 3);
    assert.strictEqual(todaySnap.daily_medium, 1);
    assert.strictEqual(todaySnap.daily_hard, 1);
    details.push('Pass: getStudentDailyProgress attaches accurate daily_solved and category deltas for modal inspection.');

    return {
      name: 'Date Preset & Period Progress Calculation',
      passed: true,
      details,
    };
  } catch (err: any) {
    return {
      name: 'Date Preset & Period Progress Calculation',
      passed: false,
      message: err?.message || String(err),
      details,
    };
  }
}

if (process.argv[1]?.includes('datePresetProgress.test.ts')) {
  runDatePresetProgressTests().then((res) => {
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.passed ? 0 : 1);
  });
}
