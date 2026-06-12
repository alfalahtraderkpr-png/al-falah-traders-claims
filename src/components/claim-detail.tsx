'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, Share2, Printer, FileText, Image, FileDown, MessageCircle, Package, CheckCircle, Banknote, Camera } from 'lucide-react';
import { Receipt, ReceiptType } from './receipt';

interface ClaimDetailProps {
  claim: ClaimData;
  user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
  onBack: () => void;
}

interface ClaimAttachment {
  id: string;
  claimId: string;
  url: string;
  type: string;
  createdAt: string;
}

interface ClaimData {
  id: string;
  claimNumber: string;
  date: string;
  totalAmount: number;
  deductionAmount: number;
  netAmount: number;
  approvedAmount: number | null;
  status: string;
  companyId: string;
  shopId: string;
  supplierId: string;
  orderBookerId: string | null;
  company: { name: string; claimDeductionPercent?: number };
  shop: { name: string; address: string };
  supplier: { name: string };
  orderBooker: { name: string } | null;
  claimItems: Array<{
    id: string;
    productId: string;
    quantity: number;
    amount: number;
    product: { name: string; price: number; claimPrice: number; unit: string };
  }>;
  clearedBy: string | null;
  clearedDate: string | null;
  rejectReason: string | null;
  createdBy: string | null;
  attachments?: ClaimAttachment[];
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  approved: 'bg-green-100 text-green-800 border-green-300',
  partially_cleared: 'bg-orange-100 text-orange-800 border-orange-300',
  cleared: 'bg-blue-100 text-blue-800 border-blue-300',
  rejected: 'bg-red-100 text-red-800 border-red-300',
  // Legacy
  arrived_approved: 'bg-green-100 text-green-800 border-green-300',
  partially_approved: 'bg-orange-100 text-orange-800 border-orange-300',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  partially_cleared: 'Partially Cleared',
  cleared: 'Cleared',
  rejected: 'Rejected',
  // Legacy
  arrived_approved: 'Approved',
  partially_approved: 'Partially Cleared',
};

const statusLabelsOB: Record<string, string> = {
  pending: 'Stock Not Received',
  approved: 'Approved',
  partially_cleared: 'Partially Cleared',
  cleared: 'Cleared',
  rejected: 'Rejected',
  // Legacy
  arrived_approved: 'Approved',
  partially_approved: 'Partially Cleared',
};

const getStatusLabel = (status: string, isOrderBooker: boolean) => {
  return isOrderBooker ? (statusLabelsOB[status] || status) : (statusLabels[status] || status);
};

// Get prefilled WhatsApp text based on receipt type
function getWhatsAppText(claim: ClaimData, receiptType: ReceiptType): string {
  const formatAmount = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  switch (receiptType) {
    case 'received':
      return `\u2705 Al-Falah Traders - Expiry Stock Received\n\nClaim ID: ${claim.claimNumber}\nShop: ${claim.shop.name}\nCompany: ${claim.company.name}\nAmount: ${formatAmount(claim.netAmount || claim.totalAmount)}${claim.deductionAmount > 0 ? `\nDeduction: ${formatAmount(claim.deductionAmount)} (${claim.company.claimDeductionPercent}%)\nTotal: ${formatAmount(claim.totalAmount)}` : ''}\nDate: ${new Date(claim.date).toLocaleDateString()}\n\nClaim receive ho chuki hai. JazakAllah.`;
    case 'approved':
      return `\u2705 Al-Falah Traders - Claim Approved\n\nClaim ID: ${claim.claimNumber}\nShop: ${claim.shop.name}\nCompany: ${claim.company.name}\nTotal Claim: ${formatAmount(claim.totalAmount)}${claim.approvedAmount ? `\nApproved Amount: ${formatAmount(claim.approvedAmount)}` : ''}\n\nClaim approve ho chuki hai.`;
    case 'cleared':
      return `\u2705 Al-Falah Traders - Claim Cleared\n\nClaim ID: ${claim.claimNumber}\nShop: ${claim.shop.name}\nCompany: ${claim.company.name}\nTotal Claim: ${formatAmount(claim.totalAmount)}${claim.approvedAmount ? `\nCleared Amount: ${formatAmount(claim.approvedAmount)}` : ''}${claim.approvedAmount && claim.totalAmount - claim.approvedAmount > 0 ? `\nRemaining: ${formatAmount(claim.totalAmount - claim.approvedAmount)}` : ''}${claim.clearedBy ? `\nCleared By: ${claim.clearedBy}` : ''}\n\nClaim clear ho chuki hai. JazakAllah.`;
    default:
      return `Claim ${claim.claimNumber} - AL FALAH TRADERS`;
  }
}

// Get available receipt types based on claim status
function getAvailableReceiptTypes(status: string): { type: ReceiptType; label: string; icon: React.ReactNode; color: string; description: string }[] {
  const types = [
    { type: 'received' as ReceiptType, label: 'Expiry Stock Received', icon: <Package className="h-5 w-5" />, color: 'from-emerald-500 to-emerald-600', description: 'Stock receive confirmation' },
  ];

  if (status === 'approved' || status === 'partially_approved' || status === 'cleared') {
    types.push({ type: 'approved' as ReceiptType, label: 'Claim Approved', icon: <CheckCircle className="h-5 w-5" />, color: 'from-green-500 to-green-600', description: 'Approval confirmation' });
  }

  if (status === 'cleared') {
    types.push({ type: 'cleared' as ReceiptType, label: 'Claim Cleared', icon: <Banknote className="h-5 w-5" />, color: 'from-blue-500 to-blue-600', description: 'Claim cleared confirmation' });
  }

  return types;
}

export function ClaimDetail({ claim, user, onBack }: ClaimDetailProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedType, setSelectedType] = useState<ReceiptType>('received');
  const availableTypes = getAvailableReceiptTypes(claim.status);

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
      link.download = `claim-${claim.claimNumber}-${selectedType}.png`;
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
      pdf.save(`claim-${claim.claimNumber}-${selectedType}.pdf`);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  const handleShareWhatsApp = async (receiptType: ReceiptType) => {
    if (!receiptRef.current) return;
    setGenerating(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(receiptRef.current, {
        quality: 0.8,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const text = encodeURIComponent(getWhatsAppText(claim, receiptType));

      // Try native share first (works on mobile)
      if (navigator.share && navigator.canShare) {
        try {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], `claim-${claim.claimNumber}-${receiptType}.png`, { type: 'image/png' });

          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              text: getWhatsAppText(claim, receiptType),
              files: [file],
            });
            return;
          }
        } catch (shareError) {
          // If native share fails or is cancelled, fall through to WhatsApp web
          if ((shareError as Error).name !== 'AbortError') {
            console.log('Native share failed, falling back to WhatsApp web');
          } else {
            return; // User cancelled
          }
        }
      }

      // Fallback: Download image + open WhatsApp with prefilled text
      const link = document.createElement('a');
      link.download = `claim-${claim.claimNumber}-${receiptType}.png`;
      link.href = dataUrl;
      link.click();

      // Open WhatsApp with prefilled text
      window.open(`https://wa.me/?text=${text}`, '_blank');
    } catch (error) {
      console.error('WhatsApp share error:', error);
    } finally {
      setGenerating(false);
    }
  };

  // Quick share without image - just open WhatsApp with text
  const handleQuickShareWhatsApp = (receiptType: ReceiptType) => {
    const text = encodeURIComponent(getWhatsAppText(claim, receiptType));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between animate-slide-up">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={onBack} className="btn-enhanced btn-ripple border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 h-10 w-10 rounded-xl shadow-sm">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-emerald-800 flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Claim {claim.claimNumber}
            </h2>
            <Badge className={`${statusColors[claim.status]} border mt-1 transition-transform hover:scale-105 px-3 py-0.5`}>
              {getStatusLabel(claim.status, user.role === 'orderbooker')}
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
            {claim.createdBy && (
              <div className="bg-purple-50/50 rounded-lg p-2 transition-colors hover:bg-purple-50">
                <p className="text-muted-foreground text-xs">Entered By</p>
                <p className="font-medium text-purple-700">{claim.createdBy}</p>
              </div>
            )}
            <div className="bg-emerald-50/50 rounded-lg p-2 transition-colors hover:bg-emerald-50">
              <p className="text-muted-foreground text-xs">Total Claim</p>
              <p className="font-bold text-emerald-700">{formatAmount(claim.totalAmount)}</p>
            </div>
            {claim.deductionAmount > 0 && (
              <div className="bg-amber-50/50 rounded-lg p-2 transition-colors hover:bg-amber-50">
                <p className="text-muted-foreground text-xs">Deduction ({claim.company.claimDeductionPercent}%)</p>
                <p className="font-bold text-amber-700">- {formatAmount(claim.deductionAmount)}</p>
              </div>
            )}
            {claim.deductionAmount > 0 && (
              <div className="bg-blue-50/50 rounded-lg p-2 transition-colors hover:bg-blue-50">
                <p className="text-muted-foreground text-xs">Net Amount</p>
                <p className="font-bold text-blue-700">{formatAmount(claim.netAmount)}</p>
              </div>
            )}
            <div className="bg-blue-50/50 rounded-lg p-2 transition-colors hover:bg-blue-50">
              <p className="text-muted-foreground text-xs">Cleared Amount</p>
              <p className="font-bold text-blue-700">{claim.approvedAmount ? formatAmount(claim.approvedAmount) : '-'}</p>
            </div>
            {claim.approvedAmount !== null && claim.approvedAmount !== undefined && (
              <div className="bg-orange-50/50 rounded-lg p-2 transition-colors hover:bg-orange-50">
                <p className="text-muted-foreground text-xs">Remaining Pending</p>
                <p className={`font-bold ${claim.totalAmount - claim.approvedAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatAmount(claim.totalAmount - claim.approvedAmount)}
                </p>
              </div>
            )}
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
                    <td className="py-3 px-4 text-right">Rs.{item.product.claimPrice && item.product.claimPrice > 0 ? item.product.claimPrice : item.product.price}</td>
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
                {claim.deductionAmount > 0 && (
                  <tr className="bg-amber-50">
                    <td colSpan={4} className="py-3 px-4 text-right font-bold text-lg">
                      Deduction ({claim.company.claimDeductionPercent}%):
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-lg text-amber-700">
                      - {formatAmount(claim.deductionAmount)}
                    </td>
                  </tr>
                )}
                {claim.deductionAmount > 0 && (
                  <tr className="bg-blue-50">
                    <td colSpan={4} className="py-3 px-4 text-right font-bold text-lg">
                      Net Amount:
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-lg text-blue-700">
                      {formatAmount(claim.netAmount)}
                    </td>
                  </tr>
                )}
                {claim.approvedAmount !== null && (
                  <tr className="bg-blue-50">
                    <td colSpan={4} className="py-3 px-4 text-right font-bold text-lg">
                      Cleared:
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-lg text-blue-700">
                      {formatAmount(claim.approvedAmount)}
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Claim Photos Gallery */}
      {claim.attachments && claim.attachments.length > 0 && (
        <Card className="shadow-sm animate-fade-in-up" style={{ animationDelay: '180ms' }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="h-5 w-5 text-emerald-600" />
              Claim Photos
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{claim.attachments.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {claim.attachments.map((attachment) => (
                <div key={attachment.id} className="relative group rounded-lg overflow-hidden border aspect-square">
                  <img src={attachment.url} alt="Claim attachment" className="w-full h-full object-cover" />
                  <a
                    href={attachment.url}
                    download={`claim-${claim.claimNumber}-photo.png`}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <Download className="h-6 w-6 text-white" />
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Receipt Type Selection */}
      <Card className="shadow-sm animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <CardHeader>
          <CardTitle className="text-lg">Share Receipt on WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Receipt Type Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {availableTypes.map((t) => (
              <button
                key={t.type}
                onClick={() => setSelectedType(t.type)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  selectedType === t.type
                    ? `bg-gradient-to-r ${t.color} text-white shadow-lg scale-105`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Selected type description */}
          <p className="text-sm text-muted-foreground mb-4">
            {selectedType === 'received' && 'Stock receive confirmation - share when claim is first recorded'}
            {selectedType === 'approved' && 'Approval confirmation - share when claim is approved'}
            {selectedType === 'cleared' && 'Claim cleared confirmation - share when claim is cleared'}
          </p>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg btn-enhanced btn-ripple h-12 rounded-xl text-sm font-semibold"
              onClick={() => handleShareWhatsApp(selectedType)}
              disabled={generating}
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              WhatsApp
            </Button>
            <Button
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg btn-enhanced btn-ripple h-12 rounded-xl text-sm font-semibold"
              onClick={handleDownloadImage}
              disabled={generating}
            >
              <Image className="h-5 w-5 mr-2" />
              Download PNG
            </Button>
            <Button
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg btn-enhanced btn-ripple h-12 rounded-xl text-sm font-semibold"
              onClick={handleDownloadPDF}
              disabled={generating}
            >
              <FileDown className="h-5 w-5 mr-2" />
              Download PDF
            </Button>
            <Button
              variant="outline"
              className="border-2 border-gray-400 btn-enhanced btn-ripple h-12 rounded-xl text-sm font-semibold hover:bg-gray-50"
              onClick={handlePrint}
            >
              <Printer className="h-5 w-5 mr-2" />
              Print
            </Button>
          </div>

          {/* Quick Text Share */}
          <div className="mt-3 pt-3 border-t">
            <Button
              variant="outline"
              className="w-full border-2 border-green-400 text-green-700 hover:bg-green-50 btn-enhanced btn-ripple h-10 rounded-xl text-sm font-semibold"
              onClick={() => handleQuickShareWhatsApp(selectedType)}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Quick Share (Text Only - No Image)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Receipt Preview - centered for proper image generation */}
      <div className="flex justify-center">
        <div className="print-area w-full max-w-2xl">
          <Receipt claim={claim} receiptType={selectedType} ref={receiptRef} />
        </div>
      </div>
    </div>
  );
}
