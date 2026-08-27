'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Loader2, Printer, FileText, BarChart3, Clock, Users, Building2, Banknote,
  ClipboardList, Search, Download, FileSpreadsheet, FileDown, Lightbulb,
} from 'lucide-react';

interface Company { id: string; name: string }
interface OrderBooker { id: string; name: string }

// ─────────────────────────────────────────────
// Shared Export Helper — used by every report component
// ─────────────────────────────────────────────
export interface ExportFilters {
  reportType: string;
  status?: string;
  companyId?: string;
  supplierId?: string;
  orderBookerId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function exportReport(
  format: 'pdf' | 'excel',
  filters: ExportFilters,
  onSuccess?: () => void,
  onError?: (msg: string) => void
) {
  try {
    const params = new URLSearchParams();
    params.set('type', filters.reportType);
    params.set('t', String(Date.now())); // cache buster
    if (filters.status) params.set('status', filters.status);
    if (filters.companyId) params.set('companyId', filters.companyId);
    if (filters.supplierId) params.set('supplierId', filters.supplierId);
    if (filters.orderBookerId) params.set('orderBookerId', filters.orderBookerId);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);

    const endpoint = format === 'pdf' ? 'report-pdf' : 'report-excel';
    const ext = format === 'pdf' ? 'pdf' : 'xlsx';
    const url = `/api/export/${endpoint}?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to generate ${format.toUpperCase()}`);
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `al-falah-${filters.reportType}-report-${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
    onSuccess?.();
  } catch (err) {
    console.error(`${format} export error:`, err);
    const msg = err instanceof Error ? err.message : `Failed to export ${format.toUpperCase()}`;
    onError?.(msg);
    alert(`${format.toUpperCase()} export failed: ${msg}`);
  }
}

// ─────────────────────────────────────────────
// Report Action Buttons — Print + Export PDF + Export Excel
// Used by every report component with their local filters
// ─────────────────────────────────────────────
function ReportActionButtons({
  reportType,
  onPrint,
  filters,
}: {
  reportType: string;
  onPrint: () => void;
  filters: Omit<ExportFilters, 'reportType'>;
}) {
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  const handleExport = async (format: 'pdf' | 'excel') => {
    setExporting(format);
    await exportReport(format, { reportType, ...filters });
    setExporting(null);
  };

  return (
    <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }} className="no-print">
      <button className="btn btn-o btn-sm" onClick={onPrint}>
        <Printer className="ic sm" /> Print
      </button>
      <button
        className="btn btn-o btn-sm"
        onClick={() => handleExport('pdf')}
        disabled={exporting !== null}
        style={{ color: 'var(--af-bad)', borderColor: 'color-mix(in srgb, var(--af-bad) 35%, transparent)' }}
      >
        {exporting === 'pdf' ? (<><Loader2 className="ic sm animate-spin" /> Generating…</>) : (<><FileDown className="ic sm" /> PDF</>)}
      </button>
      <button
        className="btn btn-o btn-sm"
        onClick={() => handleExport('excel')}
        disabled={exporting !== null}
        style={{ color: 'var(--af-ok)', borderColor: 'color-mix(in srgb, var(--af-ok) 35%, transparent)' }}
      >
        {exporting === 'excel' ? (<><Loader2 className="ic sm animate-spin" /> Generating…</>) : (<><FileSpreadsheet className="ic sm" /> Excel</>)}
      </button>
    </div>
  );
}

interface ClaimItem {
  id: string;
  productId: string;
  quantity: number;
  amount: number;
  product: { name: string; price: number; claimPrice: number; unit: string; wholesalePrice: number | null; lmtPrice: number | null; company: { multiTierPricing: boolean } };
}

interface Claim {
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
  shop: { name: string; address: string; shopType?: string };
  supplier: { name: string };
  orderBooker: { name: string } | null;
  claimItems: ClaimItem[];
  clearedBy: string | null;
  clearedDate: string | null;
  rejectReason: string | null;
  createdAt: string;
}

// Normalize legacy statuses to current statuses
function normalizeStatus(status: string): string {
  if (status === 'arrived_approved') return 'approved';
  if (status === 'partially_approved' || status === 'partially_cleared') return 'partial';
  return status;
}

const statusBdg: Record<string, string> = {
  pending: 'pending',
  approved: 'arrived',
  partial: 'partial',
  cleared: 'cleared',
  rejected: 'rejected',
  arrived_approved: 'arrived',
  partially_approved: 'partial',
  partially_cleared: 'partial',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  partial: 'Partial',
  cleared: 'Cleared',
  rejected: 'Rejected',
  arrived_approved: 'Approved',
  partially_approved: 'Partial',
  partially_cleared: 'Partial',
};

// Compact KPI card for report summaries
function StatKpi({ label, value, icon: Icon, style }: { label: string; value: string | number; icon?: React.ElementType; style?: React.CSSProperties }) {
  return (
    <div className="kpi" style={style}>
      <div className="kpi-top">
        {Icon && <div className="kpi-ic"><Icon className="ic" /></div>}
      </div>
      <div>
        <div className="kpi-lbl">{label}</div>
        <div className="kpi-val">{value}</div>
      </div>
    </div>
  );
}

export function Reports({ user }: { user: { id: string; name: string; email: string; role: string; orderBookerId: string | null } }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [orderBookers, setOrderBookers] = useState<OrderBooker[]>([]);
  const [allClaims, setAllClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending_claims');

  const isAdmin = user.role === 'admin';

  const adminTabs = [
    { value: 'pending_claims', label: 'Pending (Arrived)', icon: Clock },
    { value: 'cleared_claims', label: 'Cleared Claims', icon: Banknote },
    { value: 'summary', label: 'Summary', icon: BarChart3 },
    { value: 'aging', label: 'Aging', icon: Clock },
    { value: 'performance', label: 'Order Booker', icon: Users },
    { value: 'company', label: 'Company-wise', icon: Building2 },
    { value: 'detail', label: 'Detail', icon: ClipboardList },
  ];

  const obTabs = [
    { value: 'pending', label: 'Pending', icon: Clock },
    { value: 'summary', label: 'Summary', icon: BarChart3 },
    { value: 'aging', label: 'Aging', icon: Clock },
  ];

  const tabs = isAdmin ? adminTabs : obTabs;

  // Load all data once
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [compRes, obRes, claimsRes] = await Promise.all([
        fetch('/api/companies'),
        fetch('/api/order-bookers'),
        fetch('/api/reports'),
      ]);
      if (compRes.ok) { const d = await compRes.json(); if (Array.isArray(d)) setCompanies(d); }
      else { console.error('Companies API error:', compRes.status); }

      if (obRes.ok) { const d = await obRes.json(); if (Array.isArray(d)) setOrderBookers(d); }
      else { console.error('Order Bookers API error:', obRes.status); }

      if (claimsRes.ok) {
        const d = await claimsRes.json();
        if (d && typeof d === 'object' && Array.isArray(d.claims)) {
          // If orderbooker, only show their claims
          if (!isAdmin && user.orderBookerId) {
            setAllClaims(d.claims.filter((c: Claim) => c.orderBookerId === user.orderBookerId));
          } else {
            setAllClaims(d.claims);
          }
        } else if (Array.isArray(d)) {
          // Fallback: if API returns array directly (like /api/claims)
          if (!isAdmin && user.orderBookerId) {
            setAllClaims(d.filter((c: Claim) => c.orderBookerId === user.orderBookerId));
          } else {
            setAllClaims(d);
          }
        }
      } else {
        // Fallback: try /api/claims if /api/reports fails
        console.error('Reports API error:', claimsRes.status, '- falling back to /api/claims');
        try {
          const fallbackRes = await fetch('/api/claims');
          if (fallbackRes.ok) {
            const d = await fallbackRes.json();
            if (Array.isArray(d)) {
              if (!isAdmin && user.orderBookerId) {
                setAllClaims(d.filter((c: Claim) => c.orderBookerId === user.orderBookerId));
              } else {
                setAllClaims(d);
              }
            }
          } else {
            setLoadError('Failed to load claims data. Please refresh the page.');
          }
        } catch (fallbackErr) {
          console.error('Fallback claims API error:', fallbackErr);
          setLoadError('Network error. Please check your connection and refresh.');
        }
      }
    } catch (e) {
      console.error('Reports load error:', e);
      setLoadError('Failed to load reports. Please refresh the page.');
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const formatAmount = (amount: number) => `Rs ${amount.toLocaleString()}`;
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  // Map UI tab to API report type
  const getReportType = (tab: string): string => {
    const map: Record<string, string> = {
      'pending': 'pending',
      'pending_claims': 'pending',
      'summary': 'summary',
      'aging': 'aging',
      'cleared': 'cleared',
      'cleared_claims': 'cleared',
      'detail': 'detail',
      'company': 'company',
      'performance': 'order-booker',
    };
    return map[tab] || 'all';
  };

  // Export to PDF
  const [exportingPdf, setExportingPdf] = useState(false);
  const handleExportPdf = async () => {
    try {
      setExportingPdf(true);
      const reportType = getReportType(activeTab);
      const url = `/api/export/report-pdf?type=${reportType}&t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `al-falah-${reportType}-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('PDF export failed. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  // Export to Excel
  const [exportingExcel, setExportingExcel] = useState(false);
  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      const reportType = getReportType(activeTab);
      const url = `/api/export/report-excel?type=${reportType}&t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to generate Excel');
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `al-falah-${reportType}-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Excel export error:', err);
      alert('Excel export failed. Please try again.');
    } finally {
      setExportingExcel(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state" style={{ minHeight: 320 }}>
        <Loader2 className="ic animate-spin" />
        <p className="small">Loading reports…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="card">
        <div className="empty-state" style={{ minHeight: 260 }}>
          <FileText className="ic" style={{ color: 'var(--af-bad)', opacity: 0.6 }} />
          <p style={{ color: 'var(--af-bad)', fontWeight: 600 }}>{loadError}</p>
          <button className="btn btn-p btn-sm" onClick={loadData}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header — hidden on print */}
      <div className="page-head no-print">
        <div>
          <div className="h1">Reports</div>
          <div className="sub">
            Claims performance aur financial summaries
            {!isAdmin && <span className="chip c1" style={{ marginLeft: 8 }}>My Claims Only</span>}
          </div>
        </div>
        <div className="ph-actions">
          <button
            className="btn btn-o"
            onClick={handleExportPdf}
            disabled={exportingPdf}
            style={{ color: 'var(--af-bad)', borderColor: 'color-mix(in srgb, var(--af-bad) 35%, transparent)' }}
          >
            {exportingPdf ? <Loader2 className="ic sm animate-spin" /> : <Download className="ic sm" />} PDF
          </button>
          <button
            className="btn btn-o"
            onClick={handleExportExcel}
            disabled={exportingExcel}
            style={{ color: 'var(--af-ok)', borderColor: 'color-mix(in srgb, var(--af-ok) 35%, transparent)' }}
          >
            {exportingExcel ? <Loader2 className="ic sm animate-spin" /> : <Download className="ic sm" />} Excel
          </button>
        </div>
      </div>

      {/* Tabs — mockup master-tabs */}
      <div className="master-tabs no-print">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              className={`mtab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.value)}
            >
              <Icon className="ic sm" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div ref={printRef} className="print-area" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {activeTab === 'pending' && <PendingClaimsReport companies={companies} orderBookers={orderBookers} allClaims={allClaims} formatAmount={formatAmount} onPrint={handlePrint} user={user} />}
        {activeTab === 'pending_claims' && isAdmin && <PendingClaimsArrivedReport companies={companies} orderBookers={orderBookers} allClaims={allClaims} formatAmount={formatAmount} onPrint={handlePrint} user={user} />}
        {activeTab === 'summary' && <ClaimsSummaryReport companies={companies} orderBookers={orderBookers} allClaims={allClaims} formatAmount={formatAmount} onPrint={handlePrint} user={user} />}
        {activeTab === 'aging' && <ClaimsAgingReport companies={companies} orderBookers={orderBookers} allClaims={allClaims} formatAmount={formatAmount} onPrint={handlePrint} user={user} />}
        {activeTab === 'performance' && isAdmin && <OBPerformanceReport orderBookers={orderBookers} allClaims={allClaims} formatAmount={formatAmount} onPrint={handlePrint} />}
        {activeTab === 'company' && isAdmin && <CompanyClaimsReport companies={companies} allClaims={allClaims} formatAmount={formatAmount} onPrint={handlePrint} />}
        {activeTab === 'cleared' && isAdmin && <ClearedPaymentReport companies={companies} orderBookers={orderBookers} allClaims={allClaims} formatAmount={formatAmount} onPrint={handlePrint} user={user} />}
        {activeTab === 'cleared_claims' && isAdmin && <ClearedClaimsReport companies={companies} orderBookers={orderBookers} allClaims={allClaims} formatAmount={formatAmount} onPrint={handlePrint} user={user} />}
        {activeTab === 'detail' && isAdmin && <ClaimDetailReport companies={companies} allClaims={allClaims} formatAmount={formatAmount} onPrint={handlePrint} />}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Shared filter bar + print header
   ───────────────────────────────────────────── */
function FilterBar({ children, actions }: { children: React.ReactNode; actions: React.ReactNode }) {
  return (
    <div className="filters card no-print">
      {children}
      <div className="spacer" />
      {actions}
    </div>
  );
}

function PrintHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="hidden print-block print-header">
      <h1 className="text-xl font-bold text-center">AL FALAH TRADERS</h1>
      <h2 className="text-lg font-semibold text-center mt-1">{title}</h2>
      {sub && <p className="text-sm text-center mt-1">{sub}</p>}
      <p className="text-xs text-center text-gray-500 mt-1">Generated: {new Date().toLocaleString()}</p>
      <hr className="my-3 border-gray-400" />
    </div>
  );
}

/* ─────────────────────────────────────────────
   REPORT 1: Pending Claims Report (Stock Not Received)
   ───────────────────────────────────────────── */
function PendingClaimsReport({ companies, orderBookers, allClaims, formatAmount, onPrint, user }: {
  companies: Company[]; orderBookers: OrderBooker[]; allClaims: Claim[]; formatAmount: (a: number) => string; onPrint: () => void; user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
}) {
  const isOB = user.role === 'orderbooker';
  const [filterOB, setFilterOB] = useState(isOB && user.orderBookerId ? user.orderBookerId : 'all');
  const [filterCompany, setFilterCompany] = useState('all');

  const filtered = allClaims.filter(c => {
    if (c.status !== 'pending') return false;
    if (filterOB !== 'all' && c.orderBookerId !== filterOB) return false;
    if (filterCompany !== 'all' && c.companyId !== filterCompany) return false;
    return true;
  });

  const grandTotal = filtered.reduce((s, c) => s + (c.netAmount || c.totalAmount), 0);
  const selectedOB = orderBookers.find(o => o.id === filterOB);
  const selectedComp = companies.find(c => c.id === filterCompany);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FilterBar actions={
        <ReportActionButtons
          reportType="pending"
          onPrint={onPrint}
          filters={{ orderBookerId: filterOB !== 'all' ? filterOB : undefined, companyId: filterCompany !== 'all' ? filterCompany : undefined }}
        />
      }>
        {isOB ? (
          <div className="sel" style={{ display: 'flex', alignItems: 'center', background: 'var(--af-surface2)', fontWeight: 600, color: 'var(--af-primary)', minWidth: 150 }}>
            {orderBookers.find(o => o.id === user.orderBookerId)?.name || user.name}
          </div>
        ) : (
          <select className="sel" value={filterOB} onChange={(e) => setFilterOB(e.target.value)}>
            <option value="all">All Order Bookers</option>
            {orderBookers.map(ob => <option key={ob.id} value={ob.id}>{ob.name}</option>)}
          </select>
        )}
        <select className="sel" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
          <option value="all">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </FilterBar>

      <PrintHeader
        title="Pending Claims Report"
        sub={selectedOB || selectedComp
          ? `${selectedOB ? `Order Booker: ${selectedOB.name}` : ''}${selectedOB && selectedComp ? ' | ' : ''}${selectedComp ? `Company: ${selectedComp.name}` : ''}`
          : undefined}
      />

      {/* Summary */}
      <div className="kpis print-hide-cards" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
        <StatKpi label="Pending Claims" value={filtered.length} icon={Clock} style={{ '--kc': 'linear-gradient(90deg,#f59e0b,#f97316)', '--kc2': 'var(--af-warn)', '--kb': 'var(--af-warn-soft)' } as React.CSSProperties} />
        <StatKpi label="Total Pending Amount" value={formatAmount(grandTotal)} icon={Banknote} />
      </div>
      <div className="hidden print-block print-summary">
        <span className="print-summary-item"><span className="print-summary-label">Pending Claims:</span> <span className="print-summary-value">{filtered.length}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Total Amount:</span> <span className="print-summary-value">{formatAmount(grandTotal)}</span></span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card"><div className="empty-state" style={{ minHeight: 200 }}>
          <FileText className="ic" />
          <p className="small">No pending claims found</p>
        </div></div>
      ) : (
        <div className="card tbl-wrap">
          <table className="tbl print-table">
            <thead>
              <tr className="print-bg-gray">
                <th>#</th><th>Claim #</th><th>Date</th><th>Company</th><th>Shop</th><th>Supplier</th><th>Order Booker</th><th className="num">Items</th><th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((claim, i) => (
                <tr key={claim.id}>
                  <td className="muted">{i + 1}</td>
                  <td className="strong claim-no">{claim.claimNumber}</td>
                  <td>{new Date(claim.date).toLocaleDateString()}</td>
                  <td>{claim.company.name}</td>
                  <td>{claim.shop.name}</td>
                  <td>{claim.supplier.name}</td>
                  <td>{claim.orderBooker?.name || '—'}</td>
                  <td className="num">{claim.claimItems.length}</td>
                  <td className="num strong">
                    {claim.deductionAmount > 0 ? (
                      <div>
                        <div>{formatAmount(claim.netAmount)}</div>
                        <div className="small" style={{ color: 'var(--af-warn)' }}>−{formatAmount(claim.deductionAmount)} ({claim.company.claimDeductionPercent}%)</div>
                      </div>
                    ) : formatAmount(claim.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="print-bg-light" style={{ fontWeight: 700 }}>
                <td colSpan={8} style={{ textAlign: 'right' }}>Grand Total:</td>
                <td className="num">{formatAmount(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   REPORT 2: Claims Summary Report (mockup: KPIs + bar chart + monthly table)
   ───────────────────────────────────────────── */
function ClaimsSummaryReport({ companies, orderBookers, allClaims, formatAmount, onPrint, user }: {
  companies: Company[]; orderBookers: OrderBooker[]; allClaims: Claim[]; formatAmount: (a: number) => string; onPrint: () => void; user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
}) {
  const isOB = user.role === 'orderbooker';
  const [filterOB, setFilterOB] = useState(isOB && user.orderBookerId ? user.orderBookerId : 'all');
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const filtered = allClaims.filter(c => {
    if (filterOB !== 'all' && c.orderBookerId !== filterOB) return false;
    if (filterCompany !== 'all' && c.companyId !== filterCompany) return false;
    if (filterDateFrom && new Date(c.date) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(c.date) > new Date(new Date(filterDateTo).setHours(23, 59, 59, 999))) return false;
    return true;
  });

  const totalAmount = filtered.reduce((s, c) => s + (c.netAmount || c.totalAmount), 0);
  const totalDeduction = filtered.reduce((s, c) => s + (c.deductionAmount || 0), 0);
  const totalApproved = filtered.reduce((s, c) => s + (c.approvedAmount || 0), 0);
  const pendingAmount = filtered.filter(c => normalizeStatus(c.status) === 'pending').reduce((s, c) => s + (c.netAmount || c.totalAmount), 0);
  const clearedAmount = filtered.filter(c => normalizeStatus(c.status) === 'cleared').reduce((s, c) => s + (c.approvedAmount || c.netAmount || c.totalAmount), 0);
  const rejectedAmount = filtered.filter(c => normalizeStatus(c.status) === 'rejected').reduce((s, c) => s + (c.netAmount || c.totalAmount), 0);
  const remainingAmount = totalAmount - totalApproved;

  const byStatus = {
    pending: filtered.filter(c => normalizeStatus(c.status) === 'pending').length,
    approved: filtered.filter(c => normalizeStatus(c.status) === 'approved').length,
    partial: filtered.filter(c => normalizeStatus(c.status) === 'partial').length,
    cleared: filtered.filter(c => normalizeStatus(c.status) === 'cleared').length,
    rejected: filtered.filter(c => normalizeStatus(c.status) === 'rejected').length,
  };

  const selectedOB = orderBookers.find(o => o.id === filterOB);
  const selectedComp = companies.find(c => c.id === filterCompany);

  // Monthly aggregation (mockup: Monthly Claims Performance)
  const monthly = useMemo(() => {
    const map = new Map<string, { label: string; claims: number; total: number; deduction: number; net: number; cleared: number }>();
    for (const c of filtered) {
      const d = new Date(c.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const e = map.get(key) || { label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), claims: 0, total: 0, deduction: 0, net: 0, cleared: 0 };
      e.claims += 1;
      e.total += c.totalAmount;
      e.deduction += c.deductionAmount || 0;
      e.net += c.netAmount || c.totalAmount;
      if (normalizeStatus(c.status) === 'cleared') e.cleared += 1;
      map.set(key, e);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  }, [filtered]);

  const maxMonthly = Math.max(1, ...monthly.map((m) => m.claims));
  const monthlyTotals = monthly.reduce((acc, m) => ({
    claims: acc.claims + m.claims,
    total: acc.total + m.total,
    deduction: acc.deduction + m.deduction,
    net: acc.net + m.net,
    cleared: acc.cleared + m.cleared,
  }), { claims: 0, total: 0, deduction: 0, net: 0, cleared: 0 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FilterBar actions={
        <ReportActionButtons
          reportType="summary"
          onPrint={onPrint}
          filters={{ orderBookerId: filterOB !== 'all' ? filterOB : undefined, companyId: filterCompany !== 'all' ? filterCompany : undefined, dateFrom: filterDateFrom || undefined, dateTo: filterDateTo || undefined }}
        />
      }>
        {isOB ? (
          <div className="sel" style={{ display: 'flex', alignItems: 'center', background: 'var(--af-surface2)', fontWeight: 600, color: 'var(--af-primary)', minWidth: 150 }}>
            {orderBookers.find(o => o.id === user.orderBookerId)?.name || user.name}
          </div>
        ) : (
          <select className="sel" value={filterOB} onChange={(e) => setFilterOB(e.target.value)}>
            <option value="all">All Order Bookers</option>
            {orderBookers.map(ob => <option key={ob.id} value={ob.id}>{ob.name}</option>)}
          </select>
        )}
        <select className="sel" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
          <option value="all">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <span className="label" style={{ margin: 0 }}>From</span>
          <input className="input" type="date" style={{ width: 'auto' }} value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
        </div>
        <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <span className="label" style={{ margin: 0 }}>To</span>
          <input className="input" type="date" style={{ width: 'auto' }} value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
        </div>
      </FilterBar>

      <PrintHeader
        title="Claims Summary Report"
        sub={selectedOB || selectedComp || filterDateFrom || filterDateTo
          ? `${selectedOB ? `OB: ${selectedOB.name}` : ''}${selectedOB && selectedComp ? ' | ' : ''}${selectedComp ? `Company: ${selectedComp.name}` : ''}${(filterDateFrom || filterDateTo) ? ` | ${filterDateFrom || 'Start'} to ${filterDateTo || 'Now'}` : ''}`
          : undefined}
      />

      {/* KPI cards (mockup) */}
      <div className="kpis print-hide-cards">
        <StatKpi label="Claims (in range)" value={filtered.length} icon={FileText} />
        <StatKpi label="Total Value" value={formatAmount(totalAmount)} icon={Banknote} style={{ '--kb': 'var(--af-violet-soft)', '--kc2': 'var(--af-violet)', '--kc': 'linear-gradient(90deg,#7c3aed,#8b5cf6)' } as React.CSSProperties} />
        <StatKpi label="Deductions" value={formatAmount(totalDeduction)} icon={BarChart3} style={{ '--kb': 'var(--af-bad-soft)', '--kc2': 'var(--af-bad)', '--kc': 'linear-gradient(90deg,#f43f5e,#e11d48)' } as React.CSSProperties} />
        <StatKpi label="Cleared" value={byStatus.cleared} icon={Banknote} style={{ '--kb': 'var(--af-ok-soft)', '--kc2': 'var(--af-ok)', '--kc': 'linear-gradient(90deg,#10b981,#059669)' } as React.CSSProperties} />
      </div>

      {/* Status mini stats */}
      <div className="mini-stats print-hide-decor">
        <div className="mstat"><Clock className="ic sm" /><b>{byStatus.pending}</b> pending</div>
        <div className="mstat"><Banknote className="ic sm" /><b>{byStatus.approved}</b> approved</div>
        <div className="mstat"><BarChart3 className="ic sm" /><b>{byStatus.partial}</b> partial</div>
        <div className="mstat"><FileText className="ic sm" /><b>{byStatus.cleared}</b> cleared</div>
        <div className="mstat"><FileText className="ic sm" /><b>{byStatus.rejected}</b> rejected</div>
        <div className="mstat">Remaining <b>{formatAmount(remainingAmount)}</b></div>
      </div>

      {/* Amount summary */}
      <div className="card print-hide-cards">
        <div className="card-b" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
          <div className="info-tile"><div className="k">Total Claim</div><div className="v">{formatAmount(totalAmount)}</div></div>
          <div className="info-tile"><div className="k">Cleared Amount</div><div className="v" style={{ color: 'var(--af-ok)' }}>{formatAmount(clearedAmount)}</div></div>
          <div className="info-tile"><div className="k">Approved Amount</div><div className="v" style={{ color: 'var(--af-info)' }}>{formatAmount(totalApproved)}</div></div>
          <div className="info-tile"><div className="k">Remaining Pending</div><div className="v" style={{ color: 'var(--af-warn)' }}>{formatAmount(remainingAmount)}</div></div>
          <div className="info-tile"><div className="k">Stock Pending Amount</div><div className="v">{formatAmount(pendingAmount)}</div></div>
          <div className="info-tile"><div className="k">Rejected Amount</div><div className="v" style={{ color: 'var(--af-bad)' }}>{formatAmount(rejectedAmount)}</div></div>
        </div>
      </div>
      <div className="hidden print-block print-summary">
        <span className="print-summary-item"><span className="print-summary-label">Total:</span> <span className="print-summary-value">{filtered.length}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Pending:</span> <span className="print-summary-value">{byStatus.pending}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Approved:</span> <span className="print-summary-value">{byStatus.approved}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Partial:</span> <span className="print-summary-value">{byStatus.partial}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Cleared:</span> <span className="print-summary-value">{byStatus.cleared}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Rejected:</span> <span className="print-summary-value">{byStatus.rejected}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Total Claim:</span> <span className="print-summary-value">{formatAmount(totalAmount)}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Cleared:</span> <span className="print-summary-value">{formatAmount(clearedAmount)}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Remaining:</span> <span className="print-summary-value">{formatAmount(remainingAmount)}</span></span>
      </div>

      {/* Monthly bar chart (mockup) */}
      {monthly.length > 1 && (
        <div className="card print-hide-decor">
          <div className="card-h">
            <div>
              <div className="card-t"><BarChart3 className="ic sm" /> Monthly Claims Performance</div>
              <div className="card-sub">Claims per month · all filtered companies</div>
            </div>
          </div>
          <div className="card-b">
            <div className="bars">
              {monthly.map((m, i) => (
                <div className="bar-col" key={m.label}>
                  <div className="bar-val">{m.claims}</div>
                  <div className={`bar ${i < monthly.length - 2 ? 'dim' : ''}`} style={{ ['--h' as string]: `${Math.max(4, (m.claims / maxMonthly) * 100)}%` }} />
                  <div className="bar-lbl">{m.label.split(' ')[0].slice(0, 3)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Monthly table (mockup) */}
      {monthly.length > 0 && (
        <div className="card tbl-wrap">
          <table className="tbl print-table">
            <thead>
              <tr className="print-bg-gray">
                <th>Month</th><th className="num">Claims</th><th className="num">Total (Rs)</th><th className="num">Deduction</th><th className="num">Net (Rs)</th><th className="num">Cleared</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m) => {
                const inProcess = m.claims - m.cleared;
                return (
                  <tr key={m.label} className={m === monthly[monthly.length - 1] && inProcess > 0 ? 'row-warn' : ''}>
                    <td className="strong">{m.label}</td>
                    <td className="num">{m.claims}</td>
                    <td className="num">{m.total.toLocaleString()}</td>
                    <td className="num">{m.deduction.toLocaleString()}</td>
                    <td className="num strong">{m.net.toLocaleString()}</td>
                    <td className="num">{m.cleared}</td>
                    <td>
                      {inProcess === 0
                        ? <span className="bdg cleared">Complete</span>
                        : <span className="bdg partial">{inProcess} in process</span>}
                    </td>
                  </tr>
                );
              })}
              <tr className="row-total">
                <td className="strong" style={{ fontSize: 14 }}>TOTAL</td>
                <td className="num strong" style={{ fontSize: 14 }}>{monthlyTotals.claims}</td>
                <td className="num strong" style={{ fontSize: 14 }}>{monthlyTotals.total.toLocaleString()}</td>
                <td className="num strong" style={{ fontSize: 14 }}>{monthlyTotals.deduction.toLocaleString()}</td>
                <td className="num strong" style={{ fontSize: 14, color: 'var(--af-primary)' }}>{monthlyTotals.net.toLocaleString()}</td>
                <td className="num strong" style={{ fontSize: 14 }}>{monthlyTotals.cleared}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* All Claims Table */}
      {filtered.length > 0 && (
        <div className="card tbl-wrap">
          <div className="card-h"><div className="card-t"><FileText className="ic sm" /> All Claims ({filtered.length})</div></div>
          <table className="tbl print-table">
            <thead>
              <tr className="print-bg-gray">
                <th>#</th><th>Claim #</th><th>Date</th><th>Company</th><th>Shop</th><th>Order Booker</th><th className="num">Total Claim</th><th className="num">Cleared</th><th className="num">Remaining</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id}>
                  <td className="muted">{i + 1}</td>
                  <td className="strong claim-no">{c.claimNumber}</td>
                  <td>{new Date(c.date).toLocaleDateString()}</td>
                  <td>{c.company.name}</td>
                  <td>{c.shop.name}</td>
                  <td>{c.orderBooker?.name || '—'}</td>
                  <td className="num strong">{formatAmount(c.totalAmount)}</td>
                  <td className="num">
                    {normalizeStatus(c.status) === 'approved' ? <span className="muted">Pending</span> : c.approvedAmount ? formatAmount(c.approvedAmount) : '—'}
                  </td>
                  <td className="num">
                    {normalizeStatus(c.status) === 'rejected' ? '—' : normalizeStatus(c.status) === 'approved' ? (
                      <span style={{ color: 'var(--af-primary)', fontWeight: 600 }}>{formatAmount(c.netAmount || c.totalAmount)}</span>
                    ) : (
                      <span style={{ color: c.totalAmount - (c.approvedAmount || 0) > 0 ? 'var(--af-bad)' : 'var(--af-ok)' }}>
                        {formatAmount(c.totalAmount - (c.approvedAmount || 0))}
                      </span>
                    )}
                  </td>
                  <td><span className={`bdg ${statusBdg[c.status] || 'neutral'}`}>{statusLabels[c.status] || c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="note no-print">
        <Lightbulb className="ic" />
        <div><b>Exports same rahenge:</b> PDF (landscape, full-width table) aur Excel dono — jo filters aapne lagaye hain wahi export honge. Layout improvements ke ilawa reporting logic mein koi change nahi.</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   REPORT 3: Claims Aging Report
   ───────────────────────────────────────────── */
function ClaimsAgingReport({ companies, orderBookers, allClaims, formatAmount, onPrint, user }: {
  companies: Company[]; orderBookers: OrderBooker[]; allClaims: Claim[]; formatAmount: (a: number) => string; onPrint: () => void; user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
}) {
  const isOB = user.role === 'orderbooker';
  const [filterOB, setFilterOB] = useState(isOB && user.orderBookerId ? user.orderBookerId : 'all');
  const [filterCompany, setFilterCompany] = useState('all');

  const pending = allClaims.filter(c => {
    // Include claims that are not yet cleared - pending, approved, and partial
    const ns = normalizeStatus(c.status);
    if (ns === 'cleared' || ns === 'rejected') return false;
    if (filterOB !== 'all' && c.orderBookerId !== filterOB) return false;
    if (filterCompany !== 'all' && c.companyId !== filterCompany) return false;
    return true;
  });

  const now = new Date();
  const getDays = (dateStr: string) => Math.floor((now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));

  const agingGroups = [
    { label: '0-7 Days', style: { '--kb': 'var(--af-ok-soft)', '--kc2': 'var(--af-ok)', '--kc': 'linear-gradient(90deg,#10b981,#059669)' } as React.CSSProperties, filter: (d: number) => d <= 7 },
    { label: '8-15 Days', style: { '--kb': 'var(--af-warn-soft)', '--kc2': 'var(--af-warn)', '--kc': 'linear-gradient(90deg,#f59e0b,#f97316)' } as React.CSSProperties, filter: (d: number) => d >= 8 && d <= 15 },
    { label: '16-30 Days', style: { '--kb': 'var(--af-violet-soft)', '--kc2': 'var(--af-violet)', '--kc': 'linear-gradient(90deg,#7c3aed,#8b5cf6)' } as React.CSSProperties, filter: (d: number) => d >= 16 && d <= 30 },
    { label: '30+ Days', style: { '--kb': 'var(--af-bad-soft)', '--kc2': 'var(--af-bad)', '--kc': 'linear-gradient(90deg,#f43f5e,#e11d48)' } as React.CSSProperties, filter: (d: number) => d > 30 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FilterBar actions={
        <ReportActionButtons
          reportType="aging"
          onPrint={onPrint}
          filters={{ orderBookerId: filterOB !== 'all' ? filterOB : undefined, companyId: filterCompany !== 'all' ? filterCompany : undefined }}
        />
      }>
        {isOB ? (
          <div className="sel" style={{ display: 'flex', alignItems: 'center', background: 'var(--af-surface2)', fontWeight: 600, color: 'var(--af-primary)', minWidth: 150 }}>
            {orderBookers.find(o => o.id === user.orderBookerId)?.name || user.name}
          </div>
        ) : (
          <select className="sel" value={filterOB} onChange={(e) => setFilterOB(e.target.value)}>
            <option value="all">All Order Bookers</option>
            {orderBookers.map(ob => <option key={ob.id} value={ob.id}>{ob.name}</option>)}
          </select>
        )}
        <select className="sel" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
          <option value="all">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </FilterBar>

      <PrintHeader title="Claims Aging Report" />

      {/* Aging summary KPIs */}
      <div className="kpis print-hide-decor" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
        {agingGroups.map(g => {
          const groupClaims = pending.filter(c => g.filter(getDays(c.createdAt || c.date)));
          const total = groupClaims.reduce((s, c) => s + c.totalAmount, 0);
          return (
            <StatKpi key={g.label} label={g.label} value={groupClaims.length} icon={Clock} style={g.style} />
          );
        })}
      </div>
      <div className="hidden print-block print-summary">
        {agingGroups.map(g => {
          const groupClaims = pending.filter(c => g.filter(getDays(c.createdAt || c.date)));
          const total = groupClaims.reduce((s, c) => s + c.totalAmount, 0);
          return (
            <span key={g.label} className="print-summary-item"><span className="print-summary-label">{g.label}:</span> <span className="print-summary-value">{groupClaims.length} ({formatAmount(total)})</span></span>
          );
        })}
      </div>

      {/* Detailed by Group */}
      {agingGroups.map(g => {
        const groupClaims = pending.filter(c => g.filter(getDays(c.createdAt || c.date)));
        if (groupClaims.length === 0) return null;
        return (
          <div className="card tbl-wrap" key={g.label}>
            <div className="card-h"><div className="card-t">{g.label} ({groupClaims.length} claims)</div></div>
            <table className="tbl print-table">
              <thead>
                <tr className="print-bg-gray">
                  <th>Claim #</th><th>Date</th><th>Company</th><th>Shop</th><th>Days</th><th className="num">Amount</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {groupClaims.map(c => (
                  <tr key={c.id}>
                    <td className="strong claim-no">{c.claimNumber}</td>
                    <td>{new Date(c.date).toLocaleDateString()}</td>
                    <td>{c.company.name}</td>
                    <td>{c.shop.name}</td>
                    <td><span className="chip">{getDays(c.createdAt || c.date)}d</span></td>
                    <td className="num strong">{formatAmount(c.totalAmount)}</td>
                    <td><span className={`bdg ${statusBdg[c.status] || 'neutral'}`}>{statusLabels[c.status] || c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   REPORT 4: Order Booker Performance Report
   ───────────────────────────────────────────── */
function OBPerformanceReport({ orderBookers, allClaims, formatAmount, onPrint }: {
  orderBookers: OrderBooker[]; allClaims: Claim[]; formatAmount: (a: number) => string; onPrint: () => void;
}) {
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const filtered = allClaims.filter(c => {
    if (filterDateFrom && new Date(c.date) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(c.date) > new Date(new Date(filterDateTo).setHours(23, 59, 59, 999))) return false;
    return true;
  });

  const obStats = orderBookers.map(ob => {
    const obClaims = filtered.filter(c => c.orderBookerId === ob.id);
    return {
      id: ob.id,
      name: ob.name,
      totalClaims: obClaims.length,
      totalAmount: obClaims.reduce((s, c) => s + c.totalAmount, 0),
      pending: obClaims.filter(c => normalizeStatus(c.status) === 'pending').length,
      pendingAmount: obClaims.filter(c => normalizeStatus(c.status) === 'pending').reduce((s, c) => s + c.totalAmount, 0),
      approved: obClaims.filter(c => normalizeStatus(c.status) === 'approved').length,
      approvedAmount: obClaims.filter(c => normalizeStatus(c.status) === 'approved').reduce((s, c) => s + (c.approvedAmount || c.totalAmount), 0),
      cleared: obClaims.filter(c => normalizeStatus(c.status) === 'cleared').length,
      clearedAmount: obClaims.filter(c => normalizeStatus(c.status) === 'cleared').reduce((s, c) => s + (c.approvedAmount || c.totalAmount), 0),
      remainingAmount: obClaims.reduce((s, c) => s + c.totalAmount, 0) - obClaims.reduce((s, c) => s + (c.approvedAmount || 0), 0),
      rejected: obClaims.filter(c => normalizeStatus(c.status) === 'rejected').length,
      rejectedAmount: obClaims.filter(c => normalizeStatus(c.status) === 'rejected').reduce((s, c) => s + c.totalAmount, 0),
      clearanceRate: obClaims.length > 0 ? Math.round((obClaims.filter(c => normalizeStatus(c.status) === 'cleared').length / obClaims.length) * 100) : 0,
    };
  }).sort((a, b) => b.totalAmount - a.totalAmount);

  const grandTotal = obStats.reduce((s, o) => s + o.totalAmount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FilterBar actions={
        <ReportActionButtons
          reportType="order-booker"
          onPrint={onPrint}
          filters={{ dateFrom: filterDateFrom || undefined, dateTo: filterDateTo || undefined }}
        />
      }>
        <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <span className="label" style={{ margin: 0 }}>From</span>
          <input className="input" type="date" style={{ width: 'auto' }} value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
        </div>
        <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <span className="label" style={{ margin: 0 }}>To</span>
          <input className="input" type="date" style={{ width: 'auto' }} value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
        </div>
      </FilterBar>

      <PrintHeader title="Order Booker Performance Report" sub={filterDateFrom || filterDateTo ? `${filterDateFrom || 'Start'} to ${filterDateTo || 'Now'}` : undefined} />

      <div className="card tbl-wrap">
        <table className="tbl print-table">
          <thead>
            <tr className="print-bg-gray">
              <th>Order Booker</th><th className="num">Total</th><th className="num">Total Claim</th><th className="num">Cleared</th><th className="num">Remaining</th><th className="num">Clear %</th>
            </tr>
          </thead>
          <tbody>
            {obStats.map(ob => (
              <tr key={ob.id}>
                <td className="strong">{ob.name}</td>
                <td className="num">{ob.totalClaims}</td>
                <td className="num strong">{formatAmount(ob.totalAmount)}</td>
                <td className="num" style={{ color: 'var(--af-info)' }}>{formatAmount(ob.clearedAmount)}</td>
                <td className="num">
                  <span style={{ color: ob.remainingAmount > 0 ? 'var(--af-bad)' : 'var(--af-ok)' }}>{formatAmount(ob.remainingAmount)}</span>
                </td>
                <td className="num">
                  <span style={{ fontWeight: 700, color: ob.clearanceRate >= 50 ? 'var(--af-ok)' : ob.clearanceRate >= 25 ? 'var(--af-warn)' : 'var(--af-bad)' }}>{ob.clearanceRate}%</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="print-bg-light" style={{ fontWeight: 700 }}>
              <td>Grand Total</td>
              <td className="num">{obStats.reduce((s, o) => s + o.totalClaims, 0)}</td>
              <td className="num">{formatAmount(grandTotal)}</td>
              <td className="num">{formatAmount(obStats.reduce((s, o) => s + o.clearedAmount, 0))}</td>
              <td className="num">{formatAmount(obStats.reduce((s, o) => s + o.remainingAmount, 0))}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   REPORT 5: Company-wise Claims Report
   ───────────────────────────────────────────── */
function CompanyClaimsReport({ companies, allClaims, formatAmount, onPrint }: {
  companies: Company[]; allClaims: Claim[]; formatAmount: (a: number) => string; onPrint: () => void;
}) {
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const filtered = allClaims.filter(c => {
    if (filterCompany !== 'all' && c.companyId !== filterCompany) return false;
    if (filterDateFrom && new Date(c.date) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(c.date) > new Date(new Date(filterDateTo).setHours(23, 59, 59, 999))) return false;
    return true;
  });

  // Group by company
  const companyGroups = companies.map(comp => {
    const compClaims = filtered.filter(c => c.companyId === comp.id);
    const compCleared = compClaims.filter(c => normalizeStatus(c.status) === 'cleared').reduce((s, c) => s + (c.approvedAmount || c.totalAmount), 0);
    const compTotal = compClaims.reduce((s, c) => s + c.totalAmount, 0);
    return {
      id: comp.id,
      name: comp.name,
      claims: compClaims,
      total: compTotal,
      pending: compClaims.filter(c => normalizeStatus(c.status) === 'pending').reduce((s, c) => s + c.totalAmount, 0),
      approved: compClaims.filter(c => normalizeStatus(c.status) === 'approved').reduce((s, c) => s + (c.approvedAmount || c.totalAmount), 0),
      cleared: compCleared,
      remaining: compTotal - compClaims.reduce((s, c) => s + (c.approvedAmount || 0), 0),
    };
  }).filter(g => g.claims.length > 0).sort((a, b) => b.total - a.total);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FilterBar actions={
        <ReportActionButtons
          reportType="company"
          onPrint={onPrint}
          filters={{ companyId: filterCompany !== 'all' ? filterCompany : undefined, dateFrom: filterDateFrom || undefined, dateTo: filterDateTo || undefined }}
        />
      }>
        <select className="sel" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
          <option value="all">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <span className="label" style={{ margin: 0 }}>From</span>
          <input className="input" type="date" style={{ width: 'auto' }} value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
        </div>
        <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <span className="label" style={{ margin: 0 }}>To</span>
          <input className="input" type="date" style={{ width: 'auto' }} value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
        </div>
      </FilterBar>

      <PrintHeader title="Company-wise Claims Report" />

      {/* Company Summary */}
      <div className="card tbl-wrap">
        <table className="tbl print-table">
          <thead>
            <tr className="print-bg-gray">
              <th>Company</th><th className="num">Claims</th><th className="num">Total Claim</th><th className="num">Cleared</th><th className="num">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {companyGroups.map(g => (
              <tr key={g.id}>
                <td className="strong">{g.name}</td>
                <td className="num">{g.claims.length}</td>
                <td className="num strong">{formatAmount(g.total)}</td>
                <td className="num" style={{ color: 'var(--af-info)' }}>{formatAmount(g.cleared)}</td>
                <td className="num">
                  <span style={{ color: g.remaining > 0 ? 'var(--af-bad)' : 'var(--af-ok)' }}>{formatAmount(g.remaining)}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="print-bg-light" style={{ fontWeight: 700 }}>
              <td>Total</td>
              <td className="num">{filtered.length}</td>
              <td className="num">{formatAmount(companyGroups.reduce((s, g) => s + g.total, 0))}</td>
              <td className="num">{formatAmount(companyGroups.reduce((s, g) => s + g.cleared, 0))}</td>
              <td className="num">{formatAmount(companyGroups.reduce((s, g) => s + g.remaining, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Detailed Claims per Company */}
      {filterCompany !== 'all' && companyGroups.map(g => (
        <div className="card tbl-wrap" key={g.id}>
          <div className="card-h"><div className="card-t">{g.name} — Claims Detail</div></div>
          <table className="tbl print-table">
            <thead>
              <tr className="print-bg-gray">
                <th>Claim #</th><th>Date</th><th>Shop</th><th>Order Booker</th><th className="num">Total Claim</th><th className="num">Cleared</th><th className="num">Remaining</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {g.claims.map(c => (
                <tr key={c.id}>
                  <td className="strong claim-no">{c.claimNumber}</td>
                  <td>{new Date(c.date).toLocaleDateString()}</td>
                  <td>{c.shop.name}</td>
                  <td>{c.orderBooker?.name || '—'}</td>
                  <td className="num">{formatAmount(c.totalAmount)}</td>
                  <td className="num">{normalizeStatus(c.status) === 'approved' ? <span className="muted">Pending</span> : c.approvedAmount ? formatAmount(c.approvedAmount) : '—'}</td>
                  <td className="num">
                    {normalizeStatus(c.status) === 'rejected' ? '—' : normalizeStatus(c.status) === 'approved' ? (
                      <span style={{ color: 'var(--af-primary)', fontWeight: 600 }}>{formatAmount(c.netAmount || c.totalAmount)}</span>
                    ) : (
                      <span style={{ color: c.totalAmount - (c.approvedAmount || 0) > 0 ? 'var(--af-bad)' : 'var(--af-ok)' }}>
                        {formatAmount(c.totalAmount - (c.approvedAmount || 0))}
                      </span>
                    )}
                  </td>
                  <td><span className={`bdg ${statusBdg[normalizeStatus(c.status)] || 'neutral'}`}>{statusLabels[normalizeStatus(c.status)]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   REPORT 6: Cleared/Payment Report
   ───────────────────────────────────────────── */
function ClearedPaymentReport({ companies, orderBookers, allClaims, formatAmount, onPrint }: {
  companies: Company[]; orderBookers: OrderBooker[]; allClaims: Claim[]; formatAmount: (a: number) => string; onPrint: () => void;
}) {
  const [filterOB, setFilterOB] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const cleared = allClaims.filter(c => {
    if (c.status !== 'cleared') return false;
    if (filterOB !== 'all' && c.orderBookerId !== filterOB) return false;
    if (filterCompany !== 'all' && c.companyId !== filterCompany) return false;
    if (filterDateFrom && c.clearedDate && new Date(c.clearedDate) < new Date(filterDateFrom)) return false;
    if (filterDateTo && c.clearedDate && new Date(c.clearedDate) > new Date(new Date(filterDateTo).setHours(23, 59, 59, 999))) return false;
    return true;
  });

  const grandTotal = cleared.reduce((s, c) => s + (c.approvedAmount || c.totalAmount), 0);
  const grandTotalClaim = cleared.reduce((s, c) => s + c.totalAmount, 0);
  const grandRemaining = grandTotalClaim - grandTotal;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FilterBar actions={
        <ReportActionButtons
          reportType="cleared"
          onPrint={onPrint}
          filters={{ status: 'cleared', orderBookerId: filterOB !== 'all' ? filterOB : undefined, companyId: filterCompany !== 'all' ? filterCompany : undefined, dateFrom: filterDateFrom || undefined, dateTo: filterDateTo || undefined }}
        />
      }>
        <select className="sel" value={filterOB} onChange={(e) => setFilterOB(e.target.value)}>
          <option value="all">All Order Bookers</option>
          {orderBookers.map(ob => <option key={ob.id} value={ob.id}>{ob.name}</option>)}
        </select>
        <select className="sel" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
          <option value="all">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <span className="label" style={{ margin: 0 }}>Cleared From</span>
          <input className="input" type="date" style={{ width: 'auto' }} value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
        </div>
        <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <span className="label" style={{ margin: 0 }}>To</span>
          <input className="input" type="date" style={{ width: 'auto' }} value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
        </div>
      </FilterBar>

      <PrintHeader title="Payment/Cleared Report" />

      {/* Summary */}
      <div className="card print-hide-cards">
        <div className="card-b" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
          <div className="info-tile"><div className="k">Total Claim</div><div className="v">{formatAmount(grandTotalClaim)}</div></div>
          <div className="info-tile"><div className="k">Cleared Amount</div><div className="v" style={{ color: 'var(--af-ok)' }}>{formatAmount(grandTotal)}</div></div>
          <div className="info-tile"><div className="k">Remaining</div><div className="v" style={{ color: 'var(--af-warn)' }}>{formatAmount(grandRemaining)}</div></div>
        </div>
      </div>

      {cleared.length > 0 ? (
        <div className="card tbl-wrap">
          <table className="tbl print-table">
            <thead>
              <tr className="print-bg-gray">
                <th>#</th><th>Claim #</th><th>Date</th><th>Company</th><th>Shop</th><th>Order Booker</th><th className="num">Total Claim</th><th className="num">Cleared</th><th className="num">Remaining</th><th>Cleared By</th><th>Cleared Date</th>
              </tr>
            </thead>
            <tbody>
              {cleared.map((c, i) => (
                <tr key={c.id}>
                  <td className="muted">{i + 1}</td>
                  <td className="strong claim-no">{c.claimNumber}</td>
                  <td>{new Date(c.date).toLocaleDateString()}</td>
                  <td>{c.company.name}</td>
                  <td>{c.shop.name}</td>
                  <td>{c.orderBooker?.name || '—'}</td>
                  <td className="num strong">{formatAmount(c.totalAmount)}</td>
                  <td className="num" style={{ color: 'var(--af-info)' }}>{formatAmount(c.approvedAmount || c.totalAmount)}</td>
                  <td className="num">
                    <span style={{ color: c.totalAmount - (c.approvedAmount || c.totalAmount) > 0 ? 'var(--af-bad)' : 'var(--af-ok)' }}>
                      {formatAmount(c.totalAmount - (c.approvedAmount || c.totalAmount))}
                    </span>
                  </td>
                  <td>{c.clearedBy || '—'}</td>
                  <td>{c.clearedDate ? new Date(c.clearedDate).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="print-bg-light" style={{ fontWeight: 700 }}>
                <td colSpan={6} style={{ textAlign: 'right' }}>Grand Total:</td>
                <td className="num">{formatAmount(grandTotalClaim)}</td>
                <td className="num" style={{ color: 'var(--af-info)' }}>{formatAmount(grandTotal)}</td>
                <td className="num" style={{ color: 'var(--af-warn)' }}>{formatAmount(grandRemaining)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="card"><div className="empty-state" style={{ minHeight: 200 }}>
          <Banknote className="ic" />
          <p className="small">No cleared claims found</p>
        </div></div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   REPORT: Approved Claims (Stock Arrived, Payment Pending)
   ───────────────────────────────────────────── */
function PendingClaimsArrivedReport({ companies, orderBookers, allClaims, formatAmount, onPrint, user }: {
  companies: Company[]; orderBookers: OrderBooker[]; allClaims: Claim[]; formatAmount: (a: number) => string; onPrint: () => void; user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
}) {
  const [filterOB, setFilterOB] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');

  // Approved + Partial Claims = Stock has ARRIVED on floor, payment still pending.
  const filtered = allClaims.filter(c => {
    const normalized = normalizeStatus(c.status);
    if (normalized !== 'approved' && normalized !== 'partial') return false;
    if (filterOB !== 'all' && c.orderBookerId !== filterOB) return false;
    if (filterCompany !== 'all' && c.companyId !== filterCompany) return false;
    return true;
  });

  const grandTotal = filtered.reduce((s, c) => s + (c.approvedAmount || c.netAmount || c.totalAmount), 0);
  const selectedOB = orderBookers.find(o => o.id === filterOB);
  const selectedComp = companies.find(c => c.id === filterCompany);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FilterBar actions={
        <ReportActionButtons
          reportType="approved"
          onPrint={onPrint}
          filters={{
            status: 'approved,partial',
            orderBookerId: filterOB !== 'all' ? filterOB : undefined,
            companyId: filterCompany !== 'all' ? filterCompany : undefined,
          }}
        />
      }>
        <select className="sel" value={filterOB} onChange={(e) => setFilterOB(e.target.value)}>
          <option value="all">All Order Bookers</option>
          {orderBookers.map(ob => <option key={ob.id} value={ob.id}>{ob.name}</option>)}
        </select>
        <select className="sel" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
          <option value="all">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </FilterBar>

      <PrintHeader
        title="Approved Claims Report (Stock Arrived)"
        sub={selectedOB || selectedComp
          ? `${selectedOB ? `Order Booker: ${selectedOB.name}` : ''}${selectedOB && selectedComp ? ' | ' : ''}${selectedComp ? `Company: ${selectedComp.name}` : ''}`
          : undefined}
      />

      {/* Summary */}
      <div className="kpis print-hide-cards" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
        <StatKpi label="Total Pending" value={filtered.length} icon={Clock} style={{ '--kb': 'var(--af-teal-soft)', '--kc2': 'var(--af-teal)', '--kc': 'linear-gradient(90deg,#14b8a6,#0d9488)' } as React.CSSProperties} />
        <StatKpi label="Stock Not Received" value={filtered.filter(c => normalizeStatus(c.status) === 'pending').length} icon={Clock} style={{ '--kb': 'var(--af-warn-soft)', '--kc2': 'var(--af-warn)', '--kc': 'linear-gradient(90deg,#f59e0b,#f97316)' } as React.CSSProperties} />
        <StatKpi label="Approved (Arrived)" value={filtered.filter(c => normalizeStatus(c.status) === 'approved').length} icon={Banknote} style={{ '--kb': 'var(--af-ok-soft)', '--kc2': 'var(--af-ok)', '--kc': 'linear-gradient(90deg,#10b981,#059669)' } as React.CSSProperties} />
        <StatKpi label="Total Amount" value={formatAmount(grandTotal)} icon={Banknote} />
      </div>
      <div className="hidden print-block print-summary">
        <span className="print-summary-item"><span className="print-summary-label">Total Pending:</span> <span className="print-summary-value">{filtered.length}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Stock Not Received:</span> <span className="print-summary-value">{filtered.filter(c => normalizeStatus(c.status) === 'pending').length}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Approved (Arrived):</span> <span className="print-summary-value">{filtered.filter(c => normalizeStatus(c.status) === 'approved').length}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Total Amount:</span> <span className="print-summary-value">{formatAmount(grandTotal)}</span></span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card"><div className="empty-state" style={{ minHeight: 200 }}>
          <FileText className="ic" />
          <p className="small">No pending claims (all claims are cleared)</p>
        </div></div>
      ) : (
        <div className="card tbl-wrap">
          <table className="tbl print-table">
            <thead>
              <tr className="print-bg-gray">
                <th>#</th><th>Claim #</th><th>Date</th><th>Status</th><th>Company</th><th>Shop</th><th>Supplier</th><th>Order Booker</th><th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((claim, i) => (
                <tr key={claim.id}>
                  <td className="muted">{i + 1}</td>
                  <td className="strong claim-no">{claim.claimNumber}</td>
                  <td>{new Date(claim.date).toLocaleDateString()}</td>
                  <td><span className={`bdg ${statusBdg[normalizeStatus(claim.status)] || 'neutral'}`}>{statusLabels[normalizeStatus(claim.status)] || claim.status}</span></td>
                  <td>{claim.company.name}</td>
                  <td>{claim.shop.name}</td>
                  <td>{claim.supplier.name}</td>
                  <td>{claim.orderBooker?.name || '—'}</td>
                  <td className="num strong" style={{ color: 'var(--af-teal)' }}>{formatAmount(claim.approvedAmount || claim.netAmount || claim.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="print-bg-light" style={{ fontWeight: 700 }}>
                <td colSpan={8} style={{ textAlign: 'right' }}>Grand Total:</td>
                <td className="num">{formatAmount(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   REPORT 7: Claim Detail Report (Single Claim)
   ───────────────────────────────────────────── */
function ClaimDetailReport({ companies, allClaims, formatAmount, onPrint }: {
  companies: Company[]; allClaims: Claim[]; formatAmount: (a: number) => string; onPrint: () => void;
}) {
  const [searchClaim, setSearchClaim] = useState('');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);

  const handleSearch = () => {
    const found = allClaims.find(c => c.claimNumber.toLowerCase() === searchClaim.toLowerCase() || c.id === searchClaim);
    setSelectedClaim(found || null);
  };

  const claim = selectedClaim;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="filters card no-print">
        <div className="f-search" style={{ flex: 1, width: 'auto', maxWidth: 340 }}>
          <Search className="ic sm" />
          <input
            placeholder="Enter Claim # (e.g. CLM-1)"
            value={searchClaim}
            onChange={(e) => setSearchClaim(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <button className="btn btn-p btn-sm" onClick={handleSearch}>Search</button>
        <div className="spacer" />
        {claim && (
          <ReportActionButtons reportType="detail" onPrint={onPrint} filters={{}} />
        )}
      </div>

      {!claim ? (
        <div className="card"><div className="empty-state" style={{ minHeight: 240 }}>
          <ClipboardList className="ic" />
          <p style={{ color: 'var(--af-text)', fontWeight: 600 }}>Enter a Claim # to view details</p>
        </div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PrintHeader title={`Claim Detail - ${claim.claimNumber}`} />

          {/* Claim Info */}
          <div className="card">
            <div className="card-h"><div className="card-t"><FileText className="ic sm" /> Claim Information</div></div>
            <div className="card-b">
              <div className="grid4" style={{ gap: 12 }}>
                <div className="info-tile"><div className="k">Claim #</div><div className="v" style={{ color: 'var(--af-primary)' }}>{claim.claimNumber}</div></div>
                <div className="info-tile"><div className="k">Date</div><div className="v">{new Date(claim.date).toLocaleDateString()}</div></div>
                <div className="info-tile"><div className="k">Status</div><div className="v"><span className={`bdg ${statusBdg[claim.status] || 'neutral'}`}>{statusLabels[claim.status] || claim.status}</span></div></div>
                <div className="info-tile"><div className="k">Total Amount</div><div className="v" style={{ color: 'var(--af-primary)' }}>{formatAmount(claim.totalAmount)}</div></div>
                <div className="info-tile"><div className="k">Company</div><div className="v">{claim.company.name}</div></div>
                <div className="info-tile"><div className="k">Shop</div><div className="v">{claim.shop.name}</div></div>
                <div className="info-tile"><div className="k">Supplier</div><div className="v">{claim.supplier.name}</div></div>
                <div className="info-tile"><div className="k">Order Booker</div><div className="v">{claim.orderBooker?.name || '—'}</div></div>
              </div>
            </div>
          </div>

          {/* Claim Items */}
          <div className="card tbl-wrap">
            <div className="card-h"><div className="card-t"><ClipboardList className="ic sm" /> Claim Items</div></div>
            <table className="tbl print-table">
              <thead>
                <tr className="print-bg-gray">
                  <th>#</th><th>Product</th><th className="num">Price</th><th className="num">Claim Price</th><th className="num">Qty</th><th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {claim.claimItems.map((item, i) => (
                  <tr key={item.id}>
                    <td className="muted">{i + 1}</td>
                    <td className="strong">{item.product.name}</td>
                    <td className="num">{formatAmount(item.product.price)}</td>
                    <td className="num">{formatAmount(item.product.claimPrice || item.product.price)}</td>
                    <td className="num">{item.quantity}</td>
                    <td className="num strong">{formatAmount(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="print-bg-light" style={{ fontWeight: 700 }}>
                  <td colSpan={5} style={{ textAlign: 'right' }}>Total:</td>
                  <td className="num">{formatAmount(claim.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   REPORT 8: Cleared Claims Report
   ───────────────────────────────────────────── */
function ClearedClaimsReport({ companies, orderBookers, allClaims, formatAmount, onPrint, user }: {
  companies: Company[]; orderBookers: OrderBooker[]; allClaims: Claim[]; formatAmount: (a: number) => string; onPrint: () => void; user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
}) {
  const [filterOB, setFilterOB] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');

  const filtered = allClaims.filter(c => {
    if (c.status !== 'cleared') return false;
    if (filterOB !== 'all' && c.orderBookerId !== filterOB) return false;
    if (filterCompany !== 'all' && c.companyId !== filterCompany) return false;
    return true;
  });

  const grandTotal = filtered.reduce((s, c) => s + (c.approvedAmount || c.netAmount || c.totalAmount), 0);
  const selectedOB = orderBookers.find(o => o.id === filterOB);
  const selectedComp = companies.find(c => c.id === filterCompany);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FilterBar actions={
        <ReportActionButtons
          reportType="cleared"
          onPrint={onPrint}
          filters={{ status: 'cleared', orderBookerId: filterOB !== 'all' ? filterOB : undefined, companyId: filterCompany !== 'all' ? filterCompany : undefined }}
        />
      }>
        <select className="sel" value={filterOB} onChange={(e) => setFilterOB(e.target.value)}>
          <option value="all">All Order Bookers</option>
          {orderBookers.map(ob => <option key={ob.id} value={ob.id}>{ob.name}</option>)}
        </select>
        <select className="sel" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
          <option value="all">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </FilterBar>

      <PrintHeader
        title="Cleared Claims Report"
        sub={selectedOB || selectedComp
          ? `${selectedOB ? `Order Booker: ${selectedOB.name}` : ''}${selectedOB && selectedComp ? ' | ' : ''}${selectedComp ? `Company: ${selectedComp.name}` : ''}`
          : undefined}
      />

      {/* Summary */}
      <div className="kpis print-hide-cards" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
        <StatKpi label="Cleared Claims" value={filtered.length} icon={Banknote} style={{ '--kb': 'var(--af-ok-soft)', '--kc2': 'var(--af-ok)', '--kc': 'linear-gradient(90deg,#10b981,#059669)' } as React.CSSProperties} />
        <StatKpi label="Total Cleared Amount" value={formatAmount(grandTotal)} icon={Banknote} />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card"><div className="empty-state" style={{ minHeight: 200 }}>
          <FileText className="ic" />
          <p className="small">No cleared claims found</p>
        </div></div>
      ) : (
        <div className="card tbl-wrap">
          <table className="tbl print-table">
            <thead>
              <tr className="print-bg-gray">
                <th>#</th><th>Claim #</th><th>Date</th><th>Company</th><th>Shop</th><th>Supplier</th><th>Order Booker</th><th className="num">Cleared Amount</th><th>Cleared By</th><th>Cleared Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((claim, i) => (
                <tr key={claim.id}>
                  <td className="muted">{i + 1}</td>
                  <td className="strong claim-no">{claim.claimNumber}</td>
                  <td>{new Date(claim.date).toLocaleDateString()}</td>
                  <td>{claim.company.name}</td>
                  <td>{claim.shop.name}</td>
                  <td>{claim.supplier.name}</td>
                  <td>{claim.orderBooker?.name || '—'}</td>
                  <td className="num strong" style={{ color: 'var(--af-info)' }}>{formatAmount(claim.approvedAmount || claim.netAmount || claim.totalAmount)}</td>
                  <td>{claim.clearedBy || '—'}</td>
                  <td>{claim.clearedDate ? new Date(claim.clearedDate).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="print-bg-light" style={{ fontWeight: 700 }}>
                <td colSpan={7} style={{ textAlign: 'right' }}>Grand Total:</td>
                <td className="num">{formatAmount(grandTotal)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
