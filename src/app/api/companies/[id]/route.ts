export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, multiTierPricing, claimDeductionPercent } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { name: name.trim() };
    if (multiTierPricing !== undefined) updateData.multiTierPricing = multiTierPricing === true;
    if (claimDeductionPercent !== undefined) updateData.claimDeductionPercent = Number(claimDeductionPercent) || 0;

    const company = await db.company.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(company);
  } catch (error) {
    console.error('Update company error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const productCount = await db.product.count({ where: { companyId: id } });
    if (productCount > 0) {
      return NextResponse.json({ error: 'Cannot delete company with products' }, { status: 400 });
    }

    // SOFT DELETE — company moves to Trash, recoverable for 30 days
    await db.company.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, trashed: true });
  } catch (error) {
    console.error('Delete company error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
