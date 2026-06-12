export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderBookerId = searchParams.get('orderBookerId');

    // Get claims stats
    const where: Record<string, unknown> = {};

    // If order booker, only show their shops' claims
    if (orderBookerId) {
      where.orderBookerId = orderBookerId;
    }

    const [
      totalClaims,
      pendingClaims,
      approvedClaims,
      partiallyClearedClaims,
      clearedClaims,
      rejectedClaims,
      recentClaims,
      outstandingShopClaims,
    ] = await Promise.all([
      db.claim.count({ where }),
      // Pending = Stock not received yet, claim created but not approved
      db.claim.aggregate({ where: { ...where, status: { in: ['pending'] } }, _sum: { totalAmount: true }, _count: true }),
      // Approved = Stock arrived on floor, amount deduction pending (includes legacy 'arrived_approved')
      db.claim.aggregate({ where: { ...where, status: { in: ['approved', 'arrived_approved'] } }, _sum: { totalAmount: true, approvedAmount: true }, _count: true }),
      // Partial = Some amount deducted from shopkeeper, more pending (includes legacy 'partially_approved', 'partially_cleared')
      db.claim.aggregate({ where: { ...where, status: { in: ['partial', 'partially_approved', 'partially_cleared'] } }, _sum: { totalAmount: true, approvedAmount: true }, _count: true }),
      // Cleared = Full amount deducted, claim complete
      db.claim.aggregate({ where: { ...where, status: 'cleared' }, _sum: { totalAmount: true, approvedAmount: true }, _count: true }),
      // Rejected
      db.claim.aggregate({ where: { ...where, status: 'rejected' }, _sum: { totalAmount: true }, _count: true }),
      db.claim.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          company: true,
          shop: true,
          supplier: true,
          orderBooker: true,
        },
      }),
      // Get all non-cleared claims for shop outstanding calculation (includes legacy statuses)
      db.claim.findMany({
        where: { ...where, status: { in: ['pending', 'approved', 'partial', 'arrived_approved', 'partially_approved', 'partially_cleared'] } },
        include: {
          shop: true,
          company: true,
        },
      }),
    ]);

    // Calculate top outstanding shops
    const shopOutstandingMap = new Map<string, { shopId: string; shopName: string; companyName: string; totalPendingAmount: number; pendingClaimCount: number }>();
    for (const claim of outstandingShopClaims) {
      const key = `${claim.shopId}_${claim.companyId}`;
      const existing = shopOutstandingMap.get(key);
      const outstandingForClaim = claim.totalAmount - (claim.approvedAmount || 0);
      if (existing) {
        existing.totalPendingAmount += outstandingForClaim;
        existing.pendingClaimCount += 1;
      } else {
        shopOutstandingMap.set(key, {
          shopId: claim.shopId,
          shopName: claim.shop.name,
          companyName: claim.company.name,
          totalPendingAmount: outstandingForClaim,
          pendingClaimCount: 1,
        });
      }
    }
    const topOutstandingShops = Array.from(shopOutstandingMap.values())
      .sort((a, b) => b.totalPendingAmount - a.totalPendingAmount)
      .slice(0, 10);

    return NextResponse.json({
      totalClaims,
      pendingClaims: {
        count: pendingClaims._count,
        totalAmount: pendingClaims._sum.totalAmount || 0,
      },
      approvedClaims: {
        count: approvedClaims._count,
        totalAmount: approvedClaims._sum.totalAmount || 0,
        approvedAmount: approvedClaims._sum.approvedAmount || 0,
      },
      partiallyClearedClaims: {
        count: partiallyClearedClaims._count,
        totalAmount: partiallyClearedClaims._sum.totalAmount || 0,
        approvedAmount: partiallyClearedClaims._sum.approvedAmount || 0,
      },
      clearedClaims: {
        count: clearedClaims._count,
        totalAmount: clearedClaims._sum.totalAmount || 0,
        approvedAmount: clearedClaims._sum.approvedAmount || 0,
      },
      rejectedClaims: {
        count: rejectedClaims._count,
        totalAmount: rejectedClaims._sum.totalAmount || 0,
      },
      recentClaims,
      topOutstandingShops,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
