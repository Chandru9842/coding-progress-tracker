import assert from 'assert';
import { buildGoogleSheetMatrix } from '../../services/googleSheetsService.js';
import { inMemoryStore } from '../../db/inMemoryStore.js';

export async function runMidnightDateAlignmentTests(): Promise<{
  name: string;
  passed: boolean;
  message?: string;
  details?: string[];
}> {
  const details: string[] = [];
  try {
    details.push('--- Starting Midnight Date Alignment & Completed Day Reconciliation Test ---');

    // Scenario:
    // Today is 09/09/2026. Students solve coding problems throughout the day.
    // At midnight on 10/09/2026 (00:00 - 00:30 IST), day 09/09/2026 has concluded.
    // The sheet must be updated with the 09/09/2026 details of the coding.

    const student = {
      id: 'st_midnight_test_1',
      name: 'Test Student',
      register_number: '7104099',
      department: 'CSE',
      batch_id: 'batch_test',
      academic_year: '2023–2027',
      section_name: 'CSE-A',
      sub_batch: 'Batch 1',
      mentor_name: 'Mentor Name',
      leetcode_username: 'test_student_lc',
    };

    const snapshots = [
      // 08-Sep-2026 baseline: 200 solved
      {
        student_id: 'st_midnight_test_1',
        snapshot_date: new Date('2026-09-08T00:00:00.000Z'),
        easy_solved: 120,
        medium_solved: 60,
        hard_solved: 20,
        total_solved: 200,
        created_at: new Date('2026-09-08T18:00:00.000Z'),
      },
      // 09-Sep-2026 finalized at 23:59:59: 205 solved (+5 solved on 09/09/2026: +3E, +2M)
      {
        student_id: 'st_midnight_test_1',
        snapshot_date: new Date('2026-09-09T00:00:00.000Z'),
        easy_solved: 123,
        medium_solved: 62,
        hard_solved: 20,
        total_solved: 205,
        created_at: new Date('2026-09-09T23:59:59.000Z'),
      },
      // 10-Sep-2026 at 00:30 AM: 205 solved (0 new solved past midnight)
      {
        student_id: 'st_midnight_test_1',
        snapshot_date: new Date('2026-09-10T00:00:00.000Z'),
        easy_solved: 123,
        medium_solved: 62,
        hard_solved: 20,
        total_solved: 205,
        created_at: new Date('2026-09-10T00:30:00.000Z'),
      },
    ];

    const matrix = buildGoogleSheetMatrix([student], snapshots, '2026-09-08');

    const idx08 = matrix.headers.indexOf('08-Sep-2026');
    const idx09 = matrix.headers.indexOf('09-Sep-2026');
    const idx10 = matrix.headers.indexOf('10-Sep-2026');

    assert(idx08 !== -1, 'Header must contain 08-Sep-2026');
    assert(idx09 !== -1, 'Header must contain 09-Sep-2026');
    assert(idx10 !== -1, 'Header must contain 10-Sep-2026');
    details.push('Pass: Headers contain all consecutive days 08-Sep-2026, 09-Sep-2026, 10-Sep-2026.');

    const row = matrix.rows[0];

    // Verify 09-Sep-2026 contains exact 5 problems solved on 09/09/2026
    assert(row[idx09].includes('Overall: 123E | 62M | 20H | 205T'), `09-Sep must show 205 overall, got ${row[idx09]}`);
    assert(row[idx09].includes('Today: +3E | +2M | +0H | +5T'), `09-Sep must show +5T delta for problems solved on 09/09, got ${row[idx09]}`);
    details.push('Pass: Column 09-Sep-2026 correctly displays the finalized details (+5T) solved on 09/09/2026.');

    // Verify 10-Sep-2026 reflects +0T since no problems were solved past midnight
    assert(row[idx10].includes('Overall: 123E | 62M | 20H | 205T'), `10-Sep must show 205 overall, got ${row[idx10]}`);
    assert(row[idx10].includes('Today: +0E | +0M | +0H | +0T'), `10-Sep must show +0T delta past midnight, got ${row[idx10]}`);
    details.push('Pass: Column 10-Sep-2026 reflects start-of-day baseline with +0T delta.');

    // Now test if student solved 1 problem at 00:15 AM on 10/09/2026
    const snapshotsWithMidnightSolve = [
      ...snapshots.slice(0, 2),
      {
        student_id: 'st_midnight_test_1',
        snapshot_date: new Date('2026-09-10T00:00:00.000Z'),
        easy_solved: 124,
        medium_solved: 62,
        hard_solved: 20,
        total_solved: 206,
        created_at: new Date('2026-09-10T00:30:00.000Z'),
      },
    ];

    const matrix2 = buildGoogleSheetMatrix([student], snapshotsWithMidnightSolve, '2026-09-08');
    const row2 = matrix2.rows[0];

    assert(row2[idx09].includes('Today: +3E | +2M | +0H | +5T'), '09-Sep remains unchanged (+5T)');
    assert(row2[idx10].includes('Today: +1E | +0M | +0H | +1T'), '10-Sep correctly receives the 1 problem solved past midnight');
    details.push('Pass: Midnight solved problem (+1T) is cleanly separated from completed day solves (+5T).');

    return {
      name: 'Midnight Date Alignment & Completed Day Reconciliation Test Suite',
      passed: true,
      details,
    };
  } catch (err: any) {
    return {
      name: 'Midnight Date Alignment & Completed Day Reconciliation Test Suite',
      passed: false,
      message: err.message,
      details,
    };
  }
}
