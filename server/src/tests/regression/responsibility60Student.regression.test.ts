import { runScenarioTest } from '../../test/scenarioTest.js';

export async function run60StudentResponsibilityRegressionTest(): Promise<{ name: string; passed: boolean; details: string[] }> {
  const details: string[] = [];
  const log = (msg: string) => details.push(msg);

  log('--- Starting 60-Student Multi-Staff Responsibility Regression Test ---');

  try {
    const scenarioResult = await runScenarioTest();
    scenarioResult.log.forEach((line) => log(line));

    if (!scenarioResult.success) {
      log('FAIL: 60-Student Multi-Staff Responsibility scenario checks failed.');
      return { name: '60-Student Responsibility Regression Suite', passed: false, details };
    }

    log('====================================================');
    log('60-STUDENT RESPONSIBILITY REGRESSION PASSED!');
    log('====================================================');

    return { name: '60-Student Responsibility Regression Suite', passed: true, details };
  } catch (err: any) {
    log(`FAIL: Error running 60-Student Responsibility regression: ${err.message}`);
    return { name: '60-Student Responsibility Regression Suite', passed: false, details };
  }
}
