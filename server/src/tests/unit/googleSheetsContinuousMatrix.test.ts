import assert from 'assert';
import { buildGoogleSheetMatrix } from '../../services/googleSheetsService.js';
import { inMemoryStore } from '../../db/inMemoryStore.js';
import { toISTDateString } from '../../services/reportService.js';

export async function runGoogleSheetsContinuousMatrixTests(): Promise<{
  name: string;
  passed: boolean;
  message?: string;
  details?: string[];
}> {
  const details: string[] = [];
  try {
    details.push('--- Starting Google Sheets Continuous Matrix & No-Hyphen Test Suite ---');

    // Test Setup: 2 students
    // Student 1 (Arunbalaji): Has snapshots on 2026-09-05, 2026-09-06, 2026-09-08 (missing 2026-09-07 and 2026-09-09)
    // Student 2 (Chandru M): Has snapshots on 2026-09-05, 2026-09-06, 2026-09-08, and 2026-09-09 (today)
    const mockStudents = [
      {
        id: 'st_arun_1',
        name: 'ARUNBALAJI R',
        register_number: '7104022',
        department: 'CSE',
        batch_id: 'batch_cse',
        academic_year: '2023–2027',
        section_name: 'CSE-A',
        sub_batch: 'Batch 1',
        mentor_name: 'Staff Mentor',
        leetcode_username: 'arunbalaji_r',
      },
      {
        id: 'st_chandru_2',
        name: 'CHANDRU M',
        register_number: '7104029',
        department: 'CSE',
        batch_id: 'batch_cse',
        academic_year: '2023–2027',
        section_name: 'CSE-A',
        sub_batch: 'Batch 1',
        mentor_name: 'Staff Mentor',
        leetcode_username: 'chandrum06',
      },
    ];

    const mockSnapshots = [
      // Arunbalaji: 248 total on 06-Sep and 08-Sep
      {
        student_id: 'st_arun_1',
        snapshot_date: new Date('2026-09-06T00:00:00.000Z'),
        easy_solved: 120,
        medium_solved: 100,
        hard_solved: 28,
        total_solved: 248,
      },
      {
        student_id: 'st_arun_1',
        snapshot_date: new Date('2026-09-08T00:00:00.000Z'),
        easy_solved: 120,
        medium_solved: 100,
        hard_solved: 28,
        total_solved: 248,
      },
      // Chandru: 276 on 06-Sep, 277 on 08-Sep (+1), 278 on 09-Sep (+1)
      {
        student_id: 'st_chandru_2',
        snapshot_date: new Date('2026-09-06T00:00:00.000Z'),
        easy_solved: 112,
        medium_solved: 149,
        hard_solved: 15,
        total_solved: 276,
      },
      {
        student_id: 'st_chandru_2',
        snapshot_date: new Date('2026-09-08T00:00:00.000Z'),
        easy_solved: 112,
        medium_solved: 150,
        hard_solved: 15,
        total_solved: 277,
      },
      {
        student_id: 'st_chandru_2',
        snapshot_date: new Date('2026-09-09T00:00:00.000Z'),
        easy_solved: 112,
        medium_solved: 151,
        hard_solved: 15,
        total_solved: 278,
      },
    ];

    const matrix = buildGoogleSheetMatrix(mockStudents, mockSnapshots, '2026-09-06');

    // 1. Verify headers contain continuous dates: 06-Sep, 07-Sep, 08-Sep, 09-Sep
    assert(matrix.headers.includes('06-Sep-2026'), 'Headers must include 06-Sep-2026');
    assert(matrix.headers.includes('07-Sep-2026'), 'Headers must include 07-Sep-2026 (continuous healing)');
    assert(matrix.headers.includes('08-Sep-2026'), 'Headers must include 08-Sep-2026');
    assert(matrix.headers.includes('09-Sep-2026'), 'Headers must include 09-Sep-2026');
    details.push('Pass: Headers contain all dates continuously without skipping 07-Sep-2026.');

    const colIdx09Sep = matrix.headers.indexOf('09-Sep-2026');
    const colIdx07Sep = matrix.headers.indexOf('07-Sep-2026');
    assert(colIdx09Sep >= 8, '09-Sep-2026 column index must be >= 8');

    // 2. Verify Arunbalaji row on 09-Sep-2026 DOES NOT SHOW '-'
    const arunRow = matrix.rows.find((r) => r[6] === 'ARUNBALAJI R');
    assert(arunRow, 'Arunbalaji row must exist');

    const arunCell09Sep = arunRow[colIdx09Sep];
    assert.notStrictEqual(arunCell09Sep, '-', 'Arunbalaji cell on 09-Sep-2026 MUST NOT be "-"!');
    assert(arunCell09Sep.includes('248T'), `Expected 248T in cell, got: ${arunCell09Sep}`);
    assert(arunCell09Sep.includes('Today: +0E | +0M | +0H | +0T'), `Expected +0T today, got: ${arunCell09Sep}`);
    details.push('Pass: Arunbalaji R carries forward 248 overall solved with +0 today on 09-Sep-2026 (zero false hyphens).');

    // 3. Verify Arunbalaji row on 07-Sep-2026 also carries forward smoothly
    const arunCell07Sep = arunRow[colIdx07Sep];
    assert.notStrictEqual(arunCell07Sep, '-', 'Arunbalaji cell on 07-Sep-2026 MUST NOT be "-"!');
    assert(arunCell07Sep.includes('248T'), `Expected 248T on 07-Sep, got: ${arunCell07Sep}`);
    details.push('Pass: Arunbalaji R continuous timeline carries forward 248 total on 07-Sep-2026.');

    // 4. Verify Chandru M row has exact delta (+1T) on 09-Sep-2026
    const chandruRow = matrix.rows.find((r) => r[6] === 'CHANDRU M');
    assert(chandruRow, 'Chandru row must exist');
    const chandruCell09Sep = chandruRow[colIdx09Sep];
    assert(chandruCell09Sep.includes('278T'), `Expected 278T, got: ${chandruCell09Sep}`);
    assert(chandruCell09Sep.includes('Today: +0E | +1M | +0H | +1T'), `Expected +1M / +1T, got: ${chandruCell09Sep}`);
    details.push('Pass: Chandru M cell reflects live 278T and +1T delta for 09-Sep-2026.');

    return {
      name: 'Google Sheets Continuous Matrix & False Hyphen Prevention',
      passed: true,
      details,
    };
  } catch (err: any) {
    return {
      name: 'Google Sheets Continuous Matrix & False Hyphen Prevention',
      passed: false,
      message: err?.message || String(err),
      details,
    };
  }
}

if (process.argv[1]?.includes('googleSheetsContinuousMatrix.test.ts')) {
  runGoogleSheetsContinuousMatrixTests().then((res) => {
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.passed ? 0 : 1);
  });
}
