export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Diagnostic endpoint: returns the DB schema state so admins can verify
 * whether the UserCompany table exists and how many mappings are present.
 *
 * GET /api/db-status
 */
export async function GET() {
  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // 1. Check UserCompany table existence + row count
  try {
    const count = await db.userCompany.count();
    result.checks.userCompanyTable = { exists: true, rowCount: count };
  } catch (e) {
    result.checks.userCompanyTable = {
      exists: false,
      error: (e as Error).message,
      fix: 'POST to /api/setup-user-companies to create the table and seed mappings',
    };
  }

  // 2. Total users + order booker count
  try {
    const totalUsers = await db.user.count();
    const obUsers = await db.user.count({ where: { role: 'orderbooker' } });
    result.checks.users = { total: totalUsers, orderBookers: obUsers };
  } catch (e) {
    result.checks.users = { error: (e as Error).message };
  }

  // 3. Total companies
  try {
    const companies = await db.company.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    result.checks.companies = { count: companies.length, items: companies };
  } catch (e) {
    result.checks.companies = { error: (e as Error).message };
  }

  // 4. Total order bookers
  try {
    const obs = await db.orderBooker.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    result.checks.orderBookers = { count: obs.length, items: obs };
  } catch (e) {
    result.checks.orderBookers = { error: (e as Error).message };
  }

  // 5. Existing mappings (if table exists)
  try {
    const mappings = await db.userCompany.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        company: { select: { id: true, name: true } },
      },
      orderBy: { userId: 'asc' },
    });
    result.checks.mappings = {
      count: mappings.length,
      items: mappings.map((m) => ({
        userName: m.user.name,
        userEmail: m.user.email,
        companyName: m.company.name,
      })),
    };
  } catch (e) {
    result.checks.mappings = { error: (e as Error).message };
  }

  return NextResponse.json(result);
}
