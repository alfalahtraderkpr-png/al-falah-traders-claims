export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const shops = await db.shop.findMany({
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

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Shop name is required' }, { status: 400 });
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
      if (companyOrderBookers && Array.isArray(companyOrderBookers)) {
        for (const mapping of companyOrderBookers) {
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
