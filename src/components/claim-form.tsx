'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, Plus, Trash2, ArrowLeft, Store, Search, X, ChevronDown, Package,
  Minus, Lock, Camera, AlertTriangle, FileText, Check, Lightbulb, XCircle, Banknote,
} from 'lucide-react';

interface ClaimFormProps {
  claim: ClaimData | null;
  companies: Array<{ id: string; name: string; multiTierPricing?: boolean; claimDeductionPercent?: number }>
  user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
  onSave: () => void;
  onCancel: () => void;
  existingClaims?: Array<{ companyId: string; shopId: string; date: string; totalAmount: number; id: string }>;
  quickClaim?: { companyId: string; shopId: string; supplierId: string; orderBookerId: string | null; claimNumber?: string } | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  claimPrice: number;
  wholesalePrice: number | null;
  lmtPrice: number | null;
  unit: string;
  companyId: string;
  company: { name: string; multiTierPricing: boolean };
}

interface ShopCompanyOB {
  id: string;
  shopId: string;
  companyId: string;
  orderBookerId: string | null;
  shopType?: string;
  company: { id: string; name: string };
  orderBooker?: { id: string; name: string } | null;
}

interface Shop {
  id: string;
  name: string;
  address: string;
  shopType: string;
  companyOrderBookers: ShopCompanyOB[];
}

interface Supplier {
  id: string;
  name: string;
}

interface OrderBooker {
  id: string;
  name: string;
}

interface ClaimData {
  id: string;
  claimNumber: string;
  date: string;
  companyId: string;
  shopId: string;
  supplierId: string;
  orderBookerId: string | null;
  totalAmount: number;
  deductionAmount: number;
  netAmount: number;
  createdAt?: string;
  claimItems: Array<{
    id: string;
    productId: string;
    quantity: number;
    amount: number;
    product: { name: string; price: number; claimPrice: number; unit: string; wholesalePrice: number | null; lmtPrice: number | null; company: { multiTierPricing: boolean } };
  }>;
}

const CO_GRADIENTS = [
  'linear-gradient(135deg,#4f46e5,#6366f1)',
  'linear-gradient(135deg,#7c3aed,#8b5cf6)',
  'linear-gradient(135deg,#0d9488,#14b8a6)',
  'linear-gradient(135deg,#0369a1,#0ea5e9)',
  'linear-gradient(135deg,#b45309,#f59e0b)',
];

export function ClaimForm({ claim, companies, user, onSave, onCancel, existingClaims, quickClaim }: ClaimFormProps) {
  const [date, setDate] = useState(claim ? new Date(claim.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [companyId, setCompanyId] = useState(claim?.companyId || quickClaim?.companyId || '');
  const [shopId, setShopId] = useState(claim?.shopId || quickClaim?.shopId || '');
  const [supplierId, setSupplierId] = useState(claim?.supplierId || quickClaim?.supplierId || '');
  const [orderBookerId, setOrderBookerId] = useState(claim?.orderBookerId || quickClaim?.orderBookerId || user.orderBookerId || '');
  const [items, setItems] = useState<Array<{ productId: string; quantity: number; amount: number }>>(
    claim?.claimItems.map((ci) => ({ productId: ci.productId, quantity: ci.quantity, amount: ci.amount })) || []
  );
  const [saving, setSaving] = useState(false);

  // Check if editing a rejected claim (resubmit scenario)
  const isResubmit = claim?.hasOwnProperty('status') && (claim as { status?: string }).status === 'rejected';

  // Photo attachments state
  const [photos, setPhotos] = useState<string[]>([]);

  // Credit limit state
  const [creditLimit, setCreditLimit] = useState<number | null>(null);
  const [pendingAmount, setPendingAmount] = useState(0);

  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orderBookers, setOrderBookers] = useState<OrderBooker[]>([]);

  // AUTO-SELECT COMPANY: If user is order booker and has exactly 1 company assigned
  useEffect(() => {
    if (!companyId && companies.length === 1 && user.role === 'orderbooker') {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId, user.role]);

  // Quick shop create dialog state
  const [showQuickShop, setShowQuickShop] = useState(false);
  const [quickShopName, setQuickShopName] = useState('');
  const [quickShopAddress, setQuickShopAddress] = useState('');
  const [quickShopOB, setQuickShopOB] = useState(user.orderBookerId || '');
  const [quickShopType, setQuickShopType] = useState('retail');
  const [creatingShop, setCreatingShop] = useState(false);

  // Shop search state
  const [shopSearch, setShopSearch] = useState('');
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false);
  const shopDropdownRef = useRef<HTMLDivElement>(null);

  // Product search state
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    loadDropdowns();
  }, []);

  useEffect(() => {
    if (companyId) {
      loadProducts(companyId);
    } else {
      setProducts([]);
    }
  }, [companyId]);

  useEffect(() => {
    // Auto-fill order booker based on shop + company combination
    if (shopId && companyId) {
      const shop = shops.find((s) => s.id === shopId);
      if (shop) {
        const mapping = shop.companyOrderBookers?.find(
          (cob) => cob.companyId === companyId
        );
        if (mapping?.orderBookerId) {
          setOrderBookerId(mapping.orderBookerId);
        }
      }
    }
  }, [shopId, companyId, shops]);

  // Recalculate amounts when shop changes (price tier may change)
  useEffect(() => {
    if (shopId && companyId && items.length > 0) {
      const newItems = items.map((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (product) {
          return { ...item, amount: calculateClaimAmount(product, item.quantity) };
        }
        return item;
      });
      setItems(newItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  // Check credit limit when shop/company changes
  useEffect(() => {
    const checkCreditLimit = async () => {
      if (!shopId || !companyId) { setCreditLimit(null); setPendingAmount(0); return; }
      try {
        const limitsRes = await fetch('/api/credit-limits');
        if (limitsRes.ok) {
          const limits = await limitsRes.json();
          const limit = limits.find((l: { shopId: string; companyId: string; creditLimit: number }) => l.shopId === shopId && l.companyId === companyId);
          setCreditLimit(limit?.creditLimit || null);
          if (limit?.creditLimit) {
            // Fetch pending claims for this shop+company to get pending amount
            const claimsRes = await fetch('/api/claims');
            if (claimsRes.ok) {
              const claims = await claimsRes.json();
              const pending = claims
                .filter((c: { shopId: string; companyId: string; status: string; id: string }) =>
                  c.shopId === shopId && c.companyId === companyId &&
                  (c.status === 'pending' || c.status === 'approved' || c.status === 'partial') &&
                  c.id !== claim?.id)
                .reduce((sum: number, c: { totalAmount: number }) => sum + c.totalAmount, 0);
              setPendingAmount(pending);
            }
          }
        }
      } catch { /* ignore credit limit check errors */ }
    };
    checkCreditLimit();
  }, [shopId, companyId, claim?.id]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (shopDropdownRef.current && !shopDropdownRef.current.contains(e.target as Node)) {
        setShopDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadDropdowns = async () => {
    try {
      const [shopRes, supRes, obRes] = await Promise.all([
        fetch('/api/shops'),
        fetch('/api/suppliers'),
        fetch('/api/order-bookers'),
      ]);
      if (shopRes.ok) { const data = await shopRes.json(); if (Array.isArray(data)) setShops(data); }
      if (supRes.ok) { const data = await supRes.json(); if (Array.isArray(data)) setSuppliers(data); }
      if (obRes.ok) { const data = await obRes.json(); if (Array.isArray(data)) setOrderBookers(data); }
    } catch (error) {
      console.error('Failed to load dropdowns:', error);
    }
  };

  const loadProducts = async (compId: string) => {
    try {
      const res = await fetch(`/api/products?companyId=${compId}`);
      if (res.ok) { const data = await res.json(); if (Array.isArray(data)) setProducts(data); }
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  // Get the effective shop type for a given company — checks ShopCompanyOrderBooker first, falls back to Shop.shopType
  const getEffectiveShopType = (compId: string): string => {
    const shop = shops.find((s) => s.id === shopId);
    if (!shop) return 'retail';
    const companyMapping = shop.companyOrderBookers?.find((cob) => cob.companyId === compId);
    if (companyMapping?.shopType) return companyMapping.shopType;
    return shop.shopType || 'retail';
  };

  const getProductPrice = (product: Product): number => {
    // For multi-tier companies, check wholesale/LMT prices FIRST (they override claimPrice)
    if (product.company?.multiTierPricing) {
      const effectiveType = getEffectiveShopType(product.companyId);
      if (effectiveType === 'wholesale' && product.wholesalePrice) {
        return product.wholesalePrice;
      }
      if (effectiveType === 'lmt' && product.lmtPrice) {
        return product.lmtPrice;
      }
    }
    if (product.claimPrice && product.claimPrice > 0) {
      return product.claimPrice;
    }
    return product.price;
  };

  const calculateClaimAmount = (product: Product, quantity: number): number => {
    const price = getProductPrice(product);
    return Math.round(price * quantity);
  };

  const getPriceLabel = (product: Product): string => {
    if (product.company?.multiTierPricing) {
      const effectiveType = getEffectiveShopType(product.companyId);
      if (effectiveType === 'wholesale' && product.wholesalePrice) {
        return `Ws: Rs.${product.wholesalePrice}`;
      }
      if (effectiveType === 'lmt' && product.lmtPrice) {
        return `LMT: Rs.${product.lmtPrice}`;
      }
    }
    const claimPrice = product.claimPrice && product.claimPrice > 0 ? product.claimPrice : null;
    if (claimPrice) {
      return `Rs.${claimPrice}`;
    }
    return `Rs.${product.price}`;
  };

  const addProductToClaim = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const existingIndex = items.findIndex((i) => i.productId === productId);
    if (existingIndex >= 0) {
      const newItems = [...items];
      newItems[existingIndex].quantity += 1;
      newItems[existingIndex].amount = calculateClaimAmount(product, newItems[existingIndex].quantity);
      setItems(newItems);
    } else {
      const amount = calculateClaimAmount(product, 1);
      setItems([...items, { productId, quantity: 1, amount }]);
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, newQty: number) => {
    if (newQty < 1) return;
    const newItems = [...items];
    newItems[index].quantity = newQty;
    const product = products.find((p) => p.id === newItems[index].productId);
    if (product) {
      newItems[index].amount = calculateClaimAmount(product, newQty);
    }
    setItems(newItems);
  };

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  // Get the selected company's multi-tier status
  const selectedCompany = companies.find((c) => c.id === companyId);
  const isMultiTier = selectedCompany?.multiTierPricing || false;
  const selectedShop = shops.find((s) => s.id === shopId);
  const effectiveShopType = companyId ? getEffectiveShopType(companyId) : (selectedShop?.shopType || 'retail');
  const shopTypeLabel = effectiveShopType === 'wholesale' ? 'Wholesale' : effectiveShopType === 'lmt' ? 'LMT' : 'Retail';

  // Deduction calculation
  const deductionPercent = selectedCompany?.claimDeductionPercent || 0;
  const hasDeduction = deductionPercent > 0;
  const deductionAmount = hasDeduction ? Math.round(totalAmount * deductionPercent / 100) : 0;
  const netAmount = totalAmount - deductionAmount;

  // Credit meter values
  const creditUsed = pendingAmount;
  const creditAfter = pendingAmount + totalAmount;
  const creditPct = creditLimit && creditLimit > 0 ? Math.min(100, Math.round((creditAfter / creditLimit) * 100)) : 0;
  const creditExceeded = creditLimit !== null && creditLimit > 0 && creditAfter > creditLimit;

  // Total units
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);

  // 24-hour edit lock check
  const isOlderThan24hr = claim?.createdAt ? new Date(claim.createdAt).getTime() + 24 * 60 * 60 * 1000 < Date.now() : false;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photos.length >= 3) { alert('Maximum 3 photos allowed'); return; }
    if (file.size > 2 * 1024 * 1024) { alert('Photo must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      if (base64) { setPhotos((prev) => [...prev, base64]); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = useCallback(async () => {
    if (!companyId || !shopId || !supplierId) {
      alert('Please fill in Company, Shop and Supplier');
      return;
    }
    if (items.length === 0 || items.some((i) => !i.productId)) {
      alert('Please add at least one product');
      return;
    }

    // Duplicate claim detection (only for new claims, not edits)
    if (!claim && existingClaims && existingClaims.length > 0) {
      const duplicate = existingClaims.find((ec) => {
        if (ec.companyId !== companyId || ec.shopId !== shopId || ec.date !== date) return false;
        const amountDiff = Math.abs(ec.totalAmount - totalAmount);
        const threshold = ec.totalAmount * 0.1;
        return amountDiff <= threshold;
      });
      if (duplicate) {
        const confirmed = confirm('A similar claim already exists for this shop+company+date. Are you sure you want to create another?');
        if (!confirmed) return;
      }
    }

    setSaving(true);
    try {
      const claimPayload = {
        date,
        companyId,
        shopId,
        supplierId,
        orderBookerId: orderBookerId || null,
        createdBy: user.name,
        creatorRole: user.role, // admin → auto-approve, orderbooker → needs approval
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          amount: i.amount,
        })),
      };

      let createdClaimId = claim?.id || '';

      if (claim) {
        const res = await fetch(`/api/claims/${claim.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            ...claimPayload,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || 'Failed to update claim');
          return;
        }
      } else {
        const res = await fetch('/api/claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(claimPayload),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || 'Failed to create claim');
          return;
        }
        const newClaim = await res.json();
        createdClaimId = newClaim.id;
      }

      // Upload photo attachments
      if (photos.length > 0 && createdClaimId) {
        try {
          await fetch('/api/claims/attachments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ claimId: createdClaimId, attachments: photos }),
          });
        } catch (attachErr) {
          console.error('Attachment upload error:', attachErr);
        }
      }

      onSave();
    } catch (error) {
      console.error('Save error:', error);
      alert('Network error. Please check your internet connection and try again.');
    } finally {
      setSaving(false);
    }
  }, [companyId, shopId, supplierId, items, claim, existingClaims, date, totalAmount, orderBookerId, user.name, user.role, onSave, photos]);

  // Keyboard shortcuts: Ctrl+S = Save, Esc = Cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!saving) handleSave();
      }
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saving, handleSave, onCancel]);

  // Filtered products for search
  const filteredProducts = products.filter((p) => {
    if (!productSearch) return true;
    const search = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(search);
  });
  const shownProducts = productSearch ? filteredProducts.slice(0, 24) : filteredProducts.slice(0, 12);

  const title = claim
    ? (isResubmit ? `Resubmit Claim ${claim.claimNumber}` : `Edit Claim ${claim.claimNumber}`)
    : quickClaim ? `Quick Claim (from ${quickClaim.claimNumber || ''})` : 'New Claim';

  const coInitials = selectedCompany
    ? selectedCompany.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '—';
  const coIdx = companies.findIndex((c) => c.id === companyId);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="h1">{title}</div>
          <div className="sub">
            Damage, expiry ya stock return claim create karein
            {!claim && !quickClaim && ' · Claim # auto-generate hoga'}
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-g" onClick={onCancel}>
            <ArrowLeft className="ic sm" /> Cancel
          </button>
        </div>
      </div>

      {/* 24hr Edit Lock Warning */}
      {claim && isOlderThan24hr && !isResubmit && (
        <div className="note" style={{ borderColor: 'var(--af-bad)', background: 'var(--af-bad-soft)' }}>
          <Lock className="ic" style={{ color: 'var(--af-bad)' }} />
          <div>
            <b style={{ color: 'var(--af-bad)' }}>This claim is older than 24 hours. Editing is restricted.</b>{' '}
            Claims can only be edited within 24 hours of creation.
          </div>
        </div>
      )}

      {/* Rejected Claim Resubmit Info */}
      {isResubmit && (
        <div className="note">
          <AlertTriangle className="ic" />
          <div>
            <b>This claim was rejected.</b> Edit and resubmit for admin approval.
            {(claim as { rejectReason?: string }).rejectReason && (
              <div className="small" style={{ marginTop: 4 }}>Reject Reason: <strong>{(claim as { rejectReason?: string }).rejectReason}</strong></div>
            )}
          </div>
        </div>
      )}

      <div className="form-grid">
        {/* ── LEFT: step cards ─────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Step 1 — Claim Details */}
          <div className="card">
            <div className="card-h">
              <div className="card-t"><FileText className="ic sm" /> Claim Details</div>
              <span className="bdg neutral">Step 1 of 3</span>
            </div>
            <div className="card-b">
              <div className="grid3">
                <div className="field">
                  <label className="label">Claim Date <span className="req">*</span></label>
                  <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Company <span className="req">*</span></label>
                  <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setItems([]); }}>
                    <SelectTrigger className="af-sel"><SelectValue placeholder="Select Company" /></SelectTrigger>
                    <SelectContent>
                      {companies.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-amber-600 italic">
                          No companies assigned to you. Ask admin to assign companies from Users tab.
                        </div>
                      ) : (
                        companies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}{c.multiTierPricing ? ' (Multi-Tier)' : ''}{c.claimDeductionPercent && c.claimDeductionPercent > 0 ? ` (${c.claimDeductionPercent}% Ded.)` : ''}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {user.role === 'orderbooker' && companies.length === 1 && (
                    <p className="small" style={{ color: 'var(--af-primary)' }}>✓ Auto-selected: {companies[0].name} (your assigned company)</p>
                  )}
                  {user.role === 'orderbooker' && companies.length === 0 && (
                    <p className="small" style={{ color: 'var(--af-warn)' }}>⚠ You have no companies assigned. Please contact admin.</p>
                  )}
                </div>
                <div className="field">
                  <label className="label">Supplier <span className="req">*</span></label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger className="af-sel"><SelectValue placeholder="Select Supplier" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid3" style={{ marginTop: 14 }}>
                {/* Shop — searchable dropdown + quick create */}
                <div className="field">
                  <label className="label">Shop <span className="req">*</span></label>
                  <div ref={shopDropdownRef} style={{ position: 'relative' }}>
                    {shopId ? (
                      <div className="sel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedShop?.name}
                          {selectedShop?.address ? ` (${selectedShop.address})` : ''}
                          {selectedShop?.shopType && selectedShop.shopType !== 'retail' && (
                            <span style={{ color: 'var(--af-violet)', fontWeight: 700, marginLeft: 4 }}>[{selectedShop.shopType === 'wholesale' ? 'Wholesale' : 'LMT'}]</span>
                          )}
                        </span>
                        <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button type="button" className="ra" style={{ width: 26, height: 26 }} title="Quick Create Shop" onClick={() => { setQuickShopName(''); setQuickShopAddress(''); setQuickShopOB(''); setQuickShopType('retail'); setShowQuickShop(true); }}>
                            <Store className="ic sm" />
                          </button>
                          <button type="button" className="ra danger" style={{ width: 26, height: 26 }} title="Clear shop" onClick={() => { setShopId(''); setShopSearch(''); }}>
                            <X className="ic sm" />
                          </button>
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <Search className="ic sm" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--af-text3)' }} />
                          <input
                            className="input"
                            style={{ paddingLeft: 34, paddingRight: 34 }}
                            placeholder="Search shop…"
                            value={shopSearch}
                            onChange={(e) => { setShopSearch(e.target.value); setShopDropdownOpen(true); }}
                            onFocus={() => setShopDropdownOpen(true)}
                          />
                          <button type="button" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, cursor: 'pointer', color: 'var(--af-text3)', padding: 6 }} onClick={() => setShopDropdownOpen(!shopDropdownOpen)}>
                            <ChevronDown className="ic sm" />
                          </button>
                        </div>
                        <button type="button" className="btn btn-o" style={{ padding: '6px 10px' }} title="Quick Create Shop" onClick={() => { setQuickShopName(''); setQuickShopAddress(''); setQuickShopOB(''); setQuickShopType('retail'); setShowQuickShop(true); }}>
                          <Store className="ic sm" />
                        </button>
                      </div>
                    )}
                    {shopDropdownOpen && !shopId && (
                      <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderRadius: 10, boxShadow: 'var(--af-sh-lg)', maxHeight: 240, overflowY: 'auto' }}>
                        {shops
                          .filter((s) => {
                            if (!shopSearch) return true;
                            const search = shopSearch.toLowerCase();
                            return s.name.toLowerCase().includes(search) || (s.address && s.address.toLowerCase().includes(search));
                          })
                          .length === 0 ? (
                          <div style={{ padding: '14px 12px', textAlign: 'center' }}>
                            <p className="small muted" style={{ marginBottom: 8 }}>No shop found</p>
                            <button type="button" className="btn btn-p btn-sm" onClick={() => { setQuickShopName(shopSearch); setQuickShopAddress(''); setQuickShopOB(''); setShowQuickShop(true); setShopDropdownOpen(false); }}>
                              <Store className="ic sm" /> Create &quot;{shopSearch}&quot;
                            </button>
                          </div>
                        ) : (
                          shops
                            .filter((s) => {
                              if (!shopSearch) return true;
                              const search = shopSearch.toLowerCase();
                              return s.name.toLowerCase().includes(search) || (s.address && s.address.toLowerCase().includes(search));
                            })
                            .map((s) => (
                              <button key={s.id} type="button" style={{ width: '100%', textAlign: 'left', padding: '9px 12px', fontSize: 13, background: 'transparent', border: 0, borderBottom: '1px solid var(--af-border)', cursor: 'pointer', color: 'var(--af-text2)', fontFamily: 'inherit' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--af-primary-soft)'; e.currentTarget.style.color = 'var(--af-primary)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--af-text2)'; }}
                                onClick={() => { setShopId(s.id); setShopSearch(''); setShopDropdownOpen(false); }}
                              >
                                <span style={{ fontWeight: 600, color: 'var(--af-text)' }}>{s.name}</span>
                                {s.address && <span className="muted"> ({s.address})</span>}
                                {s.shopType !== 'retail' && <span style={{ color: 'var(--af-violet)', fontWeight: 600, marginLeft: 4 }}>[{s.shopType === 'wholesale' ? 'Wholesale' : 'LMT'}]</span>}
                                {companyId && s.companyOrderBookers?.find((cob) => cob.companyId === companyId)?.orderBooker && (
                                  <span style={{ color: 'var(--af-primary)', marginLeft: 4 }}>- {s.companyOrderBookers.find((cob) => cob.companyId === companyId)?.orderBooker?.name}</span>
                                )}
                              </button>
                            ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Booker */}
                <div className="field">
                  <label className="label">Order Booker</label>
                  {user.role === 'orderbooker' ? (
                    <div className="sel" style={{ display: 'flex', alignItems: 'center', background: 'var(--af-surface2)', fontWeight: 600, color: 'var(--af-primary)' }}>
                      {orderBookers.find((ob) => ob.id === orderBookerId)?.name || user.name}
                    </div>
                  ) : (
                    <Select value={orderBookerId || 'none'} onValueChange={(v) => setOrderBookerId(v === 'none' ? '' : v)}>
                      <SelectTrigger className="af-sel"><SelectValue placeholder="Auto / Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {orderBookers.map((ob) => (<SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Shop Credit Status */}
                <div className="field">
                  <label className="label">Shop Credit Status</label>
                  {creditLimit !== null && creditLimit > 0 ? (
                    <div className="sel" style={{ display: 'flex', alignItems: 'center', gap: 9, background: creditExceeded ? 'var(--af-bad-soft)' : 'var(--af-ok-soft)', borderColor: 'transparent', fontWeight: 600, color: creditExceeded ? 'var(--af-bad)' : 'var(--af-ok)' }}>
                      {creditExceeded
                        ? <>⚠ Rs {creditAfter.toLocaleString()} / {creditLimit.toLocaleString()} — limit exceeded</>
                        : <>✓ Rs {(creditLimit - creditUsed).toLocaleString()} available (limit {creditLimit.toLocaleString()})</>}
                    </div>
                  ) : (
                    <div className="sel" style={{ display: 'flex', alignItems: 'center', color: 'var(--af-text3)' }}>
                      No credit limit set
                    </div>
                  )}
                </div>
              </div>

              {/* Multi-tier / deduction info */}
              {isMultiTier && companyId && shopId && (
                <div className="note" style={{ marginTop: 14 }}>
                  <Lightbulb className="ic" />
                  <div><b>Multi-Tier Pricing Active</b> — Shop Type: <b>{shopTypeLabel}</b>. Rates isi tier ke hisaab se lagengi.</div>
                </div>
              )}
            </div>
          </div>

          {/* Step 2 — Add Products */}
          <div className="card">
            <div className="card-h">
              <div>
                <div className="card-t"><Package className="ic sm" /> Add Products</div>
                <div className="card-sub">Claim price per product ke hisaab se lagti hai</div>
              </div>
              <span className="bdg neutral">Step 2 of 3</span>
            </div>
            <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {!companyId ? (
                <div className="empty-state">
                  <Package className="ic" />
                  <p className="small">Pehle company select karo products add karne ke liye</p>
                </div>
              ) : (
                <>
                  <div className="f-search" style={{ width: '100%' }}>
                    <Search className="ic sm" />
                    <input
                      placeholder="Search product by name… (e.g. Biryani Masala)"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                  </div>

                  {shownProducts.length === 0 ? (
                    <div className="empty-state">
                      <Package className="ic" />
                      <p className="small">{productSearch ? `No product found for "${productSearch}"` : 'No products in this company'}</p>
                    </div>
                  ) : (
                    <div className="prod-grid">
                      {shownProducts.map((product) => {
                        const added = items.some((i) => i.productId === product.id);
                        return (
                          <div className={`prod ${added ? '' : ''}`} key={product.id} style={added ? { borderColor: 'var(--af-violet)', boxShadow: 'var(--af-sh)' } : undefined}>
                            <div className="prod-nm">{product.name}</div>
                            <div className="prod-pr">
                              Price Rs {product.price} · <b>{getPriceLabel(product)}</b> / {product.unit}
                              {isMultiTier && product.wholesalePrice && product.lmtPrice && (
                                <span className="muted"> (Ws:{product.wholesalePrice} / LMT:{product.lmtPrice})</span>
                              )}
                            </div>
                            <div className="prod-foot">
                              <span className="chip c3">{product.company?.name || ''}</span>
                              {added ? (
                                <span className="chip c1"><Check className="ic" /> Added</span>
                              ) : (
                                <button className="btn btn-p btn-sm" onClick={() => addProductToClaim(product.id)}>
                                  <Plus className="ic sm" /> Add
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!productSearch && filteredProducts.length > 12 && (
                    <p className="small muted" style={{ textAlign: 'center' }}>
                      +{filteredProducts.length - 12} more products — search to narrow down
                    </p>
                  )}

                  {/* Items in this claim */}
                  <div style={{ borderTop: '1px solid var(--af-border)', paddingTop: 15, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--af-text3)' }}>
                      Items in this claim ({items.length})
                    </div>
                    {items.length === 0 ? (
                      <div className="empty-state" style={{ padding: '24px 16px' }}>
                        <Package className="ic" />
                        <p className="small">Search aur click karke products add karo</p>
                      </div>
                    ) : (
                      items.map((item, index) => {
                        const product = products.find((p) => p.id === item.productId);
                        if (!product) return null;
                        return (
                          <div className="item-row" key={item.productId}>
                            <div className="nm">
                              <div style={{ fontWeight: 600, color: 'var(--af-text)', fontSize: 13 }}>{product.name}</div>
                              <div className="small muted">
                                {getPriceLabel(product)} / {product.unit}
                                {isMultiTier && <span style={{ color: 'var(--af-violet)', marginLeft: 4 }}>({shopTypeLabel})</span>}
                              </div>
                            </div>
                            <div className="stepper">
                              <button className="stp" type="button" onClick={() => updateQuantity(index, item.quantity - 1)}><Minus className="ic sm" /></button>
                              <input
                                className="stp-val"
                                style={{ border: 0, outline: 0, background: 'transparent', fontFamily: 'inherit' }}
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => updateQuantity(index, Math.max(1, parseInt(e.target.value) || 1))}
                              />
                              <button className="stp" type="button" onClick={() => updateQuantity(index, item.quantity + 1)}><Plus className="ic sm" /></button>
                            </div>
                            <div style={{ width: 100, textAlign: 'right', fontWeight: 700, color: 'var(--af-text)', fontVariantNumeric: 'tabular-nums' }}>
                              Rs {item.amount.toLocaleString()}
                            </div>
                            <button className="ra danger" type="button" title="Remove" onClick={() => removeItem(index)}>
                              <Trash2 className="ic sm" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Step 3 — Attachments */}
          <div className="card">
            <div className="card-h">
              <div className="card-t"><Camera className="ic sm" /> Attachments <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></div>
              <span className="bdg neutral">Step 3 of 3</span>
            </div>
            <div className="card-b">
              <div className="attach-row">
                {photos.map((photo, idx) => (
                  <div className="attach" key={idx} style={{ position: 'relative' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt={`Claim photo ${idx + 1}`} />
                    <button
                      type="button"
                      onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                      style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 99, background: 'var(--af-bad)', color: '#fff', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      aria-label="Remove photo"
                    >
                      <X className="ic sm" style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                ))}
                <label className="attach add" style={{ cursor: photos.length >= 3 ? 'not-allowed' : 'pointer', opacity: photos.length >= 3 ? 0.5 : 1 }}>
                  <Camera className="ic" />
                  {photos.length >= 3 ? 'Max 3 photos' : 'Add Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoSelect}
                    className="hidden"
                    style={{ display: 'none' }}
                    disabled={photos.length >= 3}
                  />
                </label>
              </div>
              <p className="small muted" style={{ marginTop: 11 }}>Damage/expiry photos — shopkeeper ko dikhane aur proof ke liye (max 3, 2MB each)</p>
            </div>
          </div>
        </div>

        {/* ── RIGHT: sticky summary ─────────────────────────── */}
        <div className="sticky-side">
          <div className="card" style={{ position: 'sticky', top: 80 }}>
            <div className="card-h"><div className="card-t"><Banknote className="ic sm" /> Summary</div></div>
            <div className="card-b">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, paddingBottom: 13, borderBottom: '1px solid var(--af-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div className="co-logo" style={{ background: CO_GRADIENTS[coIdx >= 0 ? coIdx % CO_GRADIENTS.length : 0], fontSize: 11 }}>{coInitials}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--af-text)' }}>{selectedCompany?.name || 'No company selected'}</div>
                    <div className="small muted">{hasDeduction ? `${deductionPercent}% claim deduction policy` : 'No deduction policy'}</div>
                  </div>
                </div>
                <div className="small" style={{ color: 'var(--af-text2)' }}>
                  {selectedShop?.name || 'No shop selected'} · {orderBookers.find((ob) => ob.id === orderBookerId)?.name || user.name}
                </div>
              </div>
              <div style={{ paddingTop: 11 }}>
                <div className="sum-row"><span>Items</span><b>{items.length} products · {totalUnits} units</b></div>
                <div className="sum-row"><span>Total Amount</span><b>Rs {totalAmount.toLocaleString()}</b></div>
                <div className="sum-row"><span>Deduction ({deductionPercent}%)</span><b style={{ color: 'var(--af-bad)' }}>− Rs {deductionAmount.toLocaleString()}</b></div>
                <div className="sum-total">
                  <span className="lbl">Net Payable</span>
                  <span className="val">Rs {netAmount.toLocaleString()}</span>
                </div>
              </div>

              {creditLimit !== null && creditLimit > 0 && (
                <div style={{ marginTop: 15 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--af-text3)', marginBottom: 6 }}>
                    <span>Shop credit limit</span>
                    <span>{creditPct}% used</span>
                  </div>
                  <div className={`prog ${creditPct >= 80 ? 'bad' : creditPct >= 50 ? 'warn' : ''}`}>
                    <i style={{ width: `${creditPct}%` }} />
                  </div>
                  <p className="small muted" style={{ marginTop: 6 }}>
                    Rs {creditUsed.toLocaleString()} / {creditLimit.toLocaleString()} used · is claim ke baad Rs {creditAfter.toLocaleString()}
                  </p>
                </div>
              )}

              {creditExceeded && (
                <div className="note" style={{ marginTop: 12, borderColor: 'var(--af-bad)', background: 'var(--af-bad-soft)' }}>
                  <AlertTriangle className="ic" style={{ color: 'var(--af-bad)' }} />
                  <div><b style={{ color: 'var(--af-bad)' }}>Credit limit exceeded!</b> Limit: Rs {creditLimit?.toLocaleString()}, Pending: Rs {creditUsed.toLocaleString()}, This Claim: Rs {totalAmount.toLocaleString()}</div>
                </div>
              )}

              <button className="btn btn-p btn-lg btn-block" style={{ marginTop: 16 }} onClick={handleSave} disabled={saving || (claim ? isOlderThan24hr : false)}>
                {saving ? (<><Loader2 className="ic sm animate-spin" /> Saving…</>) : (<><Check className="ic sm" /> {claim ? 'Update Claim' : 'Submit Claim'}</>)}
              </button>
              <button className="btn btn-o btn-block" style={{ marginTop: 8 }} onClick={onCancel}>Cancel</button>
              {user.role === 'orderbooker' && (
                <p className="small muted" style={{ marginTop: 10, textAlign: 'center' }}>⚠ Order booker claims admin approval ke baad process hongi</p>
              )}
              <p className="small muted" style={{ marginTop: 6, textAlign: 'center' }}>Ctrl+S = Save · Esc = Cancel</p>
            </div>
          </div>
        </div>
      </div>

      <div className="note">
        <Lightbulb className="ic" />
        <div><b>Auto-calculations:</b> {hasDeduction ? `${deductionPercent}% deduction company setting se automatic lagega` : 'deduction company setting se automatic lagega (agar set hai)'}, claim price per product se — koi manual hisaab nahi. <b>Credit limit meter:</b> 80% cross hone par red warning.</div>
      </div>

      {/* Quick Shop Create Dialog */}
      <Dialog open={showQuickShop} onOpenChange={setShowQuickShop}>
        <DialogContent className="af-dialog sm:max-w-[440px]">
          <div className="dlg-h">
            <DialogTitle className="dlg-t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Store className="ic sm" style={{ color: 'var(--af-primary)' }} /> Quick Create Shop
            </DialogTitle>
          </div>
          <div className="dlg-b">
            <div className="field">
              <label className="label">Shop Name <span className="req">*</span></label>
              <input className="input" placeholder="Enter shop name" value={quickShopName} onChange={(e) => setQuickShopName(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label className="label">Address</label>
              <input className="input" placeholder="Enter address (optional)" value={quickShopAddress} onChange={(e) => setQuickShopAddress(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Shop Type <span className="req">*</span></label>
              <p className="small muted">Affects claim rate for multi-tier companies like Cadbury</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {['retail', 'wholesale', 'lmt'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`btn btn-sm ${quickShopType === type ? 'btn-p' : 'btn-o'}`}
                    style={{ flex: 1 }}
                    onClick={() => setQuickShopType(type)}
                  >
                    {type === 'retail' ? 'Retail' : type === 'wholesale' ? 'Wholesale' : 'LMT'}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="label">Order Booker {companyId ? `(for ${companies.find((c) => c.id === companyId)?.name})` : ''}</label>
              {user.role === 'orderbooker' ? (
                <div className="sel" style={{ display: 'flex', alignItems: 'center', background: 'var(--af-surface2)', fontWeight: 600, color: 'var(--af-primary)' }}>
                  {orderBookers.find((ob) => ob.id === user.orderBookerId)?.name || user.name}
                </div>
              ) : (
                <Select value={quickShopOB || 'none'} onValueChange={setQuickShopOB}>
                  <SelectTrigger className="af-sel"><SelectValue placeholder="Select Order Booker" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {orderBookers.map((ob) => (<SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="dlg-f">
            <button className="btn btn-g" onClick={() => setShowQuickShop(false)}>Cancel</button>
            <button
              className="btn btn-p"
              disabled={creatingShop || !quickShopName.trim()}
              onClick={async () => {
                setCreatingShop(true);
                try {
                  const cobArray: Array<{ companyId: string; orderBookerId: string; shopType: string }> = [];
                  if (companyId) {
                    cobArray.push({ companyId, orderBookerId: quickShopOB && quickShopOB !== 'none' ? quickShopOB : '', shopType: quickShopType });
                  }
                  const res = await fetch('/api/shops', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: quickShopName.trim(), address: quickShopAddress.trim(), shopType: quickShopType, companyOrderBookers: cobArray }),
                  });
                  if (!res.ok) { const data = await res.json(); alert(data.error || 'Failed to create shop'); return; }
                  const newShop = await res.json();
                  setShops((prev) => [...prev, newShop].sort((a, b) => a.name.localeCompare(b.name)));
                  setShopId(newShop.id);
                  if (quickShopOB && quickShopOB !== 'none') { setOrderBookerId(quickShopOB); }
                  setShowQuickShop(false);
                } catch (error) { console.error(error); alert('Failed to create shop'); }
                finally { setCreatingShop(false); }
              }}
            >
              {creatingShop ? (<><Loader2 className="ic sm animate-spin" /> Creating…</>) : (<><Check className="ic sm" /> Create Shop</>)}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
