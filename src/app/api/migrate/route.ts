export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    const results: string[] = [];

    // Step 1: Add claimPrice column to Product table if not exists
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "claimPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;
      `);
      results.push('Added claimPrice column to Product table');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        results.push('claimPrice column already exists in Product table');
      } else {
        results.push(`Warning adding claimPrice: ${msg}`);
      }
    }

    // Step 2: Set claimPrice = price for all products that have claimPrice = 0
    try {
      const updateResult = await db.$executeRawUnsafe(`
        UPDATE "Product" SET "claimPrice" = "price" WHERE "claimPrice" = 0 OR "claimPrice" IS NULL;
      `);
      results.push(`Updated ${updateResult} products: set claimPrice = price where claimPrice was 0`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push(`Warning updating claimPrice values: ${msg}`);
    }

    // Step 3: Drop claimRate column from Company table (optional - keeping for safety)
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE "Company" DROP COLUMN IF EXISTS "claimRate";
      `);
      results.push('Removed claimRate column from Company table');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push(`Warning removing claimRate: ${msg}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
