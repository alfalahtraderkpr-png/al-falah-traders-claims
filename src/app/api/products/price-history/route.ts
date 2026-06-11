export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    
    if (!productId) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }
    
    const history = await db.productPriceHistory.findMany({
      where: { productId },
      orderBy: { changedAt: 'desc' },
      take: 20,
    });
    
    return NextResponse.json(history);
  } catch (error) {
    console.error('Price history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
