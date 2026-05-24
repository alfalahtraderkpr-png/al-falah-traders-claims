export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    const claims = await db.claim.findMany({
      include: {
        company: true,
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

        // Recalculate each item: amount = price × quantity (no claim rate)
        for (const item of claim.claimItems) {
          const price = item.product.price;
          const correctAmount = Math.round(price * item.quantity);
          newTotalAmount += correctAmount;

          await db.claimItem.update({
            where: { id: item.id },
            data: { amount: correctAmount },
          });
        }

        // Update claim total and adjust approvedAmount proportionally
        const updateData: Record<string, unknown> = { totalAmount: newTotalAmount };

        if (claim.approvedAmount !== null && claim.approvedAmount !== undefined && claim.totalAmount > 0) {
          const ratio = claim.approvedAmount / claim.totalAmount;
          updateData.approvedAmount = Math.round(newTotalAmount * ratio);
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
      message: `Recalculated ${updatedCount} claims (Amount = Rate x Quantity)`,
      totalClaims: claims.length,
      updatedClaims: updatedCount,
      errors: errorCount,
    });
  } catch (error) {
    console.error('Recalculate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
