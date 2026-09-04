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
