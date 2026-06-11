export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const companyId = searchParams.get('companyId');
    
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (companyId) where.companyId = companyId;
    
    const claims = await db.claim.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        company: true,
        shop: true,
        supplier: true,
        orderBooker: true,
        claimItems: { include: { product: true } },
      },
    });
    
    const rows = claims.map(c => ({
      'Claim #': c.claimNumber,
      'Date': new Date(c.date).toLocaleDateString(),
      'Company': c.company.name,
      'Shop': c.shop.name,
      'Supplier': c.supplier.name,
      'Order Booker': c.orderBooker?.name || '-',
      'Entered By': c.createdBy || '-',
      'Total Amount': c.totalAmount,
      'Deduction': c.deductionAmount,
      'Net Amount': c.netAmount,
      'Approved Amount': c.approvedAmount || 0,
      'Status': c.status,
      'Cleared By': c.clearedBy || '-',
      'Cleared Date': c.clearedDate ? new Date(c.clearedDate).toLocaleDateString() : '-',
    }));
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Claims');
    
    // Add items sheet
    const itemRows = claims.flatMap(c => 
      c.claimItems.map(item => ({
        'Claim #': c.claimNumber,
        'Product': item.product.name,
        'Quantity': item.quantity,
        'Amount': item.amount,
      }))
    );
    const ws2 = XLSX.utils.json_to_sheet(itemRows);
    ws2['!cols'] = [
      { wch: 10 }, { wch: 25 }, { wch: 10 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, 'Claim Items');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=claims-export.xlsx',
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
