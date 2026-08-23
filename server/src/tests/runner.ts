import { seedInitialAdmin } from '../services/userService.js';
import { testEnvironmentValidation } from './unit/env.test.js';
import { testAuthMiddleware } from './unit/authMiddleware.test.js';
import { testStudentAuthServiceLogic } from './unit/studentAuthService.test.js';
import { runPhase1RegressionTests } from './regression/phase1.regression.test.js';
import { runPhase2RegressionTests } from './regression/phase2.regression.test.js';
import { runPhase3RegressionTests } from './regression/phase3.regression.test.js';
import { runPhase4RegressionTests } from './regression/phase4.regression.test.js';
import { runPhase5RegressionTests } from './regression/phase5.regression.test.js';
import { runPhase6RegressionTests } from './regression/phase6.regression.test.js';
import { runPhase7RegressionTests } from './regression/phase7.regression.test.js';
import { runPhase8RegressionTests } from './regression/phase8.regression.test.js';
import { run60StudentResponsibilityRegressionTest } from './regression/responsibility60Student.regression.test.js';
import { testExcelReportAndSyncOptimization } from './unit/excelAndSyncReport.test.js';

async function main() {
  console.log('===========================================================');
  console.log('CODING PROGRESS TRACKER — CENTRAL AUTOMATED TEST SUITE');
  console.log('===========================================================');

  await seedInitialAdmin();

  let totalCount = 0;
  let passCount = 0;
  let failCount = 0;

  const runTest = async (testFn: () => Promise<{ name: string; passed: boolean; message?: string; details?: string[] }>) => {
    totalCount++;
    try {
      const res = await testFn();
      if (res.passed) {
        passCount++;
        console.log(`[PASS] ${res.name}`);
        if (res.details) {
          res.details.forEach((d) => console.log(`       ${d}`));
        }
      } else {
        failCount++;
        console.error(`[FAIL] ${res.name} — Error: ${res.message || 'Validation failed'}`);
        if (res.details) {
          res.details.forEach((d) => console.error(`       ${d}`));
        }
      }
    } catch (err: any) {
      failCount++;
      console.error(`[FAIL] Test Execution Exception: ${err.message}`);
    }
  };

  await runTest(testEnvironmentValidation);
  await runTest(testAuthMiddleware);
  await runTest(testStudentAuthServiceLogic);
  await runTest(testExcelReportAndSyncOptimization);
  await runTest(runPhase1RegressionTests);
  await runTest(runPhase2RegressionTests);
  await runTest(runPhase3RegressionTests);
  await runTest(runPhase4RegressionTests);
  await runTest(runPhase5RegressionTests);
  await runTest(runPhase6RegressionTests);
  await runTest(runPhase7RegressionTests);
  await runTest(runPhase8RegressionTests);
  await runTest(run60StudentResponsibilityRegressionTest);

  console.log('===========================================================');
  console.log(`TEST RESULTS SUMMARY: Total: ${totalCount} | Passed: ${passCount} | Failed: ${failCount}`);
  console.log('===========================================================');

  if (failCount > 0) {
    console.error('QUALITY GATE FAILED: Known errors remain in test suite.');
    process.exit(1);
  } else {
    console.log('QUALITY GATE PASSED: All automated tests & regression suites succeeded!');
    process.exit(0);
  }
}

main();
