export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const claim = await db.claim.findUnique({
      where: { id },
      include: {
        company: true,
        shop: true,
        supplier: true,
        orderBooker: true,
        claimItems: {
          include: { product: true },
        },
      },
    });

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    return NextResponse.json(claim);
  } catch (error) {
    console.error('Get claim error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const claim = await db.claim.findUnique({ where: { id } });
    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'approve':
        updateData = {
          approvedAmount: claim.totalAmount,
          status: 'approved',
        };
        break;

      case 'partial_approve':
        if (!body.approvedAmount || body.approvedAmount <= 0) {
          return NextResponse.json({ error: 'Approved amount is required' }, { status: 400 });
        }
        updateData = {
          approvedAmount: Number(body.approvedAmount),
          status: 'partially_approved',
        };
        break;

      case 'clear':
        if (!body.clearedBy || !body.clearedBy.trim()) {
          return NextResponse.json({ error: 'Cleared by name is required' }, { status: 400 });
        }
        updateData = {
          status: 'cleared',
          clearedBy: body.clearedBy.trim(),
          clearedDate: new Date(),
        };
        break;

      case 'reject':
        if (!body.rejectReason || !body.rejectReason.trim()) {
          return NextResponse.json({ error: 'Reject reason is required' }, { status: 400 });
        }
        updateData = {
          status: 'rejected',
          rejectReason: body.rejectReason.trim(),
        };
        break;

      case 'update':
        // Update claim details (only if pending)
        if (claim.status !== 'pending') {
          return NextResponse.json({ error: 'Can only edit pending claims' }, { status: 400 });
        }
        const { date, companyId, shopId, supplierId, orderBookerId, items } = body;
        if (items && items.length > 0) {
          const totalAmount = items.reduce((sum: number, item: { amount: number }) => sum + (item.amount || 0), 0);
          // Delete old items and create new ones
          await db.claimItem.deleteMany({ where: { claimId: id } });
          updateData = {
            ...(date && { date: new Date(date) }),
            ...(companyId && { companyId }),
            ...(shopId && { shopId }),
            ...(supplierId && { supplierId }),
            ...(orderBookerId !== undefined && { orderBookerId: orderBookerId || null }),
            totalAmount,
            claimItems: {
              create: items.map((item: { productId: string; quantity: number; amount: number }) => ({
                productId: item.productId,
                quantity: item.quantity,
                amount: item.amount,
              })),
            },
          };
        }
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const updatedClaim = await db.claim.update({
      where: { id },
      data: updateData,
      include: {
        company: true,
        shop: true,
        supplier: true,
        orderBooker: true,
        claimItems: { include: { product: true } },
      },
    });

    return NextResponse.json(updatedClaim);
  } catch (error) {
    console.error('Update claim error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const claim = await db.claim.findUnique({ where: { id } });
    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    if (claim.status !== 'pending') {
      return NextResponse.json({ error: 'Can only delete pending claims' }, { status: 400 });
    }

    await db.claimItem.deleteMany({ where: { claimId: id } });
    await db.claim.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete claim error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
