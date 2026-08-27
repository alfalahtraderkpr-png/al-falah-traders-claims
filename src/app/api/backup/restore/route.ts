export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';

/**
 * POST /api/backup/restore
 * Restores the database from a backup JSON file. Admin only.
 *
 * Safety:
 *  - Validates the backup structure BEFORE touching any data
 *  - Refuses backups that contain no users (would lock everyone out)
 *  - Runs inside ONE transaction: if anything fails, the current data is
 *    left completely untouched (rollback)
 *  - Unknown fields are dropped, so backups from slightly different app
 *    versions still restore cleanly
 *
 * Attachments (photos) may be included here when the payload is small, or
 * uploaded afterwards one-by-one via /api/backup/restore-attachment when the
 * backup file is large.
 */

// Whitelist of allowed fields per table — makes restore resilient across
// schema versions (extra fields in old/new backups are silently dropped).
const FIELDS: Record<string, string[]> = {
  appSettings: ['id', 'companyName', 'address', 'phone', 'email', 'updatedAt'],
  users: ['id', 'name', 'email', 'password', 'role', 'orderBookerId', 'createdAt', 'updatedAt'],
  companies: ['id', 'name', 'multiTierPricing', 'claimDeductionPercent', 'createdAt', 'updatedAt', 'deletedAt'],
  products: ['id', 'name', 'price', 'claimPrice', 'wholesalePrice', 'lmtPrice', 'unit', 'companyId', 'createdAt', 'updatedAt', 'deletedAt'],
  suppliers: ['id', 'name', 'companyId', 'createdAt', 'updatedAt', 'deletedAt'],
  shops: ['id', 'name', 'address', 'phone', 'shopType', 'createdAt', 'updatedAt', 'deletedAt'],
  orderBookers: ['id', 'name', 'createdAt', 'updatedAt', 'deletedAt'],
  userCompanies: ['id', 'userId', 'companyId', 'createdAt'],
  shopCompanyOrderBookers: ['id', 'shopId', 'companyId', 'orderBookerId', 'shopType', 'createdAt', 'updatedAt'],
  creditLimits: ['id', 'shopId', 'companyId', 'creditLimit', 'createdAt', 'updatedAt'],
  claims: ['id', 'claimNumber', 'date', 'companyId', 'shopId', 'supplierId', 'orderBookerId', 'totalAmount', 'deductionAmount', 'netAmount', 'approvedAmount', 'status', 'clearedBy', 'clearedDate', 'rejectReason', 'createdBy', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy'],
  claimItems: ['id', 'claimId', 'productId', 'quantity', 'amount'],
  priceHistory: ['id', 'productId', 'oldPrice', 'newPrice', 'oldClaimPrice', 'newClaimPrice', 'oldWholesalePrice', 'newWholesalePrice', 'oldLmtPrice', 'newLmtPrice', 'changedBy', 'changedAt'],
  auditLogs: ['id', 'userId', 'userName', 'action', 'entity', 'entityId', 'details', 'createdAt'],
  claimAttachments: ['id', 'claimId', 'url', 'type', 'createdAt'],
};

function sanitize(table: string, rows: unknown): Record<string, unknown>[] {
  if (!Array.isArray(rows)) return [];
  const allowed = FIELDS[table] || [];
  return rows
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => {
      const out: Record<string, unknown> = {};
      for (const f of allowed) {
        if (r[f] !== undefined) out[f] = r[f];
      }
      return out;
    })
    .filter((r) => Object.keys(r).length > 0);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    let payload: {
      app?: string;
      version?: number;
      createdAt?: string;
      tables?: Record<string, unknown>;
      skipAttachments?: boolean;
    };

    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON file — could not parse backup' }, { status: 400 });
    }

    // ---- Validate before touching anything ----
    if (payload.app !== 'al-falah-traders-claims') {
      return NextResponse.json(
        { error: 'This file is not an Al Falah Traders backup file' },
        { status: 400 },
      );
    }
    if (!payload.tables || typeof payload.tables !== 'object') {
      return NextResponse.json({ error: 'Backup file is missing the "tables" section' }, { status: 400 });
    }

    const t = payload.tables;
    const users = sanitize('users', t.users);
    if (users.length === 0) {
      return NextResponse.json(
        { error: 'Backup contains no user accounts — restoring it would lock everyone out. Restore cancelled.' },
        { status: 400 },
      );
    }

    const companies = sanitize('companies', t.companies);
    const products = sanitize('products', t.products);
    const suppliers = sanitize('suppliers', t.suppliers);
    const shops = sanitize('shops', t.shops);
    const orderBookers = sanitize('orderBookers', t.orderBookers);
    const userCompanies = sanitize('userCompanies', t.userCompanies);
    const shopCompanyOrderBookers = sanitize('shopCompanyOrderBookers', t.shopCompanyOrderBookers);
    const creditLimits = sanitize('creditLimits', t.creditLimits);
    const claims = sanitize('claims', t.claims);
    const claimItems = sanitize('claimItems', t.claimItems);
    const priceHistory = sanitize('priceHistory', t.priceHistory);
    const auditLogs = sanitize('auditLogs', t.auditLogs);
    const claimAttachments = payload.skipAttachments
      ? [] // photos come separately via /api/backup/restore-attachment
      : sanitize('claimAttachments', t.claimAttachments).filter((a) => a.url); // skip empty urls
    const appSettings = sanitize('appSettings', t.appSettings);

    // ---- Restore inside one transaction (rollback on any failure) ----
    await db.$transaction(
      async (tx) => {
        // 1. Wipe existing data — children first (FK-safe order)
        await tx.claimAttachment.deleteMany({});
        await tx.claimItem.deleteMany({});
        await tx.claim.deleteMany({});
        await tx.productPriceHistory.deleteMany({});
        await tx.auditLog.deleteMany({});
        await tx.userCompany.deleteMany({});
        await tx.shopCreditLimit.deleteMany({});
        await tx.shopCompanyOrderBooker.deleteMany({});
        await tx.user.deleteMany({});
        await tx.product.deleteMany({});
        await tx.supplier.deleteMany({});
        await tx.orderBooker.deleteMany({});
        await tx.shop.deleteMany({});
        await tx.company.deleteMany({});
        await tx.appSetting.deleteMany({});

        // 2. Insert backup data — parents first (FK-safe order)
        if (companies.length) await tx.company.createMany({ data: companies as never[] });
        if (shops.length) await tx.shop.createMany({ data: shops as never[] });
        if (orderBookers.length) await tx.orderBooker.createMany({ data: orderBookers as never[] });
        if (suppliers.length) await tx.supplier.createMany({ data: suppliers as never[] });
        if (users.length) await tx.user.createMany({ data: users as never[] });
        if (products.length) await tx.product.createMany({ data: products as never[] });
        if (userCompanies.length) await tx.userCompany.createMany({ data: userCompanies as never[] });
        if (shopCompanyOrderBookers.length) await tx.shopCompanyOrderBooker.createMany({ data: shopCompanyOrderBookers as never[] });
        if (creditLimits.length) await tx.shopCreditLimit.createMany({ data: creditLimits as never[] });
        if (claims.length) await tx.claim.createMany({ data: claims as never[] });
        if (claimItems.length) await tx.claimItem.createMany({ data: claimItems as never[] });
        if (priceHistory.length) await tx.productPriceHistory.createMany({ data: priceHistory as never[] });
        if (claimAttachments.length) await tx.claimAttachment.createMany({ data: claimAttachments as never[] });
        if (auditLogs.length) await tx.auditLog.createMany({ data: auditLogs as never[] });
        if (appSettings.length) {
          await tx.appSetting.createMany({ data: appSettings as never[] });
        } else {
          // No settings in backup (old version) — keep defaults
          await tx.appSetting.create({
            data: { id: 'main', companyName: 'Al-Falah Traders', address: '', phone: '', email: '' },
          });
        }

        // 3. Record the restore action itself
        await tx.auditLog.create({
          data: {
            userId: auth.userId,
            userName: auth.name,
            action: 'restore',
            entity: 'backup',
            details: `Database restored from backup file (created ${payload.createdAt || 'unknown date'}). ` +
              `${claims.length} claims, ${companies.length} companies, ${users.length} users.`,
          },
        });
      },
      { timeout: 120000, maxWait: 10000 },
    );

    return NextResponse.json({
      success: true,
      restored: {
        users: users.length,
        companies: companies.length,
        products: products.length,
        suppliers: suppliers.length,
        shops: shops.length,
        orderBookers: orderBookers.length,
        userCompanies: userCompanies.length,
        shopCompanyOrderBookers: shopCompanyOrderBookers.length,
        creditLimits: creditLimits.length,
        claims: claims.length,
        claimItems: claimItems.length,
        priceHistory: priceHistory.length,
        auditLogs: auditLogs.length,
        attachmentsRestoredNow: claimAttachments.length,
        attachmentsPending: payload.skipAttachments
          ? sanitize('claimAttachments', t.claimAttachments).length
          : 0,
      },
    });
  } catch (error) {
    console.error('Restore error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Restore failed — no changes were made to your data. (${message})` },
      { status: 500 },
    );
  }
}
