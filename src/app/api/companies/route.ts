export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);

    // For admins, return all (excluding soft-deleted). For order bookers,
    // return only their assigned companies. Zero assignments → nothing.
    const companyWhere =
      auth && auth.role !== 'admin'
        ? (auth.assignedCompanyIds.length === 0
            ? { id: { in: ['__none__'] } } // see nothing
            : { AND: [{ deletedAt: null }, { id: { in: auth.assignedCompanyIds } }] })
        : { deletedAt: null };

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

    const existing = await db.company.findFirst({ where: { name: name.trim(), deletedAt: null } });
    if (existing) {
      return NextResponse.json({ error: 'Company already exists' }, { status: 409 });
    }

    // Same name in trash? Reuse that record instead of creating a duplicate
    const trashed = await db.company.findFirst({ where: { name: name.trim(), deletedAt: { not: null } } });
    if (trashed) {
      const restored = await db.company.update({
        where: { id: trashed.id },
        data: { deletedAt: null },
      });
      return NextResponse.json(restored, { status: 201 });
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
