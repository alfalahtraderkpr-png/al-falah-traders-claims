export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const companyId = searchParams.get('companyId');
    const supplierId = searchParams.get('supplierId');
    const orderBookerId = searchParams.get('orderBookerId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (companyId) where.companyId = companyId;
    if (supplierId) where.supplierId = supplierId;
    if (orderBookerId) where.orderBookerId = orderBookerId;
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
      where.date = dateFilter;
    }
    if (search) {
      where.OR = [
        { claimNumber: { contains: search } },
        { shop: { name: { contains: search } } },
      ];
    }

    const claims = await db.claim.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        company: true,
        shop: true,
        supplier: true,
        orderBooker: true,
        claimItems: {
          include: {
            product: {
              include: { company: true },
            },
          },
        },
      },
    });

    return NextResponse.json(claims);
  } catch (error) {
    console.error('Get claims error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { date, companyId, shopId, supplierId, orderBookerId, items, createdBy } = await request.json();

    if (!companyId || !shopId || !supplierId) {
      return NextResponse.json({ error: 'Company, Shop and Supplier are required' }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    // Validate that referenced entities exist
    const [company, shop, supplier] = await Promise.all([
      db.company.findUnique({ where: { id: companyId } }),
      db.shop.findUnique({ where: { id: shopId } }),
      db.supplier.findUnique({ where: { id: supplierId } }),
    ]);

    if (!company) {
      return NextResponse.json({ error: 'Company not found. Please select a valid company.' }, { status: 400 });
    }
    if (!shop) {
      return NextResponse.json({ error: 'Shop not found. Please select a valid shop.' }, { status: 400 });
    }
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found. Please select a valid supplier.' }, { status: 400 });
    }

    // Validate all products exist
    const productIds = items.map((item: { productId: string }) => item.productId);
    const products = await db.product.findMany({ where: { id: { in: productIds } } });
    if (products.length !== productIds.length) {
      const foundIds = new Set(products.map(p => p.id));
      const missingIds = productIds.filter((id: string) => !foundIds.has(id));
      return NextResponse.json({ 
        error: `Some products not found. Please remove and re-add the missing products.` 
      }, { status: 400 });
    }

    // Generate claim number with year/month prefix (YYMM format)
    const now = new Date();
    const yearPrefix = `${now.getFullYear().toString().slice(-2)}`;
    const monthPrefix = `${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    const prefix = `CLM-${yearPrefix}${monthPrefix}-`;

    const lastClaim = await db.claim.findFirst({
      where: { claimNumber: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { claimNumber: true },
    });

    let nextNumber = 1;
    if (lastClaim) {
      const match = lastClaim.claimNumber.match(/CLM-\d{4}-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    const claimNumber = `${prefix}${String(nextNumber).padStart(3, '0')}`;

    // Calculate total
    const totalAmount = items.reduce((sum: number, item: { amount: number }) => sum + (item.amount || 0), 0);

    // Calculate deduction if company has claimDeductionPercent
    const deductionPercent = company.claimDeductionPercent || 0;
    const deductionAmount = deductionPercent > 0 ? Math.round(totalAmount * deductionPercent / 100) : 0;
    const netAmount = totalAmount - deductionAmount;

    const claim = await db.claim.create({
      data: {
        claimNumber,
        date: new Date(date || new Date()),
        companyId,
        shopId,
        supplierId,
        orderBookerId: orderBookerId || null,
        totalAmount,
        deductionAmount,
        netAmount,
        status: 'pending',
        createdBy: createdBy || null,
        claimItems: {
          create: items.map((item: { productId: string; quantity: number; amount: number }) => ({
            productId: item.productId,
            quantity: item.quantity,
            amount: item.amount,
          })),
        },
      },
      include: {
        company: true,
        shop: true,
        supplier: true,
        orderBooker: true,
        claimItems: { include: { product: { include: { company: true } } } },
      },
    });

    return NextResponse.json(claim, { status: 201 });
  } catch (error) {
    console.error('Create claim error:', error);
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: `Failed to create claim: ${errMsg}` }, { status: 500 });
  }
}
