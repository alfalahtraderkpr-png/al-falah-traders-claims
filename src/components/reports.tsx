'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Download } from 'lucide-react';

interface Company { id: string; name: string }
interface Supplier { id: string; name: string }
interface OrderBooker { id: string; name: string }

interface Claim {
  id: string;
  claimNumber: string;
  date: string;
  totalAmount: number;
  approvedAmount: number | null;
  status: string;
  company: { name: string };
  shop: { name: string; address: string };
  supplier: { name: string };
  orderBooker: { name: string } | null;
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
  partially_approved: 'Partial',
  cleared: 'Cleared',
  rejected: 'Rejected',
};

export function Reports() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [summary, setSummary] = useState<{ totalClaims: number; totalAmount: number; totalApproved: number; byStatus: Record<string, number> } | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orderBookers, setOrderBookers] = useState<OrderBooker[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [filterOrderBooker, setFilterOrderBooker] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const loadFilters = useCallback(async () => {
    try {
      const [compRes, supRes, obRes] = await Promise.all([
        fetch('/api/companies'),
        fetch('/api/suppliers'),
        fetch('/api/order-bookers'),
      ]);
      setCompanies(await compRes.json());
      setSuppliers(await supRes.json());
      setOrderBookers(await obRes.json());
    } catch (e) { console.error(e); }
  }, []);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterCompany !== 'all') params.set('companyId', filterCompany);
      if (filterSupplier !== 'all') params.set('supplierId', filterSupplier);
      if (filterOrderBooker !== 'all') params.set('orderBookerId', filterOrderBooker);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);

      const res = await fetch(`/api/reports?${params}`);
      const data = await res.json();
      setClaims(data.claims);
      setSummary(data.summary);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterStatus, filterCompany, filterSupplier, filterOrderBooker, filterDateFrom, filterDateTo]);

  useEffect(() => { loadFilters(); }, [loadFilters]);
  useEffect(() => { loadReports(); }, [loadReports]);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set('format', 'excel');
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterCompany !== 'all') params.set('companyId', filterCompany);
      if (filterSupplier !== 'all') params.set('supplierId', filterSupplier);
      if (filterOrderBooker !== 'all') params.set('orderBookerId', filterOrderBooker);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);

      const res = await fetch(`/api/reports?${params}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'claims-report.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    finally { setExporting(false); }
  };

  const formatAmount = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-emerald-800">Reports</h2>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleExportExcel} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Export Excel
        </Button>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="partially_approved">Partially Approved</SelectItem>
                <SelectItem value="cleared">Cleared</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger><SelectValue placeholder="Company" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterSupplier} onValueChange={setFilterSupplier}>
              <SelectTrigger><SelectValue placeholder="Supplier" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterOrderBooker} onValueChange={setFilterOrderBooker}>
              <SelectTrigger><SelectValue placeholder="Order Booker" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Order Bookers</SelectItem>
                {orderBookers.map((ob) => <SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="text-xs" />
              <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="shadow-sm bg-emerald-50">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Claims</p>
              <p className="text-lg font-bold text-emerald-700">{summary.totalClaims}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm bg-yellow-50">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-lg font-bold text-yellow-700">{summary.byStatus.pending || 0}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm bg-green-50">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Approved</p>
              <p className="text-lg font-bold text-green-700">{summary.byStatus.approved || 0}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm bg-orange-50">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Partial</p>
              <p className="text-lg font-bold text-orange-700">{summary.byStatus.partially_approved || 0}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm bg-blue-50">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Cleared</p>
              <p className="text-lg font-bold text-blue-700">{summary.byStatus.cleared || 0}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm bg-red-50">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Rejected</p>
              <p className="text-lg font-bold text-red-700">{summary.byStatus.rejected || 0}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary Totals */}
      {summary && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-xl font-bold text-emerald-700">{formatAmount(summary.totalAmount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Approved</p>
                <p className="text-xl font-bold text-green-700">{formatAmount(summary.totalApproved)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-xl font-bold text-red-700">{formatAmount(summary.totalAmount - summary.totalApproved)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
          ) : claims.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No claims found for the selected filters</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium">Claim #</th>
                    <th className="text-left py-3 px-4 font-medium">Date</th>
                    <th className="text-left py-3 px-4 font-medium">Company</th>
                    <th className="text-left py-3 px-4 font-medium">Shop</th>
                    <th className="text-left py-3 px-4 font-medium">Supplier</th>
                    <th className="text-left py-3 px-4 font-medium">Order Booker</th>
                    <th className="text-right py-3 px-4 font-medium">Total</th>
                    <th className="text-right py-3 px-4 font-medium">Approved</th>
                    <th className="text-center py-3 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr key={claim.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-emerald-700">{claim.claimNumber}</td>
                      <td className="py-3 px-4">{new Date(claim.date).toLocaleDateString()}</td>
                      <td className="py-3 px-4">{claim.company.name}</td>
                      <td className="py-3 px-4">{claim.shop.name}</td>
                      <td className="py-3 px-4">{claim.supplier.name}</td>
                      <td className="py-3 px-4">{claim.orderBooker?.name || '-'}</td>
                      <td className="py-3 px-4 text-right">{formatAmount(claim.totalAmount)}</td>
                      <td className="py-3 px-4 text-right">{claim.approvedAmount ? formatAmount(claim.approvedAmount) : '-'}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge className={`${statusColors[claim.status]} border text-xs`}>
                          {statusLabels[claim.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
