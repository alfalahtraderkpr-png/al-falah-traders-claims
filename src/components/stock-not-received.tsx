'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, Search, CheckCircle, XCircle, Edit3, ChevronDown, ChevronUp,
  Package, RefreshCw, AlertTriangle, Clock, Store, Truck, Banknote, Minus, Plus, Trash2,
} from 'lucide-react';
import { logAction } from '@/lib/audit';

interface StockNotReceivedProps {
  user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
}

interface Company { id: string; name: string; claimDeductionPercent?: number }
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
  createdAt: string;
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

interface CreditLimit { id: string; shopId: string; companyId: string; creditLimit: number }

// Editable item for the inline verify & approve panel
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
  const [orderBookers, setOrderBookers] = useState<OrderBooker[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [creditLimits, setCreditLimits] = useState<CreditLimit[]>([]);
  const [allClaims, setAllClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [filterOrderBooker, setFilterOrderBooker] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Expand/collapse claim details
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);

  // Inline verify & edit state (mockup pattern)
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [editItems, setEditItems] = useState<EditableItem[]>([]);
  const [addProductSearch, setAddProductSearch] = useState('');

  // Reject dialog
  const [rejectDialog, setRejectDialog] = useState<Claim | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadFilters = useCallback(async () => {
    try {
      const [compRes, obRes, prodRes, limitsRes, claimsRes] = await Promise.all([
        fetch('/api/companies'),
        fetch('/api/order-bookers'),
        fetch('/api/products'),
        fetch('/api/credit-limits'),
        fetch('/api/claims'),
      ]);
      if (compRes.ok) { const data = await compRes.json(); if (Array.isArray(data)) setCompanies(data); }
      if (obRes.ok) { const data = await obRes.json(); if (Array.isArray(data)) setOrderBookers(data); }
      if (prodRes.ok) { const data = await prodRes.json(); if (Array.isArray(data)) setProducts(data); }
      if (limitsRes.ok) { const data = await limitsRes.json(); if (Array.isArray(data)) setCreditLimits(data); }
      if (claimsRes.ok) { const data = await claimsRes.json(); if (Array.isArray(data)) setAllClaims(data); }
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
      if (!isAdmin) {
        if (user.orderBookerId) {
          params.set('orderBookerId', user.orderBookerId);
        }
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

  const openInlineEditor = (claim: Claim) => {
    const items: EditableItem[] = claim.claimItems.map(item => ({
      productId: item.productId,
      productName: item.product.name,
      quantity: item.quantity,
      amount: item.amount,
      claimPrice: item.product.claimPrice || item.product.price,
      unit: item.product.unit,
    }));
    setEditingClaimId(claim.id);
    setEditItems(items);
    setAddProductSearch('');
    setExpandedClaim(claim.id);
  };

  const updateEditItemQuantity = (index: number, newQty: number) => {
    if (newQty < 1) return;
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
    const claim = claims.find(c => c.id === editingClaimId);
    if (!claim || editItems.length === 0) return;
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
        payload.date = claim.date;
        payload.companyId = claim.companyId;
        payload.shopId = claim.shopId;
        payload.supplierId = claim.supplierId;
        payload.orderBookerId = claim.orderBookerId;
        payload.items = editItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          amount: item.amount,
        }));
      }

      const res = await fetch(`/api/claims/${claim.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        logAction({
          userName: user.name,
          action: isAdmin ? 'arrive_and_approve' : 'update',
          entity: 'claim',
          entityId: claim.id,
          details: isAdmin ? 'Verified and approved with edits' : 'Order booker edited pending claim items',
        });
        setEditingClaimId(null);
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

  const formatAmount = (amount: number) => `Rs ${amount.toLocaleString()}`;

  const editingClaim = claims.find(c => c.id === editingClaimId) || null;
  const filteredProducts = products.filter(p => {
    if (!editingClaim) return [];
    const matchesCompany = p.companyId === editingClaim.companyId;
    const matchesSearch = !addProductSearch || p.name.toLowerCase().includes(addProductSearch.toLowerCase());
    const notAlreadyAdded = !editItems.find(item => item.productId === p.id);
    return matchesCompany && matchesSearch && notAlreadyAdded;
  });

  const editTotalAmount = editItems.reduce((sum, item) => sum + item.amount, 0);

  // Credit usage for a shop+company (pending + approved + partial claims)
  const creditFor = (claim: Claim): { limit: number; used: number; pct: number } | null => {
    const limit = creditLimits.find(l => l.shopId === claim.shopId && l.companyId === claim.companyId)?.creditLimit;
    if (!limit || limit <= 0) return null;
    const used = allClaims
      .filter(c => c.shopId === claim.shopId && c.companyId === claim.companyId &&
        ['pending', 'approved', 'partial', 'arrived_approved', 'partially_approved', 'partially_cleared'].includes(c.status))
      .reduce((s, c) => s + c.totalAmount, 0);
    return { limit, used, pct: Math.min(100, Math.round((used / limit) * 100)) };
  };

  const waitingDays = (claim: Claim) => {
    const created = new Date(claim.createdAt || claim.date).getTime();
    return Math.max(0, Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24)));
  };

  const totalValue = claims.reduce((s, c) => s + c.totalAmount, 0);
  const oldestWaiting = claims.length > 0 ? Math.max(...claims.map(waitingDays)) : 0;

  if (loading && claims.length === 0) {
    return (
      <div className="empty-state" style={{ minHeight: 320 }}>
        <Loader2 className="ic animate-spin" />
        <p className="small">Loading claims…</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="h1">Stock Not Received</div>
          <div className="sub">
            {claims.length} claims awaiting stock verification · {formatAmount(totalValue)} total value at distribution
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-o" onClick={loadClaims} disabled={loading}>
            {loading ? <Loader2 className="ic sm animate-spin" /> : <RefreshCw className="ic sm" />} Refresh
          </button>
        </div>
      </div>

      {/* Mini stats */}
      <div className="mini-stats">
        <div className="mstat"><AlertTriangle className="ic sm" /><b>{claims.length}</b> pending claims</div>
        <div className="mstat"><Clock className="ic sm" />Oldest waiting <b>{oldestWaiting} days</b></div>
        <div className="mstat"><Store className="ic sm" /><b>{new Set(claims.map(c => c.shopId)).size}</b> unique shops</div>
        <div className="mstat"><Banknote className="ic sm" /><b>{formatAmount(totalValue)}</b> total value</div>
      </div>

      {/* Filters */}
      <div className="filters card">
        <div className="f-search">
          <Search className="ic sm" />
          <input
            placeholder="Search by claim # or shop name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="sel" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
          <option value="all">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {isAdmin && (
          <select className="sel" value={filterOrderBooker} onChange={(e) => setFilterOrderBooker(e.target.value)}>
            <option value="all">All Order Bookers</option>
            {orderBookers.map(ob => <option key={ob.id} value={ob.id}>{ob.name}</option>)}
          </select>
        )}
        <div className="spacer" />
      </div>

      {!isAdmin && (
        <div className="note">
          <CheckCircle className="ic" />
          <div>Showing only claims created by you (<b>{user.name}</b>). Other order bookers&apos; claims are hidden.</div>
        </div>
      )}

      {/* Claim cards */}
      {claims.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ minHeight: 240 }}>
            <Package className="ic" />
            <p style={{ color: 'var(--af-text)', fontWeight: 600 }}>No pending claims</p>
            <p className="small">All expiry stock has been received at distribution</p>
          </div>
        </div>
      ) : (
        claims.map((claim) => {
          const credit = creditFor(claim);
          const days = waitingDays(claim);
          const isEditing = editingClaimId === claim.id;
          const itemsPreview = claim.claimItems
            .slice(0, 3)
            .map(i => `${i.product.name} ×${i.quantity}`)
            .join(', ');

          return (
            <div className="claim-card" key={claim.id} style={isEditing ? { borderColor: 'var(--af-primary)' } : undefined}>
              <div className="cc-h">
                <span style={{ fontWeight: 800, color: 'var(--af-primary)', fontSize: 14.5 }}>{claim.claimNumber}</span>
                <span className="bdg pending">{isAdmin ? 'Pending' : 'Stock Not Received'}</span>
                <span className="chip" style={{ marginLeft: 'auto' }}>
                  <Clock className="ic" /> waiting {days} day{days === 1 ? '' : 's'}
                </span>
              </div>

              <div className="cc-b">
                <div className="cc-grid">
                  <div className="cc-cell"><div className="k">Shop</div><div className="v">{claim.shop.name}</div></div>
                  <div className="cc-cell"><div className="k">Company</div><div className="v">{claim.company.name}</div></div>
                  <div className="cc-cell"><div className="k">Order Booker</div><div className="v">{claim.orderBooker?.name || '—'}</div></div>
                  <div className="cc-cell"><div className="k">Claim Value</div><div className="v" style={{ color: 'var(--af-primary)' }}>{formatAmount(claim.totalAmount)}</div></div>
                </div>

                <div className="small muted" style={{ background: 'var(--af-surface2)', borderRadius: 9, padding: '9px 12px' }}>
                  📦 {claim.claimItems.length} items · {itemsPreview}{claim.claimItems.length > 3 ? `, +${claim.claimItems.length - 3} more` : ''}
                </div>

                {credit && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div className={`prog ${credit.pct >= 80 ? 'bad' : credit.pct >= 50 ? 'warn' : ''}`} style={{ maxWidth: 220 }}>
                      <i style={{ width: `${credit.pct}%` }} />
                    </div>
                    <span className="small muted">
                      Shop credit {credit.pct}% used — {credit.pct >= 80 ? 'verify carefully' : 'within limit'}
                    </span>
                  </div>
                )}

                {/* Expandable items detail */}
                <button
                  onClick={() => setExpandedClaim(expandedClaim === claim.id ? null : claim.id)}
                  style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--af-primary)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
                >
                  {expandedClaim === claim.id ? <ChevronUp className="ic sm" /> : <ChevronDown className="ic sm" />}
                  {claim.claimItems.length} items — Click to {expandedClaim === claim.id ? 'hide' : 'view'} details
                </button>

                {expandedClaim === claim.id && !isEditing && (
                  <div className="tbl-wrap" style={{ border: '1px solid var(--af-border)', borderRadius: 10 }}>
                    <table className="tbl" style={{ minWidth: 520 }}>
                      <thead>
                        <tr>
                          <th>#</th><th>Product</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {claim.claimItems.map((item, idx) => (
                          <tr key={item.id}>
                            <td className="muted">{idx + 1}</td>
                            <td className="strong">{item.product.name}</td>
                            <td className="num">{item.quantity} {item.product.unit}</td>
                            <td className="num">{formatAmount(item.product.claimPrice || item.product.price)}</td>
                            <td className="num strong">{formatAmount(item.amount)}</td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={4} className="num strong" style={{ background: 'var(--af-surface2)' }}>Total</td>
                          <td className="num strong" style={{ background: 'var(--af-surface2)' }}>{formatAmount(claim.totalAmount)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Inline Verify & Edit panel (mockup pattern) */}
                {isEditing && (
                  <div style={{ border: '1.5px solid var(--af-primary-soft)', borderRadius: 12, padding: 13, background: 'var(--af-primary-soft)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--af-primary)', marginBottom: 10 }}>
                      Physical stock verify karein — quantity edit kar sakte hain
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {editItems.map((item, index) => (
                        <div className="item-row" key={item.productId} style={{ background: 'var(--af-surface)', padding: '9px 12px' }}>
                          <div className="nm">
                            <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--af-text)' }}>{item.productName}</div>
                            <div className="small muted">Claim rate Rs {item.claimPrice}</div>
                          </div>
                          <div className="stepper">
                            <button className="stp" type="button" onClick={() => updateEditItemQuantity(index, item.quantity - 1)}><Minus className="ic sm" /></button>
                            <span className="stp-val">{item.quantity}</span>
                            <button className="stp" type="button" onClick={() => updateEditItemQuantity(index, item.quantity + 1)}><Plus className="ic sm" /></button>
                          </div>
                          <div style={{ width: 90, textAlign: 'right', fontWeight: 700, color: 'var(--af-text)', fontSize: 13 }}>Rs {item.amount.toLocaleString()}</div>
                          <button className="ra danger" type="button" title="Remove item" onClick={() => removeEditItem(index)}>
                            <Trash2 className="ic sm" />
                          </button>
                        </div>
                      ))}

                      {/* Add product */}
                      <div>
                        <div className="f-search" style={{ width: '100%', background: 'var(--af-surface)' }}>
                          <Search className="ic sm" />
                          <input
                            placeholder="Search products to add…"
                            value={addProductSearch}
                            onChange={(e) => setAddProductSearch(e.target.value)}
                          />
                        </div>
                        {addProductSearch && filteredProducts.length > 0 && (
                          <div style={{ border: '1px solid var(--af-border)', borderRadius: 10, marginTop: 8, maxHeight: 150, overflowY: 'auto', background: 'var(--af-surface)' }}>
                            {filteredProducts.slice(0, 5).map(product => (
                              <button
                                key={product.id}
                                type="button"
                                style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 0, borderBottom: '1px solid var(--af-border)', cursor: 'pointer', fontSize: 13, display: 'flex', justifyContent: 'space-between', fontFamily: 'inherit', color: 'var(--af-text)' }}
                                onClick={() => { addEditItem(product); setAddProductSearch(''); }}
                              >
                                <span>{product.name}</span>
                                <span className="small muted">Rs {product.claimPrice || product.price}/{product.unit}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 18, fontSize: 12.5, padding: '4px 12px 0' }}>
                        <span className="muted">Revised total</span>
                        <b style={{ color: 'var(--af-primary)' }}>
                          Rs {editingClaim ? editingClaim.totalAmount.toLocaleString() : 0} → Rs {editTotalAmount.toLocaleString()}
                        </b>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="cc-f">
                <button className="btn btn-do" onClick={() => { setRejectDialog(claim); setRejectReason(''); }}>
                  <XCircle className="ic sm" /> Reject
                </button>
                {!isEditing && (
                  <button className="btn btn-o" onClick={() => openInlineEditor(claim)}>
                    <Edit3 className="ic sm" /> {isAdmin ? 'Verify & Edit' : 'Edit Claim'}
                  </button>
                )}
                {isEditing ? (
                  <>
                    <button className="btn btn-o" onClick={() => { setEditingClaimId(null); setEditItems([]); }}>
                      Cancel Edit
                    </button>
                    <button className="btn btn-p" style={{ marginLeft: 'auto' }} onClick={handleApproveWithEdits} disabled={editItems.length === 0}>
                      <CheckCircle className="ic sm" /> {isAdmin ? 'Approve with Edited Quantities' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  isAdmin && (
                    <button className="btn btn-p" style={{ marginLeft: 'auto' }} onClick={() => handleQuickApprove(claim)}>
                      <CheckCircle className="ic sm" /> Approve — Stock Received
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })
      )}

      <div className="note">
        <Truck className="ic" />
        <div><b>Same workflow, better UI:</b> Approve = stock received on floor (payment baad mein clear hoga). Verify &amp; Edit mein quantity correct kar ke approve — total automatic recalculate. Ye bilkul aapke current system ke rules follow karta hai, koi naya process nahi.</div>
      </div>

      {/* Reject Dialog */}
      {rejectDialog && (
        <div className="af-ovl" onClick={() => setRejectDialog(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dlg-h">
              <div className="dlg-t" style={{ color: 'var(--af-bad)' }}>Reject Claim {rejectDialog.claimNumber}</div>
            </div>
            <div className="dlg-b">
              <p className="small" style={{ color: 'var(--af-text2)' }}>
                Shop: {rejectDialog.shop.name} | Amount: {formatAmount(rejectDialog.totalAmount)}
              </p>
              <div className="field">
                <label className="label">Reject Reason <span className="req">*</span></label>
                <textarea
                  className="af-ta"
                  rows={3}
                  placeholder="Enter reason for rejection…"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="dlg-f">
              <button className="btn btn-g" onClick={() => setRejectDialog(null)}>Cancel</button>
              <button className="btn btn-d" onClick={handleReject} disabled={!rejectReason.trim()}>
                <XCircle className="ic sm" /> Reject Claim
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
