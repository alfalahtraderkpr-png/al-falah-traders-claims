export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
type Claim = Awaited<ReturnType<typeof fetchClaims>>[number];

async function fetchClaims(filters: {
  status?: string;
  companyId?: string;
  supplierId?: string;
  orderBookerId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filters.status) {
    // Support comma-separated list of statuses (e.g. 'approved,partial')
    if (filters.status.includes(',')) {
      where.status = { in: filters.status.split(',').map(s => s.trim()) };
    } else {
      where.status = filters.status;
    }
  }
  if (filters.companyId) where.companyId = filters.companyId;
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.orderBookerId) where.orderBookerId = filters.orderBookerId;
  if (filters.dateFrom || filters.dateTo) {
    const d: Record<string, Date> = {};
    if (filters.dateFrom) d.gte = new Date(filters.dateFrom);
    if (filters.dateTo) d.lte = new Date(new Date(filters.dateTo).setHours(23, 59, 59, 999));
    where.date = d;
  }

  return db.claim.findMany({
    where,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: {
      company: true,
      shop: true,
      supplier: true,
      orderBooker: true,
      claimItems: { include: { product: true } },
    },
  });
}

function normalizeStatus(s: string) {
  if (s === 'arrived_approved') return 'approved';
  if (s === 'partially_approved' || s === 'partially_cleared') return 'partial';
  return s;
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB');
}

// Styling helper for sheets - adds formatting, borders, column widths
function styleSheet(ws: XLSX.WorkSheet, headers: string[], dataRowCount: number, colWidths: number[]) {
  // Column widths
  ws['!cols'] = colWidths.map(w => ({ wch: w }));

  // Row heights
  ws['!rows'] = [{ hpt: 28 }]; // header row taller

  // Range
  const range = XLSX.utils.decode_range(ws['!ref'] as string);
  const lastCol = range.e.c;

  // Header row styling (row 1)
  for (let c = 0; c <= lastCol; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[cellRef];
    if (cell) {
      cell.s = {
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: '059669' } }, // emerald-600
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: '047857' } },
          bottom: { style: 'medium', color: { rgb: '047857' } },
          left: { style: 'thin', color: { rgb: '047857' } },
          right: { style: 'thin', color: { rgb: '047857' } },
        },
      };
    }
  }

  // Data rows styling
  for (let r = 1; r <= dataRowCount; r++) {
    for (let c = 0; c <= lastCol; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = ws[cellRef];
      if (cell) {
        const isAlt = r % 2 === 0;
        cell.s = {
          font: { name: 'Calibri', sz: 10, color: { rgb: '111827' } },
          fill: isAlt ? { patternType: 'solid', fgColor: { rgb: 'F9FAFB' } } : undefined,
          alignment: { vertical: 'center', wrapText: false },
          border: {
            top: { style: 'thin', color: { rgb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            left: { style: 'thin', color: { rgb: 'E5E7EB' } },
            right: { style: 'thin', color: { rgb: 'E5E7EB' } },
          },
        };
      }
    }
  }
}

// Add a styled "title" sheet (cover page) showing report info
function buildCoverSheet(reportType: string, filters: string[], totalClaims: number) {
  const data: (string | number)[][] = [
    ['AL FALAH TRADERS'],
    ['Claim Management System'],
    [''],
    ['Report Type', reportType.toUpperCase()],
    ['Generated On', new Date().toLocaleString('en-GB')],
    ['Total Claims', totalClaims],
    [''],
    ['Filters Applied'],
  ];
  filters.forEach(f => data.push(['', f]));

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 24 }, { wch: 60 }];
  ws['!rows'] = [
    { hpt: 36 }, // AL FALAH TRADERS
    { hpt: 22 }, // subtitle
    { hpt: 8 },
    { hpt: 22 }, // report type
    { hpt: 22 },
    { hpt: 22 },
    { hpt: 8 },
    { hpt: 22 }, // Filters Applied
  ];

  // Style title cells
  if (ws['A1']) {
    ws['A1'].s = {
      font: { name: 'Calibri', sz: 22, bold: true, color: { rgb: '047857' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }
  if (ws['A2']) {
    ws['A2'].s = {
      font: { name: 'Calibri', sz: 12, italic: true, color: { rgb: '6B7280' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }
  // Style label cells
  ['A4', 'A5', 'A6', 'A8'].forEach(ref => {
    if (ws[ref]) {
      ws[ref].s = {
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '374151' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'D1D5DB' } },
          bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
          left: { style: 'thin', color: { rgb: 'D1D5DB' } },
          right: { style: 'thin', color: { rgb: 'D1D5DB' } },
        },
      };
    }
  });
  // Style value cells
  ['B4', 'B5', 'B6'].forEach(ref => {
    if (ws[ref]) {
      ws[ref].s = {
        font: { name: 'Calibri', sz: 11, color: { rgb: '111827' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'D1D5DB' } },
          bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
          left: { style: 'thin', color: { rgb: 'D1D5DB' } },
          right: { style: 'thin', color: { rgb: 'D1D5DB' } },
        },
      };
    }
  });

  // Filter rows
  for (let i = 9; i < 9 + filters.length; i++) {
    const ref = `B${i}`;
    if (ws[ref]) {
      ws[ref].s = {
        font: { name: 'Calibri', sz: 10, color: { rgb: '4B5563' } },
        alignment: { horizontal: 'left', vertical: 'center' },
      };
    }
  }

  return ws;
}

function buildSummarySheet(claims: Claim[]) {
  const byStatus = (s: string) => claims.filter(c => normalizeStatus(c.status) === s);
  const pending = byStatus('pending');
  const approved = byStatus('approved');
  const partial = byStatus('partial');
  const cleared = byStatus('cleared');
  const rejected = byStatus('rejected');

  const totalAmount = claims.reduce((s, c) => s + c.totalAmount, 0);
  const totalApproved = claims.reduce((s, c) => s + (c.approvedAmount || 0), 0);
  const totalNet = claims.reduce((s, c) => s + c.netAmount, 0);

  const data = [
    ['Status', 'Count', 'Total Amount (Rs.)', 'Approved Amount (Rs.)', 'Net Amount (Rs.)', '% of Total'],
    ['Pending', pending.length, pending.reduce((s, c) => s + c.totalAmount, 0), 0, pending.reduce((s, c) => s + c.netAmount, 0), pct(pending.length, claims.length) + '%'],
    ['Approved', approved.length, approved.reduce((s, c) => s + c.totalAmount, 0), 0, approved.reduce((s, c) => s + c.netAmount, 0), pct(approved.length, claims.length) + '%'],
    ['Partial', partial.length, partial.reduce((s, c) => s + c.totalAmount, 0), partial.reduce((s, c) => s + (c.approvedAmount || 0), 0), partial.reduce((s, c) => s + c.netAmount, 0), pct(partial.length, claims.length) + '%'],
    ['Cleared', cleared.length, cleared.reduce((s, c) => s + c.totalAmount, 0), cleared.reduce((s, c) => s + (c.approvedAmount || 0), 0), cleared.reduce((s, c) => s + c.netAmount, 0), pct(cleared.length, claims.length) + '%'],
    ['Rejected', rejected.length, rejected.reduce((s, c) => s + c.totalAmount, 0), 0, rejected.reduce((s, c) => s + c.netAmount, 0), pct(rejected.length, claims.length) + '%'],
    ['', '', '', '', '', ''],
    ['GRAND TOTAL', claims.length, totalAmount, totalApproved, totalNet, '100%'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  styleSheet(ws, [], data.length - 1, [16, 12, 22, 22, 22, 12]);

  // Total row (last row) special styling
  const totalRow = data.length - 1; // 0-indexed
  for (let c = 0; c < 6; c++) {
    const ref = XLSX.utils.encode_cell({ r: totalRow, c });
    if (ws[ref]) {
      ws[ref].s = {
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: '047857' } },
        alignment: { horizontal: c === 0 ? 'left' : 'right', vertical: 'center' },
        border: {
          top: { style: 'medium', color: { rgb: '047857' } },
          bottom: { style: 'medium', color: { rgb: '047857' } },
          left: { style: 'thin', color: { rgb: '047857' } },
          right: { style: 'thin', color: { rgb: '047857' } },
        },
      };
    }
  }

  return ws;
}

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

function buildClaimsSheet(claims: Claim[]) {
  const rows = claims.map((c, i) => ({
    '#': i + 1,
    'Claim #': c.claimNumber,
    'Date': fmtDate(c.date),
    'Company': c.company.name,
    'Shop': c.shop.name,
    'Shop Address': c.shop.address || '',
    'Supplier': c.supplier.name,
    'Order Booker': c.orderBooker?.name || '',
    'Items Count': c.claimItems.length,
    'Gross Amount': c.totalAmount,
    'Deduction': c.deductionAmount,
    'Net Amount': c.netAmount,
    'Approved Amount': c.approvedAmount || 0,
    'Status': normalizeStatus(c.status),
    'Cleared By': c.clearedBy || '',
    'Cleared Date': c.clearedDate ? fmtDate(c.clearedDate) : '',
    'Reject Reason': c.rejectReason || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  styleSheet(ws, [], rows.length, [6, 16, 12, 16, 18, 22, 14, 16, 8, 14, 12, 14, 14, 12, 16, 12, 22]);
  return ws;
}

function buildItemsSheet(claims: Claim[]) {
  const rows: any[] = [];
  let idx = 1;
  claims.forEach(c => {
    c.claimItems.forEach(item => {
      rows.push({
        '#': idx++,
        'Claim #': c.claimNumber,
        'Date': fmtDate(c.date),
        'Company': c.company.name,
        'Shop': c.shop.name,
        'Product': item.product.name,
        'Unit': item.product.unit,
        'Quantity': item.quantity,
        'Rate (Rs.)': Math.round(item.amount / Math.max(item.quantity, 1)),
        'Amount (Rs.)': item.amount,
        'Claim Status': normalizeStatus(c.status),
      });
    });
  });

  if (rows.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['No items found']]);
    return ws;
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  styleSheet(ws, [], rows.length, [6, 16, 12, 16, 18, 24, 8, 10, 12, 14, 14]);
  return ws;
}

function buildCompanyBreakdownSheet(claims: Claim[]) {
  const groups = new Map<string, Claim[]>();
  for (const c of claims) {
    const arr = groups.get(c.company.name) || [];
    arr.push(c);
    groups.set(c.company.name, arr);
  }
  const rows = Array.from(groups.entries()).map(([name, items], i) => ({
    '#': i + 1,
    'Company': name,
    'Total Claims': items.length,
    'Pending': items.filter(c => normalizeStatus(c.status) === 'pending').length,
    'Approved': items.filter(c => normalizeStatus(c.status) === 'approved').length,
    'Partial': items.filter(c => normalizeStatus(c.status) === 'partial').length,
    'Cleared': items.filter(c => normalizeStatus(c.status) === 'cleared').length,
    'Rejected': items.filter(c => normalizeStatus(c.status) === 'rejected').length,
    'Gross Amount (Rs.)': items.reduce((s, c) => s + c.totalAmount, 0),
    'Deduction (Rs.)': items.reduce((s, c) => s + c.deductionAmount, 0),
    'Net Amount (Rs.)': items.reduce((s, c) => s + c.netAmount, 0),
    'Cleared Amount (Rs.)': items.reduce((s, c) => s + (c.approvedAmount || 0), 0),
  })).sort((a, b) => b['Gross Amount (Rs.)'] - a['Gross Amount (Rs.)']);

  // Add grand total row
  rows.push({
    '#': 0 as any,
    'Company': 'GRAND TOTAL',
    'Total Claims': rows.reduce((s, r) => s + r['Total Claims'], 0),
    'Pending': rows.reduce((s, r) => s + r['Pending'], 0),
    'Approved': rows.reduce((s, r) => s + r['Approved'], 0),
    'Partial': rows.reduce((s, r) => s + r['Partial'], 0),
    'Cleared': rows.reduce((s, r) => s + r['Cleared'], 0),
    'Rejected': rows.reduce((s, r) => s + r['Rejected'], 0),
    'Gross Amount (Rs.)': rows.reduce((s, r) => s + r['Gross Amount (Rs.)'], 0),
    'Deduction (Rs.)': rows.reduce((s, r) => s + r['Deduction (Rs.)'], 0),
    'Net Amount (Rs.)': rows.reduce((s, r) => s + r['Net Amount (Rs.)'], 0),
    'Cleared Amount (Rs.)': rows.reduce((s, r) => s + r['Cleared Amount (Rs.)'], 0),
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  styleSheet(ws, [], rows.length, [6, 24, 12, 10, 10, 10, 10, 10, 18, 16, 16, 18]);

  // Total row styling
  const totalRowIdx = rows.length; // 0-indexed row in sheet (header is row 0, data starts row 1)
  const lastCol = 12; // 12 columns
  for (let c = 0; c < lastCol; c++) {
    const ref = XLSX.utils.encode_cell({ r: totalRowIdx, c });
    if (ws[ref]) {
      ws[ref].s = {
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: '047857' } },
        alignment: { horizontal: c === 1 ? 'left' : 'right', vertical: 'center' },
      };
    }
  }
  return ws;
}

function buildOrderBookerSheet(claims: Claim[]) {
  const groups = new Map<string, Claim[]>();
  for (const c of claims) {
    const key = c.orderBooker?.name || 'Unassigned';
    const arr = groups.get(key) || [];
    arr.push(c);
    groups.set(key, arr);
  }
  const rows = Array.from(groups.entries()).map(([name, items], i) => ({
    '#': i + 1,
    'Order Booker': name,
    'Total Claims': items.length,
    'Pending': items.filter(c => normalizeStatus(c.status) === 'pending').length,
    'Approved': items.filter(c => normalizeStatus(c.status) === 'approved').length,
    'Partial': items.filter(c => normalizeStatus(c.status) === 'partial').length,
    'Cleared': items.filter(c => normalizeStatus(c.status) === 'cleared').length,
    'Rejected': items.filter(c => normalizeStatus(c.status) === 'rejected').length,
    'Gross Amount (Rs.)': items.reduce((s, c) => s + c.totalAmount, 0),
    'Cleared Amount (Rs.)': items.reduce((s, c) => s + (c.approvedAmount || 0), 0),
    'Pending Amount (Rs.)': items.reduce((s, c) => s + (c.totalAmount - (c.approvedAmount || 0)), 0),
  })).sort((a, b) => b['Gross Amount (Rs.)'] - a['Gross Amount (Rs.)']);

  rows.push({
    '#': 0 as any,
    'Order Booker': 'GRAND TOTAL',
    'Total Claims': rows.reduce((s, r) => s + r['Total Claims'], 0),
    'Pending': rows.reduce((s, r) => s + r['Pending'], 0),
    'Approved': rows.reduce((s, r) => s + r['Approved'], 0),
    'Partial': rows.reduce((s, r) => s + r['Partial'], 0),
    'Cleared': rows.reduce((s, r) => s + r['Cleared'], 0),
    'Rejected': rows.reduce((s, r) => s + r['Rejected'], 0),
    'Gross Amount (Rs.)': rows.reduce((s, r) => s + r['Gross Amount (Rs.)'], 0),
    'Cleared Amount (Rs.)': rows.reduce((s, r) => s + r['Cleared Amount (Rs.)'], 0),
    'Pending Amount (Rs.)': rows.reduce((s, r) => s + r['Pending Amount (Rs.)'], 0),
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  styleSheet(ws, [], rows.length, [6, 22, 12, 10, 10, 10, 10, 10, 18, 18, 18]);

  const totalRowIdx = rows.length;
  const lastCol = 11;
  for (let c = 0; c < lastCol; c++) {
    const ref = XLSX.utils.encode_cell({ r: totalRowIdx, c });
    if (ws[ref]) {
      ws[ref].s = {
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: '047857' } },
        alignment: { horizontal: c === 1 ? 'left' : 'right', vertical: 'center' },
      };
    }
  }
  return ws;
}

function buildAgingSheet(claims: Claim[]) {
  const now = Date.now();
  const buckets = [
    { label: '0-7 days', min: 0, max: 7 * 86400000 },
    { label: '8-15 days', min: 7 * 86400000 + 1, max: 15 * 86400000 },
    { label: '16-30 days', min: 15 * 86400000 + 1, max: 30 * 86400000 },
    { label: '31-60 days', min: 30 * 86400000 + 1, max: 60 * 86400000 },
    { label: '60+ days', min: 60 * 86400000 + 1, max: Infinity },
  ];
  const counts = buckets.map(() => ({ count: 0, amount: 0 }));
  const open = claims.filter(c => normalizeStatus(c.status) !== 'cleared' && normalizeStatus(c.status) !== 'rejected');
  for (const c of open) {
    const age = now - new Date(c.date).getTime();
    for (let i = 0; i < buckets.length; i++) {
      if (age >= buckets[i].min && age <= buckets[i].max) {
        counts[i].count++;
        counts[i].amount += c.totalAmount;
        break;
      }
    }
  }

  const rows = buckets.map((b, i) => ({
    'Aging Bucket': b.label,
    'Open Claims': counts[i].count,
    'Amount (Rs.)': counts[i].amount,
    '% of Open': pct(counts[i].count, open.length) + '%',
  }));
  rows.push({
    'Aging Bucket': 'GRAND TOTAL',
    'Open Claims': open.length,
    'Amount (Rs.)': counts.reduce((s, x) => s + x.amount, 0),
    '% of Open': '100%',
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  styleSheet(ws, [], rows.length, [22, 16, 20, 14]);

  const totalRowIdx = rows.length;
  for (let c = 0; c < 4; c++) {
    const ref = XLSX.utils.encode_cell({ r: totalRowIdx, c });
    if (ws[ref]) {
      ws[ref].s = {
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: '047857' } },
        alignment: { horizontal: c === 0 ? 'left' : 'right', vertical: 'center' },
      };
    }
  }
  return ws;
}

// ─────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'all';
    const status = searchParams.get('status') || undefined;
    const companyId = searchParams.get('companyId') || undefined;
    const supplierId = searchParams.get('supplierId') || undefined;
    const orderBookerId = searchParams.get('orderBookerId') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;

    const claims = await fetchClaims({ status, companyId, supplierId, orderBookerId, dateFrom, dateTo });

    // Build filter labels
    const filterLabels: string[] = [];
    if (status) filterLabels.push(`Status: ${status}`);
    if (companyId) {
      const c = await db.company.findUnique({ where: { id: companyId } });
      if (c) filterLabels.push(`Company: ${c.name}`);
    }
    if (supplierId) {
      const s = await db.supplier.findUnique({ where: { id: supplierId } });
      if (s) filterLabels.push(`Supplier: ${s.name}`);
    }
    if (orderBookerId) {
      const ob = await db.orderBooker.findUnique({ where: { id: orderBookerId } });
      if (ob) filterLabels.push(`Order Booker: ${ob.name}`);
    }
    if (dateFrom) filterLabels.push(`From: ${fmtDate(dateFrom)}`);
    if (dateTo) filterLabels.push(`To: ${fmtDate(dateTo)}`);
    if (filterLabels.length === 0) filterLabels.push('All data (no filters)');

    // Build workbook
    const wb = XLSX.utils.book_new();

    // 1. Cover sheet
    const cover = buildCoverSheet(reportType, filterLabels, claims.length);
    XLSX.utils.book_append_sheet(wb, cover, 'Report Info');

    // 2. Summary sheet (always included)
    const summary = buildSummarySheet(claims);
    XLSX.utils.book_append_sheet(wb, summary, 'Summary');

    // 3. Specific report sheets based on type
    if (reportType === 'all' || reportType === 'pending') {
      const pending = claims.filter(c => normalizeStatus(c.status) === 'pending');
      const ws = buildClaimsSheet(pending);
      XLSX.utils.book_append_sheet(wb, ws, 'Pending Claims');
    }
    if (reportType === 'all' || reportType === 'approved') {
      // Approved + partial — stock has arrived on floor, payment still pending
      const approved = claims.filter(c => {
        const s = normalizeStatus(c.status);
        return s === 'approved' || s === 'partial';
      });
      const ws = buildClaimsSheet(approved);
      XLSX.utils.book_append_sheet(wb, ws, 'Approved Claims');
    }
    if (reportType === 'all' || reportType === 'cleared') {
      const cleared = claims.filter(c => normalizeStatus(c.status) === 'cleared');
      const ws = buildClaimsSheet(cleared);
      XLSX.utils.book_append_sheet(wb, ws, 'Cleared Claims');
    }
    if (reportType === 'all' || reportType === 'detail') {
      const ws = buildItemsSheet(claims);
      XLSX.utils.book_append_sheet(wb, ws, 'All Items');
    }
    if (reportType === 'all' || reportType === 'company') {
      const ws = buildCompanyBreakdownSheet(claims);
      XLSX.utils.book_append_sheet(wb, ws, 'By Company');
    }
    if (reportType === 'all' || reportType === 'order-booker') {
      const ws = buildOrderBookerSheet(claims);
      XLSX.utils.book_append_sheet(wb, ws, 'By Order Booker');
    }
    if (reportType === 'all' || reportType === 'aging') {
      const ws = buildAgingSheet(claims);
      XLSX.utils.book_append_sheet(wb, ws, 'Aging');
    }

    // Always add full claims list as last sheet (reference)
    const fullSheet = buildClaimsSheet(claims);
    XLSX.utils.book_append_sheet(wb, fullSheet, 'All Claims');

    const filename = `al-falah-${reportType}-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Excel export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate Excel: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
