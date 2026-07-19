export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    // OR a single status string.
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
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMoney(n: number | null | undefined) {
  const v = Number(n || 0);
  return 'Rs. ' + v.toLocaleString('en-PK');
}

// ─────────────────────────────────────────────
// PDF Document Setup
// ─────────────────────────────────────────────
const COLORS = {
  primary: [5, 150, 105] as [number, number, number],      // emerald-600
  primaryDark: [4, 120, 87] as [number, number, number],   // emerald-700
  primaryLight: [209, 250, 229] as [number, number, number], // emerald-50
  gray: [107, 114, 128] as [number, number, number],       // gray-500
  grayLight: [243, 244, 246] as [number, number, number],  // gray-100
  grayDark: [55, 65, 81] as [number, number, number],      // gray-700
  white: [255, 255, 255] as [number, number, number],
  black: [17, 24, 39] as [number, number, number],
  yellow: [254, 243, 199] as [number, number, number],
  green: [220, 252, 231] as [number, number, number],
  orange: [254, 215, 170] as [number, number, number],
  blue: [219, 234, 254] as [number, number, number],
  red: [254, 226, 226] as [number, number, number],
};

function addHeader(doc: jsPDF, title: string, filters: string[], generatedAt: string) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Top brand strip — compact (height 22 instead of 28) so table gets more space
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 22, 'F');

  // Brand mark "AF"
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(12, 5, 12, 12, 2, 2, 'F');
  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('AF', 18, 13, { align: 'center' });

  // Company name + report title (compact font sizes)
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('AL FALAH TRADERS', 28, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Claim Management System', 28, 17);

  // Right side: report title + generated date
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, pageWidth - 12, 11, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(220, 255, 220);
  doc.text(`Generated: ${generatedAt}`, pageWidth - 12, 17, { align: 'right' });

  // Filters box (if any) — compact, single line if possible
  let y = 28;
  if (filters.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.grayDark);
    doc.text('Filters:', 12, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    const filterText = filters.join('   |   ');
    const wrappedFilters = doc.splitTextToSize(filterText, pageWidth - 50);
    doc.text(wrappedFilters, 38, y);
    y += 3 + wrappedFilters.length * 3.5;
  }

  return y;
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Footer line
    doc.setDrawColor(...COLORS.grayLight);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);

    // Left: copyright
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray);
    doc.text('AL FALAH TRADERS - Confidential', 14, pageHeight - 9);

    // Center: generated
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 9, { align: 'center' });

    // Right: system tag
    doc.text('Claim Management System', pageWidth - 14, pageHeight - 9, { align: 'right' });
  }
}

function addSummaryBoxes(
  doc: jsPDF,
  y: number,
  boxes: { label: string; value: string; bg: [number, number, number]; fg: [number, number, number] }[]
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const gap = 4;
  const boxW = (pageWidth - 28 - gap * (boxes.length - 1)) / boxes.length;
  // Compact boxes (height 18 instead of 22) so table starts higher on page
  const boxH = 18;

  boxes.forEach((b, i) => {
    const x = 14 + i * (boxW + gap);
    doc.setFillColor(...b.bg);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, 'F');
    doc.setTextColor(...COLORS.gray);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(b.label.toUpperCase(), x + 4, y + 6);
    doc.setTextColor(...b.fg);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(b.value, x + 4, y + 14);
  });

  return y + boxH + 4;
}

// ─────────────────────────────────────────────
// Report Generators
// ─────────────────────────────────────────────

function reportPending(doc: jsPDF, claims: Claim[], filters: string[]) {
  const data = claims.filter(c => normalizeStatus(c.status) === 'pending');
  const total = data.reduce((s, c) => s + (c.netAmount || c.totalAmount), 0);
  const generatedAt = new Date().toLocaleString('en-GB');

  let y = addHeader(doc, 'Pending Claims Report', filters, generatedAt);
  y = addSummaryBoxes(doc, y, [
    { label: 'Pending Claims', value: String(data.length), bg: COLORS.yellow, fg: COLORS.primaryDark },
    { label: 'Total Amount', value: fmtMoney(total), bg: COLORS.primaryLight, fg: COLORS.primaryDark },
    { label: 'Avg Per Claim', value: data.length ? fmtMoney(total / data.length) : 'Rs. 0', bg: COLORS.grayLight, fg: COLORS.grayDark },
  ]);

  if (data.length === 0) {
    doc.setTextColor(...COLORS.gray);
    doc.setFontSize(11);
    doc.text('No pending claims found.', 14, y + 10);
    return;
  }

  // Short date format
  const fmtShortDate = (d: Date | string) => {
    const date = new Date(d);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  autoTable(doc, {
    startY: y,
    head: [['#', 'Claim #', 'Date', 'Company', 'Shop', 'Supplier', 'Order Booker', 'Items', 'Amount']],
    body: data.map((c, i) => [
      String(i + 1),
      c.claimNumber,
      fmtShortDate(c.date),
      c.company.name,
      c.shop.name,
      c.supplier.name,
      c.orderBooker?.name || '-',
      String(c.claimItems.length),
      { content: fmtMoney(c.netAmount || c.totalAmount), styles: { halign: 'right' } },
    ]),
    foot: [['', '', '', '', '', '', '', 'Grand Total:', { content: fmtMoney(total), styles: { halign: 'right', textColor: COLORS.white } }]],
    // Show Grand Total row ONLY on the LAST page (not every page)
    showFoot: 'lastPage',
    // Repeat table header on every page
    showHead: 'everyPage',
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      valign: 'middle',
      cellPadding: 3,
    },
    footStyles: {
      fillColor: COLORS.primaryDark,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'right',
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: COLORS.black,
      valign: 'middle',
      cellPadding: 1.5,
      overflow: 'linebreak',
    },
    alternateRowStyles: { fillColor: COLORS.grayLight },
    // Column widths STRETCHED to fill full landscape A4 page width.
    // Landscape A4 usable width = 273mm; total = 12+22+18+28+52+24+35+12+32 = 235mm
    // (autoTable will proportionally distribute the extra ~38mm to columns)
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontSize: 8 },        // #
      1: { cellWidth: 22, halign: 'center', textColor: COLORS.primary, fontStyle: 'bold' },  // Claim #
      2: { cellWidth: 18, halign: 'center' },                      // Date
      3: { cellWidth: 28, fontStyle: 'bold' },                     // Company
      4: { cellWidth: 52 },                                         // Shop (widest)
      5: { cellWidth: 24, halign: 'center' },                       // Supplier
      6: { cellWidth: 35 },                                         // Order Booker
      7: { cellWidth: 12, halign: 'center' },                       // Items
      8: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },     // Amount
    },
    margin: { left: 12, right: 12, top: 14, bottom: 18 },
    didDrawPage: () => addFooter(doc),
  });
}

// ─────────────────────────────────────────────
// Approved Claims Report (stock arrived on floor, payment pending)
// Used by the 'Pending Claims (Arrived)' tab in the Reports page
// Uses LANDSCAPE orientation for better column fit
// ─────────────────────────────────────────────

function reportApproved(doc: jsPDF, claims: Claim[], filters: string[]) {
  // Show approved AND partial claims (both have stock arrived, payment not yet cleared)
  const data = claims.filter(c => {
    const s = normalizeStatus(c.status);
    return s === 'approved' || s === 'partial';
  });
  const total = data.reduce((s, c) => s + (c.approvedAmount || c.netAmount || c.totalAmount), 0);
  const generatedAt = new Date().toLocaleString('en-GB');

  let y = addHeader(doc, 'Approved Claims Report (Stock Arrived)', filters, generatedAt);
  y = addSummaryBoxes(doc, y, [
    { label: 'Approved Claims', value: String(data.length), bg: COLORS.green, fg: COLORS.primaryDark },
    { label: 'Total Approved Amount', value: fmtMoney(total), bg: COLORS.primaryLight, fg: COLORS.primaryDark },
    { label: 'Avg Per Claim', value: data.length ? fmtMoney(total / data.length) : 'Rs. 0', bg: COLORS.grayLight, fg: COLORS.grayDark },
  ]);

  if (data.length === 0) {
    doc.setTextColor(...COLORS.gray);
    doc.setFontSize(11);
    doc.text('No approved claims found. Stock not yet received at distribution.', 14, y + 10);
    return;
  }

  // Short date format for compact column (e.g., "19/07/26")
  const fmtShortDate = (d: Date | string) => {
    const date = new Date(d);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  autoTable(doc, {
    startY: y,
    head: [['#', 'Claim #', 'Date', 'Company', 'Shop', 'Supplier', 'Order Booker', 'Status', 'Items', 'Approved Amount']],
    body: data.map((c, i) => {
      const s = normalizeStatus(c.status);
      const statusLabel = s === 'partial' ? 'Partial' : 'Approved';
      const amt = c.approvedAmount != null ? c.approvedAmount : (c.netAmount || c.totalAmount);
      return [
        String(i + 1),
        c.claimNumber,
        fmtShortDate(c.date),
        c.company.name,
        c.shop.name,
        c.supplier.name,
        c.orderBooker?.name || '-',
        statusLabel,
        String(c.claimItems.length),
        { content: fmtMoney(amt), styles: { halign: 'right' } },
      ];
    }),
    foot: [['', '', '', '', '', '', '', '', 'Grand Total:', { content: fmtMoney(total), styles: { halign: 'right', textColor: COLORS.white } }]],
    // Show Grand Total row ONLY on the LAST page (not every page)
    showFoot: 'lastPage',
    // Repeat table header on every page (so users know what each column is)
    showHead: 'everyPage',
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      valign: 'middle',
      cellPadding: 3,
    },
    footStyles: {
      fillColor: COLORS.primaryDark,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'right',
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: COLORS.black,
      valign: 'middle',
      cellPadding: 1.5,
      overflow: 'linebreak',
    },
    alternateRowStyles: { fillColor: COLORS.grayLight },
    // Column widths STRETCHED to fill full landscape A4 page width.
    // Landscape A4 = 297mm; margins 12+12 = 24mm; usable = 273mm
    // Total = 12+22+18+28+52+24+35+24+12+32 = 259mm (fills page, auto-fit handles rounding)
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontSize: 8 },        // #
      1: { cellWidth: 22, halign: 'center', textColor: COLORS.primary, fontStyle: 'bold' },  // Claim #
      2: { cellWidth: 18, halign: 'center' },                      // Date
      3: { cellWidth: 28, fontStyle: 'bold' },                     // Company
      4: { cellWidth: 52 },                                         // Shop (widest)
      5: { cellWidth: 24, halign: 'center' },                       // Supplier
      6: { cellWidth: 35 },                                         // Order Booker
      7: { cellWidth: 24, halign: 'center' },                       // Status
      8: { cellWidth: 12, halign: 'center' },                       // Items
      9: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },     // Approved Amount
    },
    // Tight margins so the table fills the full page width
    margin: { left: 12, right: 12, top: 14, bottom: 18 },
    didDrawPage: () => addFooter(doc),
    didParseCell: (data) => {
      // Color-code the Status column (7) for visual emphasis
      if (data.section === 'body' && data.column.index === 7) {
        const val = String(data.cell.text[0] || '');
        if (val === 'Approved') {
          data.cell.styles.textColor = [4, 120, 87]; // emerald-700
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'Partial') {
          data.cell.styles.textColor = [180, 83, 9]; // amber-700
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });
}

function reportSummary(doc: jsPDF, claims: Claim[], filters: string[]) {
  const generatedAt = new Date().toLocaleString('en-GB');
  let y = addHeader(doc, 'Claims Summary Report', filters, generatedAt);

  const byStatus = (s: string) => claims.filter(c => normalizeStatus(c.status) === s);
  const pending = byStatus('pending');
  const approved = byStatus('approved');
  const partial = byStatus('partial');
  const cleared = byStatus('cleared');
  const rejected = byStatus('rejected');

  const totalAmount = claims.reduce((s, c) => s + c.totalAmount, 0);
  const totalApproved = claims.reduce((s, c) => s + (c.approvedAmount || 0), 0);

  y = addSummaryBoxes(doc, y, [
    { label: 'Total Claims', value: String(claims.length), bg: COLORS.primaryLight, fg: COLORS.primaryDark },
    { label: 'Total Amount', value: fmtMoney(totalAmount), bg: COLORS.grayLight, fg: COLORS.grayDark },
    { label: 'Cleared', value: fmtMoney(totalApproved), bg: COLORS.blue, fg: COLORS.primaryDark },
    { label: 'Pending', value: fmtMoney(pending.reduce((s, c) => s + c.totalAmount, 0)), bg: COLORS.yellow, fg: COLORS.primaryDark },
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Status', 'Count', 'Total Amount', 'Approved Amount', '% of Total']],
    body: [
      ['Pending', pending.length, fmtMoney(pending.reduce((s, c) => s + c.totalAmount, 0)), '-', pct(pending.length, claims.length)],
      ['Approved', approved.length, fmtMoney(approved.reduce((s, c) => s + c.totalAmount, 0)), '-', pct(approved.length, claims.length)],
      ['Partial', partial.length, fmtMoney(partial.reduce((s, c) => s + c.totalAmount, 0)), fmtMoney(partial.reduce((s, c) => s + (c.approvedAmount || 0), 0)), pct(partial.length, claims.length)],
      ['Cleared', cleared.length, fmtMoney(cleared.reduce((s, c) => s + c.totalAmount, 0)), fmtMoney(cleared.reduce((s, c) => s + (c.approvedAmount || 0), 0)), pct(cleared.length, claims.length)],
      ['Rejected', rejected.length, fmtMoney(rejected.reduce((s, c) => s + c.totalAmount, 0)), '-', pct(rejected.length, claims.length)],
    ],
    foot: [['Total', claims.length, fmtMoney(totalAmount), fmtMoney(totalApproved), '100%']],
    showFoot: 'lastPage',
    showHead: 'everyPage',
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 10 },
    footStyles: { fillColor: COLORS.primaryDark, textColor: COLORS.white, fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 10, textColor: COLORS.black },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 40, halign: 'right' },
      3: { cellWidth: 40, halign: 'right' },
      4: { cellWidth: 30, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
    styles: { cellPadding: 4 },
  });
}

function pct(n: number, total: number) {
  if (!total) return '0%';
  return Math.round((n / total) * 100) + '%';
}

function reportAging(doc: jsPDF, claims: Claim[], filters: string[]) {
  const generatedAt = new Date().toLocaleString('en-GB');
  let y = addHeader(doc, 'Claims Aging Report', filters, generatedAt);

  const now = Date.now();
  const buckets = [
    { label: '0-7 days', min: 0, max: 7 * 86400000, claims: [] as Claim[] },
    { label: '8-15 days', min: 7 * 86400000 + 1, max: 15 * 86400000, claims: [] as Claim[] },
    { label: '16-30 days', min: 15 * 86400000 + 1, max: 30 * 86400000, claims: [] as Claim[] },
    { label: '31-60 days', min: 30 * 86400000 + 1, max: 60 * 86400000, claims: [] as Claim[] },
    { label: '60+ days', min: 60 * 86400000 + 1, max: Infinity, claims: [] as Claim[] },
  ];

  const open = claims.filter(c => normalizeStatus(c.status) !== 'cleared' && normalizeStatus(c.status) !== 'rejected');
  for (const c of open) {
    const age = now - new Date(c.date).getTime();
    for (const b of buckets) {
      if (age >= b.min && age <= b.max) { b.claims.push(c); break; }
    }
  }

  const totalOpen = open.reduce((s, c) => s + c.totalAmount, 0);

  y = addSummaryBoxes(doc, y, [
    { label: 'Open Claims', value: String(open.length), bg: COLORS.yellow, fg: COLORS.primaryDark },
    { label: 'Open Amount', value: fmtMoney(totalOpen), bg: COLORS.primaryLight, fg: COLORS.primaryDark },
    { label: 'Oldest Bucket', value: buckets.find(b => b.claims.length > 0)?.label || '-', bg: COLORS.grayLight, fg: COLORS.grayDark },
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Aging Bucket', 'Count', 'Total Amount', '% of Open']],
    body: buckets.map(b => [
      b.label,
      b.claims.length,
      fmtMoney(b.claims.reduce((s, c) => s + c.totalAmount, 0)),
      pct(b.claims.length, open.length),
    ]),
    foot: [['Total Open', open.length, fmtMoney(totalOpen), '100%']],
    showFoot: 'lastPage',
    showHead: 'everyPage',
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 10 },
    footStyles: { fillColor: COLORS.primaryDark, textColor: COLORS.white, fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 10, textColor: COLORS.black },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold' },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 50, halign: 'right' },
      3: { cellWidth: 30, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
    styles: { cellPadding: 4 },
  });
}

function reportCleared(doc: jsPDF, claims: Claim[], filters: string[]) {
  const data = claims.filter(c => normalizeStatus(c.status) === 'cleared');
  const total = data.reduce((s, c) => s + (c.approvedAmount || c.netAmount || c.totalAmount), 0);
  const generatedAt = new Date().toLocaleString('en-GB');

  let y = addHeader(doc, 'Cleared Claims Report', filters, generatedAt);
  y = addSummaryBoxes(doc, y, [
    { label: 'Cleared Claims', value: String(data.length), bg: COLORS.blue, fg: COLORS.primaryDark },
    { label: 'Total Settled', value: fmtMoney(total), bg: COLORS.primaryLight, fg: COLORS.primaryDark },
    { label: 'Avg Settlement', value: data.length ? fmtMoney(total / data.length) : 'Rs. 0', bg: COLORS.grayLight, fg: COLORS.grayDark },
  ]);

  if (data.length === 0) {
    doc.setTextColor(...COLORS.gray);
    doc.setFontSize(11);
    doc.text('No cleared claims found.', 14, y + 10);
    return;
  }

  autoTable(doc, {
    startY: y,
    head: [['#', 'Claim #', 'Date', 'Company', 'Shop', 'Cleared By', 'Cleared Date', 'Amount']],
    body: data.map((c, i) => [
      i + 1,
      c.claimNumber,
      fmtDate(c.date),
      c.company.name,
      c.shop.name,
      c.clearedBy || '-',
      c.clearedDate ? fmtDate(c.clearedDate) : '-',
      { content: fmtMoney(c.approvedAmount || c.netAmount || c.totalAmount), styles: { halign: 'right' } },
    ]),
    foot: [['', '', '', '', '', '', 'Grand Total:', { content: fmtMoney(total), styles: { halign: 'right', textColor: COLORS.white } }]],
    showFoot: 'lastPage',
    showHead: 'everyPage',
    theme: 'striped',
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
    footStyles: { fillColor: COLORS.primaryDark, textColor: COLORS.white, fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 9, textColor: COLORS.black },
    alternateRowStyles: { fillColor: COLORS.grayLight },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 30, textColor: COLORS.primary, fontStyle: 'bold' },
      7: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
    styles: { cellPadding: 3 },
  });
}

function reportDetail(doc: jsPDF, claims: Claim[], filters: string[]) {
  const generatedAt = new Date().toLocaleString('en-GB');
  let y = addHeader(doc, 'Detailed Claims Report', filters, generatedAt);

  const totalAmount = claims.reduce((s, c) => s + c.totalAmount, 0);
  const totalNet = claims.reduce((s, c) => s + c.netAmount, 0);

  y = addSummaryBoxes(doc, y, [
    { label: 'Total Claims', value: String(claims.length), bg: COLORS.primaryLight, fg: COLORS.primaryDark },
    { label: 'Gross Amount', value: fmtMoney(totalAmount), bg: COLORS.grayLight, fg: COLORS.grayDark },
    { label: 'Net Amount', value: fmtMoney(totalNet), bg: COLORS.blue, fg: COLORS.primaryDark },
  ]);

  // Group items by claim - show all claims with their items expanded
  const rows: any[][] = [];
  claims.forEach(c => {
    if (c.claimItems.length === 0) {
      rows.push([
        c.claimNumber,
        fmtDate(c.date),
        c.company.name,
        c.shop.name,
        '-',
        '-',
        '-',
        { content: fmtMoney(c.totalAmount), styles: { halign: 'right', fontStyle: 'bold' } },
      ]);
    } else {
      c.claimItems.forEach((item, idx) => {
        rows.push([
          idx === 0 ? c.claimNumber : '',
          idx === 0 ? fmtDate(c.date) : '',
          idx === 0 ? c.company.name : '',
          idx === 0 ? c.shop.name : '',
          item.product.name,
          String(item.quantity),
          { content: fmtMoney(item.amount / Math.max(item.quantity, 1)), styles: { halign: 'right' } },
          { content: fmtMoney(item.amount), styles: { halign: 'right', fontStyle: 'bold' } },
        ]);
      });
    }
    // Subtotal row per claim
    rows.push([
      '', '', '', '', '', '', 'Subtotal:',
      { content: fmtMoney(c.totalAmount), styles: { halign: 'right', fontStyle: 'bold', fillColor: COLORS.primaryLight, textColor: COLORS.primaryDark } },
    ]);
  });

  autoTable(doc, {
    startY: y,
    head: [['Claim #', 'Date', 'Company', 'Shop', 'Product', 'Qty', 'Rate', 'Amount']],
    body: rows,
    foot: [['', '', '', '', '', '', 'Grand Total:', { content: fmtMoney(totalAmount), styles: { halign: 'right', textColor: COLORS.white } }]],
    showFoot: 'lastPage',
    showHead: 'everyPage',
    theme: 'plain',
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
    footStyles: { fillColor: COLORS.primaryDark, textColor: COLORS.white, fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 8, textColor: COLORS.black },
    columnStyles: {
      0: { cellWidth: 26, textColor: COLORS.primary, fontStyle: 'bold' },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 26, halign: 'right' },
      7: { cellWidth: 30, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    styles: { cellPadding: 2.5, lineColor: COLORS.grayLight, lineWidth: 0.1 },
  });
}

function reportByCompany(doc: jsPDF, claims: Claim[], filters: string[]) {
  const generatedAt = new Date().toLocaleString('en-GB');
  let y = addHeader(doc, 'Claims by Company Report', filters, generatedAt);

  const groups = new Map<string, Claim[]>();
  for (const c of claims) {
    const arr = groups.get(c.company.name) || [];
    arr.push(c);
    groups.set(c.company.name, arr);
  }
  const rows = Array.from(groups.entries()).map(([name, items]) => ({
    name,
    count: items.length,
    total: items.reduce((s, c) => s + c.totalAmount, 0),
    net: items.reduce((s, c) => s + c.netAmount, 0),
    approved: items.reduce((s, c) => s + (c.approvedAmount || 0), 0),
  })).sort((a, b) => b.total - a.total);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  y = addSummaryBoxes(doc, y, [
    { label: 'Companies', value: String(rows.length), bg: COLORS.primaryLight, fg: COLORS.primaryDark },
    { label: 'Total Claims', value: String(claims.length), bg: COLORS.grayLight, fg: COLORS.grayDark },
    { label: 'Total Amount', value: fmtMoney(grandTotal), bg: COLORS.blue, fg: COLORS.primaryDark },
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Company', 'Claims', 'Gross Amount', 'Deduction', 'Net Amount', 'Cleared']],
    body: rows.map((r, i) => [
      i + 1,
      r.name,
      r.count,
      fmtMoney(r.total),
      fmtMoney(r.total - r.net),
      fmtMoney(r.net),
      fmtMoney(r.approved),
    ]),
    foot: [['', 'Total', claims.length, fmtMoney(grandTotal), '', fmtMoney(rows.reduce((s, r) => s + r.net, 0)), fmtMoney(rows.reduce((s, r) => s + r.approved, 0))]],
    showFoot: 'lastPage',
    showHead: 'everyPage',
    theme: 'striped',
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 10 },
    footStyles: { fillColor: COLORS.primaryDark, textColor: COLORS.white, fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 10, textColor: COLORS.black },
    alternateRowStyles: { fillColor: COLORS.grayLight },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 50, fontStyle: 'bold' },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 38, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 38, halign: 'right' },
      6: { cellWidth: 38, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    styles: { cellPadding: 4 },
  });
}

function reportByOrderBooker(doc: jsPDF, claims: Claim[], filters: string[]) {
  const generatedAt = new Date().toLocaleString('en-GB');
  let y = addHeader(doc, 'Order Bookers Performance Report', filters, generatedAt);

  const groups = new Map<string, Claim[]>();
  for (const c of claims) {
    const key = c.orderBooker?.name || 'Unassigned';
    const arr = groups.get(key) || [];
    arr.push(c);
    groups.set(key, arr);
  }
  const rows = Array.from(groups.entries()).map(([name, items]) => ({
    name,
    count: items.length,
    total: items.reduce((s, c) => s + c.totalAmount, 0),
    approved: items.reduce((s, c) => s + (c.approvedAmount || 0), 0),
    cleared: items.filter(c => normalizeStatus(c.status) === 'cleared').length,
    pending: items.filter(c => normalizeStatus(c.status) === 'pending').length,
  })).sort((a, b) => b.total - a.total);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  y = addSummaryBoxes(doc, y, [
    { label: 'Order Bookers', value: String(rows.length), bg: COLORS.primaryLight, fg: COLORS.primaryDark },
    { label: 'Total Claims', value: String(claims.length), bg: COLORS.grayLight, fg: COLORS.grayDark },
    { label: 'Total Amount', value: fmtMoney(grandTotal), bg: COLORS.blue, fg: COLORS.primaryDark },
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Order Booker', 'Total', 'Pending', 'Cleared', 'Gross Amount', 'Cleared Amount']],
    body: rows.map((r, i) => [
      i + 1,
      r.name,
      r.count,
      r.pending,
      r.cleared,
      fmtMoney(r.total),
      fmtMoney(r.approved),
    ]),
    foot: [['', 'Total', claims.length, '', '', fmtMoney(grandTotal), fmtMoney(rows.reduce((s, r) => s + r.approved, 0))]],
    showFoot: 'lastPage',
    showHead: 'everyPage',
    theme: 'striped',
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 10 },
    footStyles: { fillColor: COLORS.primaryDark, textColor: COLORS.white, fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 10, textColor: COLORS.black },
    alternateRowStyles: { fillColor: COLORS.grayLight },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 50, fontStyle: 'bold' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 24, halign: 'center' },
      5: { cellWidth: 40, halign: 'right' },
      6: { cellWidth: 40, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    styles: { cellPadding: 4 },
  });
}

// ─────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'pending';
    const status = searchParams.get('status') || undefined;
    const companyId = searchParams.get('companyId') || undefined;
    const supplierId = searchParams.get('supplierId') || undefined;
    const orderBookerId = searchParams.get('orderBookerId') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;

    const claims = await fetchClaims({ status, companyId, supplierId, orderBookerId, dateFrom, dateTo });

    // Build filter labels for header
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

    // Build PDF
    // Use landscape orientation for wide reports that have many columns
    // (approved has 10 columns, pending has 9 columns — both need extra horizontal space)
    const wideReports = ['approved', 'pending', 'detail'];
    const orientation = wideReports.includes(reportType) ? 'landscape' : 'portrait';
    const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const reportMap: Record<string, (d: jsPDF, c: Claim[], f: string[]) => void> = {
      pending: reportPending,
      approved: reportApproved,
      summary: reportSummary,
      aging: reportAging,
      cleared: reportCleared,
      detail: reportDetail,
      company: reportByCompany,
      'order-booker': reportByOrderBooker,
    };

    const generator = reportMap[reportType] || reportPending;
    generator(doc, claims, filterLabels);

    addFooter(doc);

    const filename = `al-falah-${reportType}-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    const pdfBuffer = doc.output('arraybuffer');

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('PDF export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
