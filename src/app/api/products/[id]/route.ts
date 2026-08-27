export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, price, claimPrice, unit, companyId, wholesalePrice, lmtPrice } = await request.json();

    // Fetch old product for price comparison
    const oldProduct = await db.product.findUnique({ where: { id } });

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (price !== undefined) data.price = Number(price);
    if (claimPrice !== undefined) data.claimPrice = Number(claimPrice);
    if (unit !== undefined) data.unit = unit;
    if (companyId !== undefined) data.companyId = companyId;
    if (wholesalePrice !== undefined) data.wholesalePrice = wholesalePrice ? Number(wholesalePrice) : null;
    if (lmtPrice !== undefined) data.lmtPrice = lmtPrice ? Number(lmtPrice) : null;

    const product = await db.product.update({
      where: { id },
      data,
      include: { company: true },
    });

    // Create price history record if prices changed
    if (oldProduct) {
      const oldPrice = oldProduct.price;
      const newPrice = price !== undefined ? Number(price) : oldPrice;
      const oldClaimPrice = oldProduct.claimPrice;
      const newClaimPrice = claimPrice !== undefined ? Number(claimPrice) : oldClaimPrice;
      const oldWholesale = oldProduct.wholesalePrice;
      const newWholesale = wholesalePrice !== undefined ? (wholesalePrice ? Number(wholesalePrice) : null) : oldWholesale;
      const oldLmt = oldProduct.lmtPrice;
      const newLmt = lmtPrice !== undefined ? (lmtPrice ? Number(lmtPrice) : null) : oldLmt;

      const priceChanged = oldPrice !== newPrice ||
        oldClaimPrice !== newClaimPrice ||
        oldWholesale !== newWholesale ||
        oldLmt !== newLmt;

      if (priceChanged) {
        await db.productPriceHistory.create({
          data: {
            productId: id,
            oldPrice,
            newPrice,
            oldClaimPrice,
            newClaimPrice,
            oldWholesalePrice: oldWholesale,
            newWholesalePrice: newWholesale,
            oldLmtPrice: oldLmt,
            newLmtPrice: newLmt,
          },
        });

        // Audit log the price change
        await db.auditLog.create({
          data: {
            action: 'price_update',
            entity: 'product',
            entityId: id,
            details: JSON.stringify({
              name: product.name,
              priceChange: oldPrice !== newPrice ? { from: oldPrice, to: newPrice } : undefined,
              claimPriceChange: oldClaimPrice !== newClaimPrice ? { from: oldClaimPrice, to: newClaimPrice } : undefined,
              wholesalePriceChange: oldWholesale !== newWholesale ? { from: oldWholesale, to: newWholesale } : undefined,
              lmtPriceChange: oldLmt !== newLmt ? { from: oldLmt, to: newLmt } : undefined,
            }),
          },
        });
      }
    }

    return NextResponse.json(product);
  } catch (error: unknown) {
    console.error('Update product error:', error);
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    if (errMsg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Product with this name, price and company already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: `Failed to update product: ${errMsg}` }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const claimItemCount = await db.claimItem.count({ where: { productId: id } });
    if (claimItemCount > 0) {
      return NextResponse.json({ error: 'Cannot delete product used in claims' }, { status: 400 });
    }

    // SOFT DELETE — product moves to Trash, recoverable for 30 days
    await db.product.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true, trashed: true });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
