import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, price, unit, companyId } = await request.json();

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (price !== undefined) data.price = Number(price);
    if (unit !== undefined) data.unit = unit;
    if (companyId !== undefined) data.companyId = companyId;

    const product = await db.product.update({
      where: { id },
      data,
      include: { company: true },
    });

    return NextResponse.json(product);
  } catch (error: unknown) {
    console.error('Update product error:', error);
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    if (errMsg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Product with this name, price and company already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const claimItemCount = await db.claimItem.count({ where: { productId: id } });
    if (claimItemCount > 0) {
      return NextResponse.json({ error: 'Cannot delete product used in claims' }, { status: 400 });
    }

    await db.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
