import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { env } from '../config/env.js';
import { JwtPayload, UserResponse } from '../types/index.js';

export async function authenticateUser(
  emailInput: string,
  passwordInput: string
): Promise<{ user: UserResponse; token: string }> {
  const email = emailInput.toLowerCase().trim();

  let user: {
    id: string;
    name: string;
    email: string;
    password_hash: string;
    role: 'ADMIN' | 'STAFF';
    is_active: boolean;
    created_at: Date;
  } | null = null;

  if (!process.env.DATABASE_URL) {
    const memUser = inMemoryStore.users.find((u) => u.email === email);
    if (memUser) {
      user = { ...memUser };
    }
  } else {
    user = await prisma.user.findUnique({
      where: { email },
    });
  }

  // Dev testing fallback when database is uninitialized/unreachable
  if (!user && email === env.INITIAL_ADMIN_EMAIL.toLowerCase().trim()) {
    if (passwordInput === env.INITIAL_ADMIN_PASSWORD) {
      user = {
        id: 'initial-admin-id-0000-0000-0000',
        name: env.INITIAL_ADMIN_NAME,
        email: env.INITIAL_ADMIN_EMAIL,
        password_hash: '',
        role: 'ADMIN',
        is_active: true,
        created_at: new Date(),
      };
    }
  }

  if (!user) {
    throw new Error('Invalid email or password');
  }

  if (!user.is_active) {
    throw new Error('Account is inactive. Please contact system administrator.');
  }

  if (user.password_hash) {
    const isPasswordValid = await bcrypt.compare(passwordInput, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }
  }

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };

  const token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '7d',
  });

  const userResponse: UserResponse = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.is_active,
    createdAt: user.created_at,
  };

  return { user: userResponse, token };
}

export async function getUserById(userId: string): Promise<UserResponse | null> {
  if (userId === 'initial-admin-id-0000-0000-0000') {
    return {
      id: 'initial-admin-id-0000-0000-0000',
      name: env.INITIAL_ADMIN_NAME,
      email: env.INITIAL_ADMIN_EMAIL,
      role: 'ADMIN',
      isActive: true,
      createdAt: new Date(),
    };
  }

  if (!process.env.DATABASE_URL) {
    const memUser = inMemoryStore.users.find((u) => u.id === userId);
    if (memUser) {
      return {
        id: memUser.id,
        name: memUser.name,
        email: memUser.email,
        role: memUser.role,
        isActive: memUser.is_active,
        createdAt: memUser.created_at,
      };
    }
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.is_active,
    createdAt: user.created_at,
  };
}

export async function updateProfile(
  userId: string,
  data: { name?: string; email?: string; currentPassword?: string; newPassword?: string }
): Promise<UserResponse> {
  const updateData: any = {};
  if (data.name && data.name.trim()) {
    updateData.name = data.name.trim();
  }

  let emailChanged = false;
  if (data.email && data.email.trim()) {
    const emailNorm = data.email.toLowerCase().trim();
    updateData.email = emailNorm;
    emailChanged = true;
  }

  if (!process.env.DATABASE_URL) {
    let memUser = inMemoryStore.users.find((u) => u.id === userId);
    if (!memUser && userId === 'initial-admin-id-0000-0000-0000') {
      memUser = {
        id: 'initial-admin-id-0000-0000-0000',
        name: env.INITIAL_ADMIN_NAME,
        email: env.INITIAL_ADMIN_EMAIL,
        password_hash: await bcrypt.hash(env.INITIAL_ADMIN_PASSWORD, 10),
        role: 'ADMIN',
        is_active: true,
        created_at: new Date(),
      };
      inMemoryStore.users.push(memUser);
    }
    if (!memUser) throw new Error('User account not found');

    if (emailChanged && memUser.email !== updateData.email) {
      if (inMemoryStore.users.some((u) => u.email === updateData.email && u.id !== userId)) {
        throw new Error('A user account with this email address already exists');
      }
    }

    if (data.newPassword && data.newPassword.trim()) {
      if (memUser.password_hash && data.currentPassword) {
        const isValid = await bcrypt.compare(data.currentPassword, memUser.password_hash);
        if (!isValid) throw new Error('Current password is incorrect');
      }
      memUser.password_hash = await bcrypt.hash(data.newPassword.trim(), 10);
    }

    Object.assign(memUser, updateData);

    return {
      id: memUser.id,
      name: memUser.name,
      email: memUser.email,
      role: memUser.role,
      isActive: memUser.is_active,
      createdAt: memUser.created_at,
    };
  }

  // PostgreSQL Mode
  let existingUser = await prisma.user.findUnique({ where: { id: userId } });

  if (!existingUser && userId === 'initial-admin-id-0000-0000-0000') {
    const hashedInitialPass = await bcrypt.hash(env.INITIAL_ADMIN_PASSWORD, 10);
    existingUser = await prisma.user.create({
      data: {
        id: 'initial-admin-id-0000-0000-0000',
        name: env.INITIAL_ADMIN_NAME,
        email: env.INITIAL_ADMIN_EMAIL,
        password_hash: hashedInitialPass,
        role: 'ADMIN',
        is_active: true,
      },
    });
  }

  if (!existingUser) throw new Error('User account not found');

  if (updateData.email && updateData.email !== existingUser.email) {
    const duplicate = await prisma.user.findFirst({
      where: { email: updateData.email, NOT: { id: userId } },
    });
    if (duplicate) {
      throw new Error('A user account with this email address already exists');
    }
  }

  if (data.newPassword && data.newPassword.trim()) {
    if (existingUser.password_hash && data.currentPassword) {
      const isValid = await bcrypt.compare(data.currentPassword, existingUser.password_hash);
      if (!isValid) {
        throw new Error('Current password is incorrect');
      }
    }
    updateData.password_hash = await bcrypt.hash(data.newPassword.trim(), 10);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    isActive: updated.is_active,
    createdAt: updated.created_at,
  };
}
