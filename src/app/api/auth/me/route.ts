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

    // Verify user still exists
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      include: {
        userCompanies: { select: { companyId: true } },
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        orderBookerId: dbUser.orderBookerId,
        // Array of company IDs this user is allowed to access.
        // For admin role this will be empty — admin sees everything.
        assignedCompanyIds: dbUser.userCompanies.map((uc) => uc.companyId),
      },
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
