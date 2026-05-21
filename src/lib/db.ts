import { PrismaClient } from '@/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // Turso / remote LibSQL (production on Vercel)
  if (process.env.TURSO_DB_URL) {
    const libsql = createClient({
      url: process.env.TURSO_DB_URL,
      authToken: process.env.TURSO_DB_TOKEN || undefined,
    })
    const adapter = new PrismaLibSql(libsql)
    return new PrismaClient({ adapter })
  }

  // Local SQLite file (development)
  const dbUrl = process.env.DATABASE_URL ?? 'file:./db/custom.db'
  const libsql = createClient({ url: dbUrl })
  const adapter = new PrismaLibSql(libsql)
  return new PrismaClient({ adapter })
}

// Lazy initialization - only create PrismaClient when first accessed, not at import time
// This prevents build-time database connection errors on Vercel
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient()
    }
    return (globalForPrisma.prisma as Record<string | symbol, unknown>)[prop]
  }
})
