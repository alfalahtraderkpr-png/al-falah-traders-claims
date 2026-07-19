'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, CheckCircle, XCircle, Edit3, ChevronDown, ChevronUp, Package, AlertTriangle, RefreshCw } from 'lucide-react';
import { logAction } from '@/lib/audit';

interface StockNotReceivedProps {
  user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
}

interface Company { id: string; name: string; claimDeductionPercent?: number }
interface Supplier { id: string; name: string }
interface OrderBooker { id: string; name: string }

interface ClaimItem {
  id: string;
  productId: string;
  quantity: number;
  amount: number;
  product: { id: string; name: string; price: number; claimPrice: number; unit: string; wholesalePrice: number | null; lmtPrice: number | null; company: { multiTierPricing: boolean } };
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
  shop: { id: string; name: string; address: string };
  supplier: { name: string };
  orderBooker: { name: string } | null;
  claimItems: ClaimItem[];
  createdBy: string | null;
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  claimPrice: number;
  unit: string;
  wholesalePrice: number | null;
  lmtPrice: number | null;
  companyId: string;
  company: { multiTierPricing: boolean };
}

// Editable item for the verify & approve dialog
interface EditableItem {
  productId: string;
  productName: string;
  quantity: number;
  amount: number;
  claimPrice: number;
  unit: string;
}

export function StockNotReceived({ user }: StockNotReceivedProps) {
  const isAdmin = user.role === 'admin';
  const [claims, setClaims] = useState<Claim[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orderBookers, setOrderBookers] = useState<OrderBooker[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [filterOrderBooker, setFilterOrderBooker] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Expand/collapse claim details
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);

  // Reject dialog
  const [rejectDialog, setRejectDialog] = useState<Claim | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Approve & Edit dialog
  const [approveDialog, setApproveDialog] = useState<Claim | null>(null);
  const [editItems, setEditItems] = useState<EditableItem[]>([]);
  const [addProductSearch, setAddProductSearch] = useState('');

  const loadFilters = useCallback(async () => {
    try {
      const [compRes, supRes, obRes, prodRes] = await Promise.all([
        fetch('/api/companies'),
        fetch('/api/suppliers'),
        fetch('/api/order-bookers'),
        fetch('/api/products'),
      ]);
      if (compRes.ok) { const data = await compRes.json(); if (Array.isArray(data)) setCompanies(data); }
      if (supRes.ok) { const data = await supRes.json(); if (Array.isArray(data)) setSuppliers(data); }
      if (obRes.ok) { const data = await obRes.json(); if (Array.isArray(data)) setOrderBookers(data); }
      if (prodRes.ok) { const data = await prodRes.json(); if (Array.isArray(data)) setProducts(data); }
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  }, []);

  const loadClaims = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('status', 'pending'); // Only show pending (Stock Not Received) claims
      if (filterCompany !== 'all') params.set('companyId', filterCompany);
      // SECURITY: Order bookers can ONLY see their own claims.
      // The API enforces this server-side too, but we also pass the OB ID
      // explicitly so the URL is unambiguous.
      if (!isAdmin) {
        if (user.orderBookerId) {
          params.set('orderBookerId', user.orderBookerId);
        }
        // (OBs without orderBookerId will see nothing — see API)
      } else if (filterOrderBooker !== 'all') {
        params.set('orderBookerId', filterOrderBooker);
      }
      if (search) params.set('search', search);

      const res = await fetch(`/api/claims?${params}`);
      if (res.ok) { const data = await res.json(); if (Array.isArray(data)) setClaims(data); }
    } catch (error) {
      console.error('Failed to load claims:', error);
    } finally {
      setLoading(false);
    }
  }, [filterCompany, filterOrderBooker, search, isAdmin, user.orderBookerId]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  const handleReject = async () => {
    if (!rejectDialog || !rejectReason.trim()) return;
    try {
      const res = await fetch(`/api/claims/${rejectDialog.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejectReason: rejectReason.trim() }),
      });
      if (res.ok) {
        logAction({ userName: user.name, action: 'reject', entity: 'claim', entityId: rejectDialog.id, details: JSON.stringify({ reason: rejectReason }) });
        setRejectDialog(null);
        setRejectReason('');
        loadClaims();
      }
    } catch (error) {
      console.error('Reject error:', error);
    }
  };

  const handleQuickApprove = async (claim: Claim) => {
    // Quick approve without editing - stock matches exactly
    try {
      const res = await fetch(`/api/claims/${claim.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (res.ok) {
        logAction({ userName: user.name, action: 'approve', entity: 'claim', entityId: claim.id, details: 'Quick approved - stock verified as-is' });
        loadClaims();
      }
    } catch (error) {
      console.error('Approve error:', error);
    }
  };

  const openApproveDialog = (claim: Claim) => {
    const items: EditableItem[] = claim.claimItems.map(item => ({
      productId: item.productId,
      productName: item.product.name,
      quantity: item.quantity,
      amount: item.amount,
      claimPrice: item.product.claimPrice || item.product.price,
      unit: item.product.unit,
    }));
    setApproveDialog(claim);
    setEditItems(items);
  };

  const updateEditItemQuantity = (index: number, newQty: number) => {
    setEditItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const newAmount = item.claimPrice * newQty;
      return { ...item, quantity: newQty, amount: newAmount };
    }));
  };

  const removeEditItem = (index: number) => {
    setEditItems(prev => prev.filter((_, i) => i !== index));
  };

  const addEditItem = (product: Product) => {
    const exists = editItems.find(item => item.productId === product.id);
    if (exists) return;
    const claimPrice = product.claimPrice || product.price;
    setEditItems(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      amount: claimPrice,
      claimPrice,
      unit: product.unit,
    }]);
  };

  const handleApproveWithEdits = async () => {
    if (!approveDialog || editItems.length === 0) return;
    try {
      // Admin uses 'arrive_and_approve' (verifies stock + approves in one go)
      // Order booker uses 'update' (just edits items, keeps status=pending)
      const action = isAdmin ? 'arrive_and_approve' : 'update';
      const payload: Record<string, unknown> = { action };
      if (isAdmin) {
        payload.items = editItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          amount: item.amount,
        }));
      } else {
        // 'update' action expects full claim fields
        payload.date = approveDialog.date;
        payload.companyId = approveDialog.companyId;
        payload.shopId = approveDialog.shopId;
        payload.supplierId = approveDialog.supplierId;
        payload.orderBookerId = approveDialog.orderBookerId;
        payload.items = editItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          amount: item.amount,
        }));
      }

      const res = await fetch(`/api/claims/${approveDialog.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        logAction({
          userName: user.name,
          action: isAdmin ? 'arrive_and_approve' : 'update',
          entity: 'claim',
          entityId: approveDialog.id,
          details: isAdmin ? 'Verified and approved with edits' : 'Order booker edited pending claim items',
        });
        setApproveDialog(null);
        setEditItems([]);
        loadClaims();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save claim');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Network error');
    }
  };

  const formatAmount = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  const filteredProducts = products.filter(p => {
    if (!approveDialog) return [];
    const matchesCompany = p.companyId === approveDialog.companyId;
    const matchesSearch = !addProductSearch || p.name.toLowerCase().includes(addProductSearch.toLowerCase());
    const notAlreadyAdded = !editItems.find(item => item.productId === p.id);
    return matchesCompany && matchesSearch && notAlreadyAdded;
  });

  const editTotalAmount = editItems.reduce((sum, item) => sum + item.amount, 0);

  if (loading && claims.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading claims...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-emerald-800 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              Expiry Stock Not Received
            </h2>
            <p className="text-muted-foreground mt-1">
              Claims created by order bookers — expiry stock still at shop. Verify when stock arrives at distribution.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            onClick={loadClaims}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-amber-50 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-800">Stock Not Received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900">{claims.length}</div>
            <p className="text-xs text-amber-600 mt-1">{formatAmount(claims.reduce((s, c) => s + c.totalAmount, 0))} total</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Unique Shops</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{new Set(claims.map(c => c.shopId)).size}</div>
            <p className="text-xs text-blue-600 mt-1">Shops with pending stock</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-800">Order Bookers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900">{new Set(claims.filter(c => c.orderBookerId).map(c => c.orderBookerId)).size}</div>
            <p className="text-xs text-emerald-600 mt-1">Active bookers</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="pt-4">
          {!isAdmin && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 mb-3">
              ✓ Showing only claims created by you ({user.name}). Other order bookers' claims are hidden.
            </p>
          )}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by claim # or shop name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-emerald-200 focus:border-emerald-400"
              />
            </div>
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger className="w-full sm:w-[180px] border-emerald-200">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAdmin && (
              <Select value={filterOrderBooker} onValueChange={setFilterOrderBooker}>
                <SelectTrigger className="w-full sm:w-[180px] border-emerald-200">
                  <SelectValue placeholder="All Bookers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Order Bookers</SelectItem>
                  {orderBookers.map(ob => (
                    <SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Claims List */}
      {claims.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12">
            <div className="text-center">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No pending claims</p>
              <p className="text-sm text-muted-foreground mt-1">All expiry stock has been received at distribution</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {claims.map((claim, index) => (
            <Card
              key={claim.id}
              className="shadow-sm border-l-4 border-l-amber-400 animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardContent className="p-4">
                {/* Claim Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-emerald-700 text-lg">{claim.claimNumber}</span>
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 border text-xs">
                        Stock Not Received
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground space-y-0.5">
                      <p><span className="font-medium text-foreground">Shop:</span> {claim.shop.name} {claim.shop.address ? `— ${claim.shop.address}` : ''}</p>
                      <p><span className="font-medium text-foreground">Company:</span> {claim.company.name} | <span className="font-medium text-foreground">Supplier:</span> {claim.supplier.name}</p>
                      {claim.orderBooker && <p><span className="font-medium text-foreground">Order Booker:</span> {claim.orderBooker.name}</p>}
                      <p><span className="font-medium text-foreground">Date:</span> {new Date(claim.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold text-amber-800">{formatAmount(claim.totalAmount)}</div>
                    {claim.deductionAmount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Deduction: -{formatAmount(claim.deductionAmount)} | Net: {formatAmount(claim.netAmount)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Expand/Collapse Items */}
                <div className="mt-3">
                  <button
                    onClick={() => setExpandedClaim(expandedClaim === claim.id ? null : claim.id)}
                    className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-800 transition-colors"
                  >
                    {expandedClaim === claim.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {claim.claimItems.length} items — Click to {expandedClaim === claim.id ? 'hide' : 'view'} details
                  </button>

                  {expandedClaim === claim.id && (
                    <div className="mt-3 overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800">
                            <th className="text-left py-2 px-3 font-medium">#</th>
                            <th className="text-left py-2 px-3 font-medium">Product</th>
                            <th className="text-center py-2 px-3 font-medium">Qty</th>
                            <th className="text-right py-2 px-3 font-medium">Rate</th>
                            <th className="text-right py-2 px-3 font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {claim.claimItems.map((item, idx) => (
                            <tr key={item.id} className="border-t">
                              <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                              <td className="py-2 px-3 font-medium">{item.product.name}</td>
                              <td className="py-2 px-3 text-center">{item.quantity} {item.product.unit}</td>
                              <td className="py-2 px-3 text-right">{formatAmount(item.product.claimPrice || item.product.price)}</td>
                              <td className="py-2 px-3 text-right font-medium">{formatAmount(item.amount)}</td>
                            </tr>
                          ))}
                          <tr className="border-t bg-gray-50 dark:bg-gray-800 font-bold">
                            <td colSpan={4} className="py-2 px-3 text-right">Total:</td>
                            <td className="py-2 px-3 text-right">{formatAmount(claim.totalAmount)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t">
                  {isAdmin && (
                    <>
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleQuickApprove(claim)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve As-Is
                      </Button>
                      <Button
                        variant="outline"
                        className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        onClick={() => openApproveDialog(claim)}
                      >
                        <Edit3 className="h-4 w-4 mr-2" />
                        Verify & Edit Before Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-50"
                        onClick={() => { setRejectDialog(claim); setRejectReason(''); }}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </>
                  )}
                  {!isAdmin && (
                    <Button
                      variant="outline"
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => openApproveDialog(claim)}
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit Claim
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reject Dialog */}
      {rejectDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setRejectDialog(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-red-700 mb-2">Reject Claim {rejectDialog.claimNumber}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Shop: {rejectDialog.shop.name} | Amount: {formatAmount(rejectDialog.totalAmount)}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Reject Reason *</label>
                <textarea
                  className="w-full mt-1 p-2 border rounded-lg text-sm resize-none h-20 focus:ring-2 focus:ring-red-300 focus:border-red-400"
                  placeholder="Enter reason for rejection..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleReject}
                  disabled={!rejectReason.trim()}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject Claim
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verify & Edit Before Approve Dialog (admin) OR Edit Claim Dialog (OB) */}
      {approveDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setApproveDialog(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-emerald-700 mb-1">
                {isAdmin ? `Verify & Approve — ${approveDialog.claimNumber}` : `Edit Claim — ${approveDialog.claimNumber}`}
              </h3>
              <p className="text-sm text-muted-foreground mb-1">
                Shop: {approveDialog.shop.name} | Company: {approveDialog.company.name}
              </p>
              <p className="text-xs text-amber-600 mb-4">
                {isAdmin
                  ? 'Compare physical stock with items below. Edit quantities if needed, then approve.'
                  : 'Edit quantities or add/remove items. The claim will remain pending — admin will approve when stock arrives.'}
              </p>

              {/* Editable Items */}
              <div className="space-y-2 mb-4">
                {editItems.map((item, index) => (
                  <div key={item.productId} className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">Rate: {formatAmount(item.claimPrice)}/{item.unit}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">Qty:</label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateEditItemQuantity(index, parseInt(e.target.value) || 1)}
                        className="w-20 text-center text-sm"
                      />
                      <span className="text-sm font-medium w-24 text-right">{formatAmount(item.amount)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:bg-red-50"
                        onClick={() => removeEditItem(index)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Product */}
              <div className="mb-4">
                <Input
                  placeholder="Search products to add..."
                  value={addProductSearch}
                  onChange={(e) => setAddProductSearch(e.target.value)}
                  className="mb-2 text-sm"
                />
                {addProductSearch && filteredProducts.length > 0 && (
                  <div className="border rounded-lg max-h-32 overflow-y-auto">
                    {filteredProducts.slice(0, 5).map(product => (
                      <button
                        key={product.id}
                        className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-sm flex justify-between items-center border-b last:border-b-0"
                        onClick={() => {
                          addEditItem(product);
                          setAddProductSearch('');
                        }}
                      >
                        <span>{product.name}</span>
                        <span className="text-xs text-muted-foreground">{formatAmount(product.claimPrice || product.price)}/{product.unit}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="border-t pt-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Amount:</span>
                  <span className="text-xl font-bold text-emerald-800">{formatAmount(editTotalAmount)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setApproveDialog(null); setEditItems([]); }}>
                  Cancel
                </Button>
                <Button
                  className={isAdmin ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}
                  onClick={handleApproveWithEdits}
                  disabled={editItems.length === 0}
                >
                  {isAdmin ? (
                    <><CheckCircle className="h-4 w-4 mr-2" />Approve (Arrived & Verified)</>
                  ) : (
                    <><Edit3 className="h-4 w-4 mr-2" />Save Changes</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
