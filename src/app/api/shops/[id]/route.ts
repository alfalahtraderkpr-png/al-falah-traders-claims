export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, address, phone, shopType, companyOrderBookers } = await request.json();
    const auth = await getAuthContext(request);

    // Order bookers can only edit shops they're assigned to
    if (auth && auth.role !== 'admin') {
      if (!auth.orderBookerId) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
      const hasAccess = await db.shopCompanyOrderBooker.findFirst({
        where: { shopId: id, orderBookerId: auth.orderBookerId },
      });
      if (!hasAccess) {
        return NextResponse.json({ error: 'You can only edit shops assigned to you' }, { status: 403 });
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (address !== undefined) data.address = address;
    if (phone !== undefined) data.phone = phone?.trim() || null;
    if (shopType !== undefined) data.shopType = shopType;

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
      // AUTO-ASSIGN: if editor is order booker, force orderBookerId to themselves
      let finalMappings = [...companyOrderBookers];
      if (auth && auth.role === 'orderbooker' && auth.orderBookerId) {
        finalMappings = finalMappings.map((m) => ({ ...m, orderBookerId: auth.orderBookerId }));
      }

      // Delete + create atomically in a transaction
      await db.$transaction(async (tx) => {
        await tx.shopCompanyOrderBooker.deleteMany({ where: { shopId: id } });

        for (const mapping of finalMappings) {
          if (mapping.companyId) {
            await tx.shopCompanyOrderBooker.create({
              data: {
                shopId: id,
                companyId: mapping.companyId,
                orderBookerId: mapping.orderBookerId || null,
                shopType: mapping.shopType || 'retail',
              },
            });
          }
        }
      });

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
    const auth = await getAuthContext(request);

    // Order bookers can only delete shops they're assigned to
    if (auth && auth.role !== 'admin') {
      if (!auth.orderBookerId) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
      const hasAccess = await db.shopCompanyOrderBooker.findFirst({
        where: { shopId: id, orderBookerId: auth.orderBookerId },
      });
      if (!hasAccess) {
        return NextResponse.json({ error: 'You can only delete shops assigned to you' }, { status: 403 });
      }
    }

    const claimCount = await db.claim.count({ where: { shopId: id } });
    if (claimCount > 0) {
      return NextResponse.json({ error: 'Cannot delete shop used in claims' }, { status: 400 });
    }

    // SOFT DELETE — shop moves to Trash, recoverable for 30 days
    await db.shop.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ success: true, trashed: true });
  } catch (error) {
    console.error('Delete shop error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
