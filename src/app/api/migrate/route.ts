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

    // Step 4: Add unique constraint on User.orderBookerId if not exists
    try {
      // First, set any duplicate orderBookerId to NULL (shouldn't happen but safety)
      await db.$executeRawUnsafe(`
        UPDATE "User" SET "orderBookerId" = NULL WHERE "orderBookerId" IS NOT NULL AND id NOT IN (
          SELECT MIN(id) FROM "User" WHERE "orderBookerId" IS NOT NULL GROUP BY "orderBookerId"
        );
      `);
      results.push('Cleaned up duplicate orderBookerId values in User table');

      // Add unique constraint (split into separate statements for PostgreSQL)
      try {
        await db.$executeRawUnsafe(`ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_orderBookerId_key"`);
      } catch (e2: unknown) {
        // ignore
      }
      await db.$executeRawUnsafe(`ALTER TABLE "User" ADD CONSTRAINT "User_orderBookerId_key" UNIQUE ("orderBookerId")`);
      results.push('Added unique constraint on User.orderBookerId');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        results.push('Unique constraint on User.orderBookerId already exists');
      } else {
        results.push(`Warning adding unique constraint on orderBookerId: ${msg}`);
      }
    }

    // Step 5: Add foreign key constraint from User.orderBookerId to OrderBooker.id
    try {
      // Add foreign key constraint (split into separate statements for PostgreSQL)
      try {
        await db.$executeRawUnsafe(`ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_orderBookerId_fkey"`);
      } catch (e2: unknown) {
        // ignore
      }
      await db.$executeRawUnsafe(`ALTER TABLE "User" ADD CONSTRAINT "User_orderBookerId_fkey" FOREIGN KEY ("orderBookerId") REFERENCES "OrderBooker"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
      results.push('Added foreign key constraint: User.orderBookerId -> OrderBooker.id');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        results.push('Foreign key constraint on User.orderBookerId already exists');
      } else {
        results.push(`Warning adding foreign key constraint: ${msg}`);
      }
    }

    // Step 6: Migrate legacy statuses to new flow: pending → approved → partial → cleared
    try {
      // Migrate 'arrived_approved' → 'approved'
      const mig1 = await db.$executeRawUnsafe(`
        UPDATE "Claim" SET status = 'approved' WHERE status = 'arrived_approved';
      `);
      results.push(`Migrated ${mig1} arrived_approved claims → approved`);

      // Migrate 'partially_approved' → 'partial'
      const mig2 = await db.$executeRawUnsafe(`
        UPDATE "Claim" SET status = 'partial' WHERE status = 'partially_approved';
      `);
      results.push(`Migrated ${mig2} partially_approved claims → partial`);

      // Migrate 'partially_cleared' → 'partial'
      const mig3 = await db.$executeRawUnsafe(`
        UPDATE "Claim" SET status = 'partial' WHERE status = 'partially_cleared';
      `);
      results.push(`Migrated ${mig3} partially_cleared claims → partial`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push(`Warning migrating claim statuses: ${msg}`);
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
