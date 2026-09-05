import { inMemoryStore } from '../db/inMemoryStore.js';
import { prisma } from '../db/client.js';

export interface SyncErrorItem {
  id: string;
  studentId: string;
  studentName: string;
  registerNumber: string;
  leetcodeUsername: string;
  batchId?: string;
  batchName?: string;
  department?: string;
  sectionId?: string;
  sectionName?: string;
  errorMessage: string;
  errorType: 'PARSE_ERROR' | 'PROFILE_NOT_FOUND' | 'RATE_LIMITED' | 'NETWORK_TIMEOUT' | 'INVALID_RESPONSE';
  failedAt: string; // ISO
  retryCount: number;
  lastRetryAt?: string;
  status: 'FAILED' | 'RETRYING' | 'RESOLVED';
}

class SyncErrorService {
  private errors: Map<string, SyncErrorItem> = new Map();

  constructor() {
    this.seedInitialErrors();
  }

  public recordError(data: {
    studentId: string;
    studentName: string;
    registerNumber: string;
    leetcodeUsername: string;
    batchId?: string;
    batchName?: string;
    department?: string;
    sectionId?: string;
    sectionName?: string;
    errorMessage: string;
    errorType?: SyncErrorItem['errorType'];
  }): SyncErrorItem {
    const existing = this.errors.get(data.studentId);
    const retryCount = existing ? existing.retryCount + 1 : 0;

    let errorType: SyncErrorItem['errorType'] = data.errorType || 'PARSE_ERROR';
    const msg = data.errorMessage.toLowerCase();
    if (msg.includes('404') || msg.includes('does not exist') || msg.includes('not found')) {
      errorType = 'PROFILE_NOT_FOUND';
    } else if (msg.includes('rate') || msg.includes('429')) {
      errorType = 'RATE_LIMITED';
    } else if (msg.includes('timeout') || msg.includes('timed out')) {
      errorType = 'NETWORK_TIMEOUT';
    } else if (msg.includes('parse') || msg.includes('json') || msg.includes('schema')) {
      errorType = 'PARSE_ERROR';
    }

    const item: SyncErrorItem = {
      id: existing?.id || `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      studentId: data.studentId,
      studentName: data.studentName,
      registerNumber: data.registerNumber,
      leetcodeUsername: data.leetcodeUsername,
      batchId: data.batchId,
      batchName: data.batchName,
      department: data.department,
      sectionId: data.sectionId,
      sectionName: data.sectionName,
      errorMessage: data.errorMessage,
      errorType,
      failedAt: new Date().toISOString(),
      retryCount,
      lastRetryAt: existing ? new Date().toISOString() : undefined,
      status: 'FAILED',
    };

    this.errors.set(data.studentId, item);
    return item;
  }

  public resolveError(studentId: string): boolean {
    if (this.errors.has(studentId)) {
      this.errors.delete(studentId);
      return true;
    }
    return false;
  }

  public getErrors(filters?: {
    search?: string;
    department?: string;
    batchId?: string;
    errorType?: string;
  }): SyncErrorItem[] {
    let list = Array.from(this.errors.values());

    if (filters?.department && filters.department !== 'ALL') {
      list = list.filter((e) => e.department?.toLowerCase() === filters.department?.toLowerCase());
    }

    if (filters?.batchId && filters.batchId !== 'ALL') {
      list = list.filter((e) => e.batchId === filters.batchId);
    }

    if (filters?.errorType && filters.errorType !== 'ALL') {
      list = list.filter((e) => e.errorType === filters.errorType);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.studentName.toLowerCase().includes(q) ||
          e.registerNumber.toLowerCase().includes(q) ||
          e.leetcodeUsername.toLowerCase().includes(q) ||
          e.errorMessage.toLowerCase().includes(q) ||
          (e.batchName && e.batchName.toLowerCase().includes(q))
      );
    }

    // Sort by latest failed first
    return list.sort((a, b) => new Date(b.failedAt).getTime() - new Date(a.failedAt).getTime());
  }

  public getErrorCount(): number {
    return this.errors.size;
  }

  public clearAll(): void {
    this.errors.clear();
  }

  private seedInitialErrors(): void {
    // Initial sample failed profile so admin can immediately view and use the 'Retry' feature
    this.errors.set('seed-err-1', {
      id: 'err_sample_1',
      studentId: 'seed-err-1',
      studentName: 'Praveen S.',
      registerNumber: '717822P101',
      leetcodeUsername: 'praveen_invalid_99x',
      batchId: 'batch-1',
      batchName: 'Batch 2022-2026',
      department: 'CSE',
      sectionName: 'A',
      errorMessage: 'LeetCode 404: User profile does not exist or has been deleted on leetcode.com',
      errorType: 'PROFILE_NOT_FOUND',
      failedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      retryCount: 1,
      status: 'FAILED',
    });

    this.errors.set('seed-err-2', {
      id: 'err_sample_2',
      studentId: 'seed-err-2',
      studentName: 'Kavitha M.',
      registerNumber: '717822P102',
      leetcodeUsername: 'kavitha_parse_err',
      batchId: 'batch-1',
      batchName: 'Batch 2022-2026',
      department: 'CSE',
      sectionName: 'B',
      errorMessage: 'Failed to parse user submitStats from LeetCode GraphQL API: malformed difficulty field',
      errorType: 'PARSE_ERROR',
      failedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      retryCount: 0,
      status: 'FAILED',
    });
  }
}

export const syncErrorService = new SyncErrorService();
