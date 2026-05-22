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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Edit2, Trash2, Search, Building2, Package, Users, Store, UserCheck, Upload, Download, FileSpreadsheet } from 'lucide-react';

// Types
interface Company { id: string; name: string; _count?: { products: number } }
interface Product { id: string; name: string; price: number; unit: string; companyId: string; company: { name: string } }
interface Supplier { id: string; name: string; companyId?: string | null; company?: { name: string } | null }
interface ShopCompanyOB { id: string; shopId: string; companyId: string; orderBookerId: string | null; company: { id: string; name: string }; orderBooker?: { id: string; name: string } | null }
interface Shop { id: string; name: string; address: string; companyOrderBookers: ShopCompanyOB[] }
interface OrderBooker { id: string; name: string; _count?: { shopCompanyOrderBookers: number } }

export function MasterData({ initialTab = 'companies' }: { initialTab?: string }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-emerald-800 animate-fade-in-up flex items-center gap-2">
        <Building2 className="h-6 w-6" />
        Master Data
      </h2>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-gray-100 p-1.5 rounded-xl shadow-sm animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <TabsTrigger value="companies" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 rounded-lg">
            <Building2 className="h-4 w-4 mr-1" /> Companies
          </TabsTrigger>
          <TabsTrigger value="products" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 rounded-lg">
            <Package className="h-4 w-4 mr-1" /> Products
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 rounded-lg">
            <Users className="h-4 w-4 mr-1" /> Suppliers
          </TabsTrigger>
          <TabsTrigger value="shops" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 rounded-lg">
            <Store className="h-4 w-4 mr-1" /> Shops
          </TabsTrigger>
          <TabsTrigger value="order-bookers" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 rounded-lg">
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50">
                <th className="text-left py-2 px-4 font-medium">Name</th>
                <th className="text-center py-2 px-4 font-medium">Products</th>
                <th className="text-center py-2 px-4 font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((item, index) => (
                  <tr key={item.id} className="border-b table-row-hover animate-fade-in-up" style={{ animationDelay: `${index * 30}ms` }}>
                    <td className="py-2 px-4 font-medium">{item.name}</td>
                    <td className="py-2 px-4 text-center"><Badge variant="outline" className="transition-transform hover:scale-105">{item._count?.products || 0}</Badge></td>
                    <td className="py-2 px-4 text-center">
                      <Button variant="outline" size="icon" className="h-8 w-8 border-emerald-200 text-emerald-600 hover:bg-emerald-50 btn-enhanced" onClick={() => { setEditItem(item); setFormName(item.name); setDialogOpen(true); }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8 border-red-200 text-red-500 hover:bg-red-50 btn-enhanced" onClick={() => handleDelete(item.id)}>
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
  const [form, setForm] = useState({ name: '', price: '', unit: 'pcs', companyId: '' });

  // Bulk import state
  const [importOpen, setImportOpen] = useState(false);
  const [importCompany, setImportCompany] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; total: number; errors?: string[] } | null>(null);

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
    // Create a sample Excel template
    const templateData = [
      { Name: 'Zeera', Price: 10, Unit: 'pcs' },
      { Name: 'Coconut', Price: 50, Unit: 'pcs' },
      { Name: 'NanKhatai', Price: 320, Unit: 'Box' },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    // Set column widths
    ws['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'product-import-template.xlsx');
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
          <Button size="sm" variant="outline" className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 btn-enhanced" onClick={() => { setImportCompany(''); setImportFile(null); setImportResult(null); setImportOpen(true); }}>
            <Upload className="h-4 w-4 mr-1" /> Bulk Import
          </Button>
          <Button size="sm" className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md btn-enhanced" onClick={() => { setEditItem(null); setForm({ name: '', price: '', unit: 'pcs', companyId: '' }); setDialogOpen(true); }}>
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
                {filtered.map((item, index) => (
                  <tr key={item.id} className="border-b table-row-hover animate-fade-in-up" style={{ animationDelay: `${index * 20}ms` }}>
                    <td className="py-2 px-4 font-medium">{item.name}</td>
                    <td className="py-2 px-4 text-right">Rs.{item.price}</td>
                    <td className="py-2 px-4 text-center">{item.unit}</td>
                    <td className="py-2 px-4">{item.company?.name}</td>
                    <td className="py-2 px-4 text-center">
                      <Button variant="outline" size="icon" className="h-8 w-8 border-emerald-200 text-emerald-600 hover:bg-emerald-50 btn-enhanced" onClick={() => { setEditItem(item); setForm({ name: item.name, price: String(item.price), unit: item.unit, companyId: item.companyId }); setDialogOpen(true); }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8 border-red-200 text-red-500 hover:bg-red-50 btn-enhanced" onClick={() => handleDelete(item.id)}>
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
            <Button className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 btn-enhanced shadow-md" onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Bulk Import Products
            </DialogTitle>
          </DialogHeader>

          {!importResult ? (
            <div className="space-y-4 py-4">
              {/* Step 1: Download Template */}
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <h4 className="font-medium text-emerald-800 mb-2">Step 1: Download Template</h4>
                <p className="text-sm text-emerald-700 mb-3">
                  Download the Excel template, fill in your products, and upload it back.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-emerald-600 text-emerald-600 hover:bg-emerald-100"
                  onClick={handleDownloadTemplate}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template (.xlsx)
                </Button>
              </div>

              {/* Step 2: Select Company */}
              <div>
                <Label className="text-sm font-medium">Step 2: Select Company *</Label>
                <p className="text-xs text-muted-foreground mb-2">All products will be added to this company</p>
                <Select value={importCompany} onValueChange={setImportCompany}>
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

              {/* Step 3: Upload File */}
              <div>
                <Label className="text-sm font-medium">Step 3: Upload Excel File *</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  File must have columns: <strong>Name, Price, Unit</strong> (Unit is optional, default: pcs)
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
                    <tr><td className="py-1">Unit</td><td className="py-1">No</td><td className="py-1">pcs / Box / Ctn</td></tr>
                  </tbody>
                </table>
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
                      <Button variant="outline" size="icon" className="h-8 w-8 border-emerald-200 text-emerald-600 hover:bg-emerald-50 btn-enhanced" onClick={() => { setEditItem(item); setFormName(item.name); setDialogOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" className="h-8 w-8 border-red-200 text-red-500 hover:bg-red-50 btn-enhanced" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
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
            <Button className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md btn-enhanced" onClick={handleSave}>Save</Button>
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
  const [form, setForm] = useState({ name: '', address: '' });
  // Company-orderbooker mappings: { companyId: orderBookerId | '' }
  const [companyOBMap, setCompanyOBMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [shopRes, obRes, compRes] = await Promise.all([
        fetch('/api/shops'),
        fetch('/api/order-bookers'),
        fetch('/api/companies'),
      ]);
      setItems(await shopRes.json());
      setOrderBookers(await obRes.json());
      setCompanies(await compRes.json());
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAddDialog = () => {
    setEditItem(null);
    setForm({ name: '', address: '' });
    // Initialize companyOBMap with empty values for each company
    const initialMap: Record<string, string> = {};
    companies.forEach((c) => { initialMap[c.id] = ''; });
    setCompanyOBMap(initialMap);
    setDialogOpen(true);
  };

  const openEditDialog = (shop: Shop) => {
    setEditItem(shop);
    setForm({ name: shop.name, address: shop.address });
    // Populate companyOBMap from existing mappings
    const map: Record<string, string> = {};
    companies.forEach((c) => { map[c.id] = ''; });
    shop.companyOrderBookers?.forEach((cob) => {
      map[cob.companyId] = cob.orderBookerId || '';
    });
    setCompanyOBMap(map);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      // Build companyOrderBookers array from the map
      const cobArray = Object.entries(companyOBMap)
        .filter(([, obId]) => obId) // only include if order booker is assigned
        .map(([companyId, orderBookerId]) => ({ companyId, orderBookerId }));

      const body = {
        name: form.name,
        address: form.address,
        companyOrderBookers: cobArray,
      };

      if (editItem) {
        await fetch(`/api/shops/${editItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetch('/api/shops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      setDialogOpen(false);
      setEditItem(null);
      setForm({ name: '', address: '' });
      setCompanyOBMap({});
      load();
    } catch (e) { console.error(e); }
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
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50">
                <th className="text-left py-2 px-4 font-medium">Name</th>
                <th className="text-left py-2 px-4 font-medium">Address</th>
                {companies.map((c) => (
                  <th key={c.id} className="text-left py-2 px-4 font-medium whitespace-nowrap">{c.name} OB</th>
                ))}
                <th className="text-center py-2 px-4 font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 font-medium">{item.name}</td>
                    <td className="py-2 px-4">{item.address || '-'}</td>
                    {companies.map((c) => (
                      <td key={c.id} className="py-2 px-4">
                        <span className={getOBForCompany(item, c.id) !== '-' ? 'text-emerald-700 font-medium' : 'text-muted-foreground'}>
                          {getOBForCompany(item, c.id)}
                        </span>
                      </td>
                    ))}
                    <td className="py-2 px-4 text-center">
                      <Button variant="outline" size="icon" className="h-8 w-8 border-emerald-200 text-emerald-600 hover:bg-emerald-50 btn-enhanced" onClick={() => openEditDialog(item)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8 border-red-200 text-red-500 hover:bg-red-50 btn-enhanced" onClick={() => handleDelete(item.id)}>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem ? 'Edit' : 'Add'} Shop</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Shop Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Shop name" /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" /></div>

            <div className="border-t pt-4">
              <Label className="text-base font-semibold text-emerald-800">Order Bookers by Company</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-3">Assign order bookers for each company. Same shop can have different order bookers for different companies.</p>
              <div className="space-y-3">
                {companies.map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <div className="w-28 shrink-0">
                      <Badge variant="outline" className="text-xs font-medium">{c.name}</Badge>
                    </div>
                    <Select
                      value={companyOBMap[c.id] || 'none'}
                      onValueChange={(v) => setCompanyOBMap({ ...companyOBMap, [c.id]: v === 'none' ? '' : v })}
                    >
                      <SelectTrigger className="flex-1">
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
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md btn-enhanced" onClick={handleSave}>Save</Button>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50">
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
                      <Button variant="outline" size="icon" className="h-8 w-8 border-emerald-200 text-emerald-600 hover:bg-emerald-50 btn-enhanced" onClick={() => { setEditItem(item); setFormName(item.name); setDialogOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" className="h-8 w-8 border-red-200 text-red-500 hover:bg-red-50 btn-enhanced" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
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
            <Button className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md btn-enhanced" onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
