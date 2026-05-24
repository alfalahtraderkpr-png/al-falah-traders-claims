export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    // Get all claims with their items and company info
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
        const claimRate = claim.company?.claimRate || 78;
        let newTotalAmount = 0;

        // Recalculate each item amount: price × (claimRate/100) × quantity
        for (const item of claim.claimItems) {
          const price = item.product.price;
          const correctAmount = Math.round(price * (claimRate / 100) * item.quantity);
          newTotalAmount += correctAmount;

          // Always update the item amount
          await db.claimItem.update({
            where: { id: item.id },
            data: { amount: correctAmount },
          });
        }

        // Update claim total and adjust approvedAmount proportionally
        const updateData: Record<string, unknown> = { totalAmount: newTotalAmount };

        // If claim was approved, adjust approvedAmount proportionally
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
      message: `Recalculated ${updatedCount} claims with correct claim rates`,
      totalClaims: claims.length,
      updatedClaims: updatedCount,
      errors: errorCount,
    });
  } catch (error) {
    console.error('Recalculate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
