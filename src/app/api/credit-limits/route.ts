export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const limits = await db.shopCreditLimit.findMany({
      include: { shop: true, company: true },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(limits);
  } catch (error) {
    console.error('Credit limits error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { shopId, companyId, creditLimit } = await request.json();
    if (!shopId || !companyId) {
      return NextResponse.json({ error: 'Shop and Company required' }, { status: 400 });
    }
    
    const limit = await db.shopCreditLimit.upsert({
      where: { shopId_companyId: { shopId, companyId } },
      update: { creditLimit: creditLimit || 0 },
      create: { shopId, companyId, creditLimit: creditLimit || 0 },
    });
    
    return NextResponse.json(limit, { status: 201 });
  } catch (error) {
    console.error('Create credit limit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
