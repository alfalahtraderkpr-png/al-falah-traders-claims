'use client';

import { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, Printer, FileText, Image as ImageIcon, FileDown, Loader2,
  MessageCircle, Package, CheckCircle, Banknote, Camera, Split, Clock,
  Lightbulb, XCircle,
} from 'lucide-react';
import { Receipt, ReceiptType, ReceiptCompanyInfo } from './receipt';

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

const statusBdg: Record<string, string> = {
  pending: 'pending',
  approved: 'arrived',
  partial: 'partial',
  cleared: 'cleared',
  rejected: 'rejected',
  // Legacy
  arrived_approved: 'arrived',
  partially_approved: 'partial',
  partially_cleared: 'partial',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  approved: 'Arrived & Approved',
  partial: 'Partial',
  cleared: 'Cleared',
  rejected: 'Rejected',
  // Legacy
  arrived_approved: 'Arrived & Approved',
  partially_approved: 'Partial',
  partially_cleared: 'Partial',
};

const statusLabelsOB: Record<string, string> = {
  ...statusLabels,
  pending: 'Stock Not Received',
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
    case 'partial':
      return `\u2705 Al-Falah Traders - Claim Partially Cleared\n\nClaim ID: ${claim.claimNumber}\nShop: ${claim.shop.name}\nCompany: ${claim.company.name}\nTotal Claim: ${formatAmount(claim.totalAmount)}${claim.approvedAmount ? `\nCleared So Far: ${formatAmount(claim.approvedAmount)}` : ''}${claim.approvedAmount ? `\nRemaining: ${formatAmount(claim.totalAmount - claim.approvedAmount)}` : ''}\n\nPartial amount deduct hui hai.`;
    case 'cleared':
      return `\u2705 Al-Falah Traders - Claim Cleared\n\nClaim ID: ${claim.claimNumber}\nShop: ${claim.shop.name}\nCompany: ${claim.company.name}\nTotal Claim: ${formatAmount(claim.totalAmount)}${claim.approvedAmount ? `\nCleared Amount: ${formatAmount(claim.approvedAmount)}` : ''}${claim.approvedAmount && claim.totalAmount - claim.approvedAmount > 0 ? `\nRemaining: ${formatAmount(claim.totalAmount - claim.approvedAmount)}` : ''}${claim.clearedBy ? `\nCleared By: ${claim.clearedBy}` : ''}\n\nClaim clear ho chuki hai. JazakAllah.`;
    default:
      return `Claim ${claim.claimNumber} - AL FALAH TRADERS`;
  }
}

// Helper: normalize legacy status to current status
const normalizeStatus = (status: string) => {
  if (status === 'arrived_approved') return 'approved';
  if (status === 'partially_approved' || status === 'partially_cleared') return 'partial';
  return status;
};

// Get available receipt types based on claim status
function getAvailableReceiptTypes(status: string): { type: ReceiptType; label: string; description: string }[] {
  const normStatus = normalizeStatus(status);
  const types = [
    { type: 'received' as ReceiptType, label: 'Expiry Stock Received', description: 'Stock receive confirmation — share when claim is first recorded' },
  ];

  if (normStatus === 'approved' || normStatus === 'partial' || normStatus === 'cleared') {
    types.push({ type: 'approved' as ReceiptType, label: 'Claim Approved', description: 'Approval confirmation — share when stock has arrived and claim is approved' });
  }

  if (normStatus === 'partial') {
    types.push({ type: 'partial' as ReceiptType, label: 'Partial', description: 'Partial payment confirmation — share when partial amount is deducted' });
  }

  if (normStatus === 'cleared') {
    types.push({ type: 'cleared' as ReceiptType, label: 'Claim Cleared', description: 'Claim cleared confirmation — share when full amount is deducted' });
  }

  return types;
}

export function ClaimDetail({ claim, user, onBack }: ClaimDetailProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedType, setSelectedType] = useState<ReceiptType>('received');
  const [company, setCompany] = useState<ReceiptCompanyInfo>({});
  const availableTypes = getAvailableReceiptTypes(claim.status);

  // Load company profile from Settings (used on receipt header + stamp)
  useEffect(() => {
    fetch('/api/settings', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (s) {
          setCompany({
            name: s.companyName || '',
            address: s.address || '',
            phone: s.phone || '',
            email: s.email || '',
            city: s.city || '',
          });
        }
      })
      .catch(() => {});
  }, []);

  const formatAmount = (amount: number) => `Rs ${amount.toLocaleString()}`;

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

  const norm = normalizeStatus(claim.status);
  const remaining = claim.totalAmount - (claim.approvedAmount || 0);

  // Timeline items derived from status
  const fmtDate = (d: string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const timeline: Array<{ title: string; desc: string; state: 'done' | 'current' | 'todo' }> = [
    { title: 'Claim created', desc: `${fmtDate(claim.date)} · by ${claim.createdBy || 'Admin'}`, state: 'done' },
    { title: 'Submitted for approval', desc: `${fmtDate(claim.date)} · Auto`, state: 'done' },
  ];
  if (norm === 'rejected') {
    timeline.push({ title: 'Rejected', desc: claim.rejectReason ? `Reason: ${claim.rejectReason}` : 'Rejected by admin', state: 'current' });
  } else {
    timeline.push({
      title: 'Stock received & verified',
      desc: norm === 'pending' ? 'Waiting for stock at distribution' : 'Stock arrived on floor',
      state: norm === 'pending' ? 'current' : 'done',
    });
    if (norm === 'cleared') {
      timeline.push({ title: 'Payment cleared', desc: claim.clearedDate ? `${fmtDate(claim.clearedDate)}${claim.clearedBy ? ` · by ${claim.clearedBy}` : ''}` : 'Cleared', state: 'done' });
    } else {
      timeline.push({ title: 'Awaiting payment clearance', desc: norm === 'partial' ? `Partial deducted: ${formatAmount(claim.approvedAmount || 0)} · remaining ${formatAmount(remaining)}` : 'In progress', state: 'current' });
      timeline.push({ title: 'Cleared', desc: 'Pending', state: 'todo' });
    }
  }

  const selectedTypeDesc = availableTypes.find((t) => t.type === selectedType)?.description || '';

  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft className="ic sm" /> Back to claims
      </button>

      <div className="page-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div className="h1">{claim.claimNumber}</div>
            <span className={`bdg ${statusBdg[claim.status] || 'neutral'}`}>
              {getStatusLabel(claim.status, user.role === 'orderbooker')}
            </span>
          </div>
          <div className="sub">
            {claim.shop.name} · {claim.company.name} · Submitted {new Date(claim.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            {claim.orderBooker ? ` by ${claim.orderBooker.name}` : ''}
          </div>
        </div>
        <div className="ph-actions no-print">
          <button className="btn btn-o" onClick={handleShareWhatsApp.bind(null, selectedType)} disabled={generating}>
            <MessageCircle className="ic sm" /> WhatsApp
          </button>
          <button className="btn btn-o" onClick={handleDownloadImage} disabled={generating}>
            <ImageIcon className="ic sm" /> PNG
          </button>
          <button className="btn btn-o" onClick={handleDownloadPDF} disabled={generating}>
            <FileDown className="ic sm" /> PDF
          </button>
          <button className="btn btn-p" onClick={handlePrint}>
            <Printer className="ic sm" /> Print Receipt
          </button>
        </div>
      </div>

      {claim.rejectReason && (
        <div className="note" style={{ borderColor: 'var(--af-bad)', background: 'var(--af-bad-soft)' }}>
          <XCircle className="ic" style={{ color: 'var(--af-bad)' }} />
          <div><b style={{ color: 'var(--af-bad)' }}>Reject Reason:</b> {claim.rejectReason}</div>
        </div>
      )}

      <div className="detail-grid">
        {/* ── LEFT: claim info + items ─────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-h"><div className="card-t"><FileText className="ic sm" /> Claim Information</div></div>
            <div className="card-b">
              <div className="grid4" style={{ gap: 12 }}>
                <div className="info-tile"><div className="k">Company</div><div className="v">{claim.company.name}</div></div>
                <div className="info-tile"><div className="k">Shop</div><div className="v">{claim.shop.name}</div></div>
                <div className="info-tile"><div className="k">Supplier</div><div className="v">{claim.supplier.name}</div></div>
                <div className="info-tile"><div className="k">Order Booker</div><div className="v">{claim.orderBooker?.name || '—'}</div></div>
              </div>
              <div className="grid4" style={{ gap: 12, marginTop: 12 }}>
                <div className="info-tile"><div className="k">Claim Date</div><div className="v">{new Date(claim.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
                <div className="info-tile"><div className="k">Address</div><div className="v" style={{ fontSize: 12.5 }}>{claim.shop.address || '—'}</div></div>
                <div className="info-tile"><div className="k">Entered By</div><div className="v">{claim.createdBy || '—'}</div></div>
                <div className="info-tile"><div className="k">Payment Status</div>
                  <div className="v" style={{ color: norm === 'cleared' ? 'var(--af-ok)' : norm === 'rejected' ? 'var(--af-bad)' : norm === 'partial' ? 'var(--af-violet)' : 'var(--af-teal)' }}>
                    {norm === 'cleared' ? 'Cleared' : norm === 'rejected' ? 'Rejected' : norm === 'partial' ? 'Partial cleared' : norm === 'approved' ? 'Awaiting clearance' : 'Awaiting stock'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <div className="card-t"><Package className="ic sm" /> Items ({claim.claimItems.length})</div>
            </div>
            <div className="tbl-wrap card-b tight">
              <table className="tbl" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th>#</th><th>Product</th><th className="num">Qty</th><th className="num">Claim Rate</th><th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {claim.claimItems.map((item, index) => (
                    <tr key={item.id}>
                      <td className="muted">{index + 1}</td>
                      <td className="strong">{item.product.name}</td>
                      <td className="num">{item.quantity} {item.product.unit}</td>
                      <td className="num">Rs {item.product.claimPrice && item.product.claimPrice > 0 ? item.product.claimPrice : item.product.price}</td>
                      <td className="num strong">{formatAmount(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── RIGHT: payment summary + timeline + attachments ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-h"><div className="card-t"><Banknote className="ic sm" /> Payment Summary</div></div>
            <div className="card-b">
              <div className="sum-row"><span>Total Amount</span><b>{formatAmount(claim.totalAmount)}</b></div>
              {claim.deductionAmount > 0 && (
                <div className="sum-row">
                  <span>Deduction ({claim.company.claimDeductionPercent}% company policy)</span>
                  <b style={{ color: 'var(--af-bad)' }}>− {formatAmount(claim.deductionAmount)}</b>
                </div>
              )}
              <div className="sum-row">
                <span>{norm === 'approved' ? 'Payment' : 'Deducted Amount'}</span>
                <b>{norm === 'approved' ? 'Pending' : claim.approvedAmount ? formatAmount(claim.approvedAmount) : '—'}</b>
              </div>
              {norm !== 'approved' && claim.approvedAmount !== null && claim.approvedAmount !== undefined && (
                <div className="sum-row">
                  <span>Balance Due</span>
                  <b style={remaining > 0 ? { color: 'var(--af-bad)' } : { color: 'var(--af-ok)' }}>{formatAmount(remaining)}</b>
                </div>
              )}
              <div className="sum-total">
                <span className="lbl">Net Payable</span>
                <span className="val">{formatAmount(claim.netAmount || claim.totalAmount)}</span>
              </div>
              {claim.clearedBy && (
                <p className="small muted" style={{ marginTop: 10 }}>
                  Cleared by <b style={{ color: 'var(--af-text)' }}>{claim.clearedBy}</b>
                  {claim.clearedDate ? ` on ${new Date(claim.clearedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                </p>
              )}
              <p className="small muted" style={{ marginTop: 8, textAlign: 'center' }}>
                Status changes Claims list se hoti hain (⋯ menu)
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><div className="card-t"><Clock className="ic sm" /> Timeline</div></div>
            <div className="card-b">
              <div className="tl">
                {timeline.map((t, i) => (
                  <div className={`tl-item ${t.state === 'done' ? 'done' : t.state === 'current' ? 'current' : ''}`} key={i}>
                    <div className="tl-dot" />
                    <div>
                      <div className="tl-t" style={t.state === 'todo' ? { color: 'var(--af-text3)' } : undefined}>{t.title}</div>
                      <div className="tl-d">{t.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {claim.attachments && claim.attachments.length > 0 && (
            <div className="card">
              <div className="card-h"><div className="card-t"><Camera className="ic sm" /> Attachments ({claim.attachments.length})</div></div>
              <div className="card-b">
                <div className="attach-row">
                  {claim.attachments.map((attachment) => (
                    <a className="attach" key={attachment.id} href={attachment.url} download={`claim-${claim.claimNumber}-photo.png`} title="Download">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={attachment.url} alt="Claim attachment" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Receipt sharing section */}
      <div className="card no-print">
        <div className="card-h">
          <div>
            <div className="card-t"><MessageCircle className="ic sm" /> Share Receipt on WhatsApp</div>
            <div className="card-sub">{selectedTypeDesc}</div>
          </div>
        </div>
        <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div className="master-tabs">
            {availableTypes.map((t) => (
              <button
                key={t.type}
                className={`mtab ${selectedType === t.type ? 'active' : ''}`}
                onClick={() => setSelectedType(t.type)}
              >
                {t.type === 'received' && <Package className="ic sm" />}
                {t.type === 'approved' && <CheckCircle className="ic sm" />}
                {t.type === 'partial' && <Split className="ic sm" />}
                {t.type === 'cleared' && <Banknote className="ic sm" />}
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <button
              className="btn btn-p"
              onClick={() => handleShareWhatsApp(selectedType)}
              disabled={generating}
            >
              {generating ? <Loader2 className="ic sm animate-spin" /> : <MessageCircle className="ic sm" />} WhatsApp (Image + Text)
            </button>
            <button className="btn btn-o" onClick={handleQuickShareWhatsApp.bind(null, selectedType)}>
              <MessageCircle className="ic sm" /> Quick Share (Text Only)
            </button>
            <button className="btn btn-o" onClick={handleDownloadImage} disabled={generating}>
              <ImageIcon className="ic sm" /> Download PNG
            </button>
            <button className="btn btn-o" onClick={handleDownloadPDF} disabled={generating}>
              <FileDown className="ic sm" /> Download PDF
            </button>
            <button className="btn btn-o" onClick={handlePrint}>
              <Printer className="ic sm" /> Print
            </button>
          </div>
        </div>
      </div>

      {/* Receipt Preview - centered for proper image generation */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="print-area" style={{ width: '100%', maxWidth: 720 }}>
          <Receipt claim={claim} receiptType={selectedType} company={company} ref={receiptRef} />
        </div>
      </div>

      <div className="note no-print">
        <Lightbulb className="ic" />
        <div><b>Timeline audit trail:</b> Har step ka record claim ke status se aata hai — kisne, kab, kya kiya. Receipt print ka format bilkul wahi rahega jo abhi hai, sirf styling upgrade hogi.</div>
      </div>
    </>
  );
}
