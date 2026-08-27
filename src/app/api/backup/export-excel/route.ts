export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';
import * as XLSX from 'xlsx';

/**
 * GET /api/backup/export-excel
 * Downloads a human-readable Excel workbook containing every table of the
 * system (multiple sheets). Intended for record-keeping / offline copies.
 * Photos are not included (Excel cannot store base64 images usefully).
 * Admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const [
      users, companies, products, suppliers, shops, orderBookers,
      claims, claimItems, priceHistory, creditLimits, userCompanies,
      shopCompanyOrderBookers, auditLogs, attachments,
    ] = await Promise.all([
      db.user.findMany({ orderBy: { createdAt: 'asc' } }),
      db.company.findMany({ orderBy: { createdAt: 'asc' } }),
      db.product.findMany({ orderBy: { createdAt: 'asc' }, include: { company: true } }),
      db.supplier.findMany({ orderBy: { createdAt: 'asc' }, include: { company: true } }),
      db.shop.findMany({ orderBy: { createdAt: 'asc' } }),
      db.orderBooker.findMany({ orderBy: { createdAt: 'asc' } }),
      db.claim.findMany({
        orderBy: { createdAt: 'asc' },
        include: { company: true, shop: true, supplier: true, orderBooker: true },
      }),
      db.claimItem.findMany({ include: { claim: true, product: true } }),
      db.productPriceHistory.findMany({ include: { product: true } }),
      db.shopCreditLimit.findMany({ include: { shop: true, company: true } }),
      db.userCompany.findMany({ include: { user: true, company: true } }),
      db.shopCompanyOrderBooker.findMany({ include: { shop: true, company: true, orderBooker: true } }),
      db.auditLog.findMany({ orderBy: { createdAt: 'desc' } }),
      db.claimAttachment.findMany({ select: { id: true, claimId: true, type: true, createdAt: true } }),
    ]);

    const wb = XLSX.utils.book_new();
    const d = (dt: Date | null | undefined) => (dt ? new Date(dt).toLocaleString() : '');

    // ---- Claims ----
    const claimRows = claims.map((c) => ({
      'Claim #': c.claimNumber,
      'Date': new Date(c.date).toLocaleDateString(),
      'Company': c.company.name,
      'Shop': c.shop.name,
      'Supplier': c.supplier.name,
      'Order Booker': c.orderBooker?.name || '-',
      'Created By': c.createdBy || '-',
      'Total Amount': c.totalAmount,
      'Deduction': c.deductionAmount,
      'Net Amount': c.netAmount,
      'Approved Amount': c.approvedAmount ?? '',
      'Status': c.status,
      'Cleared By': c.clearedBy || '-',
      'Cleared Date': c.clearedDate ? new Date(c.clearedDate).toLocaleDateString() : '',
      'Reject Reason': c.rejectReason || '',
      'Created At': d(c.createdAt),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(claimRows), 'Claims');

    // ---- Claim Items ----
    const itemRows = claimItems.map((i) => ({
      'Claim #': i.claim.claimNumber,
      'Product': i.product.name,
      'Company': i.product.companyId,
      'Unit': i.product.unit,
      'Quantity': i.quantity,
      'Amount': i.amount,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemRows), 'Claim Items');

    // ---- Companies ----
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(companies.map((c) => ({
      'Name': c.name,
      'Multi-Tier Pricing': c.multiTierPricing ? 'Yes' : 'No',
      'Claim Deduction %': c.claimDeductionPercent,
      'Created At': d(c.createdAt),
    }))), 'Companies');

    // ---- Products ----
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products.map((p) => ({
      'Name': p.name,
      'Company': p.company.name,
      'Price': p.price,
      'Claim Price': p.claimPrice,
      'Wholesale Price': p.wholesalePrice ?? '',
      'LMT Price': p.lmtPrice ?? '',
      'Unit': p.unit,
      'Created At': d(p.createdAt),
    }))), 'Products');

    // ---- Suppliers ----
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(suppliers.map((s) => ({
      'Name': s.name,
      'Company': s.company?.name || '-',
      'Created At': d(s.createdAt),
    }))), 'Suppliers');

    // ---- Shops ----
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(shops.map((s) => ({
      'Name': s.name,
      'Address': s.address,
      'Shop Type': s.shopType,
      'Created At': d(s.createdAt),
    }))), 'Shops');

    // ---- Order Bookers ----
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orderBookers.map((o) => ({
      'Name': o.name,
      'Created At': d(o.createdAt),
    }))), 'Order Bookers');

    // ---- Users ----
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(users.map((u) => ({
      'Name': u.name,
      'Email': u.email,
      'Role': u.role,
      'Linked Order Booker': u.orderBookerId || '-',
      'Created At': d(u.createdAt),
    }))), 'Users');

    // ---- User-Company Assignments ----
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(userCompanies.map((uc) => ({
      'User': uc.user.name,
      'Company': uc.company.name,
      'Created At': d(uc.createdAt),
    }))), 'User Companies');

    // ---- Shop-Company-OrderBooker assignments ----
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(shopCompanyOrderBookers.map((r) => ({
      'Shop': r.shop.name,
      'Company': r.company.name,
      'Order Booker': r.orderBooker?.name || '-',
      'Shop Type': r.shopType,
    }))), 'Shop Assignments');

    // ---- Credit Limits ----
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(creditLimits.map((cl) => ({
      'Shop': cl.shop.name,
      'Company': cl.company.name,
      'Credit Limit': cl.creditLimit,
    }))), 'Credit Limits');

    // ---- Price History ----
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(priceHistory.map((h) => ({
      'Product': h.product.name,
      'Old Price': h.oldPrice,
      'New Price': h.newPrice,
      'Old Claim Price': h.oldClaimPrice,
      'New Claim Price': h.newClaimPrice,
      'Changed By': h.changedBy || '-',
      'Changed At': d(h.changedAt),
    }))), 'Price History');

    // ---- Attachments (metadata only) ----
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attachments.map((a) => ({
      'Attachment ID': a.id,
      'Claim ID': a.claimId,
      'Type': a.type,
      'Created At': d(a.createdAt),
    }))), 'Attachments');

    // ---- Audit Log ----
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(auditLogs.map((l) => ({
      'Time': d(l.createdAt),
      'User': l.userName || '-',
      'Action': l.action,
      'Entity': l.entity,
      'Entity ID': l.entityId || '-',
      'Details': l.details || '',
    }))), 'Audit Log');

    // Generate file
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const filename = `al-falah-backup-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Excel backup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
