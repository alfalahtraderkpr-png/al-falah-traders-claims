export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';
import * as XLSX from 'xlsx';

/**
 * GET /api/export/master?type=shops|companies|suppliers|order-bookers|products
 * Downloads the current (non-deleted) records of a master data list as Excel.
 * Admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'shops';
    const live = { deletedAt: null } as const;

    const wb = XLSX.utils.book_new();
    let sheetName = 'Sheet1';
    let filename = 'export.xlsx';

    if (type === 'shops') {
      const shops = await db.shop.findMany({
        where: live,
        orderBy: { name: 'asc' },
        include: { companyOrderBookers: { include: { company: true, orderBooker: true } } },
      });
      const rows = shops.map((s) => ({
        'Shop Name': s.name,
        'Address': s.address,
        'Phone': s.phone || '',
        'Shop Type': s.shopType,
        'Companies': s.companyOrderBookers.map((m) => m.company.name).join(', '),
        'Order Bookers': s.companyOrderBookers.map((m) => m.orderBooker?.name).filter(Boolean).join(', '),
        'Created At': new Date(s.createdAt).toLocaleDateString(),
      }));
      sheetName = 'Shops';
      filename = 'shops.xlsx';
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
    } else if (type === 'companies') {
      const companies = await db.company.findMany({ where: live, orderBy: { name: 'asc' } });
      const rows = companies.map((c) => ({
        'Company Name': c.name,
        'Multi-Tier Pricing': c.multiTierPricing ? 'Yes' : 'No',
        'Claim Deduction %': c.claimDeductionPercent,
        'Created At': new Date(c.createdAt).toLocaleDateString(),
      }));
      sheetName = 'Companies';
      filename = 'companies.xlsx';
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
    } else if (type === 'suppliers') {
      const suppliers = await db.supplier.findMany({
        where: live,
        orderBy: { name: 'asc' },
        include: { company: true },
      });
      const rows = suppliers.map((s) => ({
        'Supplier Name': s.name,
        'Company': s.company?.name || '-',
        'Created At': new Date(s.createdAt).toLocaleDateString(),
      }));
      sheetName = 'Suppliers';
      filename = 'suppliers.xlsx';
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
    } else if (type === 'order-bookers') {
      const obs = await db.orderBooker.findMany({
        where: live,
        orderBy: { name: 'asc' },
        include: { shopCompanyOrderBookers: { include: { company: true } } },
      });
      const rows = obs.map((o) => ({
        'Order Booker': o.name,
        'Companies': Array.from(new Set(o.shopCompanyOrderBookers.map((m) => m.company.name))).join(', '),
        'Shops': o.shopCompanyOrderBookers.length,
        'Created At': new Date(o.createdAt).toLocaleDateString(),
      }));
      sheetName = 'Order Bookers';
      filename = 'order-bookers.xlsx';
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
    } else if (type === 'products') {
      const products = await db.product.findMany({
        where: live,
        orderBy: [{ company: { name: 'asc' } }, { name: 'asc' }],
        include: { company: true },
      });
      const rows = products.map((p) => ({
        'Product Name': p.name,
        'Company': p.company.name,
        'Price': p.price,
        'Claim Price': p.claimPrice,
        'Wholesale Price': p.wholesalePrice ?? '',
        'LMT Price': p.lmtPrice ?? '',
        'Unit': p.unit,
      }));
      sheetName = 'Products';
      filename = 'products.xlsx';
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="al-falah-${filename.replace('.xlsx', '')}-${stamp}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Master export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
