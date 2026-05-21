import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const orderBookers = await db.orderBooker.findMany({
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
