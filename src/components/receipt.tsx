'use client';

import React, { forwardRef } from 'react';

export type ReceiptType = 'received' | 'approved' | 'partial' | 'cleared';

export interface ReceiptCompanyInfo {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  city?: string;
}

interface ReceiptProps {
  claim: {
    claimNumber: string;
    date: string;
    totalAmount: number;
    deductionAmount: number;
    netAmount: number;
    approvedAmount: number | null;
    status: string;
    company: { name: string; claimDeductionPercent?: number };
    shop: { name: string; address: string };
    supplier: { name: string };
    orderBooker: { name: string } | null;
    claimItems: Array<{
      id: string;
      quantity: number;
      amount: number;
      product: { name: string; price: number; claimPrice: number; unit: string };
    }>;
    clearedBy: string | null;
    clearedDate: string | null;
  };
  receiptType?: ReceiptType;
  /** Company profile from Settings — shown on receipt header + stamp */
  company?: ReceiptCompanyInfo;
}

const receiptTypeConfig: Record<ReceiptType, {
  title: string;
  subtitle: string;
  stampText: string;
  accent: string;
  accentDark: string;
  soft: string;
  note: string;
}> = {
  received: {
    title: 'Expiry Stock Received',
    subtitle: 'Claim Receipt — Stock Received Confirmation',
    stampText: 'RECEIVED',
    accent: '#047857',
    accentDark: '#065f46',
    soft: '#ecfdf5',
    note: 'This certifies that the expiry / damaged stock listed above has been received and recorded in the system.',
  },
  approved: {
    title: 'Claim Approved',
    subtitle: 'Claim Receipt — Approval Confirmation',
    stampText: 'APPROVED',
    accent: '#15803d',
    accentDark: '#14532d',
    soft: '#f0fdf4',
    note: 'Stock has arrived and the claim is approved. Payment deduction is pending from shopkeeper.',
  },
  partial: {
    title: 'Partial Payment Receipt',
    subtitle: 'Claim Receipt — Partial Clearance Confirmation',
    stampText: 'PARTIAL',
    accent: '#c2410c',
    accentDark: '#7c2d12',
    soft: '#fff7ed',
    note: 'Partial amount has been deducted from shopkeeper. The remaining amount is still pending.',
  },
  cleared: {
    title: 'Claim Cleared',
    subtitle: 'Claim Receipt — Final Clearance Confirmation',
    stampText: 'CLEARED',
    accent: '#1d4ed8',
    accentDark: '#1e3a8a',
    soft: '#eff6ff',
    note: 'This claim has been fully cleared. No further amount is payable against this receipt.',
  },
};

/** Number → English words (Pakistani units: Crore / Lakh / Thousand) */
function amountToWords(num: number): string {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const chunk = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + chunk(n % 100) : '');
  };

  if (!Number.isFinite(num) || num < 0) return 'Zero';
  if (num === 0) return 'Zero';

  let words = '';
  let rest = Math.floor(num);
  const units: Array<{ v: number; label: string }> = [
    { v: 10000000, label: 'Crore' },
    { v: 100000, label: 'Lakh' },
    { v: 1000, label: 'Thousand' },
  ];
  for (const u of units) {
    if (rest >= u.v) {
      words += chunk(Math.floor(rest / u.v)) + ' ' + u.label + ' ';
      rest %= u.v;
    }
  }
  if (rest > 0) words += chunk(rest);
  return words.trim().replace(/\s+/g, ' ');
}

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(({ claim, receiptType = 'received', company }, ref) => {
  const formatAmount = (amount: number) => `Rs. ${amount.toLocaleString()}`;
  const config = receiptTypeConfig[receiptType];

  // Company profile (Settings) with sensible fallbacks so the receipt never looks broken
  const coName = (company?.name || 'Al-Falah Traders').trim() || 'Al-Falah Traders';
  const coCity = (company?.city || 'Khanpur').trim() || 'Khanpur';
  const coAddress = (company?.address || '').trim() || 'Main Bazaar, Khanpur';
  const coPhone = (company?.phone || '').trim();
  const coEmail = (company?.email || '').trim();

  const contactLine = [coPhone ? `Ph: ${coPhone}` : '', coEmail].filter(Boolean).join('  ·  ');
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const claimDate = new Date(claim.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const grandAmount = claim.netAmount || claim.totalAmount;

  // Status label chip inside "Claim Details"
  const statusChip = (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 4,
      border: `1.5px solid ${config.accent}`,
      backgroundColor: config.soft,
      color: config.accentDark,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
    }}>
      {config.stampText}
    </span>
  );

  return (
    <div ref={ref} style={{
      backgroundColor: '#ffffff',
      maxWidth: '720px',
      margin: '0 auto',
      fontFamily: 'Georgia, "Times New Roman", serif',
      width: '100%',
      boxSizing: 'border-box',
      border: '2px solid #1f2937',
      color: '#111827',
    }}>
      <div style={{ padding: '26px 30px 20px', boxSizing: 'border-box' }}>
        {/* ── Header ─────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 20,
          paddingBottom: 14,
          borderBottom: '3px double #1f2937',
        }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 0.5, lineHeight: 1.2 }}>
              {coName.toUpperCase()}
            </div>
            <div style={{ fontSize: 11, color: '#4b5563', marginTop: 6, lineHeight: 1.7 }}>
              {coAddress}
              {contactLine && (<React.Fragment><br />{contactLine}</React.Fragment>)}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 3,
              color: config.accent,
              textTransform: 'uppercase',
            }}>
              {config.title}
            </div>
            <div style={{ fontSize: 10.5, color: '#6b7280', marginTop: 3, letterSpacing: 0.3 }}>
              {config.subtitle}
            </div>
            <div style={{ fontSize: 11.5, marginTop: 9, color: '#374151' }}>
              Receipt No: <b style={{ fontSize: 13 }}>{claim.claimNumber}</b>
            </div>
            <div style={{ fontSize: 11.5, marginTop: 2, color: '#374151' }}>
              Date: <b style={{ fontSize: 13 }}>{claimDate}</b>
            </div>
          </div>
        </div>

        {/* ── Received From / Claim Details ───────────────── */}
        <div style={{ display: 'flex', margin: '16px 0 12px' }}>
          <div style={{ flex: 1, padding: '10px 2px 10px 0' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.6, color: '#6b7280', textTransform: 'uppercase', marginBottom: 7 }}>
              Received From
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.75, color: '#111827' }}>
              <b style={{ fontSize: 14 }}>{claim.shop.name}</b>
              <br />
              {claim.shop.address ? <span style={{ color: '#4b5563' }}>{claim.shop.address}</span> : null}
              {claim.shop.address ? <br /> : null}
              Order Booker: <span style={{ color: '#4b5563' }}>{claim.orderBooker?.name || '—'}</span>
            </div>
          </div>
          <div style={{ flex: 1, borderLeft: '1px solid #e5e7eb', padding: '10px 0 10px 18px' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.6, color: '#6b7280', textTransform: 'uppercase', marginBottom: 7 }}>
              Claim Details
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.75, color: '#111827' }}>
              Company: <b>{claim.company.name}</b>
              <br />
              Supplier: <span style={{ color: '#4b5563' }}>{claim.supplier.name}</span>
              <br />
              Status: {statusChip}
            </div>
          </div>
        </div>

        {/* ── Items Table ────────────────────────────────── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['#', 'Product', 'Rate', 'Qty', 'Amount'].map((h, i) => (
                <th key={h} style={{
                  backgroundColor: '#1f2937',
                  color: '#ffffff',
                  fontSize: 10,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  padding: '9px 10px',
                  border: '1px solid #1f2937',
                  fontWeight: 700,
                  textAlign: i === 0 ? 'left' : i === 2 || i === 4 ? 'right' : i === 3 ? 'center' : 'left',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {claim.claimItems.map((item, index) => (
              <tr key={item.id} style={{ backgroundColor: index % 2 === 0 ? '#fafafa' : '#ffffff' }}>
                <td style={{ border: '1px solid #d1d5db', padding: '8px 10px', color: '#1f2937' }}>{index + 1}</td>
                <td style={{ border: '1px solid #d1d5db', padding: '8px 10px', color: '#1f2937' }}>
                  {item.product.name}
                  <span style={{ color: '#9ca3af', fontSize: 10.5 }}> ({item.product.unit})</span>
                </td>
                <td style={{ border: '1px solid #d1d5db', padding: '8px 10px', color: '#1f2937', textAlign: 'right' }}>
                  {formatAmount(item.product.claimPrice && item.product.claimPrice > 0 ? item.product.claimPrice : item.product.price)}
                </td>
                <td style={{ border: '1px solid #d1d5db', padding: '8px 10px', color: '#1f2937', textAlign: 'center' }}>{item.quantity}</td>
                <td style={{ border: '1px solid #d1d5db', padding: '8px 10px', color: '#1f2937', textAlign: 'right', fontWeight: 700 }}>
                  {formatAmount(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Words + Terms | Totals ─────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 22, marginTop: 14, alignItems: 'flex-start' }}>
          {/* Left: amount in words + terms */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: '#6b7280', marginBottom: 4 }}>
              Amount In Words
            </div>
            <div style={{ fontSize: 11.5, fontStyle: 'italic', color: '#374151', lineHeight: 1.6 }}>
              Rupees {amountToWords(grandAmount)} Only
            </div>

            <div style={{ fontSize: 10, color: '#4b5563', lineHeight: 1.7, marginTop: 12 }}>
              <b style={{ fontSize: 10.5, letterSpacing: 1.2, color: '#374151' }}>TERMS &amp; CONDITIONS</b>
              <ol style={{ marginLeft: 16, marginTop: 4, paddingLeft: 0, listStylePosition: 'outside' }}>
                <li>This receipt confirms receipt of expiry / damaged stock; claim approval is subject to company verification.</li>
                <li>Goods once received will not be returned to the shop.</li>
                <li>Please preserve this receipt for any future reference.</li>
              </ol>
            </div>

            <div style={{
              marginTop: 10,
              padding: '8px 11px',
              border: `1.5px dashed ${config.accent}`,
              backgroundColor: config.soft,
              borderRadius: 6,
              fontSize: 10.5,
              color: config.accentDark,
              lineHeight: 1.6,
            }}>
              {config.note}
            </div>
          </div>

          {/* Right: totals */}
          <div style={{ width: 275, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: 13, borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
              <span>Total Amount</span><b style={{ color: '#111827' }}>{formatAmount(claim.totalAmount)}</b>
            </div>
            {claim.deductionAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: 13, borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                <span>Deduction ({claim.company.claimDeductionPercent}%)</span>
                <b style={{ color: '#b45309' }}>- {formatAmount(claim.deductionAmount)}</b>
              </div>
            )}
            {claim.deductionAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: 13, borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                <span>Net Amount</span><b style={{ color: '#111827' }}>{formatAmount(claim.netAmount)}</b>
              </div>
            )}

            {receiptType === 'approved' && claim.approvedAmount !== null && claim.approvedAmount !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: 13, borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                <span>Approved Amount</span><b style={{ color: '#15803d' }}>{formatAmount(claim.approvedAmount)}</b>
              </div>
            )}
            {receiptType === 'approved' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: 13, borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                <span>Payment Status</span><b style={{ color: '#b45309' }}>PENDING</b>
              </div>
            )}

            {receiptType === 'partial' && claim.approvedAmount !== null && claim.approvedAmount !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: 13, borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                <span>Amount Paid</span><b style={{ color: '#15803d' }}>{formatAmount(claim.approvedAmount)}</b>
              </div>
            )}
            {receiptType === 'partial' && claim.approvedAmount !== null && claim.approvedAmount !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: 13, borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                <span>Remaining</span><b style={{ color: '#dc2626' }}>{formatAmount(claim.netAmount - claim.approvedAmount)}</b>
              </div>
            )}

            {receiptType === 'cleared' && claim.approvedAmount !== null && claim.approvedAmount !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: 13, borderBottom: '1px solid #e5e7eb', color: '#374151' }}>
                <span>Cleared Amount</span><b style={{ color: '#1d4ed8' }}>{formatAmount(claim.approvedAmount)}</b>
              </div>
            )}
            {receiptType === 'cleared' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: 12, borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                <span>Cleared By</span>
                <span>{claim.clearedBy || 'Admin'}{claim.clearedDate ? ` · ${new Date(claim.clearedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span>
              </div>
            )}

            {/* Grand total */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: config.soft,
              border: `1.5px solid ${config.accent}`,
              fontWeight: 700,
              padding: '10px 12px',
              marginTop: 7,
              color: config.accentDark,
              fontSize: 14,
            }}>
              <span style={{ letterSpacing: 1 }}>NET PAYABLE</span>
              <span>{formatAmount(grandAmount)}</span>
            </div>
          </div>
        </div>

        {/* ── Signatures + Stamp ─────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, padding: '0 4px', alignItems: 'flex-end' }}>
          <div style={{ textAlign: 'center', width: 165 }}>
            <div style={{ height: 88 }} />
            <div style={{ borderTop: '1px solid #374151', paddingTop: 6, fontSize: 10, color: '#4b5563', letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Shopkeeper&apos;s Signature
            </div>
          </div>
          <div style={{ textAlign: 'center', width: 165 }}>
            <div style={{ height: 88 }} />
            <div style={{ borderTop: '1px solid #374151', paddingTop: 6, fontSize: 10, color: '#4b5563', letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Order Booker
            </div>
          </div>
          <div style={{ textAlign: 'center', width: 175 }}>
            {/* Round status stamp */}
            <div style={{ height: 88, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4 }}>
              <div style={{
                width: 92,
                height: 92,
                borderRadius: '50%',
                border: `2.5px solid ${config.accent}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: 'rotate(-8deg)',
                opacity: 0.92,
                flexShrink: 0,
              }}>
                <div style={{
                  width: 76,
                  height: 76,
                  borderRadius: '50%',
                  border: `1.5px solid ${config.accent}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: config.accent,
                  gap: 1,
                }}>
                  <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: 1.5 }}>{config.stampText}</span>
                  <span style={{ fontSize: 6.5, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>
                    {coName.length > 22 ? coName.slice(0, 22) + '.' : coName}
                  </span>
                  <span style={{ fontSize: 6.5, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>{coCity}</span>
                  <span style={{ fontSize: 7.5, letterSpacing: 1, marginTop: 2 }}>
                    {today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid #374151', paddingTop: 6, fontSize: 10, color: '#4b5563', letterSpacing: 0.6, textTransform: 'uppercase' }}>
              For {coName}
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer strip ─────────────────────────────────── */}
      <div style={{
        backgroundColor: '#f3f4f6',
        borderTop: '1px solid #d1d5db',
        padding: '9px 12px',
        textAlign: 'center',
        fontSize: 9.5,
        color: '#6b7280',
        letterSpacing: 0.5,
      }}>
        {coName.toUpperCase()} — CLAIM MANAGEMENT SYSTEM · GENERATED ON {dateStr.toUpperCase()} · THIS IS A SYSTEM GENERATED RECEIPT
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';
