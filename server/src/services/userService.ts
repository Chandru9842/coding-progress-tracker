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
        },
        {
          id: 'student-chandrum-06',
          register_number: '814723104029',
          name: 'CHANDRU M',
          email: 'chandru@example.edu',
          leetcode_username: 'Chandrum06',
          batch_id: batchId,
          section_id: sectionId,
          allocation_batch_id: allocId,
          department: 'Computer Science and Engineering',
          created_at: new Date(),
        }
      );

      // Seed current verified LeetCode stats snapshot for Chandru M
      const todayDate = new Date();
      inMemoryStore.snapshots.push({
        id: 'snap-chandru-today',
        student_id: 'student-chandrum-06',
        snapshot_date: todayDate,
        easy_solved: 116,
        medium_solved: 152,
        hard_solved: 15,
        total_solved: 283,
        created_at: todayDate,
      });

      console.log('[Seed] Demo batch and active LeetCode students seeded to in-memory store.');
    }

    // Seed default faculty mentors in in-memory mode if not already present
    const defaultFacultyStaff = [
      { id: 'staff-devi-01', name: 'Mrs. K. Devi', email: 'devi@college.edu' },
      { id: 'staff-muthuraj-02', name: 'Dr. A. Muthuraj', email: 'muthuraj@college.edu' },
      { id: 'staff-shyamsundar-03', name: 'Mr. Shyam Sundar', email: 'shyamsundar@college.edu' },
      { id: 'staff-chandru-04', name: 'Chandru M', email: 'chandru@college.edu' },
    ];

    const defaultStaffPassHash = await bcrypt.hash('StaffPass123!', 10);
    for (const f of defaultFacultyStaff) {
      if (!inMemoryStore.users.some((u) => u.email === f.email || u.name.toLowerCase() === f.name.toLowerCase())) {
        inMemoryStore.users.push({
          id: f.id,
          name: f.name,
          email: f.email,
          password_hash: defaultStaffPassHash,
          role: 'STAFF',
          is_active: true,
          created_at: new Date(),
        });
      }
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

    // Seed default faculty staff mentors in database if not existing
    const defaultFacultyStaff = [
      { name: 'Mrs. K. Devi', email: 'devi@college.edu' },
      { name: 'Dr. A. Muthuraj', email: 'muthuraj@college.edu' },
      { name: 'Mr. Shyam Sundar', email: 'shyamsundar@college.edu' },
      { name: 'Chandru M', email: 'chandru@college.edu' },
    ];

    const defaultStaffPass = await bcrypt.hash('StaffPass123!', 10);
    for (const f of defaultFacultyStaff) {
      const existingStaff = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: f.email, mode: 'insensitive' } },
            { name: { equals: f.name, mode: 'insensitive' } },
          ],
        },
      });
      if (!existingStaff) {
        await prisma.user.create({
          data: {
            name: f.name,
            email: f.email,
            password_hash: defaultStaffPass,
            role: 'STAFF',
            is_active: true,
          },
        });
        console.log(`[Seed] Initial faculty staff created: ${f.name} (${f.email})`);
      }
    }
  } catch (error) {
    console.warn('[Seed] Warning: Database auto-seed check skipped or failed (may be uninitialized):', error instanceof Error ? error.message : error);
  }
}
