import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, address, orderBookerId } = await request.json();

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (address !== undefined) data.address = address;
    if (orderBookerId !== undefined) data.orderBookerId = orderBookerId || null;

    const shop = await db.shop.update({
      where: { id },
      data,
      include: { orderBooker: true },
    });

    return NextResponse.json(shop);
  } catch (error) {
    console.error('Update shop error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const claimCount = await db.claim.count({ where: { shopId: id } });
    if (claimCount > 0) {
      return NextResponse.json({ error: 'Cannot delete shop used in claims' }, { status: 400 });
    }

    await db.shop.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete shop error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
