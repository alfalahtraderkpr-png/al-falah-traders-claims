export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, address, companyOrderBookers } = await request.json();

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (address !== undefined) data.address = address;

    const shop = await db.shop.update({
      where: { id },
      data,
      include: {
        companyOrderBookers: {
          include: {
            company: true,
            orderBooker: true,
          },
        },
      },
    });

    // Update company-orderbooker mappings if provided
    if (companyOrderBookers && Array.isArray(companyOrderBookers)) {
      // Delete existing mappings
      await db.shopCompanyOrderBooker.deleteMany({ where: { shopId: id } });

      // Create new mappings
      for (const mapping of companyOrderBookers) {
        if (mapping.companyId) {
          await db.shopCompanyOrderBooker.create({
            data: {
              shopId: id,
              companyId: mapping.companyId,
              orderBookerId: mapping.orderBookerId || null,
            },
          });
        }
      }

      // Reload with new mappings
      const reloaded = await db.shop.findUnique({
        where: { id },
        include: {
          companyOrderBookers: {
            include: {
              company: true,
              orderBooker: true,
            },
          },
        },
      });
      return NextResponse.json(reloaded);
    }

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

    // Delete company-orderbooker mappings first (cascade should handle this, but explicit for safety)
    await db.shopCompanyOrderBooker.deleteMany({ where: { shopId: id } });
    await db.shop.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete shop error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
