export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * One-time setup endpoint:
 *  1. Creates the UserCompany table if it doesn't exist (idempotent).
 *  2. Seeds the order booker → company mappings provided by the admin.
 *
 * Mappings:
 *   1. Danish Ramzan    -> CBL
 *   2. Ghulam Murtaza   -> CBL
 *   3. Kashif Khan      -> CBL
 *   4. Ali              -> CBL
 *   5. Anas Mirza       -> CBL
 *   6. Qadeer           -> Cadbury
 *   7. Shahid           -> Cadbury
 *   8. Ashraf           -> Shan Foods
 *   9. Khawar Akram     -> CBL
 *
 * This endpoint also safely upserts mappings (no duplicates).
 * Call it once after deploy: POST /api/setup-user-companies
 */
export async function POST(_request: NextRequest) {
  const results: string[] = [];

  try {
    // 1. Create UserCompany table if missing (raw SQL — works on Neon Postgres)
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "UserCompany" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "companyId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "UserCompany_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "UserCompany_userId_companyId_key" UNIQUE ("userId", "companyId"),
          CONSTRAINT "UserCompany_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
          CONSTRAINT "UserCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
        );
      `);
      results.push('✓ UserCompany table ensured');
    } catch (e) {
      results.push(`⚠ Table creation skipped (likely exists): ${(e as Error).message}`);
    }

    // 2. Define the order booker → company name mappings
    const mappings: Array<{ orderBookerName: string; companyName: string }> = [
      { orderBookerName: 'Danish Ramzan', companyName: 'CBL' },
      { orderBookerName: 'Ghulam Murtaza', companyName: 'CBL' },
      { orderBookerName: 'Kashif Khan', companyName: 'CBL' },
      { orderBookerName: 'Ali', companyName: 'CBL' },
      { orderBookerName: 'Anas Mirza', companyName: 'CBL' },
      { orderBookerName: 'Qadeer', companyName: 'Cadbury' },
      { orderBookerName: 'Shahid', companyName: 'Cadbury' },
      { orderBookerName: 'Ashraf', companyName: 'Shan Foods' },
      { orderBookerName: 'Khawar Akram', companyName: 'CBL' },
    ];

    // 3. Resolve OB and Company IDs, then upsert into UserCompany
    let upserts = 0;
    let skipped: string[] = [];

    for (const m of mappings) {
      // Find the order booker record by name
      const ob = await db.orderBooker.findFirst({
        where: { name: { equals: m.orderBookerName, mode: 'insensitive' } },
      });
      if (!ob) {
        skipped.push(`Order booker "${m.orderBookerName}" not found in DB`);
        continue;
      }

      // Find the User linked to this order booker
      const user = await db.user.findFirst({
        where: { orderBookerId: ob.id, role: 'orderbooker' },
      });
      if (!user) {
        skipped.push(`No login account for order booker "${m.orderBookerName}" (will be assigned when account is created via user creation flow)`);
        continue;
      }

      // Find the company by name
      const company = await db.company.findFirst({
        where: { name: { equals: m.companyName, mode: 'insensitive' } },
      });
      if (!company) {
        skipped.push(`Company "${m.companyName}" not found in DB`);
        continue;
      }

      // Upsert (skip if exists)
      try {
        await db.userCompany.upsert({
          where: { userId_companyId: { userId: user.id, companyId: company.id } },
          update: {},
          create: { userId: user.id, companyId: company.id },
        });
        upserts++;
      } catch (e) {
        skipped.push(`Failed to map ${m.orderBookerName} → ${m.companyName}: ${(e as Error).message}`);
      }
    }

    results.push(`✓ Seeded ${upserts} order booker → company mappings`);
    if (skipped.length > 0) {
      results.push(`Skipped ${skipped.length}:`);
      skipped.forEach(s => results.push(`  - ${s}`));
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Setup user companies error:', error);
    return NextResponse.json(
      { error: 'Setup failed', details: (error as Error).message, results },
      { status: 500 }
    );
  }
}
