import bcrypt from 'bcryptjs';
import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { env } from '../config/env.js';

export async function seedInitialAdmin(): Promise<void> {
  const adminEmail = env.INITIAL_ADMIN_EMAIL.toLowerCase().trim();

  if (!process.env.DATABASE_URL) {
    const existing = inMemoryStore.users.find((u) => u.email === adminEmail);
    if (!existing) {
      const passwordHash = await bcrypt.hash(env.INITIAL_ADMIN_PASSWORD, 10);
      inMemoryStore.users.push({
        id: 'initial-admin-id-0000-0000-0000',
        name: env.INITIAL_ADMIN_NAME,
        email: adminEmail,
        password_hash: passwordHash,
        role: 'ADMIN',
        is_active: true,
        created_at: new Date(),
      });
      console.log(`[Seed] Initial Admin user added to in-memory store: ${adminEmail}`);
    }

    if (inMemoryStore.batches.length === 0) {
      const batchId = 'batch-cse-2022-2026';
      const sectionId = 'sec-cse-a';
      const allocId = 'alloc-cse-a1';

      inMemoryStore.batches.push({
        id: batchId,
        batch_name: 'CSE 2022-2026',
        academic_year: '2022-2026',
        start_year: 2022,
        end_year: 2026,
        department: 'Computer Science and Engineering',
        created_at: new Date(),
      });

      inMemoryStore.sections.push({
        id: sectionId,
        batch_id: batchId,
        name: 'Section A',
        created_at: new Date(),
      });

      inMemoryStore.allocationBatches.push({
        id: allocId,
        section_id: sectionId,
        name: 'Group 1',
        created_at: new Date(),
      });

      inMemoryStore.students.push(
        {
          id: 'student-demo-1',
          register_number: '710022104001',
          name: 'Lee Coder',
          email: 'lee@example.edu',
          leetcode_username: 'lee215',
          batch_id: batchId,
          section_id: sectionId,
          allocation_batch_id: allocId,
          department: 'Computer Science and Engineering',
          created_at: new Date(),
        },
        {
          id: 'student-demo-2',
          register_number: '710022104002',
          name: 'Stefan Pochmann',
          email: 'stefan@example.edu',
          leetcode_username: 'StefanPochmann',
          batch_id: batchId,
          section_id: sectionId,
          allocation_batch_id: allocId,
          department: 'Computer Science and Engineering',
          created_at: new Date(),
        },
        {
          id: 'student-demo-3',
          register_number: '710022104003',
          name: 'Alex Wice',
          email: 'alex@example.edu',
          leetcode_username: 'awice',
          batch_id: batchId,
          section_id: sectionId,
          allocation_batch_id: allocId,
          department: 'Computer Science and Engineering',
          created_at: new Date(),
        }
      );
      console.log('[Seed] Demo batch and active LeetCode students seeded to in-memory store.');
    }
    return;
  }

  try {
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' },
    });

    if (adminCount === 0) {
      const existingUser = await prisma.user.findUnique({
        where: { email: adminEmail },
      });

      if (!existingUser) {
        const passwordHash = await bcrypt.hash(env.INITIAL_ADMIN_PASSWORD, 10);
        await prisma.user.create({
          data: {
            name: env.INITIAL_ADMIN_NAME,
            email: adminEmail,
            password_hash: passwordHash,
            role: 'ADMIN',
            is_active: true,
          },
        });
        console.log(`[Seed] Initial Admin user created successfully: ${adminEmail}`);
      }
    }
  } catch (error) {
    console.warn('[Seed] Warning: Database auto-seed check skipped or failed (may be uninitialized):', error instanceof Error ? error.message : error);
  }
}
