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
        let needsUpdate = false;
        let newTotalAmount = 0;

        const updatedItems = claim.claimItems.map((item) => {
          const price = item.product.price;
          const correctAmount = Math.round(price * (claimRate / 100) * item.quantity);

          if (item.amount !== correctAmount) {
            needsUpdate = true;
          }

          newTotalAmount += correctAmount;

          return {
            id: item.id,
            amount: correctAmount,
          };
        });

        if (needsUpdate) {
          // Update each claim item
          for (const updatedItem of updatedItems) {
            await db.claimItem.update({
              where: { id: updatedItem.id },
              data: { amount: updatedItem.amount },
            });
          }

          // Update claim total
          await db.claim.update({
            where: { id: claim.id },
            data: { totalAmount: newTotalAmount },
          });

          updatedCount++;
        }
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
