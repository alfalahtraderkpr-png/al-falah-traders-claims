export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { compareSync } from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Fetch user WITHOUT the userCompanies include — if the UserCompany table
    // doesn't exist yet (before /api/setup-user-companies is run), this still
    // works.
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isValid = compareSync(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Separately (and defensively) load assigned company IDs
    let assignedCompanyIds: string[] = [];
    try {
      const rows = await db.userCompany.findMany({
        where: { userId: user.id },
        select: { companyId: true },
      });
      assignedCompanyIds = rows.map((r) => r.companyId);
    } catch (e) {
      // UserCompany table may not exist yet — login should still succeed
      console.warn('[login] Failed to load userCompanies (table may not exist yet):', (e as Error).message);
    }

    // Create a simple session token
    const token = Buffer.from(`${user.id}:${user.email}:${Date.now()}`).toString('base64');

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        orderBookerId: user.orderBookerId,
        assignedCompanyIds,
      },
      token,
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    response.cookies.set('user-data', JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      orderBookerId: user.orderBookerId,
      // Note: assignedCompanyIds intentionally NOT stored in cookie — they
      // can change while the session is alive, so /api/auth/me re-fetches
      // them from the DB on every call.
    }), {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
