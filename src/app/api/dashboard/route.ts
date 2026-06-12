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
      arrivedApprovedClaims,
      partiallyApprovedClaims,
      clearedClaims,
      rejectedClaims,
      recentClaims,
      pendingShopClaims,
    ] = await Promise.all([
      db.claim.count({ where }),
      db.claim.aggregate({ where: { ...where, status: 'pending' }, _sum: { totalAmount: true }, _count: true }),
      db.claim.aggregate({ where: { ...where, status: 'approved' }, _sum: { totalAmount: true, approvedAmount: true }, _count: true }),
      db.claim.aggregate({ where: { ...where, status: 'arrived_approved' }, _sum: { totalAmount: true, approvedAmount: true }, _count: true }),
      db.claim.aggregate({ where: { ...where, status: 'partially_approved' }, _sum: { totalAmount: true, approvedAmount: true }, _count: true }),
      db.claim.aggregate({ where: { ...where, status: 'cleared' }, _sum: { totalAmount: true, approvedAmount: true }, _count: true }),
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
      // Get all pending/arrived_approved/approved/partially_approved claims for shop outstanding calculation
      db.claim.findMany({
        where: { ...where, status: { in: ['pending', 'approved', 'arrived_approved', 'partially_approved'] } },
        include: {
          shop: true,
          company: true,
        },
      }),
    ]);

    // Calculate remaining pending amount (total claim - cleared/approved amount)
    const totalClaimAmount = (pendingClaims._sum.totalAmount || 0) + (approvedClaims._sum.totalAmount || 0) + (arrivedApprovedClaims._sum.totalAmount || 0) + (partiallyApprovedClaims._sum.totalAmount || 0) + (clearedClaims._sum.totalAmount || 0);
    const totalClearedAmount = (approvedClaims._sum.approvedAmount || 0) + (arrivedApprovedClaims._sum.approvedAmount || 0) + (partiallyApprovedClaims._sum.approvedAmount || 0) + (clearedClaims._sum.approvedAmount || 0);
    const remainingPendingAmount = totalClaimAmount - totalClearedAmount;

    // Calculate top outstanding shops
    const shopOutstandingMap = new Map<string, { shopId: string; shopName: string; companyName: string; totalPendingAmount: number; pendingClaimCount: number }>();
    for (const claim of pendingShopClaims) {
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
        count: approvedClaims._count + arrivedApprovedClaims._count + partiallyApprovedClaims._count,
        totalAmount: (approvedClaims._sum.totalAmount || 0) + (arrivedApprovedClaims._sum.totalAmount || 0) + (partiallyApprovedClaims._sum.totalAmount || 0),
        approvedAmount: (approvedClaims._sum.approvedAmount || 0) + (arrivedApprovedClaims._sum.approvedAmount || 0) + (partiallyApprovedClaims._sum.approvedAmount || 0),
      },
      arrivedApprovedClaims: {
        count: arrivedApprovedClaims._count,
        totalAmount: arrivedApprovedClaims._sum.totalAmount || 0,
        approvedAmount: arrivedApprovedClaims._sum.approvedAmount || 0,
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
      remainingPendingAmount,
      recentClaims,
      topOutstandingShops,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
