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
      partiallyApprovedClaims,
      clearedClaims,
      rejectedClaims,
      recentClaims,
    ] = await Promise.all([
      db.claim.count({ where }),
      db.claim.aggregate({ where: { ...where, status: 'pending' }, _sum: { totalAmount: true }, _count: true }),
      db.claim.aggregate({ where: { ...where, status: 'approved' }, _sum: { totalAmount: true, approvedAmount: true }, _count: true }),
      db.claim.aggregate({ where: { ...where, status: 'partially_approved' }, _sum: { totalAmount: true, approvedAmount: true }, _count: true }),
      db.claim.aggregate({ where: { ...where, status: 'cleared' }, _sum: { totalAmount: true, approvedAmount: true }, _count: true }),
      db.claim.aggregate({ where: { ...where, status: 'rejected' }, _sum: { totalAmount: true }, _count: true }),
      db.claim.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          company: true,
          shop: true,
          supplier: true,
          orderBooker: true,
        },
      }),
    ]);

    // Calculate remaining pending amount (total claim - cleared/approved amount)
    const totalClaimAmount = (pendingClaims._sum.totalAmount || 0) + (approvedClaims._sum.totalAmount || 0) + (partiallyApprovedClaims._sum.totalAmount || 0) + (clearedClaims._sum.totalAmount || 0);
    const totalClearedAmount = (approvedClaims._sum.approvedAmount || 0) + (partiallyApprovedClaims._sum.approvedAmount || 0) + (clearedClaims._sum.approvedAmount || 0);
    const remainingPendingAmount = totalClaimAmount - totalClearedAmount;

    return NextResponse.json({
      totalClaims,
      pendingClaims: {
        count: pendingClaims._count,
        totalAmount: pendingClaims._sum.totalAmount || 0,
      },
      approvedClaims: {
        count: approvedClaims._count + partiallyApprovedClaims._count,
        totalAmount: (approvedClaims._sum.totalAmount || 0) + (partiallyApprovedClaims._sum.totalAmount || 0),
        approvedAmount: (approvedClaims._sum.approvedAmount || 0) + (partiallyApprovedClaims._sum.approvedAmount || 0),
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
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
