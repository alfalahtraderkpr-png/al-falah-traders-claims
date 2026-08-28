export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';

/**
 * POST /api/admin/migrate — one-time DDL migrations for Neon Postgres (admin only).
 *
 * Prisma 7 CLI cannot `db push` against the production database from the sandbox,
 * so schema-only additions are applied here via raw SQL. Statements are
 * idempotent (IF NOT EXISTS) so calling this endpoint repeatedly is safe.
 */
const MIGRATIONS: Array<{ id: string; sql: string; description: string }> = [
  {
    id: 'appsetting-city',
    description: 'Add city column to AppSetting (receipt stamp city)',
    sql: 'ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "city" TEXT NOT NULL DEFAULT \'Khanpur\'',
  },
];

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const results: Array<{ id: string; description: string; ok: boolean; skipped?: boolean; error?: string }> = [];

    for (const m of MIGRATIONS) {
      try {
        await db.$executeRawUnsafe(m.sql);
        results.push({ id: m.id, description: m.description, ok: true });
      } catch (err) {
        const msg = (err as Error).message || '';
        // Postgres duplicate-column error → already applied
        if (msg.includes('already exists') || msg.includes('duplicate column')) {
          results.push({ id: m.id, description: m.description, ok: true, skipped: true });
        } else {
          results.push({ id: m.id, description: m.description, ok: false, error: msg });
        }
      }
    }

    const allOk = results.every((r) => r.ok);
    return NextResponse.json({ ok: allOk, results }, { status: allOk ? 200 : 500 });
  } catch (error) {
    console.error('Migrate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
