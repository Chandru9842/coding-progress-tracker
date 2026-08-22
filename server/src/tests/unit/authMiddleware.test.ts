import { requireAuth, requireAdmin, requireStaff } from '../../middleware/authMiddleware.js';

export async function testAuthMiddleware(): Promise<{ name: string; passed: boolean; message?: string }> {
  const testName = 'Unit Test: RBAC Auth Middleware (requireAuth, requireAdmin, requireStaff)';
  try {
    // 1. requireAuth rejects missing token
    let statusSet = 0;
    let jsonResult: any = null;
    const mockRes1: any = {
      status: (code: number) => { statusSet = code; return mockRes1; },
      json: (obj: any) => { jsonResult = obj; },
    };
    let nextCalled1 = false;
    requireAuth({ headers: {}, cookies: {} } as any, mockRes1, () => { nextCalled1 = true; });

    if (nextCalled1 || statusSet !== 401) {
      return { name: testName, passed: false, message: 'requireAuth failed to reject unauthenticated request' };
    }

    // 2. requireAdmin rejects STAFF role
    statusSet = 0;
    let nextCalled2 = false;
    const mockReqStaff: any = { user: { userId: 'u1', role: 'STAFF', email: 's@col.edu', name: 'Staff' } };
    requireAdmin(mockReqStaff, mockRes1, () => { nextCalled2 = true; });

    if (nextCalled2 || statusSet !== 403) {
      return { name: testName, passed: false, message: 'requireAdmin failed to reject STAFF user with 403' };
    }

    // 3. requireStaff allows STAFF and ADMIN roles
    let nextCalled3 = false;
    requireStaff(mockReqStaff, mockRes1, () => { nextCalled3 = true; });

    if (!nextCalled3) {
      return { name: testName, passed: false, message: 'requireStaff rejected valid STAFF user' };
    }

    const mockReqAdmin: any = { user: { userId: 'u2', role: 'ADMIN', email: 'a@col.edu', name: 'Admin' } };
    let nextCalled4 = false;
    requireStaff(mockReqAdmin, mockRes1, () => { nextCalled4 = true; });

    if (!nextCalled4) {
      return { name: testName, passed: false, message: 'requireStaff rejected valid ADMIN user' };
    }

    return { name: testName, passed: true };
  } catch (err: any) {
    return { name: testName, passed: false, message: err.message };
  }
}
