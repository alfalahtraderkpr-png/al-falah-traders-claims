export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    const claims = await db.claim.findMany({
      include: {
        company: true,
        shop: {
          include: {
            companyOrderBookers: true,
          },
        },
        claimItems: {
          include: {
            product: {
              include: { company: true },
            },
          },
        },
      },
    });

    let updatedCount = 0;
    let errorCount = 0;

    for (const claim of claims) {
      try {
        let newTotalAmount = 0;

        // Recalculate each item with multi-tier pricing support
        for (const item of claim.claimItems) {
          const product = item.product;
          let effectivePrice: number;

          // Get company-specific shop type from ShopCompanyOrderBooker, fallback to shop.shopType
          const companyMapping = claim.shop?.companyOrderBookers?.find(
            (cob) => cob.companyId === claim.companyId
          );
          const effectiveShopType = companyMapping?.shopType || claim.shop?.shopType || 'retail';

          // Multi-tier pricing: check wholesale/LMT prices FIRST (same logic as claim-form.tsx)
          if (product.company?.multiTierPricing) {
            if (effectiveShopType === 'wholesale' && product.wholesalePrice) {
              effectivePrice = product.wholesalePrice;
            } else if (effectiveShopType === 'lmt' && product.lmtPrice) {
              effectivePrice = product.lmtPrice;
            } else if (product.claimPrice && product.claimPrice > 0) {
              effectivePrice = product.claimPrice;
            } else {
              effectivePrice = product.price;
            }
          } else {
            // Standard pricing: use claimPrice if available, otherwise price
            effectivePrice = product.claimPrice && product.claimPrice > 0
              ? product.claimPrice
              : product.price;
          }

          const correctAmount = Math.round(effectivePrice * item.quantity);
          newTotalAmount += correctAmount;

          await db.claimItem.update({
            where: { id: item.id },
            data: { amount: correctAmount },
          });
        }

        // Update claim total and adjust approvedAmount
        const deductionPercent = claim.company?.claimDeductionPercent || 0;
        const deductionAmount = deductionPercent > 0 ? Math.round(newTotalAmount * deductionPercent / 100) : 0;
        const netAmount = newTotalAmount - deductionAmount;

        const updateData: Record<string, unknown> = { totalAmount: newTotalAmount, deductionAmount, netAmount };

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
      message: `Recalculated ${updatedCount} claims (with multi-tier pricing support)`,
      totalClaims: claims.length,
      updatedClaims: updatedCount,
      errors: errorCount,
    });
  } catch (error) {
    console.error('Recalculate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
