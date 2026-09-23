import { api } from './api.js';
import { syncReportStudents } from '../api/reports.js';

export interface SyncCandidate {
  id: string;
  name?: string;
  register_number?: string;
  leetcode_username?: string | null;
  total_solved?: number;
  overall_total?: number;
  latest_snapshot?: any;
  snapshots?: any[];
}

export interface SyncStatusState {
  isAutoSyncing: boolean;
  pendingCount: number;
  lastSyncedName?: string;
}

type SyncStatusListener = (status: SyncStatusState) => void;

class AutoSyncManager {
  private queue: string[] = [];
  private queuedSet = new Set<string>();
  private cooldownMap = new Map<string, number>(); // studentId -> timestamp of last sync attempt
  private knownStudentsMap = new Map<string, SyncCandidate>();
  private isRunning = false;
  private isManualSyncActive = false;
  private listeners: Set<SyncStatusListener> = new Set();
  private lastSyncedName: string | undefined = undefined;
  private loopTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('app-sync-state', (e: any) => {
        const isSyncing = e.detail?.isSyncing ?? false;
        this.isManualSyncActive = isSyncing;
        if (isSyncing) {
          // Pause queue processing immediately when manual interactive sync begins
          this.pause();
        } else {
          // Resume background auto-sync 3 seconds after manual sync finishes
          setTimeout(() => {
            this.resume();
          }, 3000);
        }
      });
    }
  }

  public subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((l) => {
      try {
        l(status);
      } catch (err) {
        console.warn('[AutoSync] Listener error:', err);
      }
    });
  }

  public getStatus(): SyncStatusState {
    return {
      isAutoSyncing: this.isRunning,
      pendingCount: this.queue.length,
      lastSyncedName: this.lastSyncedName,
    };
  }

  public pause() {
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    this.isRunning = false;
    this.notify();
  }

  public resume() {
    if (!this.isRunning && !this.isManualSyncActive) {
      if (this.queue.length > 0) {
        this.startRunner();
      } else {
        this.refillFromKnownStudents();
      }
    }
  }

  /**
   * Enqueue a list of students loaded from StudentsPage, ReportsPage, or DashboardPage.
   * Prioritizes students with NO snapshots or 0 total solved, but includes all students
   * in continuous round-robin background auto-sync.
   */
  public enqueueStudents(students: SyncCandidate[]): number {
    if (!Array.isArray(students) || students.length === 0) return 0;
    const now = Date.now();
    const COOLDOWN_MS = 25 * 1000; // 25 seconds cooldown between checks for same student

    for (const s of students) {
      if (!s.id || !s.leetcode_username || !s.leetcode_username.trim()) continue;
      this.knownStudentsMap.set(s.id, s);
    }

    const candidatesNeedingSync: { id: string; priority: number }[] = [];

    for (const s of students) {
      if (!s.id || !s.leetcode_username || !s.leetcode_username.trim()) continue;

      // Check cooldown
      const lastAttempt = this.cooldownMap.get(s.id);
      if (lastAttempt && now - lastAttempt < COOLDOWN_MS) continue;

      // Check already in queue
      if (this.queuedSet.has(s.id)) continue;

      const hasNoSnapshot = !s.latest_snapshot && (!s.snapshots || s.snapshots.length === 0);
      const totalSolved = s.total_solved ?? s.overall_total ?? s.latest_snapshot?.total_solved ?? s.snapshots?.[0]?.total_solved;
      const isZeroSolved = totalSolved === 0;

      // Check if stale (older than 12 hours)
      let isStale = false;
      const snapDateStr = s.latest_snapshot?.snapshot_date || s.snapshots?.[0]?.snapshot_date;
      if (snapDateStr) {
        const snapTime = new Date(snapDateStr).getTime();
        if (now - snapTime > 12 * 60 * 60 * 1000) {
          isStale = true;
        }
      }

      if (hasNoSnapshot) {
        candidatesNeedingSync.push({ id: s.id, priority: 1 }); // Highest priority: Pending first sync
      } else if (isZeroSolved) {
        candidatesNeedingSync.push({ id: s.id, priority: 2 }); // High priority: 0 solved
      } else if (isStale) {
        candidatesNeedingSync.push({ id: s.id, priority: 3 }); // Normal priority: Stale
      } else {
        candidatesNeedingSync.push({ id: s.id, priority: 4 }); // Evergreen: Continuous round-robin
      }
    }

    if (candidatesNeedingSync.length === 0) return 0;

    // Sort by priority (1 -> 2 -> 3 -> 4)
    candidatesNeedingSync.sort((a, b) => a.priority - b.priority);

    for (const c of candidatesNeedingSync) {
      this.queue.push(c.id);
      this.queuedSet.add(c.id);
    }

    this.notify();
    this.startRunner();
    return candidatesNeedingSync.length;
  }

  public enqueueStudentIds(studentIds: string[]): number {
    if (!Array.isArray(studentIds) || studentIds.length === 0) return 0;
    const now = Date.now();
    const COOLDOWN_MS = 25 * 1000;
    let added = 0;

    for (const id of studentIds) {
      if (!id) continue;
      const lastAttempt = this.cooldownMap.get(id);
      if (lastAttempt && now - lastAttempt < COOLDOWN_MS) continue;
      if (this.queuedSet.has(id)) continue;

      this.queue.push(id);
      this.queuedSet.add(id);
      added++;
    }

    if (added > 0) {
      this.notify();
      this.startRunner();
    }
    return added;
  }

  /**
   * Fetch candidates directly from backend API for continuous auto-sync
   */
  public async fetchServerCandidates(limit = 100): Promise<number> {
    try {
      const res = await api.get<{ candidates: Array<{ id: string; name: string; leetcode_username: string }> }>(
        `/sync/unsynced-candidates?limit=${limit}`
      );
      const candidates = res.data?.candidates || [];
      if (candidates.length > 0) {
        return this.enqueueStudents(candidates);
      }
    } catch {
      // Ignore background candidate fetch failure
    }
    return 0;
  }

  private startRunner() {
    if (this.isRunning || this.isManualSyncActive) return;
    this.isRunning = true;
    this.notify();
    this.scheduleNextStep(500);
  }

  private scheduleNextStep(delayMs: number) {
    if (this.loopTimer) clearTimeout(this.loopTimer);
    this.loopTimer = setTimeout(() => {
      this.processNextBatch();
    }, delayMs);
  }

  private async processNextBatch() {
    if (this.isManualSyncActive) {
      this.isRunning = false;
      this.notify();
      return;
    }

    // If queue is empty, refill from known students in continuous round-robin
    if (this.queue.length === 0) {
      this.refillFromKnownStudents();
      if (this.queue.length === 0) {
        this.isRunning = false;
        this.notify();
        return;
      }
    }

    // Process micro-batch of 1 student per step (smooth continuous heartbeat without rate limits)
    const batchSize = 1;
    const chunkIds: string[] = [];

    while (chunkIds.length < batchSize && this.queue.length > 0) {
      const id = this.queue.shift()!;
      this.queuedSet.delete(id);
      chunkIds.push(id);
    }

    if (chunkIds.length === 0) {
      this.isRunning = false;
      this.notify();
      return;
    }

    const now = Date.now();
    chunkIds.forEach((id) => this.cooldownMap.set(id, now));

    const targetStudent = this.knownStudentsMap.get(chunkIds[0]);
    if (targetStudent) {
      this.lastSyncedName = targetStudent.name || targetStudent.leetcode_username || undefined;
    }

    try {
      // Execute low-priority background sync
      const res = await syncReportStudents({ studentIds: chunkIds });

      if (res?.results && Array.isArray(res.results)) {
        // Broadcast in-place update event to all components & open pages (Reports, Students, Dashboard)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('student-synced', {
              detail: { results: res.results },
            })
          );
        }
      }
    } catch (err) {
      // Catch silently: background sync must never disrupt user experience
      console.warn('[AutoSync Background] Micro-batch notice:', err);
    }

    this.notify();

    // Schedule next student after 1.8 seconds (continuous heartbeat)
    if (!this.isManualSyncActive) {
      this.scheduleNextStep(1800);
    } else {
      this.isRunning = false;
      this.notify();
    }
  }

  private refillFromKnownStudents() {
    if (this.isManualSyncActive) return;

    if (this.knownStudentsMap.size === 0) {
      // Proactively fetch candidates from server to discover registered students
      this.fetchServerCandidates(100);
      return;
    }

    const now = Date.now();
    const COOLDOWN_MS = 25 * 1000; // 25s cooldown before re-syncing the same student

    // Order known students by least recently attempted
    const all = Array.from(this.knownStudentsMap.values());
    all.sort((a, b) => {
      const aTime = this.cooldownMap.get(a.id) || 0;
      const bTime = this.cooldownMap.get(b.id) || 0;
      return aTime - bTime;
    });

    for (const s of all) {
      const lastAttempt = this.cooldownMap.get(s.id);
      if (lastAttempt && now - lastAttempt < COOLDOWN_MS) continue;
      if (!this.queuedSet.has(s.id)) {
        this.queue.push(s.id);
        this.queuedSet.add(s.id);
      }
    }

    // If cooldown has not elapsed yet for students, schedule next heartbeat pass in 4 seconds
    if (this.queue.length === 0 && all.length > 0) {
      this.scheduleNextStep(4000);
    } else if (this.queue.length > 0) {
      this.notify();
      this.startRunner();
    }
  }
}

export const autoSyncService = new AutoSyncManager();
