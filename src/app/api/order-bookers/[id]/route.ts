export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Order Booker name is required' }, { status: 400 });
    }

    const orderBooker = await db.orderBooker.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json(orderBooker);
  } catch (error) {
    console.error('Update order booker error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const claimCount = await db.claim.count({ where: { orderBookerId: id } });
    if (claimCount > 0) {
      return NextResponse.json({ error: 'Cannot delete order booker used in claims' }, { status: 400 });
    }

    // Unlink from shops
    await db.shop.updateMany({
      where: { orderBookerId: id },
      data: { orderBookerId: null },
    });

    await db.orderBooker.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete order booker error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
