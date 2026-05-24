export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    const claims = await db.claim.findMany({
      include: {
        company: true,
        shop: true,
        claimItems: {
          include: {
            product: true,
          },
        },
      },
    });

    let updatedCount = 0;
    let errorCount = 0;

    for (const claim of claims) {
      try {
        let newTotalAmount = 0;

        // Recalculate each item: amount = claimPrice × quantity (or price × quantity if claimPrice not set)
        for (const item of claim.claimItems) {
          const product = item.product;
          // Use claimPrice if available and > 0, otherwise fall back to price
          const effectivePrice = product.claimPrice && product.claimPrice > 0
            ? product.claimPrice
            : product.price;
          const correctAmount = Math.round(effectivePrice * item.quantity);
          newTotalAmount += correctAmount;

          await db.claimItem.update({
            where: { id: item.id },
            data: { amount: correctAmount },
          });
        }

        // Update claim total and adjust approvedAmount
        const updateData: Record<string, unknown> = { totalAmount: newTotalAmount };

        // Fix approvedAmount: ensure it's not more than totalAmount
        if (claim.approvedAmount !== null && claim.approvedAmount !== undefined) {
          if (claim.totalAmount > 0) {
            // Adjust approvedAmount proportionally
            const ratio = claim.approvedAmount / claim.totalAmount;
            updateData.approvedAmount = Math.round(newTotalAmount * ratio);
          } else {
            // Old total was 0, set approvedAmount to new total (full approval)
            updateData.approvedAmount = newTotalAmount;
          }
          // Safety: never let approvedAmount exceed totalAmount
          if ((updateData.approvedAmount as number) > newTotalAmount) {
            updateData.approvedAmount = newTotalAmount;
          }
        }

        await db.claim.update({
          where: { id: claim.id },
          data: updateData,
        });

        updatedCount++;
      } catch (itemError) {
        console.error(`Error updating claim ${claim.id}:`, itemError);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Recalculated ${updatedCount} claims (Amount = Claim Rate x Quantity)`,
      totalClaims: claims.length,
      updatedClaims: updatedCount,
      errors: errorCount,
    });
  } catch (error) {
    console.error('Recalculate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
