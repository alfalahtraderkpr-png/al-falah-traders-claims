export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const companyId = searchParams.get('companyId');
    const supplierId = searchParams.get('supplierId');
    const orderBookerId = searchParams.get('orderBookerId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const format = searchParams.get('format');

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (companyId) where.companyId = companyId;
    if (supplierId) where.supplierId = supplierId;
    if (orderBookerId) where.orderBookerId = orderBookerId;
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
      where.date = dateFilter;
    }

    const claims = await db.claim.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        company: true,
        shop: true,
        supplier: true,
        orderBooker: true,
        claimItems: {
          include: {
            product: {
              include: { company: true },
            },
          },
        },
      },
    });

    if (format === 'excel') {
      // Generate Excel file
      const rows = claims.map((c) => ({
        'Claim #': c.claimNumber,
        'Date': new Date(c.date).toLocaleDateString(),
        'Company': c.company.name,
        'Shop': c.shop.name,
        'Address': c.shop.address,
        'Supplier': c.supplier.name,
        'Order Booker': c.orderBooker?.name || '',
        'Total Amount': c.totalAmount,
        'Approved Amount': c.approvedAmount || 0,
        'Status': c.status,
        'Cleared By': c.clearedBy || '',
        'Cleared Date': c.clearedDate ? new Date(c.clearedDate).toLocaleDateString() : '',
        'Reject Reason': c.rejectReason || '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Claims');

      // Add summary row
      const summaryStartRow = rows.length + 3;
      XLSX.utils.sheet_add_aoa(ws, [['SUMMARY']], { origin: `A${summaryStartRow}` });
      XLSX.utils.sheet_add_aoa(ws, [['Total Claims', claims.length]], { origin: `A${summaryStartRow + 1}` });
      XLSX.utils.sheet_add_aoa(ws, [['Total Amount', claims.reduce((s, c) => s + c.totalAmount, 0)]], { origin: `A${summaryStartRow + 2}` });
      XLSX.utils.sheet_add_aoa(ws, [['Total Approved', claims.reduce((s, c) => s + (c.approvedAmount || 0), 0)]], { origin: `A${summaryStartRow + 3}` });

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename=claims-report.xlsx',
        },
      });
    }

    // Calculate summary
    const summary = {
      totalClaims: claims.length,
      totalAmount: claims.reduce((s, c) => s + c.totalAmount, 0),
      totalApproved: claims.reduce((s, c) => s + (c.approvedAmount || 0), 0),
      byStatus: {
        pending: claims.filter((c) => c.status === 'pending').length,
        approved: claims.filter((c) => c.status === 'approved').length,
        partial: claims.filter((c) => c.status === 'partial').length,
        cleared: claims.filter((c) => c.status === 'cleared').length,
        rejected: claims.filter((c) => c.status === 'rejected').length,
      },
      // Pending Claims = Stock not received yet
      pendingClaims: {
        count: claims.filter((c) => c.status === 'pending').length,
        totalAmount: claims.filter((c) => c.status === 'pending').reduce((s, c) => s + c.totalAmount, 0),
      },
      // Approved = Stock arrived on floor, payment deduction pending
      approvedClaims: {
        count: claims.filter((c) => c.status === 'approved').length,
        totalAmount: claims.filter((c) => c.status === 'approved').reduce((s, c) => s + c.totalAmount, 0),
        approvedAmount: claims.filter((c) => c.status === 'approved').reduce((s, c) => s + (c.approvedAmount || 0), 0),
      },
      // Stock Not Received = Still at shop (pending status)
      stockNotReceived: {
        count: claims.filter((c) => c.status === 'pending').length,
        totalAmount: claims.filter((c) => c.status === 'pending').reduce((s, c) => s + c.totalAmount, 0),
      },
      // Partially Cleared = Some amount deducted, more pending
      partiallyClearedClaims: {
        count: claims.filter((c) => c.status === 'partial').length,
        totalAmount: claims.filter((c) => c.status === 'partial').reduce((s, c) => s + c.totalAmount, 0),
        approvedAmount: claims.filter((c) => c.status === 'partial').reduce((s, c) => s + (c.approvedAmount || 0), 0),
      },
      // Cleared Claims = Admin has cleared/paid
      clearedClaims: {
        count: claims.filter((c) => c.status === 'cleared').length,
        totalAmount: claims.filter((c) => c.status === 'cleared').reduce((s, c) => s + c.totalAmount, 0),
        approvedAmount: claims.filter((c) => c.status === 'cleared').reduce((s, c) => s + (c.approvedAmount || 0), 0),
      },
    };

    return NextResponse.json({ claims, summary });
  } catch (error) {
    console.error('Reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
