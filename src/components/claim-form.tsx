'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, ArrowLeft, Store } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface ClaimFormProps {
  claim: ClaimData | null;
  companies: Array<{ id: string; name: string }>;
  user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
  onSave: () => void;
  onCancel: () => void;
}

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  companyId: string;
  company: { name: string };
}

interface Shop {
  id: string;
  name: string;
  address: string;
  orderBookerId: string | null;
  orderBooker: { name: string; id: string } | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface OrderBooker {
  id: string;
  name: string;
}

interface ClaimItemData {
  productId: string;
  quantity: number;
  amount: number;
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
    product: { name: string; price: number; unit: string };
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
  const [creatingShop, setCreatingShop] = useState(false);

  useEffect(() => {
    loadDropdowns();
  }, []);

  useEffect(() => {
    if (companyId) {
      loadProducts(companyId);
    }
  }, [companyId]);

  useEffect(() => {
    if (shopId) {
      const shop = shops.find((s) => s.id === shopId);
      if (shop?.orderBookerId) {
        setOrderBookerId(shop.orderBookerId);
      }
    }
  }, [shopId, shops]);

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

  const addItem = () => {
    setItems([...items, { productId: '', quantity: 1, amount: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    if (field === 'productId') {
      newItems[index].productId = value as string;
      // Auto-calculate amount
      const product = products.find((p) => p.id === value);
      if (product) {
        newItems[index].amount = product.price * newItems[index].quantity;
      }
    } else if (field === 'quantity') {
      newItems[index].quantity = Number(value) || 0;
      const product = products.find((p) => p.id === newItems[index].productId);
      if (product) {
        newItems[index].amount = product.price * Number(value);
      }
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
        // Update
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
        // Create
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

  const getProductDisplay = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product ? `${product.name} - Rs.${product.price}` : '';
  };

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

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Claim Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Company *</Label>
              <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setItems([]); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Shop *</Label>
              <div className="flex gap-1">
                <Select value={shopId} onValueChange={setShopId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select Shop" />
                  </SelectTrigger>
                  <SelectContent>
                    {shops.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} {s.address ? `(${s.address})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                  title="Quick Create Shop"
                  onClick={() => {
                    setQuickShopName('');
                    setQuickShopAddress('');
                    setQuickShopOB('');
                    setShowQuickShop(true);
                  }}
                >
                  <Store className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Order Booker</Label>
              <Select value={orderBookerId} onValueChange={setOrderBookerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Order Booker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {orderBookers.map((ob) => (
                    <SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Section */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Products</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={addItem}
            disabled={!companyId}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Product
          </Button>
        </CardHeader>
        <CardContent>
          {!companyId ? (
            <p className="text-center text-muted-foreground py-8">Select a company first to add products</p>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No products added yet. Click &quot;Add Product&quot; to start.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2 px-3 font-medium">#</th>
                    <th className="text-left py-2 px-3 font-medium">Product</th>
                    <th className="text-right py-2 px-3 font-medium">Price</th>
                    <th className="text-center py-2 px-3 font-medium">Qty</th>
                    <th className="text-right py-2 px-3 font-medium">Amount</th>
                    <th className="text-center py-2 px-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const product = products.find((p) => p.id === item.productId);
                    return (
                      <tr key={index} className="border-b">
                        <td className="py-2 px-3">{index + 1}</td>
                        <td className="py-2 px-3">
                          <Select
                            value={item.productId}
                            onValueChange={(v) => updateItem(index, 'productId', v)}
                          >
                            <SelectTrigger className="w-full min-w-[200px]">
                              <SelectValue placeholder="Select Product" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} - Rs.{p.price}/{p.unit}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 px-3 text-right">
                          {product ? `Rs.${product.price}` : '-'}
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                            className="w-20 text-center"
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          Rs.{item.amount.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2">
                    <td colSpan={4} className="py-3 px-3 text-right font-bold text-lg">
                      Total:
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-lg text-emerald-700">
                      Rs.{totalAmount.toLocaleString()}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Shop Create Dialog */}
      <Dialog open={showQuickShop} onOpenChange={setShowQuickShop}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-800">Quick Create Shop</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Shop Name *</Label>
              <Input
                placeholder="Enter shop name"
                value={quickShopName}
                onChange={(e) => setQuickShopName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                placeholder="Enter address (optional)"
                value={quickShopAddress}
                onChange={(e) => setQuickShopAddress(e.target.value)}
              />
            </div>
            <div>
              <Label>Order Booker</Label>
              <Select value={quickShopOB} onValueChange={setQuickShopOB}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Order Booker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {orderBookers.map((ob) => (
                    <SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowQuickShop(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={creatingShop || !quickShopName.trim()}
              onClick={async () => {
                setCreatingShop(true);
                try {
                  const res = await fetch('/api/shops', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: quickShopName.trim(),
                      address: quickShopAddress.trim(),
                      orderBookerId: quickShopOB === 'none' ? null : quickShopOB || null,
                    }),
                  });
                  if (!res.ok) {
                    const data = await res.json();
                    alert(data.error || 'Failed to create shop');
                    return;
                  }
                  const newShop = await res.json();
                  // Add to shops list, auto-select, and auto-assign order booker
                  setShops((prev) => [...prev, newShop].sort((a, b) => a.name.localeCompare(b.name)));
                  setShopId(newShop.id);
                  if (newShop.orderBookerId) {
                    setOrderBookerId(newShop.orderBookerId);
                  }
                  setShowQuickShop(false);
                } catch (error) {
                  console.error('Quick shop create error:', error);
                  alert('Failed to create shop');
                } finally {
                  setCreatingShop(false);
                }
              }}
            >
              {creatingShop ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Shop'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            claim ? 'Update Claim' : 'Create Claim'
          )}
        </Button>
      </div>
    </div>
  );
}
