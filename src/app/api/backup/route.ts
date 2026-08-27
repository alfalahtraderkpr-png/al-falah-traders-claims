export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';

/**
 * GET /api/backup
 * Returns an overview of the database: record counts per table,
 * attachment count and estimated total size — used by the Backup page.
 * Admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const [
      users,
      companies,
      products,
      suppliers,
      shops,
      orderBookers,
      claims,
      claimItems,
      priceHistory,
      shopCompanyOrderBookers,
      creditLimits,
      userCompanies,
      auditLogs,
      attachments,
    ] = await Promise.all([
      db.user.count(),
      db.company.count(),
      db.product.count(),
      db.supplier.count(),
      db.shop.count(),
      db.orderBooker.count(),
      db.claim.count(),
      db.claimItem.count(),
      db.productPriceHistory.count(),
      db.shopCompanyOrderBooker.count(),
      db.shopCreditLimit.count(),
      db.userCompany.count(),
      db.auditLog.count(),
      db.claimAttachment.count(),
    ]);

    // Estimate size of attachment blobs (base64 strings)
    let attachmentBytes = 0;
    try {
      const rows = await db.claimAttachment.findMany({ select: { url: true } });
      attachmentBytes = rows.reduce((sum, r) => sum + (r.url?.length || 0), 0);
    } catch {
      attachmentBytes = 0;
    }

    // Rough estimate of structural (text) data: ~1KB per record across tables
    const structuralRecords =
      users + companies + products + suppliers + shops + orderBookers +
      claims + claimItems + priceHistory + shopCompanyOrderBookers +
      creditLimits + userCompanies + auditLogs;

    return NextResponse.json({
      counts: {
        users,
        companies,
        products,
        suppliers,
        shops,
        orderBookers,
        claims,
        claimItems,
        priceHistory,
        shopCompanyOrderBookers,
        creditLimits,
        userCompanies,
        auditLogs,
        attachments,
      },
      attachmentBytes,
      estimatedTotalBytes: attachmentBytes + structuralRecords * 1024,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Backup stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
