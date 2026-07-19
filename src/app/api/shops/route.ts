export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    // For order bookers, only show shops where they have an assignment in
    // the junction table (regardless of company).
    const where =
      auth && auth.role !== 'admin'
        ? (auth.orderBookerId
            ? { companyOrderBookers: { some: { orderBookerId: auth.orderBookerId } } }
            : { id: '__none__' }) // no OB link → see nothing
        : {};

    const shops = await db.shop.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        companyOrderBookers: {
          include: {
            company: true,
            orderBooker: true,
          },
        },
      },
    });
    return NextResponse.json(shops);
  } catch (error) {
    console.error('Get shops error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, address, shopType, companyOrderBookers } = await request.json();
    const auth = await getAuthContext(request);

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Shop name is required' }, { status: 400 });
    }

    // AUTO-ASSIGN: if the creator is an order booker, automatically assign
    // them as the order booker for each of their assigned companies that
    // appear in the mappings (or all their assigned companies if no mappings
    // were provided).
    let finalMappings = Array.isArray(companyOrderBookers) ? [...companyOrderBookers] : [];

    if (auth && auth.role === 'orderbooker' && auth.orderBookerId) {
      if (finalMappings.length === 0) {
        // No mappings provided → auto-create one mapping per assigned company
        finalMappings = auth.assignedCompanyIds.map((cid) => ({
          companyId: cid,
          orderBookerId: auth.orderBookerId,
          shopType: shopType || 'retail',
        }));
      } else {
        // Mappings provided → for each one, force the order booker to the current user
        // (so an OB can't silently assign a different OB)
        finalMappings = finalMappings.map((m) => ({
          ...m,
          orderBookerId: auth.orderBookerId,
        }));
      }
    }

    // Create shop with mappings atomically
    const shop = await db.$transaction(async (tx) => {
      const created = await tx.shop.create({
        data: {
          name: name.trim(),
          address: address || '',
          shopType: shopType || 'retail',
        },
      });

      // Create company-orderbooker mappings if provided
      for (const mapping of finalMappings) {
        if (mapping.companyId) {
          await tx.shopCompanyOrderBooker.create({
            data: {
              shopId: created.id,
              companyId: mapping.companyId,
              orderBookerId: mapping.orderBookerId || null,
              shopType: mapping.shopType || 'retail',
            },
          });
        }
      }

      // Reload with mappings
      return tx.shop.findUnique({
        where: { id: created.id },
        include: {
          companyOrderBookers: {
            include: {
              company: true,
              orderBooker: true,
            },
          },
        },
      });
    });

    return NextResponse.json(shop, { status: 201 });
  } catch (error) {
    console.error('Create shop error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
