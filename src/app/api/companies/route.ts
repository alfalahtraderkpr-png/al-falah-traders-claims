export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    // For admins, return all. For order bookers, return only their assigned companies.
    // If an order booker has zero assignments, return nothing.
    const companyWhere =
      auth && auth.role !== 'admin'
        ? (auth.assignedCompanyIds.length === 0
            ? { id: { in: ['__none__'] } } // see nothing
            : { id: { in: auth.assignedCompanyIds } })
        : {};

    const companies = await db.company.findMany({
      where: companyWhere,
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return NextResponse.json(companies);
  } catch (error) {
    console.error('Get companies error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, multiTierPricing, claimDeductionPercent } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    const existing = await db.company.findFirst({ where: { name: name.trim() } });
    if (existing) {
      return NextResponse.json({ error: 'Company already exists' }, { status: 409 });
    }

    const company = await db.company.create({
      data: {
        name: name.trim(),
        multiTierPricing: multiTierPricing === true,
        claimDeductionPercent: claimDeductionPercent ? Number(claimDeductionPercent) : 0,
      },
    });

    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    console.error('Create company error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
