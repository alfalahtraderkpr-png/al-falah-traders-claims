'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Trash2, RotateCcw, FileText, Package, Truck, Store, Building2, UserCheck,
  RotateCw, AlertTriangle, XCircle, Clock, CheckCircle2,
} from 'lucide-react';

interface TrashedClaim {
  id: string;
  claimNumber: string;
  date: string;
  totalAmount: number;
  netAmount: number;
  status: string;
  deletedAt: string;
  deletedBy: string | null;
  company: { name: string };
  shop: { name: string };
  supplier: { name: string };
  orderBooker: { name: string } | null;
}

interface TrashedProduct {
  id: string;
  name: string;
  price: number;
  claimPrice: number;
  unit: string;
  deletedAt: string;
  company: { name: string };
}

interface TrashedSupplier {
  id: string;
  name: string;
  deletedAt: string;
  company: { name: string } | null;
}

interface TrashedShop {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  deletedAt: string;
  companyOrderBookers: Array<{ company: { name: string } }>;
}

interface TrashedCompany {
  id: string;
  name: string;
  claimDeductionPercent: number;
  deletedAt: string;
}

interface TrashedOrderBooker {
  id: string;
  name: string;
  deletedAt: string;
}

interface TrashData {
  claims: TrashedClaim[];
  products: TrashedProduct[];
  suppliers: TrashedSupplier[];
  shops: TrashedShop[];
  companies: TrashedCompany[];
  orderBookers: TrashedOrderBooker[];
}

const statusBdg: Record<string, string> = {
  pending: 'pending',
  approved: 'arrived',
  arrived_approved: 'arrived',
  partial: 'partial',
  partially_approved: 'partial',
  partially_cleared: 'partial',
  cleared: 'cleared',
  rejected: 'rejected',
};

const statusLbl: Record<string, string> = {
  pending: 'Pending',
  approved: 'Arrived',
  arrived_approved: 'Arrived',
  partial: 'Partial',
  partially_approved: 'Partial',
  partially_cleared: 'Partial',
  cleared: 'Cleared',
  rejected: 'Rejected',
};

export function TrashManager() {
  const [data, setData] = useState<TrashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'bad'; text: string } | null>(null);
  const [confirmPurgeAll, setConfirmPurgeAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/trash', { cache: 'no-store' });
      if (res.ok) {
        setData(await res.json());
      } else {
        const j = await res.json().catch(() => ({}));
        setMessage({ type: 'bad', text: j.error || 'Trash load failed' });
      }
    } catch {
      setMessage({ type: 'bad', text: 'Network error — could not load trash' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const daysLeft = (deletedAt: string) =>
    Math.max(0, 30 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / (24 * 60 * 60 * 1000)));

  const fmt = (n: number) => `Rs ${n.toLocaleString()}`;

  const handleAction = async (action: string, type?: string, id?: string) => {
    setBusy(id || action);
    setMessage(null);
    try {
      const res = await fetch('/api/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, type, id }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        if (action === 'restore') setMessage({ type: 'ok', text: `${type} wapis restore ho gaya ✓` });
        else if (action === 'purge') setMessage({ type: 'ok', text: 'Record permanently delete ho gaya' });
        else setMessage({ type: 'ok', text: 'Trash khali kar di gayi' });
        await load();
      } else {
        setMessage({ type: 'bad', text: j.error || 'Action failed' });
      }
    } catch {
      setMessage({ type: 'bad', text: 'Network error' });
    } finally {
      setBusy(null);
      setConfirmPurgeAll(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state" style={{ minHeight: 320 }}>
        <RotateCw className="ic animate-spin" />
        <p className="small">Loading trash…</p>
      </div>
    );
  }

  const d = data || { claims: [], products: [], suppliers: [], shops: [], companies: [], orderBookers: [] };
  const totalCount =
    d.claims.length + d.products.length + d.suppliers.length + d.shops.length + d.companies.length + d.orderBookers.length;

  const kpis = [
    { lbl: 'Total in Trash', val: totalCount, icon: Trash2, style: undefined as React.CSSProperties | undefined },
    { lbl: 'Claims', val: d.claims.length, icon: FileText, style: { '--kb': 'var(--af-warn-soft)', '--kc2': 'var(--af-warn)' } as React.CSSProperties },
    { lbl: 'Master Data', val: d.products.length + d.suppliers.length + d.shops.length + d.companies.length + d.orderBookers.length, icon: Building2, style: { '--kb': 'var(--af-violet-soft)', '--kc2': 'var(--af-violet)' } as React.CSSProperties },
    {
      lbl: 'Purani Claims (Claim)',
      val: d.claims.filter((c) => daysLeft(c.deletedAt) === 0).length,
      icon: Clock,
      style: { '--kb': 'var(--af-bad-soft)', '--kc2': 'var(--af-bad)' } as React.CSSProperties,
    },
  ];

  const renderRow = (
    key: string,
    title: React.ReactNode,
    sub: React.ReactNode,
    right: React.ReactNode,
    deletedAt: string,
    type: string,
    id: string,
  ) => (
    <tr key={key}>
      <td>
        <div className="strong">{title}</div>
        <div className="small muted">{sub}</div>
      </td>
      <td>{right}</td>
      <td className="small muted" style={{ whiteSpace: 'nowrap' }}>
        <Clock className="ic" style={{ width: 13, height: 13, verticalAlign: -2, marginRight: 4, display: 'inline' }} />
        {daysLeft(deletedAt) === 0 ? 'Auto-delete soon' : `${daysLeft(deletedAt)} din baqi`}
      </td>
      <td>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button
            className="ra violet"
            title="Restore"
            disabled={busy === id}
            onClick={() => handleAction('restore', type, id)}
          >
            <RotateCcw className="ic sm" />
          </button>
          <button
            className="ra danger"
            title="Delete Permanently"
            disabled={busy === id}
            onClick={() => {
              if (confirm('Ye record HAMESHA ke liye delete ho jayega. Pakka?')) {
                handleAction('purge', type, id);
              }
            }}
          >
            <XCircle className="ic sm" />
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <div className="h1">Trash 🗑️</div>
          <div className="sub">Delete huye records 30 din tak yahan recover ho sakte hain — uske baad permanently remove ho jate hain</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-o" onClick={load} disabled={busy !== null}>
            <RotateCw className="ic sm" /> Refresh
          </button>
          {totalCount > 0 && (
            <button
              className="btn btn-d"
              onClick={() => setConfirmPurgeAll(true)}
              disabled={busy !== null}
            >
              <Trash2 className="ic sm" /> Empty Trash
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`note ${message.type === 'bad' ? 'bad-note' : ''}`}>
          {message.type === 'ok'
            ? <CheckCircle2 className="ic" style={{ color: 'var(--af-ok)' }} />
            : <AlertTriangle className="ic" style={{ color: 'var(--af-bad)' }} />}
          <div>{message.text}</div>
        </div>
      )}

      {confirmPurgeAll && (
        <div className="card" style={{ borderColor: 'var(--af-bad)' }}>
          <div className="card-b">
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <AlertTriangle className="ic" style={{ color: 'var(--af-bad)' }} />
              <div>
                <div className="strong">Poori Trash khali karein?</div>
                <div className="small muted">
                  Trash wale sab records permanently delete ho jayen ge (30 din ka intezar nahi hoga).
                  Claims mein use hone wale records safety ki wajah se bachaye jayen ge.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-d" onClick={() => handleAction('purge_all')} disabled={busy !== null}>
                {busy === 'purge_all' ? <RotateCw className="ic sm animate-spin" /> : <Trash2 className="ic sm" />}
                Haan, khali kar do
              </button>
              <button className="btn btn-o" onClick={() => setConfirmPurgeAll(false)} disabled={busy !== null}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="kpis">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div className="kpi" key={k.lbl} style={k.style}>
              <div className="kpi-top">
                <div className="kpi-ic"><Icon className="ic" /></div>
              </div>
              <div>
                <div className="kpi-lbl">{k.lbl}</div>
                <div className="kpi-val">{k.val}</div>
              </div>
            </div>
          );
        })}
      </div>

      {totalCount === 0 ? (
        <div className="card">
          <div className="card-b empty-state">
            <CheckCircle2 className="ic lg" style={{ color: 'var(--af-ok)' }} />
            <div className="strong">Trash bilkul khali hai</div>
            <p className="small muted">Jab bhi koi claim ya record delete hoga, wo yahan 30 din tak mehfooz rahega</p>
          </div>
        </div>
      ) : (
        <>
          {/* Deleted Claims */}
          {d.claims.length > 0 && (
            <div className="card">
              <div className="card-h">
                <div className="card-t"><FileText className="ic sm" /> Deleted Claims ({d.claims.length})</div>
              </div>
              <div className="tbl-wrap card-b tight">
                <table className="tbl" style={{ minWidth: 720 }}>
                  <thead>
                    <tr><th>Claim</th><th>Amount / Status</th><th>Auto-Delete</th><th></th></tr>
                  </thead>
                  <tbody>
                    {d.claims.map((c) =>
                      renderRow(
                        c.id,
                        <>{c.claimNumber} <span className="muted">· {c.shop.name} → {c.company.name}</span></>,
                        `Delete: ${new Date(c.deletedAt).toLocaleDateString()}${c.deletedBy ? ` · By ${c.deletedBy}` : ''}`,
                        <>
                          <div className="strong">{fmt(c.netAmount || c.totalAmount)}</div>
                          <span className={`bdg ${statusBdg[c.status] || 'neutral'}`}>{statusLbl[c.status] || c.status}</span>
                        </>,
                        c.deletedAt,
                        'claim',
                        c.id,
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Deleted Products */}
          {d.products.length > 0 && (
            <div className="card">
              <div className="card-h">
                <div className="card-t"><Package className="ic sm" /> Deleted Products ({d.products.length})</div>
              </div>
              <div className="tbl-wrap card-b tight">
                <table className="tbl" style={{ minWidth: 640 }}>
                  <thead>
                    <tr><th>Product</th><th>Price</th><th>Auto-Delete</th><th></th></tr>
                  </thead>
                  <tbody>
                    {d.products.map((p) =>
                      renderRow(
                        p.id,
                        <>{p.name} <span className="muted">· {p.company.name}</span></>,
                        `Delete: ${new Date(p.deletedAt).toLocaleDateString()}`,
                        <>{fmt(p.claimPrice || p.price)} <span className="muted">/ {p.unit}</span></>,
                        p.deletedAt,
                        'product',
                        p.id,
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Deleted Shops */}
          {d.shops.length > 0 && (
            <div className="card">
              <div className="card-h">
                <div className="card-t"><Store className="ic sm" /> Deleted Shops ({d.shops.length})</div>
              </div>
              <div className="tbl-wrap card-b tight">
                <table className="tbl" style={{ minWidth: 640 }}>
                  <thead>
                    <tr><th>Shop</th><th>Companies</th><th>Auto-Delete</th><th></th></tr>
                  </thead>
                  <tbody>
                    {d.shops.map((s) =>
                      renderRow(
                        s.id,
                        <>{s.name} {s.phone ? <span className="muted">· {s.phone}</span> : null}</>,
                        `Delete: ${new Date(s.deletedAt).toLocaleDateString()}`,
                        <span className="muted">{s.companyOrderBookers.map((m) => m.company.name).join(', ') || '—'}</span>,
                        s.deletedAt,
                        'shop',
                        s.id,
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Deleted Companies */}
          {d.companies.length > 0 && (
            <div className="card">
              <div className="card-h">
                <div className="card-t"><Building2 className="ic sm" /> Deleted Companies ({d.companies.length})</div>
              </div>
              <div className="tbl-wrap card-b tight">
                <table className="tbl" style={{ minWidth: 640 }}>
                  <thead>
                    <tr><th>Company</th><th>Deduction %</th><th>Auto-Delete</th><th></th></tr>
                  </thead>
                  <tbody>
                    {d.companies.map((c) =>
                      renderRow(
                        c.id,
                        c.name,
                        `Delete: ${new Date(c.deletedAt).toLocaleDateString()}`,
                        <span className="muted">{c.claimDeductionPercent}%</span>,
                        c.deletedAt,
                        'company',
                        c.id,
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Deleted Suppliers */}
          {d.suppliers.length > 0 && (
            <div className="card">
              <div className="card-h">
                <div className="card-t"><Truck className="ic sm" /> Deleted Suppliers ({d.suppliers.length})</div>
              </div>
              <div className="tbl-wrap card-b tight">
                <table className="tbl" style={{ minWidth: 640 }}>
                  <thead>
                    <tr><th>Supplier</th><th>Company</th><th>Auto-Delete</th><th></th></tr>
                  </thead>
                  <tbody>
                    {d.suppliers.map((s) =>
                      renderRow(
                        s.id,
                        s.name,
                        `Delete: ${new Date(s.deletedAt).toLocaleDateString()}`,
                        <span className="muted">{s.company?.name || '—'}</span>,
                        s.deletedAt,
                        'supplier',
                        s.id,
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Deleted Order Bookers */}
          {d.orderBookers.length > 0 && (
            <div className="card">
              <div className="card-h">
                <div className="card-t"><UserCheck className="ic sm" /> Deleted Order Bookers ({d.orderBookers.length})</div>
              </div>
              <div className="tbl-wrap card-b tight">
                <table className="tbl" style={{ minWidth: 640 }}>
                  <thead>
                    <tr><th>Order Booker</th><th></th><th>Auto-Delete</th><th></th></tr>
                  </thead>
                  <tbody>
                    {d.orderBookers.map((o) =>
                      renderRow(
                        o.id,
                        o.name,
                        `Delete: ${new Date(o.deletedAt).toLocaleDateString()}`,
                        <span className="muted">—</span>,
                        o.deletedAt,
                        'orderBooker',
                        o.id,
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
