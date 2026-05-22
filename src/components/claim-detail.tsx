'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, Share2, Printer, FileText, Image, FileDown, MessageCircle } from 'lucide-react';
import { Receipt } from './receipt';

interface ClaimDetailProps {
  claim: ClaimData;
  user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
  onBack: () => void;
}

interface ClaimData {
  id: string;
  claimNumber: string;
  date: string;
  totalAmount: number;
  approvedAmount: number | null;
  status: string;
  companyId: string;
  shopId: string;
  supplierId: string;
  orderBookerId: string | null;
  company: { name: string };
  shop: { name: string; address: string };
  supplier: { name: string };
  orderBooker: { name: string } | null;
  claimItems: Array<{
    id: string;
    productId: string;
    quantity: number;
    amount: number;
    product: { name: string; price: number; unit: string };
  }>;
  clearedBy: string | null;
  clearedDate: string | null;
  rejectReason: string | null;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  approved: 'bg-green-100 text-green-800 border-green-300',
  partially_approved: 'bg-orange-100 text-orange-800 border-orange-300',
  cleared: 'bg-blue-100 text-blue-800 border-blue-300',
  rejected: 'bg-red-100 text-red-800 border-red-300',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  partially_approved: 'Partially Approved',
  cleared: 'Cleared',
  rejected: 'Rejected',
};

export function ClaimDetail({ claim, user, onBack }: ClaimDetailProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const formatAmount = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  const handleDownloadImage = async () => {
    if (!receiptRef.current) return;
    setGenerating(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(receiptRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `claim-${claim.claimNumber}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Image generation error:', error);
      alert('Failed to generate image');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return;
    setGenerating(true);
    try {
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');
      const dataUrl = await toPng(receiptRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 190;
      const imgHeight = (receiptRef.current.offsetHeight * imgWidth) / receiptRef.current.offsetWidth;
      pdf.addImage(dataUrl, 'PNG', 10, 10, imgWidth, imgHeight);
      pdf.save(`claim-${claim.claimNumber}.pdf`);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!receiptRef.current) return;
    setGenerating(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(receiptRef.current, {
        quality: 0.8,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `claim-${claim.claimNumber}.png`, { type: 'image/png' });

      if (navigator.share) {
        await navigator.share({
          text: `Claim ${claim.claimNumber} - AL FALAH TRADERS`,
          files: [file],
        });
      } else {
        const link = document.createElement('a');
        link.download = `claim-${claim.claimNumber}.png`;
        link.href = dataUrl;
        link.click();

        const text = encodeURIComponent(
          `Claim ${claim.claimNumber}\nAmount: ${formatAmount(claim.totalAmount)}\nStatus: ${statusLabels[claim.status]}\nAL FALAH TRADERS`
        );
        window.open(`https://wa.me/?text=${text}`, '_blank');
      }
    } catch (error) {
      console.error('WhatsApp share error:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between animate-fade-in-up">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={onBack} className="btn-enhanced border-emerald-200 text-emerald-700 hover:bg-emerald-50">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-emerald-800 flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Claim {claim.claimNumber}
            </h2>
            <Badge className={`${statusColors[claim.status]} border mt-1 transition-transform hover:scale-105`}>
              {statusLabels[claim.status]}
            </Badge>
          </div>
        </div>
      </div>

      {/* Claim Info */}
      <Card className="shadow-sm animate-fade-in-up" style={{ animationDelay: '80ms' }}>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
            <div className="bg-gray-50/50 rounded-lg p-2 transition-colors hover:bg-gray-50">
              <p className="text-muted-foreground text-xs">Date</p>
              <p className="font-medium">{new Date(claim.date).toLocaleDateString()}</p>
            </div>
            <div className="bg-gray-50/50 rounded-lg p-2 transition-colors hover:bg-gray-50">
              <p className="text-muted-foreground text-xs">Company</p>
              <p className="font-medium">{claim.company.name}</p>
            </div>
            <div className="bg-gray-50/50 rounded-lg p-2 transition-colors hover:bg-gray-50">
              <p className="text-muted-foreground text-xs">Shop</p>
              <p className="font-medium">{claim.shop.name}</p>
            </div>
            <div className="bg-gray-50/50 rounded-lg p-2 transition-colors hover:bg-gray-50">
              <p className="text-muted-foreground text-xs">Address</p>
              <p className="font-medium">{claim.shop.address || '-'}</p>
            </div>
            <div className="bg-gray-50/50 rounded-lg p-2 transition-colors hover:bg-gray-50">
              <p className="text-muted-foreground text-xs">Supplier</p>
              <p className="font-medium">{claim.supplier.name}</p>
            </div>
            <div className="bg-gray-50/50 rounded-lg p-2 transition-colors hover:bg-gray-50">
              <p className="text-muted-foreground text-xs">Order Booker</p>
              <p className="font-medium">{claim.orderBooker?.name || '-'}</p>
            </div>
            <div className="bg-emerald-50/50 rounded-lg p-2 transition-colors hover:bg-emerald-50">
              <p className="text-muted-foreground text-xs">Total Amount</p>
              <p className="font-bold text-emerald-700">{formatAmount(claim.totalAmount)}</p>
            </div>
            <div className="bg-green-50/50 rounded-lg p-2 transition-colors hover:bg-green-50">
              <p className="text-muted-foreground text-xs">Approved Amount</p>
              <p className="font-bold text-green-700">{claim.approvedAmount ? formatAmount(claim.approvedAmount) : '-'}</p>
            </div>
            {claim.clearedBy && (
              <div className="bg-blue-50/50 rounded-lg p-2 transition-colors hover:bg-blue-50">
                <p className="text-muted-foreground text-xs">Cleared By</p>
                <p className="font-medium">{claim.clearedBy}</p>
              </div>
            )}
            {claim.clearedDate && (
              <div className="bg-blue-50/50 rounded-lg p-2 transition-colors hover:bg-blue-50">
                <p className="text-muted-foreground text-xs">Cleared Date</p>
                <p className="font-medium">{new Date(claim.clearedDate).toLocaleDateString()}</p>
              </div>
            )}
            {claim.rejectReason && (
              <div className="col-span-2 bg-red-50/50 rounded-lg p-2">
                <p className="text-muted-foreground text-xs">Reject Reason</p>
                <p className="font-medium text-red-600">{claim.rejectReason}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card className="shadow-sm animate-fade-in-up" style={{ animationDelay: '160ms' }}>
        <CardHeader>
          <CardTitle className="text-lg">Claim Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium">#</th>
                  <th className="text-left py-3 px-4 font-medium">Product</th>
                  <th className="text-right py-3 px-4 font-medium">Price</th>
                  <th className="text-center py-3 px-4 font-medium">Qty</th>
                  <th className="text-right py-3 px-4 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {claim.claimItems.map((item, index) => (
                  <tr key={item.id} className="border-b table-row-hover animate-fade-in-up" style={{ animationDelay: `${index * 30}ms` }}>
                    <td className="py-3 px-4">{index + 1}</td>
                    <td className="py-3 px-4 font-medium">{item.product.name}</td>
                    <td className="py-3 px-4 text-right">Rs.{item.product.price}</td>
                    <td className="py-3 px-4 text-center">{item.quantity}</td>
                    <td className="py-3 px-4 text-right font-medium">Rs.{item.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-emerald-50">
                  <td colSpan={4} className="py-3 px-4 text-right font-bold text-lg">
                    Total:
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-lg text-emerald-700">
                    {formatAmount(claim.totalAmount)}
                  </td>
                </tr>
                {claim.approvedAmount !== null && (
                  <tr className="bg-green-50">
                    <td colSpan={4} className="py-3 px-4 text-right font-bold text-lg">
                      Approved:
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-lg text-green-700">
                      {formatAmount(claim.approvedAmount)}
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card className="shadow-sm animate-fade-in-up" style={{ animationDelay: '240ms' }}>
        <CardHeader>
          <CardTitle className="text-lg">Receipt Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md btn-enhanced"
              onClick={handleDownloadImage}
              disabled={generating}
            >
              <Image className="h-4 w-4 mr-2" />
              Download PNG
            </Button>
            <Button
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-md btn-enhanced"
              onClick={handleDownloadPDF}
              disabled={generating}
            >
              <FileDown className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md btn-enhanced"
              onClick={handleShareWhatsApp}
              disabled={generating}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
            <Button
              variant="outline"
              className="border-gray-300 btn-enhanced"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Receipt Preview */}
      <Receipt claim={claim} ref={receiptRef} />
    </div>
  );
}
