import { runScenarioTest } from './scenarioTest.js';

runScenarioTest()
  .then((res) => {
    console.log('\n--- SCENARIO TEST SUMMARY ---');
    console.log('SUCCESS:', res.success);
    console.log('LOGS:\n' + res.log.join('\n'));
    process.exit(res.success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
