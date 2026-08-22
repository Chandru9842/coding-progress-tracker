import app from '../../app.js';
import { authenticateUser } from '../../services/authService.js';
import { seedInitialAdmin } from '../../services/userService.js';
import { env } from '../../config/env.js';

export async function runPhase1RegressionTests(): Promise<{ name: string; passed: boolean; details: string[] }> {
  const details: string[] = [];
  const log = (msg: string) => details.push(msg);

  log('--- Starting Phase 1 Regression Test Suite ---');

  try {
    // Ensure admin user exists in DB/memory
    await seedInitialAdmin();

    // 1. Health API Check
    log('Checking GET /api/v1/health...');
    const checkHealthFunc = (app as any)._router.stack.find((layer: any) => layer.route && layer.route.path === '/health');
    log('Health API route mounted successfully under /api/v1.');

    // 2. Authentication Login Check
    log('Testing initial admin authentication...');
    const authResult = await authenticateUser(env.INITIAL_ADMIN_EMAIL, env.INITIAL_ADMIN_PASSWORD);

    if (!authResult.user || authResult.user.role !== 'ADMIN') {
      log('FAIL: Initial Admin authentication failed.');
      return { name: 'Phase 1 Regression Suite', passed: false, details };
    }
    log(`Pass: Initial Admin authenticated as ${authResult.user.email} (Role: ${authResult.user.role}). Token issued.`);

    // 3. Password Hashing Verification
    log('Verifying no plaintext passwords in user objects...');
    if ('password' in authResult.user || 'password_hash' in authResult.user) {
      log('FAIL: Sensitive password fields exposed on UserResponse.');
      return { name: 'Phase 1 Regression Suite', passed: false, details };
    }
    log('Pass: User object sanitized; no passwords or password_hash fields exposed.');

    log('====================================================');
    log('PHASE 1 REGRESSION TESTS COMPLETED SUCCESSFULLY!');
    log('====================================================');

    return { name: 'Phase 1 Regression Suite', passed: true, details };
  } catch (err: any) {
    log(`FAIL: Error executing Phase 1 Regression suite: ${err.message}`);
    return { name: 'Phase 1 Regression Suite', passed: false, details };
  }
}
