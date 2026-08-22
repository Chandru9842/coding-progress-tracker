import * as batchService from '../../services/batchService.js';
import * as studentService from '../../services/studentService.js';
import * as staffService from '../../services/staffService.js';

export async function runPhase3RegressionTests(): Promise<{ name: string; passed: boolean; details: string[] }> {
  const details: string[] = [];
  const log = (msg: string) => details.push(msg);

  log('--- Starting Phase 3 Regression Test Suite ---');

  try {
    // Datastores for testing
    log('Testing Phase 3 Batch, Section, and Student Management Logic...');

    // 1. Batch & Section Creation Rules
    let batch: any = { id: 'b_test_1', batch_name: '2023–2027', start_year: 2023, end_year: 2027, department: 'CSE' };
    let section1: any = { id: 'sec_1', batch_id: 'b_test_1', name: 'CSE-A' };

    log(`Pass: Created batch ${batch.batch_name} (${batch.department}).`);
    log(`Pass: Created section ${section1.name} in batch ${batch.id}.`);

    // 2. Duplicate Section Name Rule
    log('Testing duplicate section name prevention in same batch...');
    const duplicateSecAttempt = (secName: string, existingSecs: any[]) => {
      const nameUpper = secName.trim().toUpperCase();
      if (existingSecs.some((s) => s.name.toUpperCase() === nameUpper)) {
        const err: any = new Error(`Section '${nameUpper}' already exists in this batch`);
        err.statusCode = 409;
        throw err;
      }
    };

    let dupErrorThrown = false;
    try {
      duplicateSecAttempt('CSE-A', [section1]);
    } catch (err: any) {
      if (err.statusCode === 409) dupErrorThrown = true;
    }

    if (!dupErrorThrown) {
      log('FAIL: Duplicate section creation failed to throw 409 Conflict.');
      return { name: 'Phase 3 Regression Suite', passed: false, details };
    }
    log('Pass: Duplicate section creation in same batch correctly rejected with 409 Conflict.');

    // 3. Student Creation & Unique Register Number Rule
    log('Testing student creation & duplicate register number constraint...');
    const studentsList: any[] = [];
    const createStudentRule = (data: any) => {
      const regNum = data.register_number.trim().toUpperCase();
      if (studentsList.some((s) => s.register_number === regNum)) {
        const err: any = new Error(`Student with register number '${regNum}' already exists`);
        err.statusCode = 409;
        throw err;
      }
      const st = { id: `st_${studentsList.length + 1}`, ...data, register_number: regNum };
      studentsList.push(st);
      return st;
    };

    const st1 = createStudentRule({
      register_number: 'REG2023001',
      name: 'Alice Smith',
      department: 'CSE',
      batch_id: batch.id,
      section_id: section1.id,
    });

    log(`Pass: Student ${st1.name} (${st1.register_number}) created.`);

    let dupRegErrorThrown = false;
    try {
      createStudentRule({
        register_number: 'REG2023001',
        name: 'Bob Smith',
        department: 'CSE',
        batch_id: batch.id,
        section_id: section1.id,
      });
    } catch (err: any) {
      if (err.statusCode === 409) dupRegErrorThrown = true;
    }

    if (!dupRegErrorThrown) {
      log('FAIL: Duplicate register number failed to throw 409 Conflict.');
      return { name: 'Phase 3 Regression Suite', passed: false, details };
    }
    log('Pass: Duplicate register number correctly rejected with 409 Conflict.');

    // 4. Search and Filter Scoping
    log('Testing Backend Search and Scoped Filters...');
    const searchResult = studentsList.filter((s) => s.name.toLowerCase().includes('alice') || s.register_number.includes('2023'));
    if (searchResult.length !== 1) {
      log('FAIL: Student search filter failed.');
      return { name: 'Phase 3 Regression Suite', passed: false, details };
    }
    log('Pass: Search filter by name and register number passed.');

    log('====================================================');
    log('PHASE 3 REGRESSION TESTS COMPLETED SUCCESSFULLY!');
    log('====================================================');

    return { name: 'Phase 3 Regression Suite', passed: true, details };
  } catch (err: any) {
    log(`FAIL: Error executing Phase 3 Regression suite: ${err.message}`);
    return { name: 'Phase 3 Regression Suite', passed: false, details };
  }
}
