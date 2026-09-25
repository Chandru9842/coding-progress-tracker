import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatasourceUrl(): string | undefined {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return undefined;

  try {
    const url = new URL(rawUrl);
    // In serverless / Supabase / Neon connection pooling, guarantee a healthy connection pool
    // Override restrictive connection_limit (< 10) to prevent connection pool exhaustion
    const currentLimit = parseInt(url.searchParams.get('connection_limit') || '0', 10);
    if (!url.searchParams.has('connection_limit') || currentLimit < 10) {
      url.searchParams.set('connection_limit', '15');
    }
    const currentTimeout = parseInt(url.searchParams.get('pool_timeout') || '0', 10);
    if (!url.searchParams.has('pool_timeout') || currentTimeout < 60) {
      url.searchParams.set('pool_timeout', '60');
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

let prismaClient: PrismaClient;

try {
  if (process.env.DATABASE_URL) {
    prismaClient =
      globalForPrisma.prisma ??
      new PrismaClient({
        datasources: {
          db: {
            url: getDatasourceUrl(),
          },
        },
        log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      });
  } else {
    // In-memory mode active - construct dummy proxy
    console.warn('[AI Studio] Database not connected — using mock proxy');
    const noOp: any = {
      findMany: async () => [],
      findFirst: async () => null,
      findUnique: async () => null,
      count: async () => 0,
      create: async (d: any) => d?.data ?? {},
      update: async (d: any) => d?.data ?? {},
      delete: async () => ({}),
      deleteMany: async () => ({ count: 0 }),
      updateMany: async () => ({ count: 0 }),
    };
    prismaClient = new Proxy({} as any, {
      get: () => noOp,
    });
  }
} catch (err) {
  console.warn('[AI Studio] PrismaClient initialization error — using mock proxy:', err);
  const noOp: any = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    count: async () => 0,
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {},
    delete: async () => ({}),
    deleteMany: async () => ({ count: 0 }),
    updateMany: async () => ({ count: 0 }),
  };
  prismaClient = new Proxy({} as any, {
    get: () => noOp,
  });
}

export const prisma = prismaClient;

globalForPrisma.prisma = prisma;


