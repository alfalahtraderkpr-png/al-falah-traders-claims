'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClaimForm } from './claim-form';
import { ClaimDetail } from './claim-detail';
import { Loader2, Plus, Search, Filter, Eye, Edit, Trash2, CheckCircle, XCircle, Banknote } from 'lucide-react';

interface ClaimListProps {
  user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
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
  companyId: string;
  supplierId: string;
  orderBookerId: string | null;
  company: { name: string };
  shop: { id: string; name: string; address: string };
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

export function ClaimList({ user }: ClaimListProps) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orderBookers, setOrderBookers] = useState<OrderBooker[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [filterOrderBooker, setFilterOrderBooker] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [search, setSearch] = useState('');

  // View state
  const [showForm, setShowForm] = useState(false);
  const [editClaim, setEditClaim] = useState<Claim | null>(null);
  const [viewClaim, setViewClaim] = useState<Claim | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const isAdmin = user.role === 'admin';

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
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  }, []);

  const loadClaims = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterCompany !== 'all') params.set('companyId', filterCompany);
      if (filterSupplier !== 'all') params.set('supplierId', filterSupplier);
      if (filterOrderBooker !== 'all') params.set('orderBookerId', filterOrderBooker);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);
      if (search) params.set('search', search);

      if (user.role === 'orderbooker' && user.orderBookerId) {
        params.set('orderBookerId', user.orderBookerId);
      }

      const res = await fetch(`/api/claims?${params}`);
      setClaims(await res.json());
    } catch (error) {
      console.error('Failed to load claims:', error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterCompany, filterSupplier, filterOrderBooker, filterDateFrom, filterDateTo, search, user]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/claims/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (res.ok) {
        loadClaims();
      }
    } catch (error) {
      console.error('Approve error:', error);
    }
  };

  const handlePartialApprove = async (id: string, amount: number) => {
    try {
      const res = await fetch(`/api/claims/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'partial_approve', approvedAmount: amount }),
      });
      if (res.ok) {
        loadClaims();
      }
    } catch (error) {
      console.error('Partial approve error:', error);
    }
  };

  const handleClear = async (id: string, clearedBy: string) => {
    try {
      const res = await fetch(`/api/claims/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear', clearedBy }),
      });
      if (res.ok) {
        loadClaims();
      }
    } catch (error) {
      console.error('Clear error:', error);
    }
  };

  const handleReject = async (id: string, reason: string) => {
    try {
      const res = await fetch(`/api/claims/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejectReason: reason }),
      });
      if (res.ok) {
        loadClaims();
      }
    } catch (error) {
      console.error('Reject error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this claim?')) return;
    try {
      const res = await fetch(`/api/claims/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadClaims();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete');
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  // Action dialog state
  const [actionDialog, setActionDialog] = useState<{ type: string; claim: Claim } | null>(null);
  const [actionValue, setActionValue] = useState('');

  const formatAmount = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  if (showForm) {
    return (
      <ClaimForm
        claim={editClaim}
        companies={companies}
        user={user}
        onSave={() => {
          setShowForm(false);
          setEditClaim(null);
          loadClaims();
        }}
        onCancel={() => {
          setShowForm(false);
          setEditClaim(null);
        }}
      />
    );
  }

  if (viewClaim) {
    return (
      <ClaimDetail
        claim={viewClaim}
        user={user}
        onBack={() => {
          setViewClaim(null);
          loadClaims();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-emerald-800">
            {user.role === 'orderbooker' ? 'My Claims' : 'Claims Management'}
          </h2>
          <p className="text-muted-foreground">{claims.length} claims found</p>
        </div>
        {isAdmin && (
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Claim
          </Button>
        )}
      </div>

      {/* Search & Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by claim # or shop name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="shrink-0"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4 pt-4 border-t">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="partially_approved">Partially Approved</SelectItem>
                  <SelectItem value="cleared">Cleared</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              {isAdmin && (
                <Select value={filterCompany} onValueChange={setFilterCompany}>
                  <SelectTrigger>
                    <SelectValue placeholder="Company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {isAdmin && (
                <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                  <SelectTrigger>
                    <SelectValue placeholder="Supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {isAdmin && (
                <Select value={filterOrderBooker} onValueChange={setFilterOrderBooker}>
                  <SelectTrigger>
                    <SelectValue placeholder="Order Booker" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Order Bookers</SelectItem>
                    {orderBookers.map((ob) => (
                      <SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="flex gap-2">
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  placeholder="From"
                  className="text-xs"
                />
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  placeholder="To"
                  className="text-xs"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Claims Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : claims.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No claims found
            </div>
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
                    <th className="text-center py-3 px-4 font-medium">Actions</th>
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
                      <td className="py-3 px-4 text-right">
                        {claim.approvedAmount ? formatAmount(claim.approvedAmount) : '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge className={`${statusColors[claim.status]} border text-xs`}>
                          {statusLabels[claim.status]}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setViewClaim(claim)}
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {isAdmin && claim.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-600"
                                onClick={() => handleApprove(claim.id)}
                                title="Approve"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-orange-600"
                                onClick={() => {
                                  setActionDialog({ type: 'partial', claim });
                                  setActionValue('');
                                }}
                                title="Partial Approve"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600"
                                onClick={() => {
                                  setActionDialog({ type: 'reject', claim });
                                  setActionValue('');
                                }}
                                title="Reject"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setEditClaim(claim) || setShowForm(true)}
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600"
                                onClick={() => handleDelete(claim.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {isAdmin && (claim.status === 'approved' || claim.status === 'partially_approved') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600"
                              onClick={() => {
                                setActionDialog({ type: 'clear', claim });
                                setActionValue('');
                              }}
                              title="Clear"
                            >
                              <Banknote className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      {actionDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-lg">
                {actionDialog.type === 'partial' && 'Partial Approve'}
                {actionDialog.type === 'clear' && 'Clear Claim'}
                {actionDialog.type === 'reject' && 'Reject Claim'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Claim: {actionDialog.claim.claimNumber} — {formatAmount(actionDialog.claim.totalAmount)}
              </p>
              {actionDialog.type === 'partial' && (
                <div>
                  <label className="text-sm font-medium">Approved Amount (Rs.)</label>
                  <Input
                    type="number"
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    placeholder="Enter approved amount"
                  />
                </div>
              )}
              {actionDialog.type === 'clear' && (
                <div>
                  <label className="text-sm font-medium">Cleared By *</label>
                  <Input
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    placeholder="Enter name of person who cleared"
                  />
                </div>
              )}
              {actionDialog.type === 'reject' && (
                <div>
                  <label className="text-sm font-medium">Reject Reason *</label>
                  <Input
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    placeholder="Enter reason for rejection"
                  />
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setActionDialog(null)}>
                  Cancel
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    if (actionDialog.type === 'partial') {
                      handlePartialApprove(actionDialog.claim.id, Number(actionValue));
                    } else if (actionDialog.type === 'clear') {
                      handleClear(actionDialog.claim.id, actionValue);
                    } else if (actionDialog.type === 'reject') {
                      handleReject(actionDialog.claim.id, actionValue);
                    }
                    setActionDialog(null);
                  }}
                  disabled={!actionValue.trim()}
                >
                  Confirm
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
