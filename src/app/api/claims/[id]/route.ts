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

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'approve':
        updateData = {
          approvedAmount: claim.netAmount || claim.totalAmount, // Approve based on net amount (after deduction)
          status: 'arrived_approved',
        };
        break;

      case 'arrive_and_approve':
        // Admin verifies physical stock + edits if needed + approves
        // This allows editing claim items before marking as arrived_approved
        if (body.items && body.items.length > 0) {
          const totalAmount = body.items.reduce((sum: number, item: { amount: number }) => sum + (item.amount || 0), 0);
          const deductionPercent = claim.company.claimDeductionPercent || 0;
          const deductionAmount = deductionPercent > 0 ? Math.round(totalAmount * deductionPercent / 100) : 0;
          const netAmount = totalAmount - deductionAmount;

          // Delete old items and create new ones
          await db.claimItem.deleteMany({ where: { claimId: id } });

          updateData = {
            totalAmount,
            deductionAmount,
            netAmount,
            approvedAmount: netAmount,
            status: 'arrived_approved',
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
            approvedAmount: claim.netAmount || claim.totalAmount,
            status: 'arrived_approved',
          };
        }
        break;

      case 'partial_approve':
        if (!body.approvedAmount || body.approvedAmount <= 0) {
          return NextResponse.json({ error: 'Approved amount is required' }, { status: 400 });
        }
        if (Number(body.approvedAmount) > claim.netAmount) {
          return NextResponse.json({ error: `Approved amount cannot exceed net claim amount (Rs.${claim.netAmount})` }, { status: 400 });
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

      case 'change_status':
        // Allow admin to change claim status freely (e.g., approved back to pending/partial)
        if (!body.newStatus) {
          return NextResponse.json({ error: 'New status is required' }, { status: 400 });
        }
        const validStatuses = ['pending', 'approved', 'arrived_approved', 'partially_approved', 'cleared', 'rejected'];
        if (!validStatuses.includes(body.newStatus)) {
          return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }
        updateData = { status: body.newStatus };
        // Handle status-specific fields
        if (body.newStatus === 'pending') {
          // Reset approval when going back to pending
          updateData.approvedAmount = null;
          updateData.clearedBy = null;
          updateData.clearedDate = null;
          updateData.rejectReason = null;
        } else if (body.newStatus === 'approved' || body.newStatus === 'arrived_approved') {
          updateData.approvedAmount = claim.netAmount || claim.totalAmount; // Approve based on net amount
          updateData.clearedBy = null;
          updateData.clearedDate = null;
          updateData.rejectReason = null;
        } else if (body.newStatus === 'partially_approved') {
          // Keep existing approvedAmount or use provided amount
          const partialAmount = body.approvedAmount ? Number(body.approvedAmount) : claim.approvedAmount;
          if (!partialAmount || partialAmount <= 0) {
            return NextResponse.json({ error: 'Approved amount is required for partial approval' }, { status: 400 });
          }
          if (partialAmount > claim.netAmount) {
            return NextResponse.json({ error: `Approved amount cannot exceed net amount (Rs.${claim.netAmount})` }, { status: 400 });
          }
          updateData.approvedAmount = partialAmount;
          updateData.clearedBy = null;
          updateData.clearedDate = null;
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
        // Update claim details (if pending or rejected — rejected allows resubmit)
        if (claim.status !== 'pending' && claim.status !== 'rejected') {
          return NextResponse.json({ error: 'Can only edit pending or rejected claims' }, { status: 400 });
        }
        const { date, companyId, shopId, supplierId, orderBookerId, items } = body;
        if (items && items.length > 0) {
          const totalAmount = items.reduce((sum: number, item: { amount: number }) => sum + (item.amount || 0), 0);

          // Calculate deduction based on company's claimDeductionPercent
          const updatedCompany = companyId ? await db.company.findUnique({ where: { id: companyId } }) : claim.company;
          const deductionPercent = (updatedCompany?.claimDeductionPercent || 0);
          const deductionAmount = deductionPercent > 0 ? Math.round(totalAmount * deductionPercent / 100) : 0;
          const netAmount = totalAmount - deductionAmount;

          // Delete old items and create new ones
          await db.claimItem.deleteMany({ where: { claimId: id } });

          // If claim was rejected, resubmit it back to pending (reset rejection data)
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

    // Allow deletion of any claim (admin can delete mistaken claims)
    // Extra confirmation is handled on the frontend

    await db.claimItem.deleteMany({ where: { claimId: id } });
    await db.claim.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete claim error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
