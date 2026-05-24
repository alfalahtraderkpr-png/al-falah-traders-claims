'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, ArrowLeft, Store, Search, X, ChevronDown, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface ClaimFormProps {
  claim: ClaimData | null;
  companies: Array<{ id: string; name: string; multiTierPricing?: boolean }>;
  user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
  onSave: () => void;
  onCancel: () => void;
}

interface Product {
  id: string;
  name: string;
  price: number;
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
  claimItems: Array<{
    id: string;
    productId: string;
    quantity: number;
    amount: number;
    product: { name: string; price: number; unit: string; wholesalePrice: number | null; lmtPrice: number | null; company: { multiTierPricing: boolean } };
  }>;
}

export function ClaimForm({ claim, companies, user, onSave, onCancel }: ClaimFormProps) {
  const [date, setDate] = useState(claim ? new Date(claim.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [companyId, setCompanyId] = useState(claim?.companyId || '');
  const [shopId, setShopId] = useState(claim?.shopId || '');
  const [supplierId, setSupplierId] = useState(claim?.supplierId || '');
  const [orderBookerId, setOrderBookerId] = useState(claim?.orderBookerId || '');
  const [items, setItems] = useState<Array<{ productId: string; quantity: number; amount: number }>>(
    claim?.claimItems.map((ci) => ({ productId: ci.productId, quantity: ci.quantity, amount: ci.amount })) || []
  );
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orderBookers, setOrderBookers] = useState<OrderBooker[]>([]);

  // Quick shop create dialog state
  const [showQuickShop, setShowQuickShop] = useState(false);
  const [quickShopName, setQuickShopName] = useState('');
  const [quickShopAddress, setQuickShopAddress] = useState('');
  const [quickShopOB, setQuickShopOB] = useState('');
  const [quickShopType, setQuickShopType] = useState('retail');
  const [creatingShop, setCreatingShop] = useState(false);

  // Shop search state
  const [shopSearch, setShopSearch] = useState('');
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false);
  const shopDropdownRef = useRef<HTMLDivElement>(null);

  // Product search state - for the product picker
  const [productSearch, setProductSearch] = useState('');
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);

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
          const price = getProductPrice(product);
          return { ...item, amount: Math.round(price * item.quantity) };
        }
        return item;
      });
      setItems(newItems);
    }
  }, [shopId]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (shopDropdownRef.current && !shopDropdownRef.current.contains(e.target as Node)) {
        setShopDropdownOpen(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
        setProductDropdownOpen(false);
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
      setShops(await shopRes.json());
      setSuppliers(await supRes.json());
      setOrderBookers(await obRes.json());
    } catch (error) {
      console.error('Failed to load dropdowns:', error);
    }
  };

  const loadProducts = async (compId: string) => {
    try {
      const res = await fetch(`/api/products?companyId=${compId}`);
      setProducts(await res.json());
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const getProductPrice = (product: Product): number => {
    if (product.company?.multiTierPricing) {
      const shop = shops.find((s) => s.id === shopId);
      if (shop) {
        if (shop.shopType === 'wholesale' && product.wholesalePrice) {
          return product.wholesalePrice;
        }
        if (shop.shopType === 'lmt' && product.lmtPrice) {
          return product.lmtPrice;
        }
      }
    }
    return product.price;
  };

  const getPriceLabel = (product: Product): string => {
    if (product.company?.multiTierPricing) {
      const shop = shops.find((s) => s.id === shopId);
      if (shop?.shopType === 'wholesale' && product.wholesalePrice) {
        return `Ws:Rs.${product.wholesalePrice}`;
      }
      if (shop?.shopType === 'lmt' && product.lmtPrice) {
        return `LMT:Rs.${product.lmtPrice}`;
      }
    }
    return `Rs.${product.price}`;
  };

  const addProductToClaim = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    // Check if already added - increase quantity instead
    const existingIndex = items.findIndex((i) => i.productId === productId);
    if (existingIndex >= 0) {
      const newItems = [...items];
      newItems[existingIndex].quantity += 1;
      const price = getProductPrice(product);
      newItems[existingIndex].amount = Math.round(price * newItems[existingIndex].quantity);
      setItems(newItems);
    } else {
      const price = getProductPrice(product);
      const amount = Math.round(price);
      setItems([...items, { productId, quantity: 1, amount }]);
    }
    setProductSearch('');
    setProductDropdownOpen(false);
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
      const price = getProductPrice(product);
      newItems[index].amount = Math.round(price * newQty);
    }
    setItems(newItems);
  };

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  const handleSave = async () => {
    if (!companyId || !shopId || !supplierId) {
      alert('Please fill in Company, Shop and Supplier');
      return;
    }
    if (items.length === 0 || items.some((i) => !i.productId)) {
      alert('Please add at least one product');
      return;
    }

    setSaving(true);
    try {
      if (claim) {
        const res = await fetch(`/api/claims/${claim.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            date,
            companyId,
            shopId,
            supplierId,
            orderBookerId: orderBookerId || null,
            items: items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              amount: i.amount,
            })),
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
          body: JSON.stringify({
            date,
            companyId,
            shopId,
            supplierId,
            orderBookerId: orderBookerId || null,
            items: items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              amount: i.amount,
            })),
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || 'Failed to create claim');
          return;
        }
      }
      onSave();
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save claim');
    } finally {
      setSaving(false);
    }
  };

  // Get the selected company's multi-tier status
  const selectedCompany = companies.find((c) => c.id === companyId);
  const isMultiTier = selectedCompany?.multiTierPricing || false;
  const selectedShop = shops.find((s) => s.id === shopId);
  const shopTypeLabel = selectedShop?.shopType === 'wholesale' ? 'Wholesale' : selectedShop?.shopType === 'lmt' ? 'LMT' : 'Retail';

  // Filtered products for search
  const filteredProducts = products.filter((p) => {
    if (!productSearch) return true;
    const search = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(search);
  });

  // Products not yet in claim
  const availableProducts = filteredProducts.filter(
    (p) => !items.some((i) => i.productId === p.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-2xl font-bold text-emerald-800">
          {claim ? `Edit Claim ${claim.claimNumber}` : 'New Claim'}
        </h2>
      </div>

      {/* Claim Details - Compact single card */}
      <Card className="shadow-sm">
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium">Company *</Label>
              <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setItems([]); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}{c.multiTierPricing ? ' (Multi-Tier)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Shop *</Label>
              <div className="flex gap-1 mt-1">
                <div ref={shopDropdownRef} className="relative flex-1">
                  {shopId ? (
                    <div className="flex items-center justify-between h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <span className="truncate">
                        {selectedShop?.name}
                        {selectedShop?.address ? ` (${selectedShop.address})` : ''}
                        {selectedShop?.shopType && selectedShop.shopType !== 'retail' && (
                          <span className="ml-1 text-xs text-purple-600 font-medium">[{selectedShop.shopType === 'wholesale' ? 'Wholesale' : 'LMT'}]</span>
                        )}
                      </span>
                      <button type="button" className="text-muted-foreground hover:text-foreground ml-2 shrink-0" onClick={() => { setShopId(''); setShopSearch(''); }}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search shop..."
                        value={shopSearch}
                        onChange={(e) => { setShopSearch(e.target.value); setShopDropdownOpen(true); }}
                        onFocus={() => setShopDropdownOpen(true)}
                        className="pl-9 pr-9"
                      />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShopDropdownOpen(!shopDropdownOpen)}>
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {shopDropdownOpen && !shopId && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {shops
                        .filter((s) => {
                          if (!shopSearch) return true;
                          const search = shopSearch.toLowerCase();
                          return s.name.toLowerCase().includes(search) || (s.address && s.address.toLowerCase().includes(search));
                        })
                        .length === 0 ? (
                        <div className="px-3 py-4 text-center">
                          <p className="text-sm text-muted-foreground mb-2">No shop found</p>
                          <Button type="button" size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setQuickShopName(shopSearch); setQuickShopAddress(''); setQuickShopOB(''); setShowQuickShop(true); setShopDropdownOpen(false); }}>
                            <Store className="h-3.5 w-3.5 mr-1" /> Create &quot;{shopSearch}&quot;
                          </Button>
                        </div>
                      ) : (
                        shops
                          .filter((s) => {
                            if (!shopSearch) return true;
                            const search = shopSearch.toLowerCase();
                            return s.name.toLowerCase().includes(search) || (s.address && s.address.toLowerCase().includes(search));
                          })
                          .map((s) => (
                            <button key={s.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 hover:text-emerald-800 transition-colors border-b last:border-b-0" onClick={() => { setShopId(s.id); setShopSearch(''); setShopDropdownOpen(false); }}>
                              <span className="font-medium">{s.name}</span>
                              {s.address && <span className="text-muted-foreground ml-1">({s.address})</span>}
                              {s.shopType !== 'retail' && <span className="ml-1 text-xs text-purple-600 font-medium">[{s.shopType === 'wholesale' ? 'Wholesale' : 'LMT'}]</span>}
                              {companyId && s.companyOrderBookers?.find((cob) => cob.companyId === companyId)?.orderBooker && (
                                <span className="text-emerald-600 ml-1 text-xs">- {s.companyOrderBookers.find((cob) => cob.companyId === companyId)?.orderBooker?.name}</span>
                              )}
                            </button>
                          ))
                      )}
                    </div>
                  )}
                </div>
                <Button type="button" variant="outline" size="icon" className="shrink-0 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700" title="Quick Create Shop" onClick={() => { setQuickShopName(''); setQuickShopAddress(''); setQuickShopOB(''); setQuickShopType('retail'); setShowQuickShop(true); }}>
                  <Store className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select Supplier" /></SelectTrigger>
                <SelectContent>{suppliers.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Order Booker</Label>
              <Select value={orderBookerId} onValueChange={setOrderBookerId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Auto / Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {orderBookers.map((ob) => (<SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Multi-tier pricing info banner */}
          {isMultiTier && shopId && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center gap-2">
              <span className="text-sm font-medium text-purple-800">Multi-Tier Pricing Active</span>
              <span className="text-xs text-purple-600">|</span>
              <span className="text-xs text-purple-700">Shop Type: <strong>{shopTypeLabel}</strong></span>
              <span className="text-xs text-purple-600">|</span>
              <span className="text-xs text-purple-700">Price Type: <strong>{shopTypeLabel}</strong> rate</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Products Section - Redesigned */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-600" />
            Products
            {items.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">({items.length} items)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!companyId ? (
            <div className="text-center py-10">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-muted-foreground">Pehle company select karo products add karne ke liye</p>
            </div>
          ) : (
            <>
              {/* Search & Add Product Bar */}
              <div ref={productDropdownRef} className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search product by name..."
                      value={productSearch}
                      onChange={(e) => { setProductSearch(e.target.value); setProductDropdownOpen(true); }}
                      onFocus={() => { if (productSearch || products.length > 0) setProductDropdownOpen(true); }}
                      className="pl-9"
                      disabled={!companyId}
                    />
                  </div>
                </div>

                {/* Product Search Results Dropdown */}
                {productDropdownOpen && companyId && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-72 overflow-y-auto">
                    {productSearch && filteredProducts.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <p className="text-sm text-muted-foreground">No product found for &quot;{productSearch}&quot;</p>
                      </div>
                    ) : !productSearch && products.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <p className="text-sm text-muted-foreground">No products in this company</p>
                      </div>
                    ) : (
                      <>
                        {/* Already added products section */}
                        {items.length > 0 && !productSearch && (
                          <>
                            <div className="px-3 py-2 bg-gray-50 text-xs font-medium text-gray-500 sticky top-0 border-b">ALREADY IN CLAIM</div>
                            {items.map((item) => {
                              const product = products.find((p) => p.id === item.productId);
                              if (!product) return null;
                              return (
                                <div key={product.id} className="flex items-center justify-between px-3 py-2 border-b bg-gray-50/50">
                                  <div className="flex-1">
                                    <span className="text-sm font-medium text-gray-600">{product.name}</span>
                                    <span className="text-xs text-gray-400 ml-2">{getPriceLabel(product)}/{product.unit}</span>
                                  </div>
                                  <span className="text-xs text-emerald-600 font-medium mr-2">Qty: {item.quantity}</span>
                                </div>
                              );
                            })}
                            {availableProducts.length > 0 && (
                              <div className="px-3 py-2 bg-emerald-50 text-xs font-medium text-emerald-700 sticky top-0 border-b">CLICK TO ADD</div>
                            )}
                          </>
                        )}
                        {/* Available products */}
                        {(productSearch ? filteredProducts : availableProducts).map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 transition-colors border-b last:border-b-0 flex items-center justify-between group"
                            onClick={() => addProductToClaim(product.id)}
                          >
                            <div className="flex-1">
                              <span className="text-sm font-medium group-hover:text-emerald-800">{product.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">{getPriceLabel(product)}/{product.unit}</span>
                              {isMultiTier && product.wholesalePrice && product.lmtPrice && (
                                <span className="text-xs text-purple-500 ml-1">(Ws:{product.wholesalePrice} / LMT:{product.lmtPrice})</span>
                              )}
                            </div>
                            <Plus className="h-4 w-4 text-muted-foreground group-hover:text-emerald-600 shrink-0 ml-2" />
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Added Products List - Card Style */}
              {items.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                  <Package className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Search aur click karke products add karo</p>
                  <p className="text-xs text-muted-foreground mt-1">Ya &quot;+&quot; button se quantity badhao</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, index) => {
                    const product = products.find((p) => p.id === item.productId);
                    if (!product) return null;
                    const effectivePrice = getProductPrice(product);
                    return (
                      <div key={index} className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow">
                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {getPriceLabel(product)}/{product.unit}
                            {isMultiTier && <span className="text-purple-600 ml-1">({shopTypeLabel})</span>}
                            <span className="ml-1">= Rs.{Math.round(effectivePrice)}/unit</span>
                          </p>
                        </div>

                        {/* Quantity Control */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="h-8 w-8 rounded-md border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                            onClick={() => updateQuantity(index, item.quantity - 1)}
                          >
                            -
                          </button>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(index, Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-14 h-8 text-center text-sm p-0 border-gray-300"
                          />
                          <button
                            type="button"
                            className="h-8 w-8 rounded-md border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                            onClick={() => updateQuantity(index, item.quantity + 1)}
                          >
                            +
                          </button>
                        </div>

                        {/* Amount */}
                        <div className="text-right min-w-[80px]">
                          <p className="font-bold text-sm text-emerald-700">Rs.{item.amount.toLocaleString()}</p>
                          {item.quantity > 1 && (
                            <p className="text-xs text-muted-foreground">Rs.{Math.round(effectivePrice)} x {item.quantity}</p>
                          )}
                        </div>

                        {/* Delete */}
                        <button
                          type="button"
                          className="h-8 w-8 rounded-md flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Total */}
                  <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <span className="font-bold text-emerald-800">Total Claim Amount</span>
                    <span className="font-bold text-lg text-emerald-700">Rs.{totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Quick Shop Create Dialog */}
      <Dialog open={showQuickShop} onOpenChange={setShowQuickShop}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-emerald-800">Quick Create Shop</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Shop Name *</Label>
              <Input placeholder="Enter shop name" value={quickShopName} onChange={(e) => setQuickShopName(e.target.value)} autoFocus />
            </div>
            <div>
              <Label>Address</Label>
              <Input placeholder="Enter address (optional)" value={quickShopAddress} onChange={(e) => setQuickShopAddress(e.target.value)} />
            </div>
            <div>
              <Label>Shop Type *</Label>
              <p className="text-xs text-muted-foreground mb-2">Affects claim rate for multi-tier companies like Cadbury</p>
              <div className="grid grid-cols-3 gap-2">
                {['retail', 'wholesale', 'lmt'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      quickShopType === type
                        ? type === 'retail' ? 'bg-blue-600 text-white border-blue-600'
                          : type === 'wholesale' ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setQuickShopType(type)}
                  >
                    {type === 'retail' ? 'Retail' : type === 'wholesale' ? 'Wholesale' : 'LMT'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Order Booker {companyId ? `(for ${companies.find((c) => c.id === companyId)?.name})` : ''}</Label>
              <Select value={quickShopOB} onValueChange={setQuickShopOB}>
                <SelectTrigger><SelectValue placeholder="Select Order Booker" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {orderBookers.map((ob) => (<SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowQuickShop(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={creatingShop || !quickShopName.trim()}
              onClick={async () => {
                setCreatingShop(true);
                try {
                  const cobArray: Array<{ companyId: string; orderBookerId: string }> = [];
                  if (companyId && quickShopOB && quickShopOB !== 'none') {
                    cobArray.push({ companyId, orderBookerId: quickShopOB });
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
              {creatingShop ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>) : 'Create Shop'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Button - Sticky at bottom on mobile */}
      <div className="flex justify-end gap-3 pb-4">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={saving}>
          {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : claim ? 'Update Claim' : 'Create Claim'}
        </Button>
      </div>
    </div>
  );
}
