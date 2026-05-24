'use client';

import { forwardRef } from 'react';

interface ReceiptProps {
  claim: {
    claimNumber: string;
    date: string;
    totalAmount: number;
    approvedAmount: number | null;
    status: string;
    company: { name: string; claimRate?: number };
    shop: { name: string; address: string };
    supplier: { name: string };
    orderBooker: { name: string } | null;
    claimItems: Array<{
      id: string;
      quantity: number;
      amount: number;
      product: { name: string; price: number; unit: string };
    }>;
    clearedBy: string | null;
    clearedDate: string | null;
  };
}

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  partially_approved: 'Partially Approved',
  cleared: 'Cleared',
  rejected: 'Rejected',
};

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(({ claim }, ref) => {
  const formatAmount = (amount: number) => `Rs. ${amount.toLocaleString()}`;
  const claimRate = claim.company?.claimRate || 78;

  const infoItems = [
    { label: 'Claim #', value: claim.claimNumber },
    { label: 'Date', value: new Date(claim.date).toLocaleDateString() },
    { label: 'Company', value: claim.company.name },
    { label: 'Claim Rate', value: `${claimRate}%` },
    { label: 'Shop', value: claim.shop.name },
    { label: 'Address', value: claim.shop.address || '-' },
    { label: 'Supplier', value: claim.supplier.name },
    { label: 'Order Booker', value: claim.orderBooker?.name || '-' },
    { label: 'Status', value: statusLabels[claim.status] },
  ];

  if (claim.clearedBy) infoItems.push({ label: 'Cleared By', value: claim.clearedBy });
  if (claim.clearedDate) infoItems.push({ label: 'Cleared Date', value: new Date(claim.clearedDate).toLocaleDateString() });

  return (
    <div ref={ref} style={{
      backgroundColor: '#ffffff',
      padding: '32px',
      maxWidth: '672px',
      margin: '0 auto',
      fontFamily: 'Arial, Helvetica, sans-serif',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        borderBottom: '3px solid #047857',
        paddingBottom: '16px',
        marginBottom: '20px',
      }}>
        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#065f46', letterSpacing: '2px' }}>
          AL FALAH TRADERS
        </div>
        <div style={{ fontSize: '13px', color: '#059669', marginTop: '4px' }}>
          Claim Receipt
        </div>
      </div>

      {/* Claim Info - Table layout for reliable rendering */}
      <div style={{ marginBottom: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <tbody>
            {(() => {
              const rows = [];
              for (let i = 0; i < infoItems.length; i += 2) {
                rows.push(
                  <tr key={i}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', width: '25%', whiteSpace: 'nowrap' }}>
                      {infoItems[i].label}:
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: '600', width: '25%' }}>
                      {infoItems[i].value}
                    </td>
                    {infoItems[i + 1] ? (
                      <>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', width: '25%', whiteSpace: 'nowrap' }}>
                          {infoItems[i + 1].label}:
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: '600', width: '25%' }}>
                          {infoItems[i + 1].value}
                        </td>
                      </>
                    ) : (
                      <td colSpan={2} style={{ padding: '6px 8px' }}></td>
                    )}
                  </tr>
                );
              }
              return rows;
            })()}
          </tbody>
        </table>
      </div>

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '16px' }}>
        <thead>
          <tr style={{ backgroundColor: '#059669' }}>
            <th style={{ padding: '10px 12px', color: '#ffffff', textAlign: 'left', fontSize: '13px' }}>#</th>
            <th style={{ padding: '10px 12px', color: '#ffffff', textAlign: 'left', fontSize: '13px' }}>Product</th>
            <th style={{ padding: '10px 12px', color: '#ffffff', textAlign: 'right', fontSize: '13px' }}>Price</th>
            <th style={{ padding: '10px 12px', color: '#ffffff', textAlign: 'right', fontSize: '13px' }}>Claim/Unit</th>
            <th style={{ padding: '10px 12px', color: '#ffffff', textAlign: 'center', fontSize: '13px' }}>Qty</th>
            <th style={{ padding: '10px 12px', color: '#ffffff', textAlign: 'right', fontSize: '13px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {claim.claimItems.map((item, index) => {
            const claimPerUnit = Math.round(item.product.price * (claimRate / 100));
            return (
              <tr key={item.id} style={{ backgroundColor: index % 2 === 0 ? '#f9fafb' : '#ffffff' }}>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6' }}>{index + 1}</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6' }}>{item.product.name}</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{formatAmount(item.product.price)}</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', color: '#059669' }}>{formatAmount(claimPerUnit)}</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>{item.quantity}</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontWeight: '600' }}>{formatAmount(item.amount)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '3px solid #059669' }}>
            <td colSpan={5} style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px' }}>
              Total Amount:
            </td>
            <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px', color: '#047857' }}>
              {formatAmount(claim.totalAmount)}
            </td>
          </tr>
          {claim.approvedAmount !== null && claim.approvedAmount !== undefined && (
            <tr>
              <td colSpan={5} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px' }}>
                Approved Amount:
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px', color: '#15803d' }}>
                {formatAmount(claim.approvedAmount)}
              </td>
            </tr>
          )}
        </tfoot>
      </table>

      {/* Footer */}
      <div style={{
        borderTop: '3px solid #047857',
        paddingTop: '12px',
        marginTop: '16px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
          AL FALAH TRADERS — Claim Management System
        </div>
        <div style={{ fontSize: '10px', color: '#d1d5db', marginTop: '4px' }}>
          Generated on {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';
