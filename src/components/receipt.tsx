'use client';

import { forwardRef } from 'react';

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

  return (
    <div ref={ref} className="bg-white p-6 max-w-2xl mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="text-center border-b-2 border-emerald-600 pb-4 mb-4">
        <h1 className="text-3xl font-bold text-emerald-800 tracking-wide">AL FALAH TRADERS</h1>
        <p className="text-emerald-600 text-sm mt-1">Claim Receipt</p>
      </div>

      {/* Claim Info Grid */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-4 text-sm">
        <div className="flex justify-between border-b border-gray-200 py-1">
          <span className="text-gray-600">Claim #:</span>
          <span className="font-semibold">{claim.claimNumber}</span>
        </div>
        <div className="flex justify-between border-b border-gray-200 py-1">
          <span className="text-gray-600">Date:</span>
          <span className="font-semibold">{new Date(claim.date).toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between border-b border-gray-200 py-1">
          <span className="text-gray-600">Company:</span>
          <span className="font-semibold">{claim.company.name}</span>
        </div>
        <div className="flex justify-between border-b border-gray-200 py-1">
          <span className="text-gray-600">Shop:</span>
          <span className="font-semibold">{claim.shop.name}</span>
        </div>
        <div className="flex justify-between border-b border-gray-200 py-1">
          <span className="text-gray-600">Address:</span>
          <span className="font-semibold">{claim.shop.address || '-'}</span>
        </div>
        <div className="flex justify-between border-b border-gray-200 py-1">
          <span className="text-gray-600">Supplier:</span>
          <span className="font-semibold">{claim.supplier.name}</span>
        </div>
        <div className="flex justify-between border-b border-gray-200 py-1">
          <span className="text-gray-600">Order Booker:</span>
          <span className="font-semibold">{claim.orderBooker?.name || '-'}</span>
        </div>
        <div className="flex justify-between border-b border-gray-200 py-1">
          <span className="text-gray-600">Status:</span>
          <span className="font-semibold">{statusLabels[claim.status]}</span>
        </div>
        {claim.clearedBy && (
          <div className="flex justify-between border-b border-gray-200 py-1">
            <span className="text-gray-600">Cleared By:</span>
            <span className="font-semibold">{claim.clearedBy}</span>
          </div>
        )}
        {claim.clearedDate && (
          <div className="flex justify-between border-b border-gray-200 py-1">
            <span className="text-gray-600">Cleared Date:</span>
            <span className="font-semibold">{new Date(claim.clearedDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {/* Items Table */}
      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="bg-emerald-600 text-white">
            <th className="py-2 px-3 text-left">#</th>
            <th className="py-2 px-3 text-left">Product</th>
            <th className="py-2 px-3 text-right">Price</th>
            <th className="py-2 px-3 text-center">Qty</th>
            <th className="py-2 px-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {claim.claimItems.map((item, index) => (
            <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
              <td className="py-2 px-3">{index + 1}</td>
              <td className="py-2 px-3">{item.product.name}</td>
              <td className="py-2 px-3 text-right">{formatAmount(item.product.price)}</td>
              <td className="py-2 px-3 text-center">{item.quantity}</td>
              <td className="py-2 px-3 text-right font-medium">{formatAmount(item.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-emerald-600">
            <td colSpan={4} className="py-2 px-3 text-right font-bold">Total Amount:</td>
            <td className="py-2 px-3 text-right font-bold text-emerald-700">{formatAmount(claim.totalAmount)}</td>
          </tr>
          {claim.approvedAmount !== null && claim.approvedAmount !== undefined && (
            <tr>
              <td colSpan={4} className="py-2 px-3 text-right font-bold">Approved Amount:</td>
              <td className="py-2 px-3 text-right font-bold text-green-700">{formatAmount(claim.approvedAmount)}</td>
            </tr>
          )}
        </tfoot>
      </table>

      {/* Footer */}
      <div className="border-t-2 border-emerald-600 pt-3 mt-4 text-center">
        <p className="text-xs text-gray-500">AL FALAH TRADERS — Claim Management System</p>
        <p className="text-xs text-gray-400 mt-1">Generated on {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';
