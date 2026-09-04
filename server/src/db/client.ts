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
    // In serverless / Supabase connection pooling, ensure generous connection_limit and pool_timeout
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '10');
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '30');
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


