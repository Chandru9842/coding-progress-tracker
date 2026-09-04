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

      // Seed Staff user
      const staffPasswordHash = await bcrypt.hash('StaffPass123!', 10);
      const staffId = 'staff-demo-id-0000-0000-0001';
      inMemoryStore.users.push({
        id: staffId,
        name: 'Dr. Sarah Jenkins',
        email: 'staff@college.edu',
        password_hash: staffPasswordHash,
        role: 'STAFF',
        is_active: true,
        created_at: new Date(),
      });

      // Seed Batches
      const batch1Id = 'batch-2022-2026';
      const batch2Id = 'batch-2023-2027';
      inMemoryStore.batches.push(
        {
          id: batch1Id,
          batch_name: 'CSE 2022 - 2026',
          start_year: 2022,
          end_year: 2026,
          department: 'Computer Science and Engineering',
          created_at: new Date(),
        },
        {
          id: batch2Id,
          batch_name: 'IT 2023 - 2027',
          start_year: 2023,
          end_year: 2027,
          department: 'Information Technology',
          created_at: new Date(),
        }
      );

      // Seed Sections
      const secAId = 'sec-cse-a';
      const secBId = 'sec-cse-b';
      inMemoryStore.sections.push(
        { id: secAId, batch_id: batch1Id, name: 'CSE-A', created_at: new Date() },
        { id: secBId, batch_id: batch1Id, name: 'CSE-B', created_at: new Date() }
      );

      // Seed Allocation Batches
      const alloc1Id = 'alloc-batch-1';
      const alloc2Id = 'alloc-batch-2';
      inMemoryStore.allocationBatches.push(
        { id: alloc1Id, section_id: secAId, name: 'Batch 1', created_at: new Date() },
        { id: alloc2Id, section_id: secAId, name: 'Batch 2', created_at: new Date() }
      );

      // Seed Staff Assignments
      inMemoryStore.staffBatchAssignments.push({
        id: 'sba-1',
        staff_id: staffId,
        batch_id: batch1Id,
        created_at: new Date(),
      });
      inMemoryStore.staffSectionAssignments.push({
        id: 'ssa-1',
        staff_id: staffId,
        section_id: secAId,
        assignment_mode: 'ALL',
        created_at: new Date(),
      });

      // Seed Students
      const sampleStudents = [
        { id: 'st-01', reg: '710022104001', name: 'Aarav Patel', dept: 'CSE', batch: batch1Id, sec: secAId, alloc: alloc1Id, leet: 'aarav_patel', solved: [85, 42, 12] },
        { id: 'st-02', reg: '710022104002', name: 'Ananya Sharma', dept: 'CSE', batch: batch1Id, sec: secAId, alloc: alloc1Id, leet: 'ananya_coder', solved: [110, 68, 24] },
        { id: 'st-03', reg: '710022104003', name: 'Rohan Gupta', dept: 'CSE', batch: batch1Id, sec: secAId, alloc: alloc2Id, leet: 'rohan_dev', solved: [62, 28, 5] },
        { id: 'st-04', reg: '710022104004', name: 'Sneha Reddy', dept: 'CSE', batch: batch1Id, sec: secAId, alloc: alloc2Id, leet: 'sneha_algo', solved: [140, 95, 38] },
        { id: 'st-05', reg: '710022104005', name: 'Vikram Singh', dept: 'CSE', batch: batch1Id, sec: secBId, alloc: null, leet: 'vikram_s', solved: [45, 18, 3] },
        { id: 'st-06', reg: '710022104006', name: 'Priya Nair', dept: 'CSE', batch: batch1Id, sec: secBId, alloc: null, leet: 'priya_n', solved: [98, 54, 15] },
      ];

      sampleStudents.forEach((st) => {
        inMemoryStore.students.push({
          id: st.id,
          register_number: st.reg,
          name: st.name,
          department: st.dept,
          batch_id: st.batch,
          section_id: st.sec,
          allocation_batch_id: st.alloc,
          current_year: '3rd Year',
          leetcode_username: st.leet,
          created_at: new Date(),
        });

        // Daily snapshot
        inMemoryStore.snapshots.push({
          id: `snap-${st.id}`,
          student_id: st.id,
          snapshot_date: new Date(),
          easy_solved: st.solved[0],
          medium_solved: st.solved[1],
          hard_solved: st.solved[2],
          total_solved: st.solved[0] + st.solved[1] + st.solved[2],
          created_at: new Date(),
        });
      });

      console.log(`[Seed] In-memory store initialized with demo batches, sections, and students.`);
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
