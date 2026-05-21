export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, companyId } = await request.json();

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (companyId !== undefined) data.companyId = companyId || null;

    const supplier = await db.supplier.update({
      where: { id },
      data,
      include: { company: true },
    });

    return NextResponse.json(supplier);
  } catch (error) {
    console.error('Update supplier error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const claimCount = await db.claim.count({ where: { supplierId: id } });
    if (claimCount > 0) {
      return NextResponse.json({ error: 'Cannot delete supplier used in claims' }, { status: 400 });
    }

    await db.supplier.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete supplier error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
