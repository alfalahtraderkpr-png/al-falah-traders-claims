export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';

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
          include: { product: { include: { company: true } } },
        },
        attachments: true,
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

    const claim = await db.claim.findUnique({ where: { id }, include: { company: true } });
    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    // ============================================================
    // PERMISSION CHECK: order bookers can ONLY use 'update' action
    // (to edit their own pending claims' items). All other actions
    // (approve, reject, clear, partial, change_status, arrive_and_approve)
    // are ADMIN-ONLY.
    // ============================================================
    const auth = await getAuthContext(request);

    const ADMIN_ONLY_ACTIONS = ['approve', 'arrive_and_approve', 'partial', 'clear', 'reject', 'change_status'];
    if (ADMIN_ONLY_ACTIONS.includes(action)) {
      if (!auth || auth.role !== 'admin') {
        return NextResponse.json(
          { error: 'Only admin can perform this action. Order bookers can only edit their own pending claims.' },
          { status: 403 }
        );
      }
    }

    // For the 'update' action: order bookers can only update THEIR OWN claims
    if (action === 'update' && auth && auth.role !== 'admin') {
      if (!auth.orderBookerId || claim.orderBookerId !== auth.orderBookerId) {
        return NextResponse.json(
          { error: 'You can only edit your own claims.' },
          { status: 403 }
        );
      }
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      // ==========================================
      // FLOW: pending → approved → partial → cleared
      // ==========================================

      case 'approve':
        // Stock arrived on floor - approve the claim
        // Amount NOT yet deducted from shopkeeper's account
        // approvedAmount stays null - will be set when payment is actually deducted
        updateData = {
          approvedAmount: null,
          status: 'approved',
        };
        break;

      case 'arrive_and_approve':
        // Admin verifies physical stock + edits if needed + approves
        // Stock arrived, payment still pending
        if (body.items && body.items.length > 0) {
          const totalAmount = body.items.reduce((sum: number, item: { amount: number }) => sum + (item.amount || 0), 0);
          const deductionPercent = claim.company.claimDeductionPercent || 0;
          const deductionAmount = deductionPercent > 0 ? Math.round(totalAmount * deductionPercent / 100) : 0;
          const netAmount = totalAmount - deductionAmount;

          await db.claimItem.deleteMany({ where: { claimId: id } });

          updateData = {
            totalAmount,
            deductionAmount,
            netAmount,
            approvedAmount: null, // No payment deducted yet, only stock verified
            status: 'approved',
            claimItems: {
              create: body.items.map((item: { productId: string; quantity: number; amount: number }) => ({
                productId: item.productId,
                quantity: item.quantity,
                amount: item.amount,
              })),
            },
          };
        } else {
          updateData = {
            approvedAmount: null, // No payment deducted yet
            status: 'approved',
          };
        }
        break;

      case 'partial':
        // Partial amount deducted from shopkeeper's account
        if (!body.clearedAmount || Number(body.clearedAmount) <= 0) {
          return NextResponse.json({ error: 'Cleared amount is required' }, { status: 400 });
        }
        const clearedAmount = Number(body.clearedAmount);
        const maxAmount = claim.netAmount || claim.totalAmount;
        if (clearedAmount >= maxAmount) {
          // If full amount is cleared, mark as fully cleared
          updateData = {
            approvedAmount: maxAmount,
            status: 'cleared',
            clearedBy: body.clearedBy?.trim() || null,
            clearedDate: new Date(),
          };
        } else {
          updateData = {
            approvedAmount: clearedAmount,
            status: 'partial',
          };
        }
        break;

      case 'clear':
        // Full amount deducted from shopkeeper - claim settled
        if (!body.clearedBy || !body.clearedBy.trim()) {
          return NextResponse.json({ error: 'Cleared by name is required' }, { status: 400 });
        }
        updateData = {
          approvedAmount: claim.netAmount || claim.totalAmount,
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

      case 'change_status':
        if (!body.newStatus) {
          return NextResponse.json({ error: 'New status is required' }, { status: 400 });
        }
        const validStatuses = ['pending', 'approved', 'partial', 'cleared', 'rejected'];
        if (!validStatuses.includes(body.newStatus)) {
          return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }
        updateData = { status: body.newStatus };
        if (body.newStatus === 'pending') {
          updateData.approvedAmount = null;
          updateData.clearedBy = null;
          updateData.clearedDate = null;
          updateData.rejectReason = null;
        } else if (body.newStatus === 'approved') {
          updateData.approvedAmount = null; // No payment deducted yet
          updateData.clearedBy = null;
          updateData.clearedDate = null;
          updateData.rejectReason = null;
        } else if (body.newStatus === 'partial') {
          const partialAmount = body.approvedAmount ? Number(body.approvedAmount) : claim.approvedAmount;
          if (!partialAmount || partialAmount <= 0) {
            return NextResponse.json({ error: 'Cleared amount is required for partial status' }, { status: 400 });
          }
          const maxAmt = claim.netAmount || claim.totalAmount;
          if (partialAmount >= maxAmt) {
            // Full amount means it should be cleared, not partial
            updateData.approvedAmount = maxAmt;
            updateData.status = 'cleared';
            updateData.clearedBy = body.clearedBy?.trim() || null;
            updateData.clearedDate = new Date();
            updateData.rejectReason = null;
          } else {
            updateData.approvedAmount = partialAmount;
            updateData.clearedBy = null;
            updateData.clearedDate = null;
            updateData.rejectReason = null;
          }
        } else if (body.newStatus === 'cleared') {
          updateData.approvedAmount = claim.netAmount || claim.totalAmount;
          updateData.clearedBy = body.clearedBy?.trim() || null;
          updateData.clearedDate = new Date();
          updateData.rejectReason = null;
        } else if (body.newStatus === 'rejected') {
          if (!body.rejectReason || !body.rejectReason.trim()) {
            return NextResponse.json({ error: 'Reject reason is required' }, { status: 400 });
          }
          updateData.rejectReason = body.rejectReason.trim();
          updateData.clearedBy = null;
          updateData.clearedDate = null;
        }
        break;

      case 'update':
        if (claim.status !== 'pending' && claim.status !== 'rejected') {
          return NextResponse.json({ error: 'Can only edit pending or rejected claims' }, { status: 400 });
        }
        const { date, companyId, shopId, supplierId, orderBookerId, items } = body;
        if (items && items.length > 0) {
          const totalAmount = items.reduce((sum: number, item: { amount: number }) => sum + (item.amount || 0), 0);

          const updatedCompany = companyId ? await db.company.findUnique({ where: { id: companyId } }) : claim.company;
          const deductionPercent = (updatedCompany?.claimDeductionPercent || 0);
          const deductionAmount = deductionPercent > 0 ? Math.round(totalAmount * deductionPercent / 100) : 0;
          const netAmount = totalAmount - deductionAmount;

          await db.claimItem.deleteMany({ where: { claimId: id } });

          const isResubmit = claim.status === 'rejected';

          updateData = {
            ...(date && { date: new Date(date) }),
            ...(companyId && { companyId }),
            ...(shopId && { shopId }),
            ...(supplierId && { supplierId }),
            ...(orderBookerId !== undefined && { orderBookerId: orderBookerId || null }),
            totalAmount,
            deductionAmount,
            netAmount,
            ...(isResubmit && {
              status: 'pending',
              approvedAmount: null,
              rejectReason: null,
            }),
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
        claimItems: { include: { product: { include: { company: true } } } },
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

    await db.claimItem.deleteMany({ where: { claimId: id } });
    await db.claim.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete claim error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
