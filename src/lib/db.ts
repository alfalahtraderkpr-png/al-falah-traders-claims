import { PrismaClient } from '@/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neon } from '@neondatabase/serverless'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const sql = neon(process.env.DATABASE_URL!)
  const adapter = new PrismaNeon(sql)
  return new PrismaClient({ adapter })
}

// Lazy Proxy - PrismaClient is only created when first method is called at runtime
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient()
    }
    const result = (globalForPrisma.prisma as any)[prop]
    if (typeof result === 'function') {
      return result.bind(globalForPrisma.prisma)
    }
    return result
  }
})
