import { env } from '../../config/env.js';

export async function testEnvironmentValidation(): Promise<{ name: string; passed: boolean; message?: string }> {
  const testName = 'Unit Test: Environment Configuration & Secret Protection';
  try {
    if (!env.JWT_SECRET) {
      return { name: testName, passed: false, message: 'JWT_SECRET is missing' };
    }

    if (!env.INITIAL_ADMIN_EMAIL || !env.INITIAL_ADMIN_PASSWORD) {
      return { name: testName, passed: false, message: 'Initial Admin credentials are missing' };
    }

    // Verify secret strings are not empty and initialized
    if (env.INITIAL_ADMIN_PASSWORD.length < 6) {
      return { name: testName, passed: false, message: 'INITIAL_ADMIN_PASSWORD is too short' };
    }

    return { name: testName, passed: true };
  } catch (err: any) {
    return { name: testName, passed: false, message: err.message };
  }
}
