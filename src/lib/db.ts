import { PrismaClient } from '@/generated/prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL || ''

  // If DATABASE_URL starts with "file:", use better-sqlite3 (local dev)
  // Otherwise, use Neon PostgreSQL adapter (Vercel/production)
  if (dbUrl.startsWith('file:')) {
    // Dynamic import for better-sqlite3 adapter (local only)
    try {
      const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
      const adapter = new PrismaBetterSqlite3({ url: dbUrl })
      return new PrismaClient({ adapter })
    } catch {
      // Fallback to direct PrismaClient
      return new PrismaClient()
    }
  }

  // PostgreSQL / Neon - use the Neon serverless adapter
  try {
    const { PrismaNeon } = require('@prisma/adapter-neon')
    const { neonConfig } = require('@neondatabase/serverless')
    neonConfig.poolQueryViaFetch = true
    const adapter = new PrismaNeon({ connectionString: dbUrl })
    return new PrismaClient({ adapter })
  } catch {
    // Fallback to direct PrismaClient
    return new PrismaClient()
  }
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
