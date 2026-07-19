export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const userData = request.cookies.get('user-data')?.value;

    if (!token || !userData) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = JSON.parse(userData);

    // Verify user still exists — DO NOT include userCompanies (table may not exist yet)
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // Separately (and defensively) load assigned company IDs
    let assignedCompanyIds: string[] = [];
    try {
      const rows = await db.userCompany.findMany({
        where: { userId: dbUser.id },
        select: { companyId: true },
      });
      assignedCompanyIds = rows.map((r) => r.companyId);
    } catch (e) {
      console.warn('[auth/me] Failed to load userCompanies (table may not exist yet):', (e as Error).message);
    }

    return NextResponse.json({
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        orderBookerId: dbUser.orderBookerId,
        assignedCompanyIds,
      },
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
