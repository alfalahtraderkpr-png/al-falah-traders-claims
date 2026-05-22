export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    const where = companyId ? { companyId } : {};

    const products = await db.product.findMany({
      where,
      orderBy: [{ name: 'asc' }, { price: 'asc' }],
      include: { company: true },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, price, unit, companyId, wholesalePrice, lmtPrice } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }
    if (price === undefined || price === null || price < 0) {
      return NextResponse.json({ error: 'Valid price is required' }, { status: 400 });
    }
    if (!companyId) {
      return NextResponse.json({ error: 'Company is required' }, { status: 400 });
    }

    // Validate company exists
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found. Please select a valid company.' }, { status: 400 });
    }

    const product = await db.product.create({
      data: {
        name: name.trim(),
        price: Number(price),
        unit: unit || 'pcs',
        companyId,
        wholesalePrice: wholesalePrice ? Number(wholesalePrice) : null,
        lmtPrice: lmtPrice ? Number(lmtPrice) : null,
      },
      include: { company: true },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: unknown) {
    console.error('Create product error:', error);
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    if (errMsg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Product with this name, price and company already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: `Failed to create product: ${errMsg}` }, { status: 500 });
  }
}
