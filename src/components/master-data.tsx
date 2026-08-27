'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, Plus, Edit2, Trash2, Search, Building2, Package, Store, UserCheck,
  Upload, Download, FileSpreadsheet, Truck, History, Check, ChevronLeft, ChevronRight, Lightbulb, Key,
} from 'lucide-react';

// Types
interface Company { id: string; name: string; multiTierPricing?: boolean; claimDeductionPercent?: number; _count?: { products: number } }
interface Product { id: string; name: string; price: number; claimPrice: number; wholesalePrice: number | null; lmtPrice: number | null; unit: string; companyId: string; company: { name: string; multiTierPricing?: boolean } }
interface Supplier { id: string; name: string; companyId?: string | null; company?: { name: string } | null }
interface ShopCompanyOB { id: string; shopId: string; companyId: string; orderBookerId: string | null; shopType?: string; company: { id: string; name: string }; orderBooker?: { id: string; name: string } | null }
interface Shop { id: string; name: string; address: string; phone?: string | null; shopType?: string; companyOrderBookers: ShopCompanyOB[] }
interface OrderBooker { id: string; name: string; _count?: { shopCompanyOrderBookers: number } }
interface CreditLimit { id: string; shopId: string; companyId: string; creditLimit: number }
interface ClaimLite { id: string; totalAmount: number; companyId: string; shopId: string; supplierId: string; orderBookerId: string | null }

const masterDataTabs = [
  { value: 'companies', label: 'Companies', icon: Building2 },
  { value: 'products', label: 'Products', icon: Package },
  { value: 'suppliers', label: 'Suppliers', icon: Truck },
  { value: 'shops', label: 'Shops', icon: Store },
  { value: 'order-bookers', label: 'Order Bookers', icon: UserCheck },
];

const CO_GRADIENTS = [
  'linear-gradient(135deg,#4f46e5,#6366f1)',
  'linear-gradient(135deg,#7c3aed,#8b5cf6)',
  'linear-gradient(135deg,#0d9488,#14b8a6)',
  'linear-gradient(135deg,#0369a1,#0ea5e9)',
  'linear-gradient(135deg,#b45309,#f59e0b)',
];

const chipCls = ['c1', 'c2', 'c3'];

interface MasterDataProps {
  initialTab?: string;
  onNavigate?: (section: string) => void;
}

export function MasterData({ initialTab = 'companies', onNavigate }: MasterDataProps) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Keep tab in sync when the sidebar switches to another master-data section
  // (the component stays mounted across section changes, so initialTab alone
  // would only apply on first render).
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Shared stats (computed once from /api/claims)
  const [claims, setClaims] = useState<ClaimLite[]>([]);
  const [obWithLogin, setObWithLogin] = useState<Set<string>>(new Set());
  const [obCompanies, setObCompanies] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetch('/api/claims')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (Array.isArray(d)) setClaims(d); })
      .catch(() => {});
    fetch('/api/users')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (Array.isArray(d)) {
          setObWithLogin(new Set(d.filter((u: { orderBookerId?: string | null }) => u.orderBookerId).map((u: { orderBookerId?: string | null }) => u.orderBookerId as string)));
        }
      })
      .catch(() => {});
    fetch('/api/shop-order-bookers')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (Array.isArray(d)) {
          const map: Record<string, string[]> = {};
          d.forEach((m: { orderBookerId: string | null; company: { id: string } }) => {
            if (m.orderBookerId) {
              map[m.orderBookerId] = map[m.orderBookerId] || [];
              if (!map[m.orderBookerId].includes(m.company.id)) map[m.orderBookerId].push(m.company.id);
            }
          });
          setObCompanies(map);
        }
      })
      .catch(() => {});
  }, []);

  // Stats helpers
  const companyStats = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const c of claims) {
      const e = map.get(c.companyId) || { count: 0, total: 0 };
      e.count += 1; e.total += c.totalAmount;
      map.set(c.companyId, e);
    }
    return map;
  }, [claims]);

  const shopStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of claims) map.set(c.shopId, (map.get(c.shopId) || 0) + 1);
    return map;
  }, [claims]);

  const supplierStats = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const c of claims) {
      const e = map.get(c.supplierId) || { count: 0, total: 0 };
      e.count += 1; e.total += c.totalAmount;
      map.set(c.supplierId, e);
    }
    return map;
  }, [claims]);

  const obStats = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const c of claims) {
      if (!c.orderBookerId) continue;
      const e = map.get(c.orderBookerId) || { count: 0, total: 0 };
      e.count += 1; e.total += c.totalAmount;
      map.set(c.orderBookerId, e);
    }
    return map;
  }, [claims]);

  const fmt = (n: number) => `Rs ${n.toLocaleString()}`;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="h1">Master Data</div>
          <div className="sub">Companies, products, suppliers, shops aur order bookers manage karein</div>
        </div>
      </div>

      <div className="master-tabs">
        {masterDataTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              className={`mtab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.value)}
            >
              <Icon className="ic sm" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'companies' && <CompaniesTab companyStats={companyStats} fmt={fmt} />}
      {activeTab === 'products' && <ProductsTab />}
      {activeTab === 'suppliers' && <SuppliersTab supplierStats={supplierStats} fmt={fmt} />}
      {activeTab === 'shops' && <ShopsTab shopStats={shopStats} />}
      {activeTab === 'order-bookers' && <OrderBookersTab obStats={obStats} obWithLogin={obWithLogin} obCompanies={obCompanies} fmt={fmt} onNavigate={onNavigate} />}
    </>
  );
}

/* ─────────────────────────────────────────────
   Shared: sub-page header
   ───────────────────────────────────────────── */
function TabHeader({ title, count, sub, actions }: { title: string; count?: number; sub: string; actions?: React.ReactNode }) {
  return (
    <div className="page-head" style={{ paddingTop: 4 }}>
      <div>
        <div className="h1" style={{ fontSize: 18 }}>
          {title} {count !== undefined && <span className="muted" style={{ fontWeight: 500, fontSize: 14 }}>· {count}</span>}
        </div>
        <div className="sub">{sub}</div>
      </div>
      {actions && <div className="ph-actions">{actions}</div>}
    </div>
  );
}

/* Excel export button — downloads the current list from /api/export/master */
function ExportExcelBtn({ type }: { type: string }) {
  return (
    <button
      className="btn btn-o"
      title="Current list Excel mein download karein"
      onClick={() => window.open(`/api/export/master?type=${type}&t=${Date.now()}`, '_blank')}
    >
      <Download className="ic sm" /> Excel
    </button>
  );
}

function EmptyRow({ colSpan, icon: Icon }: { colSpan: number; icon?: React.ElementType }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--af-text3)' }}>
        {Icon ? <Icon className="ic" style={{ margin: '0 auto 8px', opacity: .4 }} /> : null}
        <span className="small">No records found</span>
      </td>
    </tr>
  );
}

function LoadingCard() {
  return (
    <div className="card">
      <div className="empty-state" style={{ minHeight: 200 }}>
        <Loader2 className="ic animate-spin" />
        <p className="small">Loading…</p>
      </div>
    </div>
  );
}

/* ========= Companies Tab ========= */
function CompaniesTab({ companyStats, fmt }: { companyStats: Map<string, { count: number; total: number }>; fmt: (n: number) => string }) {
  const [items, setItems] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Company | null>(null);
  const [formName, setFormName] = useState('');
  const [formMultiTier, setFormMultiTier] = useState(false);
  const [formDeductionPercent, setFormDeductionPercent] = useState('');
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
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
    finally { setSaving(false); }
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

  const initials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <TabHeader
        title="Companies"
        count={filtered.length}
        sub={`${items.reduce((s, c) => s + (c._count?.products || 0), 0)} products across ${items.length} companies`}
        actions={
          <>
            <ExportExcelBtn type="companies" />
            <button className="btn btn-p" onClick={() => { setEditItem(null); setFormName(''); setFormMultiTier(false); setFormDeductionPercent(''); setDialogOpen(true); }}>
              <Plus className="ic sm" /> Add Company
            </button>
          </>
        }
      />

      {loading ? <LoadingCard /> : (
        <div className="card tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Company</th><th>Multi-tier Pricing</th><th className="num">Claim Deduction</th>
                <th className="num">Products</th><th className="num">Claims</th><th className="num">Total Claimed</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? <EmptyRow colSpan={7} icon={Building2} /> : filtered.map((item, index) => {
                const stats = companyStats.get(item.id) || { count: 0, total: 0 };
                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <div className="co-logo" style={{ background: CO_GRADIENTS[index % CO_GRADIENTS.length] }}>{initials(item.name)}</div>
                        <div>
                          <div className="strong">{item.name}</div>
                          {item.multiTierPricing && <div className="small muted">Wholesale + LMT pricing</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      {item.multiTierPricing
                        ? <span className="bdg wholesale">On</span>
                        : <span className="bdg neutral">Off</span>}
                    </td>
                    <td className="num">
                      {item.claimDeductionPercent && item.claimDeductionPercent > 0
                        ? <span style={{ color: 'var(--af-bad)', fontWeight: 700 }}>{item.claimDeductionPercent}%</span>
                        : '0%'}
                    </td>
                    <td className="num">{item._count?.products || 0}</td>
                    <td className="num">{stats.count}</td>
                    <td className="num strong">{fmt(stats.total)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="ra" title="Edit" onClick={() => { setEditItem(item); setFormName(item.name); setFormMultiTier(item.multiTierPricing || false); setFormDeductionPercent(item.claimDeductionPercent ? String(item.claimDeductionPercent) : ''); setDialogOpen(true); }}>
                          <Edit2 className="ic sm" />
                        </button>
                        <button className="ra danger" title="Delete" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="ic sm" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="note">
        <Lightbulb className="ic" />
        <div><b>Multi-tier pricing</b> (jaise Cadbury ke wholesale + LMT prices) aur <b>deduction %</b> (jaise Shan Foods 22%) — dono settings ab clearly visible hain. Company delete karne se pehle system check karega ke uski claims exist karti hain ya nahi.</div>
      </div>

      {/* Add/Edit Company Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="af-dialog sm:max-w-[460px]">
          <div className="dlg-h">
            <DialogTitle className="dlg-t">{editItem ? 'Edit' : 'Add'} Company</DialogTitle>
          </div>
          <div className="dlg-b">
            <div className="field">
              <label className="label">Company Name <span className="req">*</span></label>
              <input className="input" placeholder="e.g. National Foods" value={formName} onChange={(e) => setFormName(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label className="label">Multi-tier Pricing</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'var(--af-surface2)', borderRadius: 10, padding: '12px 14px' }}>
                <button type="button" className={`switch ${formMultiTier ? 'on' : ''}`} onClick={() => setFormMultiTier(!formMultiTier)} aria-label="Toggle multi-tier pricing" />
                <span className="small" style={{ color: 'var(--af-text2)' }}>On karein agar company ke wholesale aur LMT prices alag hain (jaise Cadbury)</span>
              </div>
            </div>
            <div className="field">
              <label className="label">Claim Deduction %</label>
              <input className="input" type="number" min="0" max="100" step="0.1" placeholder="0" value={formDeductionPercent} onChange={(e) => setFormDeductionPercent(e.target.value)} />
              <p className="small muted">e.g. 22 = har claim par 22% deduction (Shan Foods policy)</p>
            </div>
          </div>
          <div className="dlg-f">
            <button className="btn btn-g" onClick={() => setDialogOpen(false)}>Cancel</button>
            <button className="btn btn-p" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="ic sm animate-spin" /> : <Check className="ic sm" />} Save Company
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ========= Products Tab ========= */
const PRODUCT_PAGE_SIZE = 20;

function ProductsTab() {
  const [items, setItems] = useState<Product[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCompany, setFilterCompany] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [page, setPage] = useState(1);
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

    let templateData;
    let colWidths;

    if (isMultiTier) {
      templateData = [
        { Name: 'Dairy Milk', Price: 150, ClaimPrice: 140, WholesalePrice: 120, LMTPrice: 130, Unit: 'pcs' },
        { Name: '5 Star', Price: 50, ClaimPrice: 45, WholesalePrice: 40, LMTPrice: 42, Unit: 'pcs' },
        { Name: 'Perk', Price: 20, ClaimPrice: 18, WholesalePrice: 15, LMTPrice: 16, Unit: 'pcs' },
      ];
      colWidths = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 10 }];
    } else {
      templateData = [
        { Name: 'Zeera', Price: 10, Unit: 'pcs' },
        { Name: 'Coconut', Price: 50, Unit: 'pcs' },
        { Name: 'NanKhatai', Price: 320, Unit: 'Box' },
      ];
      colWidths = [{ wch: 25 }, { wch: 12 }, { wch: 10 }];
    }
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    const filename = isMultiTier ? 'product-import-template-multitier.xlsx' : 'product-import-template.xlsx';
    XLSX.writeFile(wb, filename);
  };

  const openPriceHistory = async (product: Product) => {
    setPriceHistoryProduct(product);
    setPriceHistoryOpen(true);
    setPriceHistoryLoading(true);
    try {
      const res = await fetch(`/api/products/price-history?productId=${product.id}`);
      if (res.ok) { setPriceHistoryData(await res.json()); }
    } catch { setPriceHistoryData([]); }
    finally { setPriceHistoryLoading(false); }
  };

  const filtered = useMemo(() => {
    const list = items.filter((i) => {
      const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
      const matchCompany = filterCompany === 'all' || i.companyId === filterCompany;
      return matchSearch && matchCompany;
    });
    if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'price-desc') list.sort((a, b) => b.price - a.price);
    return list;
  }, [items, search, filterCompany, sortBy]);

  useEffect(() => { setPage(1); }, [search, filterCompany, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCT_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PRODUCT_PAGE_SIZE, safePage * PRODUCT_PAGE_SIZE);

  const companyChip = (name: string) => {
    const i = companies.findIndex((c) => c.name === name);
    return chipCls[i >= 0 ? i % 3 : 0];
  };

  return (
    <>
      <TabHeader
        title="Products"
        count={filtered.length}
        sub="Har product ka apna claim rate · Excel bulk-import supported"
        actions={
          <>
            <ExportExcelBtn type="products" />
            <button className="btn btn-o" onClick={() => { setImportCompany(''); setImportFile(null); setImportResult(null); setImportOpen(true); }}>
              <Upload className="ic sm" /> Bulk Import
            </button>
            <button className="btn btn-p" onClick={() => { setEditItem(null); setForm({ name: '', price: '', claimPrice: '', wholesalePrice: '', lmtPrice: '', unit: 'pcs', companyId: '' }); setDialogOpen(true); }}>
              <Plus className="ic sm" /> Add Product
            </button>
          </>
        }
      />

      <div className="filters card">
        <div className="f-search">
          <Search className="ic sm" />
          <input placeholder="Search product name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="sel" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
          <option value="all">All Companies</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="sel" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="recent">Recently Updated</option>
          <option value="name">Name A-Z</option>
          <option value="price-desc">Price High-Low</option>
        </select>
        <div className="spacer" />
        <span className="chip c1"><Check className="ic" /> {filtered.length} products</span>
      </div>

      {loading ? <LoadingCard /> : (
        <div className="card tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Product</th><th>Company</th><th>Unit</th>
                <th className="num">Price</th><th className="num">Claim Price</th>
                <th className="num">Wholesale</th><th className="num">LMT</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? <EmptyRow colSpan={8} icon={Package} /> : paged.map((item) => (
                <tr key={item.id}>
                  <td className="strong">{item.name}</td>
                  <td><span className={`chip ${companyChip(item.company?.name || '')}`}>{item.company?.name}</span></td>
                  <td>{item.unit}</td>
                  <td className="num">Rs {item.price}</td>
                  <td className="num" style={{ color: 'var(--af-primary)', fontWeight: 700 }}>Rs {item.claimPrice || item.price}</td>
                  <td className="num">{item.wholesalePrice ? `Rs ${item.wholesalePrice}` : <span className="muted">—</span>}</td>
                  <td className="num">{item.lmtPrice ? `Rs ${item.lmtPrice}` : <span className="muted">—</span>}</td>
                  <td>
                    <div className="row-actions">
                      <button className="ra violet" title="Price history" onClick={() => openPriceHistory(item)}>
                        <History className="ic sm" />
                      </button>
                      <button className="ra" title="Edit" onClick={() => { setEditItem(item); setForm({ name: item.name, price: String(item.price), claimPrice: String(item.claimPrice || item.price), wholesalePrice: item.wholesalePrice ? String(item.wholesalePrice) : '', lmtPrice: item.lmtPrice ? String(item.lmtPrice) : '', unit: item.unit, companyId: item.companyId }); setDialogOpen(true); }}>
                        <Edit2 className="ic sm" />
                      </button>
                      <button className="ra danger" title="Delete" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="ic sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="tbl-foot">
            <span>Showing <b style={{ color: 'var(--af-text)' }}>{paged.length}</b> of {filtered.length} products</span>
            <div className="pager">
              <button className="pg" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}><ChevronLeft className="ic sm" /></button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1).map((p, i, arr) => (
                <span key={p} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  {i > 0 && p - (arr[i - 1] as number) > 1 && <span style={{ color: 'var(--af-text3)' }}>…</span>}
                  <button className={`pg ${p === safePage ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                </span>
              ))}
              <button className="pg" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}><ChevronRight className="ic sm" /></button>
            </div>
          </div>
        </div>
      )}

      <div className="note">
        <Lightbulb className="ic" />
        <div><b>Price history</b> (purple clock icon): har price change ka record khulega — old → new price, kisne change kiya, kab. Bulk Import wala Excel format bilkul same rahega jo aap abhi use karte hain.</div>
      </div>

      {/* Add/Edit Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="af-dialog sm:max-w-[460px] max-h-[90vh] overflow-y-auto">
          <div className="dlg-h">
            <DialogTitle className="dlg-t">{editItem ? 'Edit' : 'Add'} Product</DialogTitle>
          </div>
          <div className="dlg-b">
            <div className="field">
              <label className="label">Name <span className="req">*</span></label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name" autoFocus />
            </div>
            <div className="grid2">
              <div className="field">
                <label className="label">Price (Rs.) <span className="req">*</span></label>
                <input className="input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" />
              </div>
              <div className="field">
                <label className="label">Claim Rate (Rs.)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" type="number" value={form.claimPrice} onChange={(e) => setForm({ ...form, claimPrice: e.target.value })} placeholder="Same as price" />
                  {editItem && (
                    <button className="ra violet" type="button" style={{ width: 40, height: 40 }} title="Price History" onClick={() => openPriceHistory(editItem)}>
                      <History className="ic sm" />
                    </button>
                  )}
                </div>
                <p className="small muted">Claim mein jo rate lagega (default = Price)</p>
              </div>
            </div>
            <div className="grid2">
              <div className="field">
                <label className="label">Unit</label>
                <input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs" />
              </div>
              <div className="field">
                <label className="label">Company <span className="req">*</span></label>
                <Select value={form.companyId} onValueChange={(v) => setForm({ ...form, companyId: v })}>
                  <SelectTrigger className="af-sel"><SelectValue placeholder="Select company" /></SelectTrigger>
                  <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.multiTierPricing ? ' (Multi-Tier)' : ''}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {/* Multi-tier pricing fields */}
            {form.companyId && companies.find(c => c.id === form.companyId)?.multiTierPricing && (
              <div style={{ background: 'var(--af-violet-soft)', border: '1px solid color-mix(in srgb, var(--af-violet) 30%, transparent)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="bdg wholesale">Multi-Tier Pricing</span>
                  <span className="small" style={{ color: 'var(--af-violet)' }}>Wholesale aur LMT prices enter karein</span>
                </div>
                <div className="grid2">
                  <div className="field">
                    <label className="label">Wholesale Price (Rs.)</label>
                    <input className="input" type="number" value={form.wholesalePrice} onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })} placeholder="0" />
                    <p className="small muted">For wholesale shops</p>
                  </div>
                  <div className="field">
                    <label className="label">LMT Price (Rs.)</label>
                    <input className="input" type="number" value={form.lmtPrice} onChange={(e) => setForm({ ...form, lmtPrice: e.target.value })} placeholder="0" />
                    <p className="small muted">For LMT shops</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="dlg-f">
            <button className="btn btn-g" onClick={() => setDialogOpen(false)}>Cancel</button>
            <button className="btn btn-p" onClick={handleSave}><Check className="ic sm" /> Save Product</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Price History Dialog */}
      <Dialog open={priceHistoryOpen} onOpenChange={setPriceHistoryOpen}>
        <DialogContent className="af-dialog sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <div className="dlg-h">
            <DialogTitle className="dlg-t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <History className="ic sm" style={{ color: 'var(--af-primary)' }} /> Price History: {priceHistoryProduct?.name}
            </DialogTitle>
          </div>
          <div className="dlg-b" style={{ padding: 0 }}>
            {priceHistoryLoading ? (
              <div className="empty-state" style={{ minHeight: 160 }}><Loader2 className="ic animate-spin" /></div>
            ) : priceHistoryData.length === 0 ? (
              <div className="empty-state" style={{ minHeight: 160 }}>
                <History className="ic" />
                <p className="small">No price changes recorded yet</p>
              </div>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl" style={{ minWidth: 440 }}>
                  <thead>
                    <tr><th>Date</th><th>Changed By</th><th>Price Change</th><th>Claim Rate</th></tr>
                  </thead>
                  <tbody>
                    {priceHistoryData.map((h) => (
                      <tr key={h.id}>
                        <td>{new Date(h.changedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td>{h.changedBy || '—'}</td>
                        <td>
                          <span style={{ color: 'var(--af-bad)' }}>Rs {h.oldPrice}</span>
                          <span className="muted"> → </span>
                          <span style={{ color: 'var(--af-primary)', fontWeight: 600 }}>Rs {h.newPrice}</span>
                        </td>
                        <td>
                          {h.oldClaimPrice !== h.newClaimPrice ? (
                            <>
                              <span style={{ color: 'var(--af-bad)' }}>Rs {h.oldClaimPrice}</span>
                              <span className="muted"> → </span>
                              <span style={{ color: 'var(--af-primary)', fontWeight: 600 }}>Rs {h.newClaimPrice}</span>
                            </>
                          ) : <span className="muted">Rs {h.newClaimPrice}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="dlg-f">
            <button className="btn btn-o" onClick={() => setPriceHistoryOpen(false)}>Close</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="af-dialog sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <div className="dlg-h">
            <DialogTitle className="dlg-t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileSpreadsheet className="ic sm" style={{ color: 'var(--af-primary)' }} /> Bulk Import Products
            </DialogTitle>
          </div>
          {!importResult ? (
            <>
              <div className="dlg-b">
                <div className="field">
                  <label className="label">Step 1: Select Company <span className="req">*</span></label>
                  <p className="small muted">All products will be added to this company</p>
                  <Select value={importCompany} onValueChange={setImportCompany}>
                    <SelectTrigger className="af-sel"><SelectValue placeholder="Select Company" /></SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}{c.multiTierPricing ? ' (Multi-Tier)' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div style={{ background: 'var(--af-primary-soft)', borderRadius: 10, padding: 14, border: '1px solid color-mix(in srgb, var(--af-primary) 25%, transparent)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--af-primary)', marginBottom: 8, fontSize: 13 }}>Step 2: Download Template</div>
                  <p className="small" style={{ color: 'var(--af-text2)', marginBottom: 10 }}>
                    {importCompany
                      ? companies.find(c => c.id === importCompany)?.multiTierPricing
                        ? 'Multi-Tier company ke liye template mein WholesalePrice aur LMTPrice columns honge.'
                        : 'Download the Excel template, fill in your products, and upload it back.'
                      : 'Pehle company select karo, phir template download karo.'}
                  </p>
                  <button className="btn btn-o btn-sm" onClick={handleDownloadTemplate} disabled={!importCompany}>
                    <Download className="ic sm" /> Download Template (.xlsx)
                  </button>
                </div>

                <div className="field">
                  <label className="label">Step 3: Upload Excel File <span className="req">*</span></label>
                  <p className="small muted">
                    File must have columns: <b>Name, Price</b>{importCompany && companies.find(c => c.id === importCompany)?.multiTierPricing ? ', WholesalePrice, LMTPrice' : ', ClaimPrice'} (Unit optional, default: pcs)
                  </p>
                  <label htmlFor="bulk-import-file" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1.5px dashed var(--af-border2)', borderRadius: 10, padding: '22px 12px', cursor: 'pointer', textAlign: 'center', transition: '.15s' }}>
                    {importFile ? (
                      <>
                        <FileSpreadsheet className="ic lg" style={{ color: 'var(--af-primary)' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--af-text)' }}>{importFile.name}</span>
                        <span className="small muted">{(importFile.size / 1024).toFixed(1)} KB — click to change</span>
                      </>
                    ) : (
                      <>
                        <Upload className="ic lg" style={{ color: 'var(--af-text3)' }} />
                        <span style={{ fontSize: 13, color: 'var(--af-text2)' }}>Click to select file</span>
                        <span className="small muted">.xlsx, .xls, .csv</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      className="hidden"
                      style={{ display: 'none' }}
                      id="bulk-import-file"
                    />
                  </label>
                </div>
              </div>
              <div className="dlg-f">
                <button className="btn btn-g" onClick={() => setImportOpen(false)}>Cancel</button>
                <button className="btn btn-p" onClick={handleBulkImport} disabled={!importFile || !importCompany || importing}>
                  {importing ? (<><Loader2 className="ic sm animate-spin" /> Importing…</>) : (<><Upload className="ic sm" /> Import Products</>)}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="dlg-b" style={{ alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: 99, background: importResult.imported > 0 ? 'var(--af-ok-soft)' : 'var(--af-warn-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                  {importResult.imported > 0 ? '✅' : '⚠️'}
                </div>
                <div className="dlg-t">Import Complete!</div>
                <div className="grid3" style={{ width: '100%' }}>
                  <div className="info-tile" style={{ textAlign: 'center' }}><div className="k">Total Rows</div><div className="v">{importResult.total}</div></div>
                  <div className="info-tile" style={{ textAlign: 'center' }}><div className="k">Imported</div><div className="v" style={{ color: 'var(--af-ok)' }}>{importResult.imported}</div></div>
                  <div className="info-tile" style={{ textAlign: 'center' }}><div className="k">Skipped</div><div className="v" style={{ color: 'var(--af-warn)' }}>{importResult.skipped}</div></div>
                </div>
                {importResult.skipped > 0 && (
                  <p className="small" style={{ color: 'var(--af-text2)', textAlign: 'left' }}>
                    {importResult.skipped} product(s) skipped — same name, price aur company wale duplicates automatically skip hote hain.
                  </p>
                )}
                {importResult.errors && importResult.errors.length > 0 && (
                  <div style={{ background: 'var(--af-bad-soft)', borderRadius: 10, padding: 12, maxHeight: 120, overflowY: 'auto', width: '100%', textAlign: 'left' }}>
                    {importResult.errors.map((err, i) => (
                      <p key={i} className="small" style={{ color: 'var(--af-bad)' }}>{err}</p>
                    ))}
                  </div>
                )}
              </div>
              <div className="dlg-f">
                <button className="btn btn-p btn-block" onClick={() => { setImportOpen(false); setImportResult(null); }}>Done</button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ========= Suppliers Tab ========= */
function SuppliersTab({ supplierStats, fmt }: { supplierStats: Map<string, { count: number; total: number }>; fmt: (n: number) => string }) {
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Supplier | null>(null);
  const [formName, setFormName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { const res = await fetch('/api/suppliers'); if (res.ok) { const data = await res.json(); if (Array.isArray(data)) setItems(data); } }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!formName.trim()) { alert('Name is required'); return; }
    setSaving(true);
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
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this supplier?')) return;
    try { const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' }); if (!res.ok) { const d = await res.json(); alert(d.error); } load(); }
    catch (e) { console.error(e); }
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  const initials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <TabHeader
        title="Suppliers"
        count={filtered.length}
        sub="Distribution partners jo claims supply karte hain"
        actions={
          <>
            <ExportExcelBtn type="suppliers" />
            <button className="btn btn-p" onClick={() => { setEditItem(null); setFormName(''); setDialogOpen(true); }}>
              <Plus className="ic sm" /> Add Supplier
            </button>
          </>
        }
      />

      <div className="filters card">
        <div className="f-search">
          <Search className="ic sm" />
          <input placeholder="Search supplier name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="spacer" />
      </div>

      {loading ? <LoadingCard /> : (
        <div className="card tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Supplier</th><th>Company</th><th className="num">Claims</th><th className="num">Total Claimed</th><th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? <EmptyRow colSpan={5} icon={Truck} /> : filtered.map((item, index) => {
                const stats = supplierStats.get(item.id) || { count: 0, total: 0 };
                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <div className="av" style={{ background: CO_GRADIENTS[index % CO_GRADIENTS.length] }}>{initials(item.name)}</div>
                        <div className="strong">{item.name}</div>
                      </div>
                    </td>
                    <td>{item.company?.name ? <span className={`chip ${chipCls[index % 3]}`}>{item.company.name}</span> : <span className="muted">—</span>}</td>
                    <td className="num">{stats.count}</td>
                    <td className="num strong">{fmt(stats.total)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="ra" title="Edit" onClick={() => { setEditItem(item); setFormName(item.name); setDialogOpen(true); }}><Edit2 className="ic sm" /></button>
                        <button className="ra danger" title="Delete" onClick={() => handleDelete(item.id)}><Trash2 className="ic sm" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="af-dialog sm:max-w-[400px]">
          <div className="dlg-h">
            <DialogTitle className="dlg-t">{editItem ? 'Edit' : 'Add'} Supplier</DialogTitle>
          </div>
          <div className="dlg-b">
            <div className="field">
              <label className="label">Supplier Name <span className="req">*</span></label>
              <input className="input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Supplier name" autoFocus />
            </div>
          </div>
          <div className="dlg-f">
            <button className="btn btn-g" onClick={() => setDialogOpen(false)}>Cancel</button>
            <button className="btn btn-p" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="ic sm animate-spin" /> : <Check className="ic sm" />} Save Supplier
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ========= Shops Tab ========= */
function ShopsTab({ shopStats }: { shopStats: Map<string, number> }) {
  const [items, setItems] = useState<Shop[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [creditLimits, setCreditLimits] = useState<CreditLimit[]>([]);
  const [allClaims, setAllClaims] = useState<ClaimLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Shop | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '', shopType: 'retail' });
  const [companySettings, setCompanySettings] = useState<Record<string, { orderBookerId: string; shopType: string; creditLimit: string }>>({});
  const [orderBookers, setOrderBookers] = useState<OrderBooker[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [shopRes, obRes, compRes, limitsRes, claimsRes] = await Promise.all([
        fetch('/api/shops'),
        fetch('/api/order-bookers'),
        fetch('/api/companies'),
        fetch('/api/credit-limits'),
        fetch('/api/claims'),
      ]);
      if (shopRes.ok) { const data = await shopRes.json(); if (Array.isArray(data)) setItems(data); }
      if (obRes.ok) { const data = await obRes.json(); if (Array.isArray(data)) setOrderBookers(data); }
      if (compRes.ok) { const data = await compRes.json(); if (Array.isArray(data)) setCompanies(data); }
      if (limitsRes.ok) { const data = await limitsRes.json(); if (Array.isArray(data)) setCreditLimits(data); }
      if (claimsRes.ok) { const data = await claimsRes.json(); if (Array.isArray(data)) setAllClaims(data); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAddDialog = () => {
    setEditItem(null);
    setForm({ name: '', address: '', phone: '', shopType: 'retail' });
    const initialSettings: Record<string, { orderBookerId: string; shopType: string; creditLimit: string }> = {};
    companies.forEach((c) => { initialSettings[c.id] = { orderBookerId: '', shopType: 'retail', creditLimit: '' }; });
    setCompanySettings(initialSettings);
    setDialogOpen(true);
  };

  const openEditDialog = async (shop: Shop) => {
    setEditItem(shop);
    setForm({ name: shop.name, address: shop.address, phone: shop.phone || '', shopType: shop.shopType || 'retail' });
    const settings: Record<string, { orderBookerId: string; shopType: string; creditLimit: string }> = {};
    companies.forEach((c) => { settings[c.id] = { orderBookerId: '', shopType: 'retail', creditLimit: '' }; });
    shop.companyOrderBookers?.forEach((cob) => {
      settings[cob.companyId] = {
        orderBookerId: cob.orderBookerId || '',
        shopType: cob.shopType || 'retail',
        creditLimit: settings[cob.companyId]?.creditLimit || '',
      };
    });

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
    setSaving(true);
    try {
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
        phone: form.phone,
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
            console.error('Failed to save credit limit for company', compId);
          }
        }
      }

      if (success) {
        setDialogOpen(false);
        setEditItem(null);
        setForm({ name: '', address: '', phone: '', shopType: 'retail' });
        setCompanySettings({});
        load();
      } else {
        alert(errMsg);
      }
    } catch (e) {
      console.error(e);
      alert('Unexpected error while saving shop');
    } finally {
      setSaving(false);
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

  const filtered = items.filter((i) => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || (i.address || '').toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' ||
      (filterType === 'retail' && (!i.shopType || i.shopType === 'retail')) ||
      i.shopType === filterType;
    const matchCompany = filterCompany === 'all' || (i.companyOrderBookers || []).some(cob => cob.companyId === filterCompany);
    return matchSearch && matchType && matchCompany;
  });

  // Credit info per shop (max across companies for the meter)
  const creditFor = (shop: Shop) => {
    const limits = creditLimits.filter(l => l.shopId === shop.id && l.creditLimit > 0);
    if (limits.length === 0) return null;
    const limit = limits.reduce((m, l) => Math.max(m, l.creditLimit), 0);
    const used = allClaims
      .filter(c => c.shopId === shop.id && ['pending', 'approved', 'partial', 'arrived_approved', 'partially_approved', 'partially_cleared'].includes(c.status as string))
      .reduce((s, c) => s + c.totalAmount, 0);
    return { limit, used, pct: Math.min(100, Math.round((used / limit) * 100)) };
  };

  return (
    <>
      <TabHeader
        title="Shops"
        count={filtered.length}
        sub="Retail, wholesale aur LMT shops · per-company credit limits"
        actions={
          <>
            <ExportExcelBtn type="shops" />
            <button className="btn btn-p" onClick={openAddDialog}>
              <Plus className="ic sm" /> Add Shop
            </button>
          </>
        }
      />

      <div className="filters card">
        <div className="f-search">
          <Search className="ic sm" />
          <input placeholder="Search shop name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="sel" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          <option value="retail">Retail</option>
          <option value="wholesale">Wholesale</option>
          <option value="lmt">LMT</option>
        </select>
        <select className="sel" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
          <option value="all">All Companies</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="spacer" />
      </div>

      {loading ? <LoadingCard /> : (
        <div className="card tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Shop</th><th>Type</th><th>Companies</th><th className="num">Credit Limit</th><th className="num">Claims</th><th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? <EmptyRow colSpan={6} icon={Store} /> : filtered.map((item) => {
                const credit = creditFor(item);
                const assignedCompanies = (item.companyOrderBookers || []).filter(cob => cob.orderBookerId);
                const shopType = item.shopType || 'retail';
                return (
                  <tr key={item.id} className={credit && credit.pct >= 80 ? 'row-bad' : ''}>
                    <td>
                      <div className="strong">{item.name}</div>
                      {item.address && <div className="small muted">{item.address}</div>}
                    </td>
                    <td>
                      <span className={`bdg ${shopType}`}>
                        {shopType === 'wholesale' ? 'Wholesale' : shopType === 'lmt' ? 'LMT' : 'Retail'}
                      </span>
                    </td>
                    <td>
                      {assignedCompanies.length === 0 ? (
                        <span className="small muted">No assignment</span>
                      ) : (
                        <div className="chips">
                          {assignedCompanies.map((cob, i) => (
                            <span className={`chip ${chipCls[i % 3]}`} key={cob.id}>
                              {cob.company.name}{cob.shopType && cob.shopType !== 'retail' ? ` · ${cob.shopType === 'wholesale' ? 'Ws' : 'LMT'}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="num">
                      {credit ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }}>
                          <span className={`strong ${credit.pct >= 80 ? '' : ''}`} style={credit.pct >= 80 ? { color: 'var(--af-bad)' } : undefined}>
                            Rs {credit.used.toLocaleString()} / {credit.limit.toLocaleString()}
                          </span>
                          <div className={`prog ${credit.pct >= 80 ? 'bad' : credit.pct >= 50 ? 'warn' : ''}`}>
                            <i style={{ width: `${credit.pct}%` }} />
                          </div>
                        </div>
                      ) : (
                        <span className="muted">No limit</span>
                      )}
                    </td>
                    <td className="num">{shopStats.get(item.id) || 0}</td>
                    <td>
                      <div className="row-actions">
                        <button className="ra" title="Edit" onClick={() => openEditDialog(item)}><Edit2 className="ic sm" /></button>
                        <button className="ra danger" title="Delete" onClick={() => handleDelete(item.id)}><Trash2 className="ic sm" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="note">
        <Lightbulb className="ic" />
        <div><b>Credit limit meter:</b> har shop ka per-company credit limit aur usage ek nazar mein. <b>80%+ used wali shop</b> red highlight — us shop ki nayi claim submit hote hi warning milegi.</div>
      </div>

      {/* Add/Edit Shop Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="af-dialog sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <div className="dlg-h">
            <DialogTitle className="dlg-t">{editItem ? 'Edit' : 'Add'} Shop</DialogTitle>
          </div>
          <div className="dlg-b">
            <div className="field">
              <label className="label">Shop Name <span className="req">*</span></label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Shop name" autoFocus />
            </div>
            <div className="field">
              <label className="label">Address</label>
              <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" />
            </div>
            <div className="field">
              <label className="label">Phone (WhatsApp)</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0300-1234567" />
            </div>
            <div className="field">
              <label className="label">Shop Type <span className="req">*</span></label>
              <p className="small muted">Affects claim rate for multi-tier companies like Cadbury</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {['retail', 'wholesale', 'lmt'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`btn btn-sm ${form.shopType === type ? 'btn-p' : 'btn-o'}`}
                    style={{ flex: 1 }}
                    onClick={() => setForm({ ...form, shopType: type })}
                  >
                    {type === 'retail' ? 'Retail' : type === 'wholesale' ? 'Wholesale' : 'LMT'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--af-border)', paddingTop: 15 }}>
              <div className="card-t" style={{ fontSize: 13 }}><Building2 className="ic sm" /> Company Settings</div>
              <p className="small muted" style={{ marginTop: 4, marginBottom: 12 }}>
                Per company: Shop Type (affects pricing) aur Order Booker assign karo.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {companies.map((c) => (
                  <div key={c.id} style={{ border: '1px solid var(--af-border)', borderRadius: 10, padding: 12, background: 'var(--af-surface2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span className="chip">{c.name}</span>
                      {c.multiTierPricing && <span className="bdg wholesale">Multi-Tier</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 150 }}>
                        <p className="small muted" style={{ marginBottom: 4 }}>Shop Type</p>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {['retail', 'wholesale', 'lmt'].map((type) => (
                            <button
                              key={type}
                              type="button"
                              className={`btn btn-sm ${(companySettings[c.id]?.shopType || 'retail') === type ? 'btn-p' : 'btn-o'}`}
                              style={{ padding: '4px 8px', fontSize: 11 }}
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
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <p className="small muted" style={{ marginBottom: 4 }}>Order Booker</p>
                        <Select
                          value={companySettings[c.id]?.orderBookerId || 'none'}
                          onValueChange={(v) => setCompanySettings({
                            ...companySettings,
                            [c.id]: { ...companySettings[c.id], orderBookerId: v === 'none' ? '' : v }
                          })}
                        >
                          <SelectTrigger className="af-sel" data-size="sm"><SelectValue placeholder="Select OB" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {orderBookers.map((ob) => (
                              <SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <p className="small muted" style={{ marginBottom: 4 }}>Credit Limit (Rs.)</p>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          placeholder="No limit"
                          value={companySettings[c.id]?.creditLimit || ''}
                          onChange={(e) => setCompanySettings({
                            ...companySettings,
                            [c.id]: { ...companySettings[c.id], creditLimit: e.target.value }
                          })}
                          style={{ height: 34, fontSize: 12.5 }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="dlg-f">
            <button className="btn btn-g" onClick={() => setDialogOpen(false)}>Cancel</button>
            <button className="btn btn-p" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="ic sm animate-spin" /> : <Check className="ic sm" />} Save Shop
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ========= Order Bookers Tab ========= */
function OrderBookersTab({ obStats, obWithLogin, obCompanies, fmt, onNavigate }: {
  obStats: Map<string, { count: number; total: number }>;
  obWithLogin: Set<string>;
  obCompanies: Record<string, string[]>;
  fmt: (n: number) => string;
  onNavigate?: (section: string) => void;
}) {
  const [items, setItems] = useState<OrderBooker[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<OrderBooker | null>(null);
  const [formName, setFormName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [obRes, compRes] = await Promise.all([fetch('/api/order-bookers'), fetch('/api/companies')]);
      if (obRes.ok) { const data = await obRes.json(); if (Array.isArray(data)) setItems(data); }
      if (compRes.ok) { const data = await compRes.json(); if (Array.isArray(data)) setCompanies(data); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!formName.trim()) { alert('Name is required'); return; }
    setSaving(true);
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
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this order booker?')) return;
    try { const res = await fetch(`/api/order-bookers/${id}`, { method: 'DELETE' }); if (!res.ok) { const d = await res.json(); alert(d.error); } load(); }
    catch (e) { console.error(e); }
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  const initials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const companiesFor = (obId: string) => {
    const ids = obCompanies[obId] || [];
    return companies.filter(c => ids.includes(c.id));
  };

  return (
    <>
      <TabHeader
        title="Order Bookers"
        count={filtered.length}
        sub="Field team aur unki assigned companies"
        actions={
          <>
            <ExportExcelBtn type="order-bookers" />
            <button className="btn btn-p" onClick={() => { setEditItem(null); setFormName(''); setDialogOpen(true); }}>
              <Plus className="ic sm" /> Add Order Booker
            </button>
          </>
        }
      />

      <div className="filters card">
        <div className="f-search">
          <Search className="ic sm" />
          <input placeholder="Search order booker…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="spacer" />
      </div>

      {loading ? <LoadingCard /> : filtered.length === 0 ? (
        <div className="card"><div className="empty-state" style={{ minHeight: 200 }}>
          <UserCheck className="ic" />
          <p className="small">Koi order booker nahi mila</p>
        </div></div>
      ) : (
        <div className="ob-grid">
          {filtered.map((item, index) => {
            const stats = obStats.get(item.id) || { count: 0, total: 0 };
            const hasLogin = obWithLogin.has(item.id);
            const comps = companiesFor(item.id);
            const shopCount = item._count?.shopCompanyOrderBookers || 0;
            return (
              <div className="ob-card" key={item.id} style={!hasLogin ? { borderColor: 'color-mix(in srgb, var(--af-bad) 35%, var(--af-border))' } : undefined}>
                <div className="ob-top">
                  <div className="av" style={{ width: 46, height: 46, fontSize: 15, background: CO_GRADIENTS[index % CO_GRADIENTS.length] }}>{initials(item.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--af-text)' }}>{item.name}</div>
                    <span className={`bdg ${hasLogin ? 'ob' : 'rejected'}`} style={{ marginTop: 4 }}>
                      {hasLogin ? 'Login active' : 'No login'}
                    </span>
                  </div>
                  <div className="row-actions">
                    <button className="ra" title="Edit" onClick={() => { setEditItem(item); setFormName(item.name); setDialogOpen(true); }}><Edit2 className="ic sm" /></button>
                    <button className="ra danger" title="Delete" onClick={() => handleDelete(item.id)}><Trash2 className="ic sm" /></button>
                  </div>
                </div>
                <div className="chips">
                  {comps.length > 0
                    ? comps.map((c, i) => <span className={`chip ${chipCls[i % 3]}`} key={c.id}>{c.name}</span>)
                    : <span className="small muted">No company assigned</span>}
                </div>
                <div className="ob-stats">
                  <div className="ob-stat"><b>{stats.count}</b><span>CLAIMS</span></div>
                  <div className="ob-stat"><b>{stats.total.toLocaleString()}</b><span>TOTAL (Rs)</span></div>
                  <div className="ob-stat"><b>{shopCount}</b><span>SHOPS</span></div>
                </div>
                {!hasLogin && (
                  <button className="btn btn-o btn-sm btn-block" onClick={() => onNavigate?.('users')}>
                    <Key className="ic sm" /> Create Login
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="af-dialog sm:max-w-[400px]">
          <div className="dlg-h">
            <DialogTitle className="dlg-t">{editItem ? 'Edit' : 'Add'} Order Booker</DialogTitle>
          </div>
          <div className="dlg-b">
            <div className="field">
              <label className="label">Order Booker Name <span className="req">*</span></label>
              <input className="input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Order Booker name" autoFocus />
            </div>
          </div>
          <div className="dlg-f">
            <button className="btn btn-g" onClick={() => setDialogOpen(false)}>Cancel</button>
            <button className="btn btn-p" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="ic sm animate-spin" /> : <Check className="ic sm" />} Save Order Booker
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
