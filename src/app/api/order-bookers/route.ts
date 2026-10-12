export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';

export async function GET(request: NextRequest) {
  try {
    // Login required — the OB list powers claim filters/reports (any role may read).
    const auth = await getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    const orderBookers = await db.orderBooker.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { shopCompanyOrderBookers: true } } },
    });
    return NextResponse.json(orderBookers);
  } catch (error) {
    console.error('Get order bookers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Order Booker name is required' }, { status: 400 });
    }

    const orderBooker = await db.orderBooker.create({
      data: { name: name.trim() },
    });

    return NextResponse.json(orderBooker, { status: 201 });
  } catch (error) {
    console.error('Create order booker error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
