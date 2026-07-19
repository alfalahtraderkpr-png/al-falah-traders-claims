'use client';

import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import { Loader2, Plus, Edit2, Trash2, Search, Building2, Package, Users, Store, UserCheck, Upload, Download, FileSpreadsheet, Truck, History, DollarSign } from 'lucide-react';

// Types
interface Company { id: string; name: string; multiTierPricing?: boolean; claimDeductionPercent?: number; _count?: { products: number } }
interface Product { id: string; name: string; price: number; claimPrice: number; wholesalePrice: number | null; lmtPrice: number | null; unit: string; companyId: string; company: { name: string; multiTierPricing?: boolean } }
interface Supplier { id: string; name: string; companyId?: string | null; company?: { name: string } | null }
interface ShopCompanyOB { id: string; shopId: string; companyId: string; orderBookerId: string | null; shopType?: string; company: { id: string; name: string }; orderBooker?: { id: string; name: string } | null }
interface Shop { id: string; name: string; address: string; shopType?: string; companyOrderBookers: ShopCompanyOB[] }
interface OrderBooker { id: string; name: string; _count?: { shopCompanyOrderBookers: number } }

const masterDataTabs = [
  { value: 'companies', label: 'Companies', icon: Building2 },
  { value: 'products', label: 'Products', icon: Package },
  { value: 'suppliers', label: 'Suppliers', icon: Truck },
  { value: 'shops', label: 'Shops', icon: Store },
  { value: 'order-bookers', label: 'Order Bookers', icon: UserCheck },
];

export function MasterData({ initialTab = 'companies' }: { initialTab?: string }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="space-y-4">
      {/* iOS-style Sliding Tab Navigation */}
      <div className="animate-fade-in-up">
        <div className="relative flex items-center bg-gray-200/80 backdrop-blur-sm rounded-xl p-1.5 overflow-x-auto scrollbar-hide gap-1">
          {/* Tab buttons */}
          {masterDataTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`relative z-10 flex items-center justify-center gap-1.5 py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-200 whitespace-nowrap flex-shrink-0 ${isActive ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'companies' && <CompaniesTab />}
      {activeTab === 'products' && <ProductsTab />}
      {activeTab === 'suppliers' && <SuppliersTab />}
      {activeTab === 'shops' && <ShopsTab />}
      {activeTab === 'order-bookers' && <OrderBookersTab />}
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
  const [formMultiTier, setFormMultiTier] = useState(false);
  const [formDeductionPercent, setFormDeductionPercent] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/companies');
      if (res.ok) { const data = await res.json(); if (Array.isArray(data)) setItems(data); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!formName.trim()) { alert('Name is required'); return; }
    try {
      const body: Record<string, unknown> = { name: formName, multiTierPricing: formMultiTier, claimDeductionPercent: formDeductionPercent ? Number(formDeductionPercent) : 0 };
      const res = editItem
        ? await fetch(`/api/companies/${editItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        let msg = 'Failed to save company';
        try { const d = await res.json(); msg = d.error || msg; } catch {}
        alert(msg);
        return;
      }
      setDialogOpen(false);
      setEditItem(null);
      setFormName('');
      setFormMultiTier(false);
      setFormDeductionPercent('');
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
        <Button size="sm" className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md btn-enhanced btn-ripple rounded-lg px-4 py-2" onClick={() => { setEditItem(null); setFormName(''); setFormMultiTier(false); setFormDeductionPercent(''); setDialogOpen(true); }}>
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
          <div className="overflow-auto max-h-[calc(100vh-340px)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10"><tr className="border-b bg-gray-50">
                <th className="text-left py-2 px-4 font-medium">Name</th>
                <th className="text-center py-2 px-4 font-medium">Pricing</th>
                <th className="text-center py-2 px-4 font-medium">Deduction %</th>
                <th className="text-center py-2 px-4 font-medium">Products</th>
                <th className="text-center py-2 px-4 font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((item, index) => (
                  <tr key={item.id} className="border-b table-row-hover animate-fade-in-up" style={{ animationDelay: `${index * 30}ms` }}>
                    <td className="py-2 px-4 font-medium">{item.name}</td>
                    <td className="py-2 px-4 text-center">{item.multiTierPricing ? <Badge className="bg-purple-100 text-purple-700 border-purple-200">Multi-Tier</Badge> : <span className="text-xs text-muted-foreground">Standard</span>}</td>
                    <td className="py-2 px-4 text-center">{item.claimDeductionPercent && item.claimDeductionPercent > 0 ? <Badge className="bg-amber-100 text-amber-700 border-amber-200">{item.claimDeductionPercent}%</Badge> : <span className="text-xs text-muted-foreground">-</span>}</td>
                    <td className="py-2 px-4 text-center"><Badge variant="outline" className="transition-transform hover:scale-105">{item._count?.products || 0}</Badge></td>
                    <td className="py-2 px-4 text-center">
                      <Button variant="outline" size="icon" className="h-9 w-9 border-emerald-300 text-emerald-600 hover:bg-emerald-100 btn-enhanced btn-ripple rounded-lg" onClick={() => { setEditItem(item); setFormName(item.name); setFormMultiTier(item.multiTierPricing || false); setFormDeductionPercent(item.claimDeductionPercent ? String(item.claimDeductionPercent) : ''); setDialogOpen(true); }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-9 w-9 border-red-300 text-red-500 hover:bg-red-100 btn-enhanced btn-ripple rounded-lg" onClick={() => handleDelete(item.id)}>
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
            <div className="flex items-center gap-3">
              <input type="checkbox" id="multiTierCheck" checked={formMultiTier} onChange={(e) => setFormMultiTier(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
              <label htmlFor="multiTierCheck" className="text-sm font-medium">Multi-Tier Pricing (Wholesale/LMT)</label>
            </div>
            <div>
              <Label>Claim Deduction %</Label>
              <Input type="number" min="0" max="100" step="0.1" value={formDeductionPercent} onChange={(e) => setFormDeductionPercent(e.target.value)} placeholder="e.g., 22 for 22%" />
              <p className="text-xs text-muted-foreground mt-1">Company ke claims mein kitna % minus hoga (e.g., Shan Masala = 22%). 0 ya blank = no deduction.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 btn-enhanced shadow-md" onClick={handleSave}>Save</Button>
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
  const [form, setForm] = useState({ name: '', price: '', claimPrice: '', wholesalePrice: '', lmtPrice: '', unit: 'pcs', companyId: '' });

  // Bulk import state
  const [importOpen, setImportOpen] = useState(false);
  const [importCompany, setImportCompany] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; total: number; errors?: string[] } | null>(null);

  // Price history state
  const [priceHistoryOpen, setPriceHistoryOpen] = useState(false);
  const [priceHistoryProduct, setPriceHistoryProduct] = useState<Product | null>(null);
  const [priceHistoryData, setPriceHistoryData] = useState<Array<{ id: string; oldPrice: number; newPrice: number; oldClaimPrice: number; newClaimPrice: number; changedBy: string | null; changedAt: string }>>([]);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [prodRes, compRes] = await Promise.all([fetch('/api/products'), fetch('/api/companies')]);
      if (prodRes.ok) { const data = await prodRes.json(); if (Array.isArray(data)) setItems(data); }
      if (compRes.ok) { const data = await compRes.json(); if (Array.isArray(data)) setCompanies(data); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.price || !form.companyId) {
      alert('Name, price and company are required');
      return;
    }
    try {
      const selectedCompany = companies.find(c => c.id === form.companyId);
      const isMultiTier = selectedCompany?.multiTierPricing || false;
      const body = {
        name: form.name,
        price: Number(form.price),
        claimPrice: form.claimPrice ? Number(form.claimPrice) : Number(form.price),
        wholesalePrice: isMultiTier && form.wholesalePrice ? Number(form.wholesalePrice) : null,
        lmtPrice: isMultiTier && form.lmtPrice ? Number(form.lmtPrice) : null,
        unit: form.unit,
        companyId: form.companyId,
      };
      const res = editItem
        ? await fetch(`/api/products/${editItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        let msg = 'Failed to save product';
        try { const d = await res.json(); msg = d.error || msg; } catch {}
        alert(msg);
        return;
      }
      setDialogOpen(false);
      setEditItem(null);
      setForm({ name: '', price: '', claimPrice: '', wholesalePrice: '', lmtPrice: '', unit: 'pcs', companyId: '' });
      load();
    } catch (e) {
      console.error(e);
      alert('Unexpected error while saving product');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); alert(d.error); }
      load();
    } catch (e) { console.error(e); }
  };

  const handleBulkImport = async () => {
    if (!importFile || !importCompany) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('companyId', importCompany);

      const res = await fetch('/api/products/bulk-import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Import failed');
        return;
      }

      setImportResult({
        imported: data.imported,
        skipped: data.skipped,
        total: data.total,
        errors: data.errors,
      });
      load();
    } catch (e) {
      console.error(e);
      alert('Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    // Check if selected company is multi-tier
    const selectedComp = companies.find(c => c.id === importCompany);
    const isMultiTier = selectedComp?.multiTierPricing || false;

    // Create template based on company type
    let templateData;
    let colWidths;

    if (isMultiTier) {
      // Multi-tier template with Wholesale & LMT price columns
      templateData = [
        { Name: 'Dairy Milk', Price: 150, ClaimPrice: 140, WholesalePrice: 120, LMTPrice: 130, Unit: 'pcs' },
        { Name: '5 Star', Price: 50, ClaimPrice: 45, WholesalePrice: 40, LMTPrice: 42, Unit: 'pcs' },
        { Name: 'Perk', Price: 20, ClaimPrice: 18, WholesalePrice: 15, LMTPrice: 16, Unit: 'pcs' },
      ];
      colWidths = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 10 }];
    } else {
      // Standard template
      templateData = [
        { Name: 'Zeera', Price: 10, Unit: 'pcs' },
        { Name: 'Coconut', Price: 50, Unit: 'pcs' },
        { Name: 'NanKhatai', Price: 320, Unit: 'Box' },
      ];
      colWidths = [{ wch: 25 }, { wch: 12 }, { wch: 10 }];
    }
    const ws = XLSX.utils.json_to_sheet(templateData);
    // Set column widths
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    const filename = isMultiTier ? 'product-import-template-multitier.xlsx' : 'product-import-template.xlsx';
    XLSX.writeFile(wb, filename);
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
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 btn-enhanced btn-ripple rounded-lg px-4 py-2" onClick={() => { setImportCompany(''); setImportFile(null); setImportResult(null); setImportOpen(true); }}>
            <Upload className="h-4 w-4 mr-1" /> Bulk Import
          </Button>
          <Button size="sm" className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md btn-enhanced btn-ripple rounded-lg px-4 py-2" onClick={() => { setEditItem(null); setForm({ name: '', price: '', claimPrice: '', unit: 'pcs', companyId: '' }); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
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
          <div className="overflow-auto max-h-[calc(100vh-340px)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-10"><tr className="border-b bg-gray-50">
                <th className="text-left py-2 px-4 font-medium">Name</th>
                <th className="text-right py-2 px-4 font-medium">Price</th>
                <th className="text-right py-2 px-4 font-medium">Claim Rate</th>
                <th className="text-right py-2 px-4 font-medium">Wholesale</th>
                <th className="text-right py-2 px-4 font-medium">LMT</th>
                <th className="text-center py-2 px-4 font-medium">Unit</th>
                <th className="text-left py-2 px-4 font-medium">Company</th>
                <th className="text-center py-2 px-4 font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((item, index) => (
                  <tr key={item.id} className="border-b table-row-hover animate-fade-in-up" style={{ animationDelay: `${index * 20}ms` }}>
                    <td className="py-2 px-4 font-medium">{item.name}</td>
                    <td className="py-2 px-4 text-right">Rs.{item.price}</td>
                    <td className="py-2 px-4 text-right font-medium text-emerald-700">Rs.{item.claimPrice || item.price}</td>
                    <td className="py-2 px-4 text-right">{item.wholesalePrice ? `Rs.${item.wholesalePrice}` : <span className="text-xs text-muted-foreground">-</span>}</td>
                    <td className="py-2 px-4 text-right">{item.lmtPrice ? `Rs.${item.lmtPrice}` : <span className="text-xs text-muted-foreground">-</span>}</td>
                    <td className="py-2 px-4 text-center">{item.unit}</td>
                    <td className="py-2 px-4">{item.company?.name}</td>
                    <td className="py-2 px-4 text-center">
                      <Button variant="outline" size="icon" className="h-9 w-9 border-emerald-300 text-emerald-600 hover:bg-emerald-100 btn-enhanced btn-ripple rounded-lg" onClick={() => { setEditItem(item); setForm({ name: item.name, price: String(item.price), claimPrice: String(item.claimPrice || item.price), wholesalePrice: item.wholesalePrice ? String(item.wholesalePrice) : '', lmtPrice: item.lmtPrice ? String(item.lmtPrice) : '', unit: item.unit, companyId: item.companyId }); setDialogOpen(true); }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-9 w-9 border-red-300 text-red-500 hover:bg-red-100 btn-enhanced btn-ripple rounded-lg" onClick={() => handleDelete(item.id)}>
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? 'Edit' : 'Add'} Product</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Price (Rs.)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" /></div>
              <div><Label>Claim Rate (Rs.)</Label><div className="flex gap-2"><Input type="number" value={form.claimPrice} onChange={(e) => setForm({ ...form, claimPrice: e.target.value })} placeholder="Same as price" className="flex-1" />{editItem && <Button type="button" variant="outline" size="icon" className="shrink-0 h-9 w-9" title="Price History" onClick={async () => { setPriceHistoryProduct(editItem); setPriceHistoryOpen(true); setPriceHistoryLoading(true); try { const res = await fetch(`/api/products/price-history?productId=${editItem.id}`); if (res.ok) { setPriceHistoryData(await res.json()); } } catch { setPriceHistoryData([]); } finally { setPriceHistoryLoading(false); } }}><History className="h-4 w-4" /></Button>}</div><p className="text-xs text-muted-foreground mt-1">Claim mein jo rate lagega (default = Price)</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs" /></div>
              <div><Label>Company</Label>
                <Select value={form.companyId} onValueChange={(v) => setForm({ ...form, companyId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                  <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.multiTierPricing ? ' (Multi-Tier)' : ''}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {/* Multi-tier pricing fields - shown when selected company has multiTierPricing */}
            {form.companyId && companies.find(c => c.id === form.companyId)?.multiTierPricing && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200">Multi-Tier Pricing</Badge>
                  <span className="text-xs text-purple-600">Enter wholesale and LMT prices for this product</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-purple-800">Wholesale Price (Rs.)</Label><Input type="number" value={form.wholesalePrice} onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })} placeholder="0" className="border-purple-300 focus:border-purple-500" /><p className="text-xs text-muted-foreground mt-1">For wholesale shops</p></div>
                  <div><Label className="text-purple-800">LMT Price (Rs.)</Label><Input type="number" value={form.lmtPrice} onChange={(e) => setForm({ ...form, lmtPrice: e.target.value })} placeholder="0" className="border-purple-300 focus:border-purple-500" /><p className="text-xs text-muted-foreground mt-1">For LMT shops</p></div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 btn-enhanced shadow-md" onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price History Dialog */}
      <Dialog open={priceHistoryOpen} onOpenChange={setPriceHistoryOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-emerald-600" />
              Price History: {priceHistoryProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {priceHistoryLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
            ) : priceHistoryData.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No price changes recorded yet</p>
              </div>
            ) : (
              <div className="overflow-auto max-h-80">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white"><tr className="border-b bg-gray-50">
                    <th className="text-left py-2 px-3 font-medium">Date</th>
                    <th className="text-left py-2 px-3 font-medium">Changed By</th>
                    <th className="text-left py-2 px-3 font-medium">Price Change</th>
                    <th className="text-left py-2 px-3 font-medium">Claim Rate</th>
                  </tr></thead>
                  <tbody>
                    {priceHistoryData.map((h) => (
                      <tr key={h.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 text-xs">{new Date(h.changedAt).toLocaleDateString()}</td>
                        <td className="py-2 px-3 text-xs">{h.changedBy || '-'}</td>
                        <td className="py-2 px-3 text-xs">
                          <span className="text-red-500">Rs.{h.oldPrice}</span>
                          <span className="mx-1">→</span>
                          <span className="text-emerald-600 font-medium">Rs.{h.newPrice}</span>
                        </td>
                        <td className="py-2 px-3 text-xs">
                          {h.oldClaimPrice !== h.newClaimPrice ? (
                            <>
                              <span className="text-red-500">Rs.{h.oldClaimPrice}</span>
                              <span className="mx-1">→</span>
                              <span className="text-emerald-600 font-medium">Rs.{h.newClaimPrice}</span>
                            </>
                          ) : <span className="text-muted-foreground">Rs.{h.newClaimPrice}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceHistoryOpen(false)} className="btn-enhanced btn-ripple rounded-lg">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Bulk Import Products
            </DialogTitle>
          </DialogHeader>

          {!importResult ? (
            <div className="space-y-4 py-4">
              {/* Step 1: Select Company (PEHLE company select karo) */}
              <div>
                <Label className="text-sm font-medium">Step 1: Select Company *</Label>
                <p className="text-xs text-muted-foreground mb-2">All products will be added to this company</p>
                <Select value={importCompany} onValueChange={setImportCompany}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}{c.multiTierPricing ? ' (Multi-Tier)' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Step 2: Download Template (company ke hisaab se) */}
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <h4 className="font-medium text-emerald-800 mb-2">Step 2: Download Template</h4>
                <p className="text-sm text-emerald-700 mb-3">
                  {importCompany ? (
                    companies.find(c => c.id === importCompany)?.multiTierPricing
                      ? 'Multi-Tier company ke liye template mein WholesalePrice aur LMTPrice columns honge.'
                      : 'Download the Excel template, fill in your products, and upload it back.'
                  ) : 'Pehle company select karo, phir template download karo.'}
                </p>
                {importCompany && companies.find(c => c.id === importCompany)?.multiTierPricing && (
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200">Multi-Tier Company</Badge>
                    <span className="text-xs text-purple-600">Template mein WholesalePrice aur LMTPrice columns honge</span>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="border-emerald-600 text-emerald-600 hover:bg-emerald-100"
                  onClick={handleDownloadTemplate}
                  disabled={!importCompany}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template (.xlsx)
                </Button>
                {!importCompany && <p className="text-xs text-amber-600 mt-2">Company select karo template download karne ke liye</p>}
              </div>

              {/* Step 3: Upload File */}
              <div>
                <Label className="text-sm font-medium">Step 3: Upload Excel File *</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  {importCompany && companies.find(c => c.id === importCompany)?.multiTierPricing
                    ? <>File must have columns: <strong>Name, Price</strong> (WholesalePrice, LMTPrice for multi-tier, Unit optional)</>
                    : <>File must have columns: <strong>Name, Price, Unit</strong> (Unit is optional, default: pcs)</>}
                </p>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-emerald-400 transition-colors">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="bulk-import-file"
                  />
                  <label htmlFor="bulk-import-file" className="cursor-pointer">
                    {importFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                        <div className="text-left">
                          <p className="font-medium text-sm">{importFile.name}</p>
                          <p className="text-xs text-muted-foreground">{(importFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Click to select file</p>
                        <p className="text-xs text-muted-foreground">.xlsx, .xls, .csv</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Format Help */}
              <div className="bg-gray-50 rounded-lg p-3 text-xs">
                <p className="font-medium text-gray-700 mb-1">Expected Columns:</p>
                <table className="w-full">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="text-left py-1">Column</th>
                      <th className="text-left py-1">Required</th>
                      <th className="text-left py-1">Example</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600">
                    <tr><td className="py-1">Name</td><td className="py-1">Yes</td><td className="py-1">Zeera</td></tr>
                    <tr><td className="py-1">Price</td><td className="py-1">Yes</td><td className="py-1">10</td></tr>
                    <tr><td className="py-1">ClaimPrice</td><td className="py-1">No</td><td className="py-1">9</td></tr>
                    {importCompany && companies.find(c => c.id === importCompany)?.multiTierPricing && (
                      <>
                        <tr className="text-purple-700 font-medium"><td className="py-1">WholesalePrice</td><td className="py-1">Multi-Tier</td><td className="py-1">8</td></tr>
                        <tr className="text-purple-700 font-medium"><td className="py-1">LMTPrice</td><td className="py-1">Multi-Tier</td><td className="py-1">8.5</td></tr>
                      </>
                    )}
                    <tr><td className="py-1">Unit</td><td className="py-1">No</td><td className="py-1">pcs / Box / Ctn</td></tr>
                  </tbody>
                </table>
                {importCompany && companies.find(c => c.id === importCompany)?.multiTierPricing && (
                  <p className="mt-2 text-purple-600 font-medium">Multi-Tier: WholesalePrice & LMTPrice columns fill karo for wholesale/LMT shops ke liye alag rates</p>
                )}
                <p className="mt-2 text-amber-600 font-medium">Note: Same product with different prices = separate rows (e.g., Zeera Rs.10, Zeera Rs.20)</p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
                <Button
                  className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md btn-enhanced"
                  onClick={handleBulkImport}
                  disabled={!importFile || !importCompany || importing}
                >
                  {importing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" /> Import Products</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            /* Import Result */
            <div className="space-y-4 py-4">
              <div className="text-center py-4">
                <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${importResult.imported > 0 ? 'bg-green-100' : 'bg-yellow-100'}`}>
                  <span className="text-2xl">{importResult.imported > 0 ? '✅' : '⚠️'}</span>
                </div>
                <h3 className="text-lg font-bold">Import Complete!</h3>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-800">{importResult.total}</p>
                  <p className="text-xs text-muted-foreground">Total Rows</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{importResult.imported}</p>
                  <p className="text-xs text-muted-foreground">Imported</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-700">{importResult.skipped}</p>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                </div>
              </div>

              {importResult.skipped > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-yellow-800 mb-1">
                    {importResult.skipped} product(s) were skipped
                  </p>
                  <p className="text-xs text-yellow-700">
                    This usually means those products already exist with the same name, price, and company (duplicates are automatically skipped).
                  </p>
                </div>
              )}

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <p className="text-sm font-medium text-red-800 mb-1">Errors:</p>
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-700">{err}</p>
                  ))}
                </div>
              )}

              <DialogFooter>
                <Button
                  className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md btn-enhanced w-full"
                  onClick={() => {
                    setImportOpen(false);
                    setImportResult(null);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
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
    try { const res = await fetch('/api/suppliers'); if (res.ok) { const data = await res.json(); if (Array.isArray(data)) setItems(data); } }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!formName.trim()) { alert('Name is required'); return; }
    try {
      const res = editItem
        ? await fetch(`/api/suppliers/${editItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: formName }) })
        : await fetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: formName }) });
      if (!res.ok) {
        let msg = 'Failed to save supplier';
        try { const d = await res.json(); msg = d.error || msg; } catch {}
        alert(msg);
        return;
      }
      setDialogOpen(false); setEditItem(null); setFormName(''); load();
    } catch (e) {
      console.error(e);
      alert('Unexpected error while saving supplier');
    }
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
        <Button size="sm" className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md btn-enhanced" onClick={() => { setEditItem(null); setFormName(''); setDialogOpen(true); }}>
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
          <div className="overflow-auto max-h-[calc(100vh-340px)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10"><tr className="border-b bg-gray-50">
                <th className="text-left py-2 px-4 font-medium">Name</th>
                <th className="text-center py-2 px-4 font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 font-medium">{item.name}</td>
                    <td className="py-2 px-4 text-center">
                      <Button variant="outline" size="icon" className="h-9 w-9 border-emerald-300 text-emerald-600 hover:bg-emerald-100 btn-enhanced btn-ripple rounded-lg" onClick={() => { setEditItem(item); setFormName(item.name); setDialogOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" className="h-9 w-9 border-red-300 text-red-500 hover:bg-red-100 btn-enhanced btn-ripple rounded-lg" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="btn-enhanced btn-ripple rounded-lg">Cancel</Button>
            <Button className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md btn-enhanced btn-ripple rounded-lg" onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ========= Shops Tab =========
function ShopsTab() {
  const [items, setItems] = useState<Shop[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [orderBookers, setOrderBookers] = useState<OrderBooker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Shop | null>(null);
  const [form, setForm] = useState({ name: '', address: '', shopType: 'retail' });
  // Company settings: { companyId: { orderBookerId: string, shopType: string, creditLimit: string } }
  const [companySettings, setCompanySettings] = useState<Record<string, { orderBookerId: string; shopType: string; creditLimit: string }>>({});

  const load = useCallback(async () => {
    try {
      const [shopRes, obRes, compRes] = await Promise.all([
        fetch('/api/shops'),
        fetch('/api/order-bookers'),
        fetch('/api/companies'),
      ]);
      if (shopRes.ok) { const data = await shopRes.json(); if (Array.isArray(data)) setItems(data); }
      if (obRes.ok) { const data = await obRes.json(); if (Array.isArray(data)) setOrderBookers(data); }
      if (compRes.ok) { const data = await compRes.json(); if (Array.isArray(data)) setCompanies(data); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAddDialog = () => {
    setEditItem(null);
    setForm({ name: '', address: '', shopType: 'retail' });
    // Initialize companySettings with default values for each company
    const initialSettings: Record<string, { orderBookerId: string; shopType: string; creditLimit: string }> = {};
    companies.forEach((c) => { initialSettings[c.id] = { orderBookerId: '', shopType: 'retail', creditLimit: '' }; });
    setCompanySettings(initialSettings);
    setDialogOpen(true);
  };

  const openEditDialog = async (shop: Shop) => {
    setEditItem(shop);
    setForm({ name: shop.name, address: shop.address, shopType: shop.shopType || 'retail' });
    // Populate companySettings from existing mappings
    const settings: Record<string, { orderBookerId: string; shopType: string; creditLimit: string }> = {};
    companies.forEach((c) => { settings[c.id] = { orderBookerId: '', shopType: 'retail', creditLimit: '' }; });
    shop.companyOrderBookers?.forEach((cob) => {
      settings[cob.companyId] = {
        orderBookerId: cob.orderBookerId || '',
        shopType: cob.shopType || 'retail',
        creditLimit: settings[cob.companyId]?.creditLimit || '',
      };
    });

    // Show dialog immediately with mapping data
    setCompanySettings({ ...settings });
    setDialogOpen(true);

    // Load credit limits from API — merge with current state to avoid overwriting user edits
    try {
      const limitsRes = await fetch('/api/credit-limits');
      if (limitsRes.ok) {
        const limits = await limitsRes.json();
        setCompanySettings((prev) => {
          const merged = { ...prev };
          limits.forEach((l: { shopId: string; companyId: string; creditLimit: number }) => {
            if (l.shopId === shop.id && merged[l.companyId]) {
              merged[l.companyId] = {
                ...merged[l.companyId],
                creditLimit: l.creditLimit ? String(l.creditLimit) : '',
              };
            }
          });
          return merged;
        });
      }
    } catch { /* ignore */ }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('Shop name is required');
      return;
    }
    try {
      // Build companyOrderBookers array — include all companies that have any non-default setting
      // (any assigned order booker, non-retail shop type, OR a credit limit)
      const cobArray = Object.entries(companySettings)
        .filter(([, setting]) =>
          setting.orderBookerId ||
          (setting.shopType && setting.shopType !== 'retail') ||
          (setting.creditLimit && Number(setting.creditLimit) > 0)
        )
        .map(([companyId, setting]) => ({
          companyId,
          orderBookerId: setting.orderBookerId || '',
          shopType: setting.shopType || 'retail',
        }));

      const body = {
        name: form.name,
        address: form.address,
        shopType: form.shopType,
        companyOrderBookers: cobArray,
      };

      let shopId = editItem?.id;
      let success = true;
      let errMsg = '';

      if (editItem) {
        const res = await fetch(`/api/shops/${editItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          success = false;
          try { const d = await res.json(); errMsg = d.error || 'Failed to update shop'; } catch { errMsg = 'Failed to update shop'; }
        }
      } else {
        const res = await fetch('/api/shops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          success = false;
          try { const d = await res.json(); errMsg = d.error || 'Failed to create shop'; } catch { errMsg = 'Failed to create shop'; }
        } else {
          const created = await res.json();
          shopId = created.id;
        }
      }

      // Save credit limits for each company (for BOTH new and edit)
      if (success && shopId) {
        for (const [compId, setting] of Object.entries(companySettings)) {
          const limitValue = setting.creditLimit ? Number(setting.creditLimit) : 0;
          const res = await fetch('/api/credit-limits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shopId, companyId: compId, creditLimit: limitValue }),
          });
          if (!res.ok) {
            // Don't abort whole save, but log
            console.error('Failed to save credit limit for company', compId);
          }
        }
      }

      if (success) {
        setDialogOpen(false);
        setEditItem(null);
        setForm({ name: '', address: '', shopType: 'retail' });
        setCompanySettings({});
        load();
      } else {
        alert(errMsg);
      }
    } catch (e) {
      console.error(e);
      alert('Unexpected error while saving shop');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this shop?')) return;
    try {
      const res = await fetch(`/api/shops/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); alert(d.error); }
      load();
    } catch (e) { console.error(e); }
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  // Get order booker display for a shop+company
  const getOBForCompany = (shop: Shop, companyId: string) => {
    const mapping = shop.companyOrderBookers?.find((cob) => cob.companyId === companyId);
    return mapping?.orderBooker?.name || '-';
  };

  // Get shop type for a shop+company
  const getTypeForCompany = (shop: Shop, companyId: string) => {
    const mapping = shop.companyOrderBookers?.find((cob) => cob.companyId === companyId);
    return mapping?.shopType || null;
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Shops ({filtered.length})</CardTitle>
        <Button size="sm" className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md btn-enhanced" onClick={openAddDialog}>
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
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div> : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Store className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Koi shop nahi mili</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3 max-h-[calc(100vh-340px)] overflow-y-auto pb-4">
              {filtered.map((item) => {
                const assignedCompanies = (item.companyOrderBookers || []).filter(cob => cob.orderBookerId);
                const unassignedCompanies = companies.filter(c => !(item.companyOrderBookers || []).some(cob => cob.companyId === c.id && cob.orderBookerId));
                return (
                  <Card key={item.id} className="shadow-sm border-emerald-100">
                    <CardContent className="p-3">
                      {/* Header: Name + Actions */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{item.name}</p>
                          {item.address && <p className="text-xs text-muted-foreground truncate">{item.address}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="outline" size="icon" className="h-8 w-8 border-emerald-300 text-emerald-600 hover:bg-emerald-100 rounded-lg" onClick={() => openEditDialog(item)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8 border-red-300 text-red-500 hover:bg-red-100 rounded-lg" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {/* Type badge */}
                      <div className="mb-2">
                        {item.shopType && item.shopType !== 'retail' ? (
                          <Badge className={item.shopType === 'wholesale' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-purple-100 text-purple-700 border-purple-200'}>
                            {item.shopType === 'wholesale' ? 'Wholesale' : 'LMT'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Retail</span>
                        )}
                      </div>
                      {/* Company assignments */}
                      {assignedCompanies.length === 0 ? (
                        <p className="text-xs text-amber-600 italic">Koi order booker assign nahi</p>
                      ) : (
                        <div className="space-y-1.5">
                          {assignedCompanies.map((cob) => (
                            <div key={cob.id} className="flex items-center justify-between gap-2 p-2 bg-emerald-50/50 rounded-md border border-emerald-100">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-emerald-800 truncate">{cob.company.name}</p>
                                {cob.shopType && cob.shopType !== 'retail' && (
                                  <Badge className={`text-[9px] px-1 py-0 mt-0.5 ${cob.shopType === 'wholesale' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                                    {cob.shopType === 'wholesale' ? 'Wholesale' : 'LMT'}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs font-semibold text-emerald-700 truncate text-right">{cob.orderBooker?.name || '-'}</p>
                            </div>
                          ))}
                          {unassignedCompanies.length > 0 && (
                            <p className="text-[10px] text-muted-foreground pt-1">
                              + {unassignedCompanies.length} aur company/unassigned
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-auto max-h-[calc(100vh-340px)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10"><tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-4 font-medium">Name</th>
                  <th className="text-left py-2 px-4 font-medium">Address</th>
                  <th className="text-center py-2 px-4 font-medium">Type</th>
                  {companies.map((c) => (
                    <th key={c.id} className="text-left py-2 px-4 font-medium whitespace-nowrap">{c.name}</th>
                  ))}
                  <th className="text-center py-2 px-4 font-medium">Actions</th>
                </tr></thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-4 font-medium">{item.name}</td>
                      <td className="py-2 px-4">{item.address || '-'}</td>
                      <td className="py-2 px-4 text-center">{item.shopType && item.shopType !== 'retail' ? <Badge className={item.shopType === 'wholesale' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-purple-100 text-purple-700 border-purple-200'}>{item.shopType === 'wholesale' ? 'Wholesale' : 'LMT'}</Badge> : <span className="text-xs text-muted-foreground">Retail</span>}</td>
                      {companies.map((c) => {
                        const compType = getTypeForCompany(item, c.id);
                        const compOB = getOBForCompany(item, c.id);
                        return (
                          <td key={c.id} className="py-2 px-4">
                            <div className="flex flex-col gap-0.5">
                              {compType && compType !== 'retail' ? (
                                <Badge className={`text-[10px] px-1.5 py-0 w-fit ${compType === 'wholesale' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                                  {compType === 'wholesale' ? 'Ws' : 'LMT'}
                                </Badge>
                              ) : null}
                              <span className={`text-xs ${compOB !== '-' ? 'text-emerald-700 font-medium' : 'text-muted-foreground'}`}>
                                {compOB}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-2 px-4 text-center whitespace-nowrap">
                        <Button variant="outline" size="icon" className="h-9 w-9 border-emerald-300 text-emerald-600 hover:bg-emerald-100 btn-enhanced btn-ripple rounded-lg" onClick={() => openEditDialog(item)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-9 w-9 border-red-300 text-red-500 hover:bg-red-100 btn-enhanced btn-ripple rounded-lg" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem ? 'Edit' : 'Add'} Shop</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Shop Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Shop name" /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" /></div>
            <div>
              <Label>Shop Type *</Label>
              <p className="text-xs text-muted-foreground mb-2">Affects claim rate for multi-tier companies like Cadbury</p>
              <div className="grid grid-cols-3 gap-2">
                {['retail', 'wholesale', 'lmt'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-all duration-200 ${
                      form.shopType === type
                        ? type === 'retail' ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                          : type === 'wholesale' ? 'bg-orange-600 text-white border-orange-600 shadow-md'
                          : 'bg-purple-600 text-white border-purple-600 shadow-md'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setForm({ ...form, shopType: type })}
                  >
                    {type === 'retail' ? 'Retail' : type === 'wholesale' ? 'Wholesale' : 'LMT'}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="text-base font-semibold text-emerald-800">Company Settings</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-3">Per company: Shop Type (affects pricing for multi-tier companies) aur Order Booker assign karo.</p>
              <div className="space-y-4">
                {companies.map((c) => (
                  <div key={c.id} className="border rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs font-medium">{c.name}</Badge>
                      {c.multiTierPricing && <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">Multi-Tier</Badge>}
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Shop Type per company */}
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-1">Shop Type</p>
                        <div className="flex gap-1">
                          {['retail', 'wholesale', 'lmt'].map((type) => (
                            <button
                              key={type}
                              type="button"
                              className={`py-1.5 px-2 rounded text-[11px] font-medium transition-all ${
                                (companySettings[c.id]?.shopType || 'retail') === type
                                  ? type === 'retail' ? 'bg-blue-600 text-white'
                                    : type === 'wholesale' ? 'bg-orange-600 text-white'
                                    : 'bg-purple-600 text-white'
                                  : 'bg-white text-gray-500 border border-gray-300 hover:bg-gray-100'
                              }`}
                              onClick={() => setCompanySettings({
                                ...companySettings,
                                [c.id]: { ...companySettings[c.id], shopType: type }
                              })}
                            >
                              {type === 'retail' ? 'Retail' : type === 'wholesale' ? 'Ws' : 'LMT'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Order Booker per company */}
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-1">Order Booker</p>
                        <Select
                          value={companySettings[c.id]?.orderBookerId || 'none'}
                          onValueChange={(v) => setCompanySettings({
                            ...companySettings,
                            [c.id]: { ...companySettings[c.id], orderBookerId: v === 'none' ? '' : v }
                          })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select OB" />
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
                    {/* Credit Limit per company */}
                    <div className="mt-2">
                      <p className="text-[10px] text-muted-foreground mb-1">Credit Limit (Rs.)</p>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                          type="number"
                          min="0"
                          placeholder="No limit"
                          value={companySettings[c.id]?.creditLimit || ''}
                          onChange={(e) => setCompanySettings({
                            ...companySettings,
                            [c.id]: { ...companySettings[c.id], creditLimit: e.target.value }
                          })}
                          className="h-7 text-xs pl-6"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="btn-enhanced btn-ripple rounded-lg">Cancel</Button>
            <Button className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md btn-enhanced btn-ripple rounded-lg" onClick={handleSave}>Save</Button>
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
    try { const res = await fetch('/api/order-bookers'); if (res.ok) { const data = await res.json(); if (Array.isArray(data)) setItems(data); } }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!formName.trim()) { alert('Name is required'); return; }
    try {
      const res = editItem
        ? await fetch(`/api/order-bookers/${editItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: formName }) })
        : await fetch('/api/order-bookers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: formName }) });
      if (!res.ok) {
        let msg = 'Failed to save order booker';
        try { const d = await res.json(); msg = d.error || msg; } catch {}
        alert(msg);
        return;
      }
      setDialogOpen(false); setEditItem(null); setFormName(''); load();
    } catch (e) {
      console.error(e);
      alert('Unexpected error while saving order booker');
    }
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
        <Button size="sm" className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md btn-enhanced btn-ripple rounded-lg px-4 py-2" onClick={() => { setEditItem(null); setFormName(''); setDialogOpen(true); }}>
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
          <div className="overflow-auto max-h-[calc(100vh-340px)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10"><tr className="border-b bg-gray-50">
                <th className="text-left py-2 px-4 font-medium">Name</th>
                <th className="text-center py-2 px-4 font-medium">Assignments</th>
                <th className="text-center py-2 px-4 font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 font-medium">{item.name}</td>
                    <td className="py-2 px-4 text-center"><Badge variant="outline">{item._count?.shopCompanyOrderBookers || 0}</Badge></td>
                    <td className="py-2 px-4 text-center">
                      <Button variant="outline" size="icon" className="h-9 w-9 border-emerald-300 text-emerald-600 hover:bg-emerald-100 btn-enhanced btn-ripple rounded-lg" onClick={() => { setEditItem(item); setFormName(item.name); setDialogOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" className="h-9 w-9 border-red-300 text-red-500 hover:bg-red-100 btn-enhanced btn-ripple rounded-lg" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="btn-enhanced btn-ripple rounded-lg">Cancel</Button>
            <Button className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md btn-enhanced btn-ripple rounded-lg" onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
