import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/shop-order-bookers?shopId=xxx&companyId=yyy
// Returns the order booker assigned to a specific shop+company combination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    const companyId = searchParams.get('companyId');

    if (shopId && companyId) {
      // Get specific mapping
      const mapping = await db.shopCompanyOrderBooker.findUnique({
        where: { shopId_companyId: { shopId, companyId } },
        include: { orderBooker: true },
      });
      return NextResponse.json(mapping);
    }

    if (shopId) {
      // Get all mappings for a shop
      const mappings = await db.shopCompanyOrderBooker.findMany({
        where: { shopId },
        include: { company: true, orderBooker: true },
        orderBy: { company: { name: 'asc' } },
      });
      return NextResponse.json(mappings);
    }

    // Get all mappings
    const mappings = await db.shopCompanyOrderBooker.findMany({
      include: { shop: true, company: true, orderBooker: true },
      orderBy: [{ shop: { name: 'asc' } }, { company: { name: 'asc' } }],
    });
    return NextResponse.json(mappings);
  } catch (error) {
    console.error('Get shop order bookers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
