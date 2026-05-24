'use client';

import { forwardRef } from 'react';

export type ReceiptType = 'received' | 'approved' | 'cleared';

interface ReceiptProps {
  claim: {
    claimNumber: string;
    date: string;
    totalAmount: number;
    approvedAmount: number | null;
    status: string;
    company: { name: string };
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
}

const receiptTypeConfig: Record<ReceiptType, { title: string; subtitle: string; icon: string; headerBg: string; headerColor: string; borderColor: string; badgeBg: string; badgeColor: string; badgeText: string }> = {
  received: {
    title: 'EXPIRY STOCK RECEIVED',
    subtitle: 'Claim Receipt - Stock Received Confirmation',
    icon: '\u2705',
    headerBg: '#047857',
    headerColor: '#ffffff',
    borderColor: '#047857',
    badgeBg: '#dcfce7',
    badgeColor: '#166534',
    badgeText: 'RECEIVED',
  },
  approved: {
    title: 'CLAIM APPROVED',
    subtitle: 'Claim Receipt - Approval Confirmation',
    icon: '\u2705',
    headerBg: '#15803d',
    headerColor: '#ffffff',
    borderColor: '#15803d',
    badgeBg: '#dcfce7',
    badgeColor: '#166534',
    badgeText: 'APPROVED',
  },
  cleared: {
    title: 'CLAIM CLEARED',
    subtitle: 'Claim Receipt - Cleared Confirmation',
    icon: '\u2705',
    headerBg: '#1d4ed8',
    headerColor: '#ffffff',
    borderColor: '#1d4ed8',
    badgeBg: '#dbeafe',
    badgeColor: '#1e40af',
    badgeText: 'CLEARED',
  },
};

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(({ claim, receiptType = 'received' }, ref) => {
  const formatAmount = (amount: number) => `Rs. ${amount.toLocaleString()}`;
  const config = receiptTypeConfig[receiptType];

  const infoItems = [
    { label: 'Claim #', value: claim.claimNumber },
    { label: 'Date', value: new Date(claim.date).toLocaleDateString() },
    { label: 'Company', value: claim.company.name },
    { label: 'Shop', value: claim.shop.name },
    { label: 'Address', value: claim.shop.address || '-' },
    { label: 'Supplier', value: claim.supplier.name },
    { label: 'Order Booker', value: claim.orderBooker?.name || '-' },
  ];

  if (receiptType === 'approved' || receiptType === 'cleared') {
    infoItems.push({ label: 'Total Claim', value: formatAmount(claim.totalAmount) });
  }
  if (receiptType === 'cleared' && claim.approvedAmount !== null) {
    infoItems.push({ label: 'Cleared Amount', value: formatAmount(claim.approvedAmount) });
  }
  if (receiptType === 'approved' && claim.approvedAmount !== null) {
    infoItems.push({ label: 'Approved Amount', value: formatAmount(claim.approvedAmount) });
  }
  if (receiptType === 'cleared' && claim.clearedBy) {
    infoItems.push({ label: 'Cleared By', value: claim.clearedBy });
  }
  if (receiptType === 'cleared' && claim.clearedDate) {
    infoItems.push({ label: 'Cleared Date', value: new Date(claim.clearedDate).toLocaleDateString() });
  }

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
        borderBottom: `3px solid ${config.borderColor}`,
        paddingBottom: '16px',
        marginBottom: '20px',
      }}>
        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#065f46', letterSpacing: '2px' }}>
          AL FALAH TRADERS
        </div>
        <div style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: config.headerBg,
          marginTop: '8px',
        }}>
          {config.icon} {config.title}
        </div>
        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
          {config.subtitle}
        </div>
        {/* Status Badge */}
        <div style={{
          display: 'inline-block',
          marginTop: '10px',
          padding: '4px 16px',
          borderRadius: '20px',
          backgroundColor: config.badgeBg,
          color: config.badgeColor,
          fontWeight: 'bold',
          fontSize: '13px',
          letterSpacing: '1px',
        }}>
          {config.badgeText}
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
          <tr style={{ backgroundColor: config.headerBg }}>
            <th style={{ padding: '10px 12px', color: '#ffffff', textAlign: 'left', fontSize: '13px' }}>#</th>
            <th style={{ padding: '10px 12px', color: '#ffffff', textAlign: 'left', fontSize: '13px' }}>Product</th>
            <th style={{ padding: '10px 12px', color: '#ffffff', textAlign: 'right', fontSize: '13px' }}>Rate</th>
            <th style={{ padding: '10px 12px', color: '#ffffff', textAlign: 'center', fontSize: '13px' }}>Qty</th>
            <th style={{ padding: '10px 12px', color: '#ffffff', textAlign: 'right', fontSize: '13px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {claim.claimItems.map((item, index) => (
            <tr key={item.id} style={{ backgroundColor: index % 2 === 0 ? '#f9fafb' : '#ffffff' }}>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6' }}>{index + 1}</td>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6' }}>{item.product.name}</td>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{formatAmount(item.product.claimPrice && item.product.claimPrice > 0 ? item.product.claimPrice : item.product.price)}</td>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontWeight: '600' }}>{formatAmount(item.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: `3px solid ${config.borderColor}` }}>
            <td colSpan={4} style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px' }}>
              Total Amount:
            </td>
            <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px', color: '#047857' }}>
              {formatAmount(claim.totalAmount)}
            </td>
          </tr>
          {receiptType === 'cleared' && claim.approvedAmount !== null && claim.approvedAmount !== undefined && (
            <tr>
              <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px' }}>
                Cleared Amount:
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px', color: '#1d4ed8' }}>
                {formatAmount(claim.approvedAmount)}
              </td>
            </tr>
          )}
          {receiptType === 'approved' && claim.approvedAmount !== null && claim.approvedAmount !== undefined && (
            <tr>
              <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px' }}>
                Approved Amount:
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px', color: '#15803d' }}>
                {formatAmount(claim.approvedAmount)}
              </td>
            </tr>
          )}
          {claim.approvedAmount !== null && claim.approvedAmount !== undefined && claim.totalAmount - claim.approvedAmount > 0 && (
            <tr>
              <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px' }}>
                Remaining Pending:
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px', color: '#dc2626' }}>
                {formatAmount(claim.totalAmount - claim.approvedAmount)}
              </td>
            </tr>
          )}
        </tfoot>
      </table>

      {/* Confirmation Stamp for Received */}
      {receiptType === 'received' && (
        <div style={{
          textAlign: 'center',
          margin: '20px 0',
          padding: '12px',
          border: '2px dashed #047857',
          borderRadius: '8px',
          backgroundColor: '#f0fdf4',
        }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#047857' }}>
            EXPIRY STOCK RECEIVED
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            This confirms that the above claim has been received and recorded in the system.
          </div>
        </div>
      )}

      {/* Approval Stamp */}
      {receiptType === 'approved' && (
        <div style={{
          textAlign: 'center',
          margin: '20px 0',
          padding: '12px',
          border: '2px dashed #15803d',
          borderRadius: '8px',
          backgroundColor: '#f0fdf4',
        }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#15803d' }}>
            CLAIM APPROVED
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            This claim has been reviewed and approved.
          </div>
        </div>
      )}

      {/* Payment Stamp */}
      {receiptType === 'cleared' && (
        <div style={{
          textAlign: 'center',
          margin: '20px 0',
          padding: '12px',
          border: '2px dashed #1d4ed8',
          borderRadius: '8px',
          backgroundColor: '#eff6ff',
        }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1d4ed8' }}>
            CLAIM CLEARED
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            This claim has been cleared.
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        borderTop: `3px solid ${config.borderColor}`,
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
