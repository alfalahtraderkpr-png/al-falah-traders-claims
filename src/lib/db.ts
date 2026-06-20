import { PrismaClient } from '@/generated/prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Create a "lazy" proxy that throws a clear runtime error if any property
 * is accessed but no real PrismaClient was constructed (e.g. during build
 * when env vars are not available).
 *
 * This allows the build to succeed even if DATABASE_URL is not set at build
 * time, while still failing loudly at runtime when the DB is actually used.
 */
function createLazyFallback(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_, prop) {
      throw new Error(
        `[db] Database not configured. Set POSTGRES_PRISMA_URL or DATABASE_URL env var. ` +
        `Attempted to access PrismaClient.${String(prop)}`
      );
    },
  });
}

function createPrismaClient(): PrismaClient {
  // Prefer POSTGRES_PRISMA_URL for Vercel (pooled), fall back to DATABASE_URL
  const dbUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || ''

  // If no DB URL is available (e.g. during Vercel build's page-data collection
  // phase when env vars are not always injected), return a lazy proxy so the
  // build can complete. Real queries will fail with a clear error at runtime.
  if (!dbUrl) {
    console.warn('[db] No DATABASE_URL or POSTGRES_PRISMA_URL found. Database calls will fail at runtime until env var is set.');
    return createLazyFallback();
  }

  // If DATABASE_URL starts with "file:", use better-sqlite3 (local dev)
  if (dbUrl.startsWith('file:')) {
    try {
      const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
      const adapter = new PrismaBetterSqlite3({ url: dbUrl })
      return new PrismaClient({ adapter })
    } catch (e) {
      console.error('[db] Failed to create SQLite adapter:', e);
      return createLazyFallback();
    }
  }

  // PostgreSQL / Neon - use the Neon serverless adapter
  try {
    const { PrismaNeon } = require('@prisma/adapter-neon')
    const { neonConfig } = require('@neondatabase/serverless')
    neonConfig.poolQueryViaFetch = true
    const adapter = new PrismaNeon({ connectionString: dbUrl })
    return new PrismaClient({ adapter })
  } catch (e) {
    console.error('[db] Failed to create Neon adapter:', e);
    return createLazyFallback();
  }
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
