export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const auth = await getAuthContext(request);

    // Build base where clause
    const where: { companyId?: string | { in: string[] }; } = {};

    if (companyId) {
      where.companyId = companyId;
    }

    // For order bookers, restrict to their assigned companies (intersection
    // with the requested companyId if any)
    if (auth && auth.role !== 'admin') {
      if (auth.assignedCompanyIds.length === 0) {
        // No companies assigned → see nothing
        where.companyId = { in: ['__none__'] };
      } else if (!companyId) {
        // No specific companyId requested → use all assigned
        where.companyId = { in: auth.assignedCompanyIds };
      } else {
        // Specific companyId requested → verify it's in their assigned list
        if (!auth.assignedCompanyIds.includes(companyId)) {
          return NextResponse.json([]); // not allowed
        }
        // (where.companyId is already the string value)
      }
    }

    const products = await db.product.findMany({
      where,
      orderBy: [{ name: 'asc' }, { price: 'asc' }],
      include: { company: true },
    });

    return NextResponse.json(products);
  } catch (error: unknown) {
    console.error('Get products error:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('connect') || errMsg.includes('fetch')) {
      return NextResponse.json({ error: 'Database connection error. Please try again.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, price, claimPrice, unit, companyId, wholesalePrice, lmtPrice } = await request.json();

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
        claimPrice: claimPrice !== undefined && claimPrice !== null ? Number(claimPrice) : Number(price),
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
