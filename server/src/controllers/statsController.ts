import { Response } from 'express';
import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { AuthenticatedRequest } from '../types/index.js';
import { getBatchesForStaff } from '../services/batchService.js';
import { getAuthorizedStudentIdsForStaff } from '../services/studentAuthorizationService.js';
import { serverCache } from '../utils/serverCache.js';
import { checkAndTriggerLazyCatchUpSync } from '../services/cronService.js';

export async function getDashboardStats(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Trigger lazy automatic catch-up sync if today's snapshot hasn't run yet (fire & forget)
    checkAndTriggerLazyCatchUpSync().catch(() => {});

    const cacheKey = `stats_${req.user.role}_${req.user.userId}`;
    const stats = await serverCache.wrap(cacheKey, 15000, async () => {
      if (req.user!.role === 'ADMIN') {
        let totalStaff = 0;
        let activeStaff = 0;
        let totalBatches = 0;
        let totalStudents = 0;

        if (!process.env.DATABASE_URL) {
          totalStaff = inMemoryStore.users.filter((u) => u.role === 'STAFF').length;
          activeStaff = inMemoryStore.users.filter((u) => u.role === 'STAFF' && u.is_active).length;
          totalBatches = inMemoryStore.batches.length;
          totalStudents = inMemoryStore.students.length;
        } else {
          const [tStaff, aStaff, tBatches, tStudents] = await Promise.all([
            prisma.user.count({ where: { role: 'STAFF' } }),
            prisma.user.count({ where: { role: 'STAFF', is_active: true } }),
            prisma.batch.count(),
            prisma.student.count(),
          ]);
          totalStaff = tStaff;
          activeStaff = aStaff;
          totalBatches = tBatches;
          totalStudents = tStudents;
        }

        return {
          role: 'ADMIN',
          totalStaff,
          activeStaff,
          totalBatches,
          totalStudents,
        };
      } else {
        const [assignedBatches, authorizedStudentIds] = await Promise.all([
          getBatchesForStaff(req.user!.userId),
          getAuthorizedStudentIdsForStaff(req.user!.userId),
        ]);

        return {
          role: 'STAFF',
          assignedBatchesCount: assignedBatches.length,
          totalStudentsInAssignedBatches: authorizedStudentIds.length,
        };
      }
    });

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve dashboard statistics' });
  }
}
