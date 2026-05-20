import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const shops = await db.shop.findMany({
      orderBy: { name: 'asc' },
      include: { orderBooker: true },
    });
    return NextResponse.json(shops);
  } catch (error) {
    console.error('Get shops error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, address, orderBookerId } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Shop name is required' }, { status: 400 });
    }

    const shop = await db.shop.create({
      data: {
        name: name.trim(),
        address: address || '',
        orderBookerId: orderBookerId || null,
      },
      include: { orderBooker: true },
    });

    return NextResponse.json(shop, { status: 201 });
  } catch (error) {
    console.error('Create shop error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
