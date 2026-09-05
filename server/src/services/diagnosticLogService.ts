export interface DiagnosticLog {
  id: string;
  timestamp: string; // ISO
  targetType: 'LEETCODE_STUDENT' | 'LEETCODE_BATCH' | 'LEETCODE_SECTION' | 'GOOGLE_SHEET' | 'AUTO_SYNC';
  targetId: string;
  targetName: string;
  identifier?: string; // register_number, leetcode_username, or spreadsheet_id
  batchId?: string;
  batchName?: string;
  sectionId?: string;
  sectionName?: string;
  department?: string;
  latencyMs: number;
  status: 'SUCCESS' | 'FAILED' | 'WARNING';
  details?: string;
  errorMessage?: string;
  source?: string;
}

export interface ActiveSyncTask {
  id: string;
  description: string;
  startedAt: number;
}

class DiagnosticLogService {
  private logs: DiagnosticLog[] = [];
  private maxLogs: number = 1000;
  private activeTasks: Map<string, ActiveSyncTask> = new Map();

  constructor() {
    this.seedInitialLogs();
  }

  // Active sync tracking for global background indicator
  public startSyncTask(id: string, description: string): () => void {
    const task: ActiveSyncTask = {
      id,
      description,
      startedAt: Date.now(),
    };
    this.activeTasks.set(id, task);

    return () => {
      this.activeTasks.delete(id);
    };
  }

  public getActiveSyncStatus(): {
    isSyncing: boolean;
    activeTaskCount: number;
    currentTasks: string[];
  } {
    return {
      isSyncing: this.activeTasks.size > 0,
      activeTaskCount: this.activeTasks.size,
      currentTasks: Array.from(this.activeTasks.values()).map((t) => t.description),
    };
  }

  public recordLog(data: Omit<DiagnosticLog, 'id' | 'timestamp'>): DiagnosticLog {
    const log: DiagnosticLog = {
      id: `diag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...data,
      latencyMs: Math.max(0, Math.round(data.latencyMs)),
    };

    this.logs.unshift(log);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
    return log;
  }

  public getLogs(filters?: {
    targetType?: string;
    status?: string;
    minLatencyMs?: number;
    batchId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): {
    logs: DiagnosticLog[];
    total: number;
  } {
    let result = [...this.logs];

    if (filters?.targetType && filters.targetType !== 'ALL') {
      result = result.filter((l) => l.targetType === filters.targetType);
    }

    if (filters?.status && filters.status !== 'ALL') {
      result = result.filter((l) => l.status === filters.status);
    }

    if (filters?.minLatencyMs && filters.minLatencyMs > 0) {
      result = result.filter((l) => l.latencyMs >= (filters.minLatencyMs || 0));
    }

    if (filters?.batchId && filters.batchId !== 'ALL') {
      result = result.filter((l) => l.batchId === filters.batchId);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      result = result.filter(
        (l) =>
          l.targetName.toLowerCase().includes(q) ||
          (l.identifier && l.identifier.toLowerCase().includes(q)) ||
          (l.batchName && l.batchName.toLowerCase().includes(q)) ||
          (l.sectionName && l.sectionName.toLowerCase().includes(q)) ||
          (l.department && l.department.toLowerCase().includes(q)) ||
          (l.errorMessage && l.errorMessage.toLowerCase().includes(q))
      );
    }

    const total = result.length;
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 100;
    result = result.slice(offset, offset + limit);

    return { logs: result, total };
  }

  public getSummary(): {
    totalSyncs: number;
    avgLatencyMs: number;
    leetcodeAvgMs: number;
    sheetsAvgMs: number;
    errorCount: number;
    warningCount: number;
    successRate: number;
    topBottleneckStudents: Array<{
      targetId: string;
      targetName: string;
      identifier?: string;
      batchName?: string;
      avgLatencyMs: number;
      syncCount: number;
      lastError?: string;
    }>;
    topBottleneckBatches: Array<{
      batchId?: string;
      batchName?: string;
      department?: string;
      avgLatencyMs: number;
      syncCount: number;
    }>;
  } {
    const total = this.logs.length;
    if (total === 0) {
      return {
        totalSyncs: 0,
        avgLatencyMs: 0,
        leetcodeAvgMs: 0,
        sheetsAvgMs: 0,
        errorCount: 0,
        warningCount: 0,
        successRate: 100,
        topBottleneckStudents: [],
        topBottleneckBatches: [],
      };
    }

    const leetcodeLogs = this.logs.filter(
      (l) => l.targetType === 'LEETCODE_STUDENT' || l.targetType === 'LEETCODE_BATCH' || l.targetType === 'LEETCODE_SECTION'
    );
    const sheetsLogs = this.logs.filter((l) => l.targetType === 'GOOGLE_SHEET');

    const totalLatency = this.logs.reduce((sum, l) => sum + l.latencyMs, 0);
    const leetcodeLatency = leetcodeLogs.reduce((sum, l) => sum + l.latencyMs, 0);
    const sheetsLatency = sheetsLogs.reduce((sum, l) => sum + l.latencyMs, 0);

    const errorCount = this.logs.filter((l) => l.status === 'FAILED').length;
    const warningCount = this.logs.filter((l) => l.status === 'WARNING').length;
    const successCount = this.logs.filter((l) => l.status === 'SUCCESS').length;

    // Aggregate student bottlenecks
    const studentMap = new Map<
      string,
      {
        targetId: string;
        targetName: string;
        identifier?: string;
        batchName?: string;
        totalLatency: number;
        count: number;
        lastError?: string;
      }
    >();

    this.logs
      .filter((l) => l.targetType === 'LEETCODE_STUDENT')
      .forEach((l) => {
        const existing = studentMap.get(l.targetId);
        if (existing) {
          existing.totalLatency += l.latencyMs;
          existing.count += 1;
          if (l.errorMessage) existing.lastError = l.errorMessage;
        } else {
          studentMap.set(l.targetId, {
            targetId: l.targetId,
            targetName: l.targetName,
            identifier: l.identifier,
            batchName: l.batchName,
            totalLatency: l.latencyMs,
            count: 1,
            lastError: l.errorMessage,
          });
        }
      });

    const topBottleneckStudents = Array.from(studentMap.values())
      .map((s) => ({
        targetId: s.targetId,
        targetName: s.targetName,
        identifier: s.identifier,
        batchName: s.batchName,
        avgLatencyMs: Math.round(s.totalLatency / s.count),
        syncCount: s.count,
        lastError: s.lastError,
      }))
      .sort((a, b) => b.avgLatencyMs - a.avgLatencyMs)
      .slice(0, 5);

    // Aggregate batch bottlenecks
    const batchMap = new Map<
      string,
      {
        batchId?: string;
        batchName?: string;
        department?: string;
        totalLatency: number;
        count: number;
      }
    >();

    this.logs
      .filter((l) => l.batchName)
      .forEach((l) => {
        const key = l.batchId || l.batchName || 'Unknown';
        const existing = batchMap.get(key);
        if (existing) {
          existing.totalLatency += l.latencyMs;
          existing.count += 1;
        } else {
          batchMap.set(key, {
            batchId: l.batchId,
            batchName: l.batchName,
            department: l.department,
            totalLatency: l.latencyMs,
            count: 1,
          });
        }
      });

    const topBottleneckBatches = Array.from(batchMap.values())
      .map((b) => ({
        batchId: b.batchId,
        batchName: b.batchName,
        department: b.department,
        avgLatencyMs: Math.round(b.totalLatency / b.count),
        syncCount: b.count,
      }))
      .sort((a, b) => b.avgLatencyMs - a.avgLatencyMs)
      .slice(0, 5);

    return {
      totalSyncs: total,
      avgLatencyMs: Math.round(totalLatency / total),
      leetcodeAvgMs: leetcodeLogs.length > 0 ? Math.round(leetcodeLatency / leetcodeLogs.length) : 0,
      sheetsAvgMs: sheetsLogs.length > 0 ? Math.round(sheetsLatency / sheetsLogs.length) : 0,
      errorCount,
      warningCount,
      successRate: total > 0 ? Math.round((successCount / total) * 100) : 100,
      topBottleneckStudents,
      topBottleneckBatches,
    };
  }

  public clearLogs(): void {
    this.logs = [];
  }

  private seedInitialLogs(): void {
    const now = Date.now();
    const seedRecords: Omit<DiagnosticLog, 'id' | 'timestamp'>[] = [
      {
        targetType: 'GOOGLE_SHEET',
        targetId: 'link-1',
        targetName: 'CSE 2022-2026 Master Progress',
        identifier: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
        batchName: 'Batch 2022-2026',
        department: 'CSE',
        latencyMs: 1420,
        status: 'SUCCESS',
        details: 'Dispatched 84 student rows with 28 date columns via Apps Script Webhook',
        source: 'apps_script_webhook',
      },
      {
        targetType: 'LEETCODE_STUDENT',
        targetId: 'st-seed-1',
        targetName: 'Aravind Kumar',
        identifier: 'aravind_code',
        batchName: 'Batch 2022-2026',
        sectionName: 'A',
        department: 'CSE',
        latencyMs: 320,
        status: 'SUCCESS',
        details: 'Total solved: 342 (Easy: 140, Med: 160, Hard: 42)',
        source: 'official_graphql',
      },
      {
        targetType: 'LEETCODE_STUDENT',
        targetId: 'st-seed-2',
        targetName: 'Deepa Lakshmi',
        identifier: 'deepa_l',
        batchName: 'Batch 2022-2026',
        sectionName: 'B',
        department: 'CSE',
        latencyMs: 2840,
        status: 'WARNING',
        details: 'GraphQL primary timed out, successfully retrieved via Faisal Shohag proxy fallback',
        source: 'faisal_backup',
      },
      {
        targetType: 'LEETCODE_SECTION',
        targetId: 'sec-seed-1',
        targetName: 'Section A Immediate Refresh',
        batchName: 'Batch 2022-2026',
        sectionName: 'A',
        department: 'CSE',
        latencyMs: 3650,
        status: 'SUCCESS',
        details: 'Force refreshed 38 students in parallel workers (all 38 synced successfully)',
        source: 'manual_force_refresh',
      },
      {
        targetType: 'LEETCODE_STUDENT',
        targetId: 'st-seed-3',
        targetName: 'Gokul Raman',
        identifier: 'gokul_invalid_user_99x',
        batchName: 'Batch 2022-2026',
        sectionName: 'B',
        department: 'CSE',
        latencyMs: 4200,
        status: 'FAILED',
        errorMessage: 'LeetCode 404: User profile does not exist or has been deleted',
        source: 'official_graphql',
      },
      {
        targetType: 'AUTO_SYNC',
        targetId: 'periodic-15m',
        targetName: '15-Minute Automated Interval Sync',
        latencyMs: 4890,
        status: 'SUCCESS',
        details: 'Automated periodic sync processed 94 active student profiles and updated Google Sheets',
        source: 'cron_scheduler',
      },
    ];

    seedRecords.forEach((r, idx) => {
      this.logs.push({
        id: `seed_${idx + 1}`,
        timestamp: new Date(now - (idx * 15 * 60 * 1000)).toISOString(),
        ...r,
      });
    });
  }
}

export const diagnosticLogService = new DiagnosticLogService();
