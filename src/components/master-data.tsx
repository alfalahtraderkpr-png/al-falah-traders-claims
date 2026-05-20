'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Edit2, Trash2, Search, Building2, Package, Users, Store, UserCheck } from 'lucide-react';

// Types
interface Company { id: string; name: string; _count?: { products: number } }
interface Product { id: string; name: string; price: number; unit: string; companyId: string; company: { name: string } }
interface Supplier { id: string; name: string; companyId?: string | null; company?: { name: string } | null }
interface Shop { id: string; name: string; address: string; orderBookerId?: string | null; orderBooker?: { name: string } | null }
interface OrderBooker { id: string; name: string; _count?: { shops: number } }

export function MasterData({ initialTab = 'companies' }: { initialTab?: string }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-emerald-800">Master Data</h2>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-gray-100 p-1 rounded-lg">
          <TabsTrigger value="companies" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Building2 className="h-4 w-4 mr-1" /> Companies
          </TabsTrigger>
          <TabsTrigger value="products" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Package className="h-4 w-4 mr-1" /> Products
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Users className="h-4 w-4 mr-1" /> Suppliers
          </TabsTrigger>
          <TabsTrigger value="shops" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Store className="h-4 w-4 mr-1" /> Shops
          </TabsTrigger>
          <TabsTrigger value="order-bookers" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <UserCheck className="h-4 w-4 mr-1" /> Order Bookers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies"><CompaniesTab /></TabsContent>
        <TabsContent value="products"><ProductsTab /></TabsContent>
        <TabsContent value="suppliers"><SuppliersTab /></TabsContent>
        <TabsContent value="shops"><ShopsTab /></TabsContent>
        <TabsContent value="order-bookers"><OrderBookersTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ========= Companies Tab =========
function CompaniesTab() {
  const [items, setItems] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Company | null>(null);
  const [formName, setFormName] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/companies');
      setItems(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!formName.trim()) return;
    try {
      if (editItem) {
        await fetch(`/api/companies/${editItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName }),
        });
      } else {
        await fetch('/api/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName }),
        });
      }
      setDialogOpen(false);
      setEditItem(null);
      setFormName('');
      load();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this company?')) return;
    try {
      const res = await fetch(`/api/companies/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); alert(d.error); }
      load();
    } catch (e) { console.error(e); }
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Companies ({filtered.length})</CardTitle>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditItem(null); setFormName(''); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        </div>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50">
                <th className="text-left py-2 px-4 font-medium">Name</th>
                <th className="text-center py-2 px-4 font-medium">Products</th>
                <th className="text-center py-2 px-4 font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 font-medium">{item.name}</td>
                    <td className="py-2 px-4 text-center"><Badge variant="outline">{item._count?.products || 0}</Badge></td>
                    <td className="py-2 px-4 text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditItem(item); setFormName(item.name); setDialogOpen(true); }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? 'Edit' : 'Add'} Company</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Name</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Company name" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ========= Products Tab =========
function ProductsTab() {
  const [items, setItems] = useState<Product[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCompany, setFilterCompany] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', price: '', unit: 'pcs', companyId: '' });

  const load = useCallback(async () => {
    try {
      const [prodRes, compRes] = await Promise.all([fetch('/api/products'), fetch('/api/companies')]);
      setItems(await prodRes.json());
      setCompanies(await compRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.price || !form.companyId) return;
    try {
      const body = { name: form.name, price: Number(form.price), unit: form.unit, companyId: form.companyId };
      if (editItem) {
        await fetch(`/api/products/${editItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      setDialogOpen(false);
      setEditItem(null);
      setForm({ name: '', price: '', unit: 'pcs', companyId: '' });
      load();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); alert(d.error); }
      load();
    } catch (e) { console.error(e); }
  };

  const filtered = items.filter((i) => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchCompany = filterCompany === 'all' || i.companyId === filterCompany;
    return matchSearch && matchCompany;
  });

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Products ({filtered.length})</CardTitle>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditItem(null); setForm({ name: '', price: '', unit: 'pcs', companyId: '' }); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterCompany} onValueChange={setFilterCompany}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Filter by company" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div> : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b bg-gray-50">
                <th className="text-left py-2 px-4 font-medium">Name</th>
                <th className="text-right py-2 px-4 font-medium">Price</th>
                <th className="text-center py-2 px-4 font-medium">Unit</th>
                <th className="text-left py-2 px-4 font-medium">Company</th>
                <th className="text-center py-2 px-4 font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 font-medium">{item.name}</td>
                    <td className="py-2 px-4 text-right">Rs.{item.price}</td>
                    <td className="py-2 px-4 text-center">{item.unit}</td>
                    <td className="py-2 px-4">{item.company?.name}</td>
                    <td className="py-2 px-4 text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditItem(item); setForm({ name: item.name, price: String(item.price), unit: item.unit, companyId: item.companyId }); setDialogOpen(true); }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? 'Edit' : 'Add'} Product</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Price (Rs.)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" /></div>
              <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs" /></div>
            </div>
            <div><Label>Company</Label>
              <Select value={form.companyId} onValueChange={(v) => setForm({ ...form, companyId: v })}>
                <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ========= Suppliers Tab =========
function SuppliersTab() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Supplier | null>(null);
  const [formName, setFormName] = useState('');

  const load = useCallback(async () => {
    try { const res = await fetch('/api/suppliers'); setItems(await res.json()); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!formName.trim()) return;
    try {
      if (editItem) {
        await fetch(`/api/suppliers/${editItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: formName }) });
      } else {
        await fetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: formName }) });
      }
      setDialogOpen(false); setEditItem(null); setFormName(''); load();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this supplier?')) return;
    try { const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' }); if (!res.ok) { const d = await res.json(); alert(d.error); } load(); }
    catch (e) { console.error(e); }
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Suppliers ({filtered.length})</CardTitle>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditItem(null); setFormName(''); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        </div>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50">
                <th className="text-left py-2 px-4 font-medium">Name</th>
                <th className="text-center py-2 px-4 font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 font-medium">{item.name}</td>
                    <td className="py-2 px-4 text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditItem(item); setFormName(item.name); setDialogOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? 'Edit' : 'Add'} Supplier</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Name</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Supplier name" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ========= Shops Tab =========
function ShopsTab() {
  const [items, setItems] = useState<Shop[]>([]);
  const [orderBookers, setOrderBookers] = useState<OrderBooker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Shop | null>(null);
  const [form, setForm] = useState({ name: '', address: '', orderBookerId: '' });

  const load = useCallback(async () => {
    try {
      const [shopRes, obRes] = await Promise.all([fetch('/api/shops'), fetch('/api/order-bookers')]);
      setItems(await shopRes.json());
      setOrderBookers(await obRes.json());
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      const body = { name: form.name, address: form.address, orderBookerId: form.orderBookerId || null };
      if (editItem) {
        await fetch(`/api/shops/${editItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      } else {
        await fetch('/api/shops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      }
      setDialogOpen(false); setEditItem(null); setForm({ name: '', address: '', orderBookerId: '' }); load();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this shop?')) return;
    try { const res = await fetch(`/api/shops/${id}`, { method: 'DELETE' }); if (!res.ok) { const d = await res.json(); alert(d.error); } load(); }
    catch (e) { console.error(e); }
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Shops ({filtered.length})</CardTitle>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditItem(null); setForm({ name: '', address: '', orderBookerId: '' }); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        </div>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50">
                <th className="text-left py-2 px-4 font-medium">Name</th>
                <th className="text-left py-2 px-4 font-medium">Address</th>
                <th className="text-left py-2 px-4 font-medium">Order Booker</th>
                <th className="text-center py-2 px-4 font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 font-medium">{item.name}</td>
                    <td className="py-2 px-4">{item.address || '-'}</td>
                    <td className="py-2 px-4">{item.orderBooker?.name || '-'}</td>
                    <td className="py-2 px-4 text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditItem(item); setForm({ name: item.name, address: item.address, orderBookerId: item.orderBookerId || '' }); setDialogOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? 'Edit' : 'Add'} Shop</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Shop name" /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" /></div>
            <div><Label>Order Booker</Label>
              <Select value={form.orderBookerId} onValueChange={(v) => setForm({ ...form, orderBookerId: v })}>
                <SelectTrigger><SelectValue placeholder="Select order booker" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {orderBookers.map((ob) => <SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ========= Order Bookers Tab =========
function OrderBookersTab() {
  const [items, setItems] = useState<OrderBooker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<OrderBooker | null>(null);
  const [formName, setFormName] = useState('');

  const load = useCallback(async () => {
    try { const res = await fetch('/api/order-bookers'); setItems(await res.json()); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!formName.trim()) return;
    try {
      if (editItem) {
        await fetch(`/api/order-bookers/${editItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: formName }) });
      } else {
        await fetch('/api/order-bookers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: formName }) });
      }
      setDialogOpen(false); setEditItem(null); setFormName(''); load();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this order booker?')) return;
    try { const res = await fetch(`/api/order-bookers/${id}`, { method: 'DELETE' }); if (!res.ok) { const d = await res.json(); alert(d.error); } load(); }
    catch (e) { console.error(e); }
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Order Bookers ({filtered.length})</CardTitle>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditItem(null); setFormName(''); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        </div>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50">
                <th className="text-left py-2 px-4 font-medium">Name</th>
                <th className="text-center py-2 px-4 font-medium">Shops</th>
                <th className="text-center py-2 px-4 font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 font-medium">{item.name}</td>
                    <td className="py-2 px-4 text-center"><Badge variant="outline">{item._count?.shops || 0}</Badge></td>
                    <td className="py-2 px-4 text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditItem(item); setFormName(item.name); setDialogOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? 'Edit' : 'Add'} Order Booker</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Name</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Order Booker name" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
