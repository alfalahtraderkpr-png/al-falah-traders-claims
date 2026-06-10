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

    const shop = await db.shop.create({
      data: {
        name: name.trim(),
        address: address || '',
        shopType: shopType || 'retail',
      },
      include: {
        companyOrderBookers: {
          include: {
            company: true,
            orderBooker: true,
          },
        },
      },
    });

    // Create company-orderbooker mappings if provided
    if (companyOrderBookers && Array.isArray(companyOrderBookers)) {
      for (const mapping of companyOrderBookers) {
        if (mapping.companyId && mapping.orderBookerId) {
          await db.shopCompanyOrderBooker.create({
            data: {
              shopId: shop.id,
              companyId: mapping.companyId,
              orderBookerId: mapping.orderBookerId,
            },
          });
        }
      }
      // Reload with mappings
      const reloaded = await db.shop.findUnique({
        where: { id: shop.id },
        include: {
          companyOrderBookers: {
            include: {
              company: true,
              orderBooker: true,
            },
          },
        },
      });
      return NextResponse.json(reloaded, { status: 201 });
    }

    return NextResponse.json(shop, { status: 201 });
  } catch (error) {
    console.error('Create shop error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
