export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';

/**
 * GET /api/backup/data
 * Returns ALL tables EXCEPT the attachment blobs (photos) in one response.
 * Photos are fetched separately via /api/backup/attachments because base64
 * image data can be many megabytes and would exceed the serverless response
 * limit. The client assembles the final backup file locally.
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
      attachmentMeta,
      appSettings,
    ] = await Promise.all([
      db.user.findMany({ orderBy: { createdAt: 'asc' } }),
      db.company.findMany({ orderBy: { createdAt: 'asc' } }),
      db.product.findMany({ orderBy: { createdAt: 'asc' } }),
      db.supplier.findMany({ orderBy: { createdAt: 'asc' } }),
      db.shop.findMany({ orderBy: { createdAt: 'asc' } }),
      db.orderBooker.findMany({ orderBy: { createdAt: 'asc' } }),
      db.claim.findMany({ orderBy: { createdAt: 'asc' } }),
      db.claimItem.findMany({ orderBy: { id: 'asc' } }),
      db.productPriceHistory.findMany({ orderBy: { changedAt: 'asc' } }),
      db.shopCompanyOrderBooker.findMany({ orderBy: { createdAt: 'asc' } }),
      db.shopCreditLimit.findMany({ orderBy: { createdAt: 'asc' } }),
      db.userCompany.findMany({ orderBy: { createdAt: 'asc' } }),
      db.auditLog.findMany({ orderBy: { createdAt: 'asc' } }),
      // Only attachment metadata (no url blob) so the client knows the total
      db.claimAttachment.findMany({
        orderBy: { createdAt: 'asc' },
        select: { id: true, claimId: true, type: true, createdAt: true },
      }),
      db.appSetting.findMany(),
    ]);

    return NextResponse.json({
      version: 2,
      app: 'al-falah-traders-claims',
      createdAt: new Date().toISOString(),
      tables: {
        appSettings,
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
        // metadata only — url filled in by client from /api/backup/attachments
        claimAttachments: attachmentMeta.map((a) => ({ ...a, url: '' })),
      },
    });
  } catch (error) {
    console.error('Backup data error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
