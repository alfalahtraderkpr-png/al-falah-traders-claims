'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Printer, FileText, BarChart3, Clock, Users, Building2, Banknote, ClipboardList, Search } from 'lucide-react';

interface Company { id: string; name: string }
interface Supplier { id: string; name: string }
interface OrderBooker { id: string; name: string }

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
  claimItems: ClaimItem[];
  clearedBy: string | null;
  clearedDate: string | null;
  rejectReason: string | null;
  createdAt: string;
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
  partially_approved: 'Partial',
  cleared: 'Cleared',
  rejected: 'Rejected',
};

export function Reports({ user }: { user: { id: string; name: string; email: string; role: string; orderBookerId: string | null } }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [orderBookers, setOrderBookers] = useState<OrderBooker[]>([]);
  const [allClaims, setAllClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  const isAdmin = user.role === 'admin';

  const adminTabs = [
    { value: 'pending', label: 'Pending', icon: Clock },
    { value: 'summary', label: 'Summary', icon: BarChart3 },
    { value: 'aging', label: 'Aging', icon: Clock },
    { value: 'performance', label: 'OB Report', icon: Users },
    { value: 'company', label: 'Company', icon: Building2 },
    { value: 'cleared', label: 'Payments', icon: Banknote },
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
        console.log('Reports: Loaded', allClaims.length, 'claims from API');
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
              console.log('Reports: Loaded', d.length, 'claims from fallback /api/claims');
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

  const formatAmount = (amount: number) => `Rs. ${amount.toLocaleString()}`;
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-3" />
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <FileText className="h-12 w-12 text-red-300 mx-auto mb-3" />
          <p className="text-red-600 font-medium mb-2">{loadError}</p>
          <Button onClick={loadData} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header - hidden on print */}
      <div className="flex justify-between items-center no-print">
        <h2 className="text-2xl font-bold text-emerald-800 flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          Reports
        </h2>
        {!isAdmin && (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 px-3 py-1">
            My Claims Only
          </Badge>
        )}
      </div>

      {/* iOS-style Sliding Tab Navigation */}
      <div className="no-print">
        <div className="relative flex items-center bg-gray-200/80 backdrop-blur-sm rounded-xl p-1.5 overflow-x-auto scrollbar-hide gap-0.5">
          {/* Sliding white indicator */}
          <div
            className="absolute top-1.5 h-[calc(100%-12px)] bg-white rounded-lg shadow-md border border-gray-100/50 transition-all duration-300 ease-out z-0"
            style={{
              width: `${100 / tabs.length}%`,
              left: `calc(${(tabs.findIndex(t => t.value === activeTab) / tabs.length) * 100}% + 6px)`,
              maxWidth: `calc(${100 / tabs.length}% - 4px)`,
            }}
          />
          {/* Tab buttons */}
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`relative z-10 flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-200 whitespace-nowrap flex-1 ${
                  isActive ? 'text-emerald-700' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden text-[10px]">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div ref={printRef} className="print-area">
        {activeTab === 'pending' && <PendingClaimsReport companies={companies} orderBookers={orderBookers} allClaims={allClaims} formatAmount={formatAmount} onPrint={handlePrint} />}
        {activeTab === 'summary' && <ClaimsSummaryReport companies={companies} orderBookers={orderBookers} allClaims={allClaims} formatAmount={formatAmount} onPrint={handlePrint} />}
        {activeTab === 'aging' && <ClaimsAgingReport companies={companies} orderBookers={orderBookers} allClaims={allClaims} formatAmount={formatAmount} onPrint={handlePrint} />}
        {activeTab === 'performance' && isAdmin && <OBPerformanceReport orderBookers={orderBookers} allClaims={allClaims} formatAmount={formatAmount} onPrint={handlePrint} />}
        {activeTab === 'company' && isAdmin && <CompanyClaimsReport companies={companies} allClaims={allClaims} formatAmount={formatAmount} onPrint={handlePrint} />}
        {activeTab === 'cleared' && isAdmin && <ClearedPaymentReport companies={companies} orderBookers={orderBookers} allClaims={allClaims} formatAmount={formatAmount} onPrint={handlePrint} />}
        {activeTab === 'detail' && isAdmin && <ClaimDetailReport companies={companies} allClaims={allClaims} formatAmount={formatAmount} onPrint={handlePrint} />}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   REPORT 1: Pending Claims Report
   ───────────────────────────────────────────── */
function PendingClaimsReport({ companies, orderBookers, allClaims, formatAmount, onPrint }: {
  companies: Company[]; orderBookers: OrderBooker[]; allClaims: Claim[]; formatAmount: (a: number) => string; onPrint: () => void;
}) {
  const [filterOB, setFilterOB] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');

  const filtered = allClaims.filter(c => {
    if (c.status !== 'pending') return false;
    if (filterOB !== 'all' && c.orderBookerId !== filterOB) return false;
    if (filterCompany !== 'all' && c.companyId !== filterCompany) return false;
    return true;
  });

  const grandTotal = filtered.reduce((s, c) => s + c.totalAmount, 0);
  const selectedOB = orderBookers.find(o => o.id === filterOB);
  const selectedComp = companies.find(c => c.id === filterCompany);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="shadow-sm no-print">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={filterOB} onValueChange={setFilterOB}>
              <SelectTrigger><SelectValue placeholder="Order Booker" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Order Bookers</SelectItem>
                {orderBookers.map(ob => <SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger><SelectValue placeholder="Company" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={onPrint} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Printer className="h-4 w-4 mr-2" /> Print Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Print Header */}
      <div className="hidden print-block print-header">
        <h1 className="text-xl font-bold text-center">AL FALAH TRADERS</h1>
        <h2 className="text-lg font-semibold text-center mt-1">Pending Claims Report</h2>
        {(selectedOB || selectedComp) && (
          <p className="text-sm text-center mt-1">
            {selectedOB ? `Order Booker: ${selectedOB.name}` : ''}
            {selectedOB && selectedComp ? ' | ' : ''}
            {selectedComp ? `Company: ${selectedComp.name}` : ''}
          </p>
        )}
        <p className="text-xs text-center text-gray-500 mt-1">Generated: {new Date().toLocaleString()}</p>
        <hr className="my-3 border-gray-400" />
      </div>

      {/* Summary - screen: cards, print: inline compact row */}
      <Card className="shadow-sm print-hide-cards">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-yellow-50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Pending Claims</p>
              <p className="text-2xl font-bold text-yellow-700">{filtered.length}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Total Pending Amount</p>
              <p className="text-2xl font-bold text-emerald-700">{formatAmount(grandTotal)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Print-only compact summary */}
      <div className="hidden print-block print-summary">
        <span className="print-summary-item"><span className="print-summary-label">Pending Claims:</span> <span className="print-summary-value">{filtered.length}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Total Amount:</span> <span className="print-summary-value">{formatAmount(grandTotal)}</span></span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="shadow-sm"><CardContent className="py-12 text-center"><FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" /><p className="text-muted-foreground">No pending claims found</p></CardContent></Card>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm print-table">
                <thead>
                  <tr className="border-b bg-gray-50 print-bg-gray">
                    <th className="text-left py-2 px-3 font-medium">#</th>
                    <th className="text-left py-2 px-3 font-medium">Claim #</th>
                    <th className="text-left py-2 px-3 font-medium">Date</th>
                    <th className="text-left py-2 px-3 font-medium">Company</th>
                    <th className="text-left py-2 px-3 font-medium">Shop</th>
                    <th className="text-left py-2 px-3 font-medium">Supplier</th>
                    <th className="text-left py-2 px-3 font-medium">Order Booker</th>
                    <th className="text-left py-2 px-3 font-medium">Items</th>
                    <th className="text-right py-2 px-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((claim, i) => (
                    <tr key={claim.id} className="border-b">
                      <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 px-3 font-medium text-emerald-700">{claim.claimNumber}</td>
                      <td className="py-2 px-3">{new Date(claim.date).toLocaleDateString()}</td>
                      <td className="py-2 px-3">{claim.company.name}</td>
                      <td className="py-2 px-3">{claim.shop.name}</td>
                      <td className="py-2 px-3">{claim.supplier.name}</td>
                      <td className="py-2 px-3">{claim.orderBooker?.name || '-'}</td>
                      <td className="py-2 px-3 text-center">{claim.claimItems.length}</td>
                      <td className="py-2 px-3 text-right font-medium">{formatAmount(claim.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-emerald-600 bg-emerald-50 print-bg-light">
                    <td colSpan={8} className="py-2 px-3 font-bold text-emerald-800 text-right">Grand Total:</td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-800">{formatAmount(grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   REPORT 2: Claims Summary Report
   ───────────────────────────────────────────── */
function ClaimsSummaryReport({ companies, orderBookers, allClaims, formatAmount, onPrint }: {
  companies: Company[]; orderBookers: OrderBooker[]; allClaims: Claim[]; formatAmount: (a: number) => string; onPrint: () => void;
}) {
  const [filterOB, setFilterOB] = useState('all');
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

  const totalAmount = filtered.reduce((s, c) => s + c.totalAmount, 0);
  const totalApproved = filtered.reduce((s, c) => s + (c.approvedAmount || 0), 0);
  const pendingAmount = filtered.filter(c => c.status === 'pending').reduce((s, c) => s + c.totalAmount, 0);
  const clearedAmount = filtered.filter(c => c.status === 'cleared').reduce((s, c) => s + (c.approvedAmount || c.totalAmount), 0);
  const rejectedAmount = filtered.filter(c => c.status === 'rejected').reduce((s, c) => s + c.totalAmount, 0);
  const remainingAmount = totalAmount - totalApproved;

  const byStatus = {
    pending: filtered.filter(c => c.status === 'pending').length,
    approved: filtered.filter(c => c.status === 'approved').length,
    partially_approved: filtered.filter(c => c.status === 'partially_approved').length,
    cleared: filtered.filter(c => c.status === 'cleared').length,
    rejected: filtered.filter(c => c.status === 'rejected').length,
  };

  const selectedOB = orderBookers.find(o => o.id === filterOB);
  const selectedComp = companies.find(c => c.id === filterCompany);

  return (
    <div className="space-y-4">
      <Card className="shadow-sm no-print">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Select value={filterOB} onValueChange={setFilterOB}>
              <SelectTrigger><SelectValue placeholder="Order Booker" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Order Bookers</SelectItem>{orderBookers.map(ob => <SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger><SelectValue placeholder="Company" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Companies</SelectItem>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            <Button onClick={onPrint} className="bg-emerald-600 hover:bg-emerald-700 text-white"><Printer className="h-4 w-4 mr-2" /> Print</Button>
          </div>
        </CardContent>
      </Card>

      <div className="hidden print-block print-header">
        <h1 className="text-xl font-bold text-center">AL FALAH TRADERS</h1>
        <h2 className="text-lg font-semibold text-center mt-1">Claims Summary Report</h2>
        {(selectedOB || selectedComp || filterDateFrom || filterDateTo) && (
          <p className="text-sm text-center mt-1">
            {selectedOB ? `OB: ${selectedOB.name}` : ''}{selectedOB && selectedComp ? ' | ' : ''}{selectedComp ? `Company: ${selectedComp.name}` : ''}
            {(filterDateFrom || filterDateTo) ? ` | ${filterDateFrom || 'Start'} to ${filterDateTo || 'Now'}` : ''}
          </p>
        )}
        <p className="text-xs text-center text-gray-500 mt-1">Generated: {new Date().toLocaleString()}</p>
        <hr className="my-3 border-gray-400" />
      </div>

      {/* Summary Cards - hidden in print */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 print-hide-decor">
        <Card className="shadow-sm bg-emerald-50 border-0"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Total Claims</p><p className="text-xl font-bold text-emerald-700">{filtered.length}</p></CardContent></Card>
        <Card className="shadow-sm bg-yellow-50 border-0"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Pending</p><p className="text-xl font-bold text-yellow-700">{byStatus.pending}</p></CardContent></Card>
        <Card className="shadow-sm bg-green-50 border-0"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Approved</p><p className="text-xl font-bold text-green-700">{byStatus.approved + byStatus.partially_approved}</p></CardContent></Card>
        <Card className="shadow-sm bg-blue-50 border-0"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Cleared</p><p className="text-xl font-bold text-blue-700">{byStatus.cleared}</p></CardContent></Card>
        <Card className="shadow-sm bg-red-50 border-0"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Rejected</p><p className="text-xl font-bold text-red-700">{byStatus.rejected}</p></CardContent></Card>
      </div>

      {/* Amount Summary - hidden in print */}
      <Card className="shadow-sm print-hide-cards">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
            <div className="bg-emerald-50 rounded-lg p-3"><p className="text-xs text-muted-foreground">Total Claim</p><p className="text-lg font-bold text-emerald-700">{formatAmount(totalAmount)}</p></div>
            <div className="bg-blue-50 rounded-lg p-3"><p className="text-xs text-muted-foreground">Cleared Amount</p><p className="text-lg font-bold text-blue-700">{formatAmount(clearedAmount)}</p></div>
            <div className="bg-orange-50 rounded-lg p-3"><p className="text-xs text-muted-foreground">Remaining Pending</p><p className="text-lg font-bold text-orange-700">{formatAmount(remainingAmount)}</p></div>
            <div className="bg-yellow-50 rounded-lg p-3"><p className="text-xs text-muted-foreground">Pending Amount</p><p className="text-lg font-bold text-yellow-700">{formatAmount(pendingAmount)}</p></div>
            <div className="bg-green-50 rounded-lg p-3"><p className="text-xs text-muted-foreground">Approved Amount</p><p className="text-lg font-bold text-green-700">{formatAmount(totalApproved)}</p></div>
          </div>
        </CardContent>
      </Card>
      {/* Print-only compact summary */}
      <div className="hidden print-block print-summary">
        <span className="print-summary-item"><span className="print-summary-label">Total:</span> <span className="print-summary-value">{filtered.length}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Pending:</span> <span className="print-summary-value">{byStatus.pending}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Approved:</span> <span className="print-summary-value">{byStatus.approved + byStatus.partially_approved}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Cleared:</span> <span className="print-summary-value">{byStatus.cleared}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Rejected:</span> <span className="print-summary-value">{byStatus.rejected}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Total Claim:</span> <span className="print-summary-value">{formatAmount(totalAmount)}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Cleared:</span> <span className="print-summary-value">{formatAmount(clearedAmount)}</span></span>
        <span className="print-summary-item"><span className="print-summary-label">Remaining:</span> <span className="print-summary-value">{formatAmount(remainingAmount)}</span></span>
      </div>

      {/* All Claims Table */}
      {filtered.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm print-table">
                <thead><tr className="border-b bg-gray-50 print-bg-gray">
                  <th className="text-left py-2 px-3 font-medium">#</th>
                  <th className="text-left py-2 px-3 font-medium">Claim #</th>
                  <th className="text-left py-2 px-3 font-medium">Date</th>
                  <th className="text-left py-2 px-3 font-medium">Company</th>
                  <th className="text-left py-2 px-3 font-medium">Shop</th>
                  <th className="text-left py-2 px-3 font-medium">Order Booker</th>
                  <th className="text-right py-2 px-3 font-medium">Total Claim</th>
                  <th className="text-right py-2 px-3 font-medium">Cleared</th>
                  <th className="text-right py-2 px-3 font-medium">Remaining</th>
                  <th className="text-center py-2 px-3 font-medium">Status</th>
                </tr></thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={c.id} className="border-b">
                      <td className="py-2 px-3">{i + 1}</td>
                      <td className="py-2 px-3 font-medium text-emerald-700">{c.claimNumber}</td>
                      <td className="py-2 px-3">{new Date(c.date).toLocaleDateString()}</td>
                      <td className="py-2 px-3">{c.company.name}</td>
                      <td className="py-2 px-3">{c.shop.name}</td>
                      <td className="py-2 px-3">{c.orderBooker?.name || '-'}</td>
                      <td className="py-2 px-3 text-right font-medium">{formatAmount(c.totalAmount)}</td>
                      <td className="py-2 px-3 text-right font-medium text-blue-700">{c.approvedAmount ? formatAmount(c.approvedAmount) : '-'}</td>
                      <td className="py-2 px-3 text-right font-medium">
                        {c.status === 'rejected' ? '-' : (
                          <span className={c.totalAmount - (c.approvedAmount || 0) > 0 ? 'text-red-600' : 'text-green-600'}>
                            {formatAmount(c.totalAmount - (c.approvedAmount || 0))}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center"><Badge className={`${statusColors[c.status]} border text-xs`}>{statusLabels[c.status]}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   REPORT 3: Claims Aging Report
   ───────────────────────────────────────────── */
function ClaimsAgingReport({ companies, orderBookers, allClaims, formatAmount, onPrint }: {
  companies: Company[]; orderBookers: OrderBooker[]; allClaims: Claim[]; formatAmount: (a: number) => string; onPrint: () => void;
}) {
  const [filterOB, setFilterOB] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');

  const pending = allClaims.filter(c => {
    // Include claims that are not yet cleared - pending, approved, and partially_approved
    if (c.status === 'cleared' || c.status === 'rejected') return false;
    if (filterOB !== 'all' && c.orderBookerId !== filterOB) return false;
    if (filterCompany !== 'all' && c.companyId !== filterCompany) return false;
    return true;
  });

  const now = new Date();
  const getDays = (dateStr: string) => Math.floor((now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));

  const agingGroups = [
    { label: '0-7 Days', color: 'bg-green-50 border-green-200', textColor: 'text-green-700', filter: (d: number) => d <= 7 },
    { label: '8-15 Days', color: 'bg-yellow-50 border-yellow-200', textColor: 'text-yellow-700', filter: (d: number) => d >= 8 && d <= 15 },
    { label: '16-30 Days', color: 'bg-orange-50 border-orange-200', textColor: 'text-orange-700', filter: (d: number) => d >= 16 && d <= 30 },
    { label: '30+ Days', color: 'bg-red-50 border-red-200', textColor: 'text-red-700', filter: (d: number) => d > 30 },
  ];

  return (
    <div className="space-y-4">
      <Card className="shadow-sm no-print">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={filterOB} onValueChange={setFilterOB}>
              <SelectTrigger><SelectValue placeholder="Order Booker" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Order Bookers</SelectItem>{orderBookers.map(ob => <SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger><SelectValue placeholder="Company" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Companies</SelectItem>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={onPrint} className="bg-emerald-600 hover:bg-emerald-700 text-white"><Printer className="h-4 w-4 mr-2" /> Print</Button>
          </div>
        </CardContent>
      </Card>

      <div className="hidden print-block print-header">
        <h1 className="text-xl font-bold text-center">AL FALAH TRADERS</h1>
        <h2 className="text-lg font-semibold text-center mt-1">Claims Aging Report</h2>
        <p className="text-xs text-center text-gray-500 mt-1">Generated: {new Date().toLocaleString()}</p>
        <hr className="my-3 border-gray-400" />
      </div>

      {/* Aging Summary Cards - hidden in print */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print-hide-decor">
        {agingGroups.map(g => {
          const groupClaims = pending.filter(c => g.filter(getDays(c.createdAt || c.date)));
          const total = groupClaims.reduce((s, c) => s + c.totalAmount, 0);
          return (
            <Card key={g.label} className={`shadow-sm border ${g.color}`}>
              <CardContent className="p-4 text-center">
                <p className={`text-sm font-semibold ${g.textColor}`}>{g.label}</p>
                <p className="text-2xl font-bold">{groupClaims.length}</p>
                <p className="text-sm font-medium">{formatAmount(total)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {/* Print-only compact aging summary */}
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
          <Card key={g.label} className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className={`text-sm ${g.textColor}`}>{g.label} ({groupClaims.length} claims)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm print-table">
                  <thead><tr className="border-b bg-gray-50 print-bg-gray">
                    <th className="text-left py-2 px-3 font-medium">Claim #</th>
                    <th className="text-left py-2 px-3 font-medium">Date</th>
                    <th className="text-left py-2 px-3 font-medium">Company</th>
                    <th className="text-left py-2 px-3 font-medium">Shop</th>
                    <th className="text-left py-2 px-3 font-medium">Days</th>
                    <th className="text-right py-2 px-3 font-medium">Amount</th>
                    <th className="text-center py-2 px-3 font-medium">Status</th>
                  </tr></thead>
                  <tbody>
                    {groupClaims.map(c => (
                      <tr key={c.id} className="border-b">
                        <td className="py-2 px-3 font-medium text-emerald-700">{c.claimNumber}</td>
                        <td className="py-2 px-3">{new Date(c.date).toLocaleDateString()}</td>
                        <td className="py-2 px-3">{c.company.name}</td>
                        <td className="py-2 px-3">{c.shop.name}</td>
                        <td className="py-2 px-3"><Badge variant="outline" className="text-xs">{getDays(c.createdAt || c.date)}d</Badge></td>
                        <td className="py-2 px-3 text-right font-medium">{formatAmount(c.totalAmount)}</td>
                        <td className="py-2 px-3 text-center"><Badge className={`${statusColors[c.status]} border text-xs`}>{statusLabels[c.status]}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
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
      pending: obClaims.filter(c => c.status === 'pending').length,
      pendingAmount: obClaims.filter(c => c.status === 'pending').reduce((s, c) => s + c.totalAmount, 0),
      approved: obClaims.filter(c => c.status === 'approved' || c.status === 'partially_approved').length,
      approvedAmount: obClaims.filter(c => c.status === 'approved' || c.status === 'partially_approved').reduce((s, c) => s + (c.approvedAmount || c.totalAmount), 0),
      cleared: obClaims.filter(c => c.status === 'cleared').length,
      clearedAmount: obClaims.filter(c => c.status === 'cleared').reduce((s, c) => s + (c.approvedAmount || c.totalAmount), 0),
      remainingAmount: obClaims.reduce((s, c) => s + c.totalAmount, 0) - obClaims.reduce((s, c) => s + (c.approvedAmount || 0), 0),
      rejected: obClaims.filter(c => c.status === 'rejected').length,
      rejectedAmount: obClaims.filter(c => c.status === 'rejected').reduce((s, c) => s + c.totalAmount, 0),
      clearanceRate: obClaims.length > 0 ? Math.round((obClaims.filter(c => c.status === 'cleared').length / obClaims.length) * 100) : 0,
    };
  }).sort((a, b) => b.totalAmount - a.totalAmount);

  const grandTotal = obStats.reduce((s, o) => s + o.totalAmount, 0);

  return (
    <div className="space-y-4">
      <Card className="shadow-sm no-print">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            <Button onClick={onPrint} className="bg-emerald-600 hover:bg-emerald-700 text-white"><Printer className="h-4 w-4 mr-2" /> Print</Button>
          </div>
        </CardContent>
      </Card>

      <div className="hidden print-block print-header">
        <h1 className="text-xl font-bold text-center">AL FALAH TRADERS</h1>
        <h2 className="text-lg font-semibold text-center mt-1">Order Booker Performance Report</h2>
        {(filterDateFrom || filterDateTo) && <p className="text-sm text-center mt-1">{filterDateFrom || 'Start'} to {filterDateTo || 'Now'}</p>}
        <p className="text-xs text-center text-gray-500 mt-1">Generated: {new Date().toLocaleString()}</p>
        <hr className="my-3 border-gray-400" />
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm print-table">
              <thead><tr className="border-b bg-gray-50 print-bg-gray">
                <th className="text-left py-2 px-3 font-medium">Order Booker</th>
                <th className="text-center py-2 px-3 font-medium">Total</th>
                <th className="text-right py-2 px-3 font-medium">Total Claim</th>
                <th className="text-right py-2 px-3 font-medium">Cleared</th>
                <th className="text-right py-2 px-3 font-medium">Remaining</th>
                <th className="text-center py-2 px-3 font-medium">Clear %</th>
              </tr></thead>
              <tbody>
                {obStats.map(ob => (
                  <tr key={ob.id} className="border-b">
                    <td className="py-2 px-3 font-medium">{ob.name}</td>
                    <td className="py-2 px-3 text-center">{ob.totalClaims}</td>
                    <td className="py-2 px-3 text-right font-bold">{formatAmount(ob.totalAmount)}</td>
                    <td className="py-2 px-3 text-right text-blue-700">{formatAmount(ob.clearedAmount)}</td>
                    <td className="py-2 px-3 text-right font-medium">
                      <span className={ob.remainingAmount > 0 ? 'text-red-600' : 'text-green-600'}>{formatAmount(ob.remainingAmount)}</span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`font-medium ${ob.clearanceRate >= 50 ? 'text-green-700' : ob.clearanceRate >= 25 ? 'text-yellow-700' : 'text-red-700'}`}>{ob.clearanceRate}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-emerald-600 bg-emerald-50 print-bg-light">
                  <td className="py-2 px-3 font-bold">Grand Total</td>
                  <td className="py-2 px-3 text-center font-bold">{obStats.reduce((s, o) => s + o.totalClaims, 0)}</td>
                  <td className="py-2 px-3 text-right font-bold">{formatAmount(grandTotal)}</td>
                  <td className="py-2 px-3 text-right font-bold">{formatAmount(obStats.reduce((s, o) => s + o.clearedAmount, 0))}</td>
                  <td className="py-2 px-3 text-right font-bold">{formatAmount(obStats.reduce((s, o) => s + o.remainingAmount, 0))}</td>
                  <td className="py-2 px-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
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
    const compCleared = compClaims.filter(c => c.status === 'cleared').reduce((s, c) => s + (c.approvedAmount || c.totalAmount), 0);
    const compTotal = compClaims.reduce((s, c) => s + c.totalAmount, 0);
    return {
      id: comp.id,
      name: comp.name,
      claims: compClaims,
      total: compTotal,
      pending: compClaims.filter(c => c.status === 'pending').reduce((s, c) => s + c.totalAmount, 0),
      approved: compClaims.filter(c => c.status === 'approved' || c.status === 'partially_approved').reduce((s, c) => s + (c.approvedAmount || c.totalAmount), 0),
      cleared: compCleared,
      remaining: compTotal - compClaims.reduce((s, c) => s + (c.approvedAmount || 0), 0),
    };
  }).filter(g => g.claims.length > 0).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <Card className="shadow-sm no-print">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger><SelectValue placeholder="Company" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Companies</SelectItem>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            <Button onClick={onPrint} className="bg-emerald-600 hover:bg-emerald-700 text-white"><Printer className="h-4 w-4 mr-2" /> Print</Button>
          </div>
        </CardContent>
      </Card>

      <div className="hidden print-block print-header">
        <h1 className="text-xl font-bold text-center">AL FALAH TRADERS</h1>
        <h2 className="text-lg font-semibold text-center mt-1">Company-wise Claims Report</h2>
        <p className="text-xs text-center text-gray-500 mt-1">Generated: {new Date().toLocaleString()}</p>
        <hr className="my-3 border-gray-400" />
      </div>

      {/* Company Summary */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm print-table">
              <thead><tr className="border-b bg-gray-50 print-bg-gray">
                <th className="text-left py-2 px-3 font-medium">Company</th>
                <th className="text-center py-2 px-3 font-medium">Claims</th>
                <th className="text-right py-2 px-3 font-medium">Total Claim</th>
                <th className="text-right py-2 px-3 font-medium">Cleared</th>
                <th className="text-right py-2 px-3 font-medium">Remaining</th>
              </tr></thead>
              <tbody>
                {companyGroups.map(g => (
                  <tr key={g.id} className="border-b">
                    <td className="py-2 px-3 font-medium">{g.name}</td>
                    <td className="py-2 px-3 text-center">{g.claims.length}</td>
                    <td className="py-2 px-3 text-right font-bold">{formatAmount(g.total)}</td>
                    <td className="py-2 px-3 text-right text-blue-700">{formatAmount(g.cleared)}</td>
                    <td className="py-2 px-3 text-right font-medium">
                      <span className={g.remaining > 0 ? 'text-red-600' : 'text-green-600'}>{formatAmount(g.remaining)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-emerald-600 bg-emerald-50 print-bg-light">
                  <td className="py-2 px-3 font-bold">Total</td>
                  <td className="py-2 px-3 text-center font-bold">{filtered.length}</td>
                  <td className="py-2 px-3 text-right font-bold">{formatAmount(companyGroups.reduce((s, g) => s + g.total, 0))}</td>
                  <td className="py-2 px-3 text-right font-bold">{formatAmount(companyGroups.reduce((s, g) => s + g.cleared, 0))}</td>
                  <td className="py-2 px-3 text-right font-bold">{formatAmount(companyGroups.reduce((s, g) => s + g.remaining, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Claims per Company */}
      {filterCompany !== 'all' && companyGroups.map(g => (
        <Card key={g.id} className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-emerald-800">{g.name} - Claims Detail</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm print-table">
                <thead><tr className="border-b bg-gray-50 print-bg-gray">
                  <th className="text-left py-2 px-3 font-medium">Claim #</th>
                  <th className="text-left py-2 px-3 font-medium">Date</th>
                  <th className="text-left py-2 px-3 font-medium">Shop</th>
                  <th className="text-left py-2 px-3 font-medium">Order Booker</th>
                  <th className="text-right py-2 px-3 font-medium">Total Claim</th>
                  <th className="text-right py-2 px-3 font-medium">Cleared</th>
                  <th className="text-right py-2 px-3 font-medium">Remaining</th>
                  <th className="text-center py-2 px-3 font-medium">Status</th>
                </tr></thead>
                <tbody>
                  {g.claims.map(c => (
                    <tr key={c.id} className="border-b">
                      <td className="py-2 px-3 font-medium text-emerald-700">{c.claimNumber}</td>
                      <td className="py-2 px-3">{new Date(c.date).toLocaleDateString()}</td>
                      <td className="py-2 px-3">{c.shop.name}</td>
                      <td className="py-2 px-3">{c.orderBooker?.name || '-'}</td>
                      <td className="py-2 px-3 text-right">{formatAmount(c.totalAmount)}</td>
                      <td className="py-2 px-3 text-right text-blue-700">{c.approvedAmount ? formatAmount(c.approvedAmount) : '-'}</td>
                      <td className="py-2 px-3 text-right font-medium">
                        {c.status === 'rejected' ? '-' : (
                          <span className={c.totalAmount - (c.approvedAmount || 0) > 0 ? 'text-red-600' : 'text-green-600'}>
                            {formatAmount(c.totalAmount - (c.approvedAmount || 0))}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center"><Badge className={`${statusColors[c.status]} border text-xs`}>{statusLabels[c.status]}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
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
    <div className="space-y-4">
      <Card className="shadow-sm no-print">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Select value={filterOB} onValueChange={setFilterOB}>
              <SelectTrigger><SelectValue placeholder="Order Booker" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Order Bookers</SelectItem>{orderBookers.map(ob => <SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger><SelectValue placeholder="Company" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Companies</SelectItem>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} placeholder="Cleared From" />
            <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} placeholder="Cleared To" />
            <Button onClick={onPrint} className="bg-emerald-600 hover:bg-emerald-700 text-white"><Printer className="h-4 w-4 mr-2" /> Print</Button>
          </div>
        </CardContent>
      </Card>

      <div className="hidden print-block print-header">
        <h1 className="text-xl font-bold text-center">AL FALAH TRADERS</h1>
        <h2 className="text-lg font-semibold text-center mt-1">Payment/Cleared Report</h2>
        <p className="text-xs text-center text-gray-500 mt-1">Generated: {new Date().toLocaleString()}</p>
        <hr className="my-3 border-gray-400" />
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-emerald-50 rounded-lg p-3"><p className="text-xs text-muted-foreground">Total Claim</p><p className="text-2xl font-bold text-emerald-700">{formatAmount(grandTotalClaim)}</p></div>
            <div className="bg-blue-50 rounded-lg p-3"><p className="text-xs text-muted-foreground">Cleared Amount</p><p className="text-2xl font-bold text-blue-700">{formatAmount(grandTotal)}</p></div>
            <div className="bg-orange-50 rounded-lg p-3"><p className="text-xs text-muted-foreground">Remaining Pending</p><p className="text-2xl font-bold text-orange-700">{formatAmount(grandRemaining)}</p></div>
          </div>
        </CardContent>
      </Card>

      {cleared.length > 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm print-table">
                <thead><tr className="border-b bg-gray-50 print-bg-gray">
                  <th className="text-left py-2 px-3 font-medium">#</th>
                  <th className="text-left py-2 px-3 font-medium">Claim #</th>
                  <th className="text-left py-2 px-3 font-medium">Date</th>
                  <th className="text-left py-2 px-3 font-medium">Company</th>
                  <th className="text-left py-2 px-3 font-medium">Shop</th>
                  <th className="text-left py-2 px-3 font-medium">Order Booker</th>
                  <th className="text-right py-2 px-3 font-medium">Total Claim</th>
                  <th className="text-right py-2 px-3 font-medium">Cleared</th>
                  <th className="text-right py-2 px-3 font-medium">Remaining</th>
                  <th className="text-left py-2 px-3 font-medium">Cleared By</th>
                  <th className="text-left py-2 px-3 font-medium">Cleared Date</th>
                </tr></thead>
                <tbody>
                  {cleared.map((c, i) => (
                    <tr key={c.id} className="border-b">
                      <td className="py-2 px-3">{i + 1}</td>
                      <td className="py-2 px-3 font-medium text-emerald-700">{c.claimNumber}</td>
                      <td className="py-2 px-3">{new Date(c.date).toLocaleDateString()}</td>
                      <td className="py-2 px-3">{c.company.name}</td>
                      <td className="py-2 px-3">{c.shop.name}</td>
                      <td className="py-2 px-3">{c.orderBooker?.name || '-'}</td>
                      <td className="py-2 px-3 text-right font-medium">{formatAmount(c.totalAmount)}</td>
                      <td className="py-2 px-3 text-right font-medium text-blue-700">{formatAmount(c.approvedAmount || c.totalAmount)}</td>
                      <td className="py-2 px-3 text-right font-medium">
                        <span className={c.totalAmount - (c.approvedAmount || c.totalAmount) > 0 ? 'text-red-600' : 'text-green-600'}>
                          {formatAmount(c.totalAmount - (c.approvedAmount || c.totalAmount))}
                        </span>
                      </td>
                      <td className="py-2 px-3">{c.clearedBy || '-'}</td>
                      <td className="py-2 px-3">{c.clearedDate ? new Date(c.clearedDate).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-emerald-600 bg-emerald-50 print-bg-light">
                    <td colSpan={6} className="py-2 px-3 font-bold text-emerald-800 text-right">Grand Total:</td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-800">{formatAmount(grandTotalClaim)}</td>
                    <td className="py-2 px-3 text-right font-bold text-blue-800">{formatAmount(grandTotal)}</td>
                    <td className="py-2 px-3 text-right font-bold text-orange-700">{formatAmount(grandRemaining)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm"><CardContent className="py-12 text-center"><Banknote className="h-12 w-12 text-gray-300 mx-auto mb-3" /><p className="text-muted-foreground">No cleared claims found</p></CardContent></Card>
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
    <div className="space-y-4">
      <Card className="shadow-sm no-print">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Enter Claim # (e.g. CLM-1)"
                value={searchClaim}
                onChange={e => setSearchClaim(e.target.value)}
                className="pl-10"
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} className="bg-emerald-600 hover:bg-emerald-700 text-white">Search</Button>
            {claim && <Button onClick={onPrint} variant="outline" className="border-emerald-300"><Printer className="h-4 w-4 mr-2" /> Print</Button>}
          </div>
        </CardContent>
      </Card>

      {!claim ? (
        <Card className="shadow-sm"><CardContent className="py-16 text-center"><ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-3" /><p className="text-muted-foreground text-lg font-medium">Enter a Claim # to view details</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {/* Print Header */}
          <div className="hidden print-block print-header">
            <h1 className="text-xl font-bold text-center">AL FALAH TRADERS</h1>
            <h2 className="text-lg font-semibold text-center mt-1">Claim Detail - {claim.claimNumber}</h2>
            <p className="text-xs text-center text-gray-500 mt-1">Generated: {new Date().toLocaleString()}</p>
            <hr className="my-3 border-gray-400" />
          </div>

          {/* Claim Info */}
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-base font-bold text-emerald-800">Claim Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-6 text-sm">
                <div><span className="text-muted-foreground text-xs">Claim #</span><p className="font-bold text-emerald-700">{claim.claimNumber}</p></div>
                <div><span className="text-muted-foreground text-xs">Date</span><p className="font-medium">{new Date(claim.date).toLocaleDateString()}</p></div>
                <div><span className="text-muted-foreground text-xs">Status</span><p><Badge className={`${statusColors[claim.status]} border text-xs`}>{statusLabels[claim.status]}</Badge></p></div>
                <div><span className="text-muted-foreground text-xs">Company</span><p className="font-medium">{claim.company.name}</p></div>
                <div><span className="text-muted-foreground text-xs">Shop</span><p className="font-medium">{claim.shop.name}</p></div>
                <div><span className="text-muted-foreground text-xs">Shop Address</span><p className="font-medium">{claim.shop.address || '-'}</p></div>
                <div><span className="text-muted-foreground text-xs">Supplier</span><p className="font-medium">{claim.supplier.name}</p></div>
                <div><span className="text-muted-foreground text-xs">Order Booker</span><p className="font-medium">{claim.orderBooker?.name || '-'}</p></div>
                <div><span className="text-muted-foreground text-xs">Total Amount</span><p className="font-bold text-emerald-700 text-lg">{formatAmount(claim.totalAmount)}</p></div>
                {claim.approvedAmount && <div><span className="text-muted-foreground text-xs">Cleared Amount</span><p className="font-bold text-blue-700">{formatAmount(claim.approvedAmount)}</p></div>}
                {claim.approvedAmount && <div><span className="text-muted-foreground text-xs">Remaining Pending</span><p className={`font-bold ${claim.totalAmount - claim.approvedAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatAmount(claim.totalAmount - claim.approvedAmount)}</p></div>}
                {claim.clearedBy && <div><span className="text-muted-foreground text-xs">Cleared By</span><p className="font-medium">{claim.clearedBy}</p></div>}
                {claim.clearedDate && <div><span className="text-muted-foreground text-xs">Cleared Date</span><p className="font-medium">{new Date(claim.clearedDate).toLocaleDateString()}</p></div>}
                {claim.rejectReason && <div className="col-span-2 sm:col-span-3"><span className="text-muted-foreground text-xs">Reject Reason</span><p className="font-medium text-red-700">{claim.rejectReason}</p></div>}
              </div>
            </CardContent>
          </Card>

          {/* Claim Items */}
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-base font-bold text-emerald-800">Claim Items</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm print-table">
                  <thead><tr className="border-b bg-gray-50 print-bg-gray">
                    <th className="text-left py-2 px-3 font-medium">#</th>
                    <th className="text-left py-2 px-3 font-medium">Product</th>
                    <th className="text-right py-2 px-3 font-medium">Price</th>
                    <th className="text-right py-2 px-3 font-medium">Claim Price</th>
                    <th className="text-right py-2 px-3 font-medium">Qty</th>
                    <th className="text-right py-2 px-3 font-medium">Amount</th>
                  </tr></thead>
                  <tbody>
                    {claim.claimItems.map((item, i) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-2 px-3">{i + 1}</td>
                        <td className="py-2 px-3 font-medium">{item.product.name}</td>
                        <td className="py-2 px-3 text-right">{formatAmount(item.product.price)}</td>
                        <td className="py-2 px-3 text-right">{formatAmount(item.product.claimPrice || item.product.price)}</td>
                        <td className="py-2 px-3 text-right">{item.quantity}</td>
                        <td className="py-2 px-3 text-right font-medium">{formatAmount(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-emerald-600 bg-emerald-50 print-bg-light">
                      <td colSpan={5} className="py-2 px-3 font-bold text-emerald-800 text-right">Total:</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-800">{formatAmount(claim.totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
