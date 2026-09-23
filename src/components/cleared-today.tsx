'use client';

import { Fragment, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Loader2, Search, RefreshCw, BadgeCheck, Store, UserCheck,
  Banknote, CalendarDays, ChevronLeft, ChevronRight, Smartphone, Monitor, Printer,
} from 'lucide-react';

interface ClearedTodayProps {
  user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
}

interface ClearedClaim {
  id: string;
  claimNumber: string;
  date: string;
  companyId: string;
  shopId: string;
  orderBookerId: string | null;
  totalAmount: number;
  deductionAmount: number;
  netAmount: number;
  approvedAmount: number | null;
  status: string;
  clearedBy: string | null;
  clearedDate: string | null;
  createdAt: string;
  company: { id: string; name: string };
  shop: { id: string; name: string; address: string };
  supplier: { id: string; name: string };
  orderBooker: { id: string; name: string } | null;
  claimItems: Array<{ id: string }>;
}

interface ByOrderBooker {
  id: string | null;
  name: string;
  count: number;
  amount: number;
}

interface ClearedResponse {
  date: string;
  summary: {
    count: number;
    totalNet: number;
    byOrderBooker: ByOrderBooker[];
  };
  claims: ClearedClaim[];
}

/** Today's date in Pakistan (UTC+5) as YYYY-MM-DD — matches the API's day window. */
function todayPKT(): string {
  return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function formatAmount(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString('en-US')}`;
}

function formatTimePKT(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatDatePKT(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      timeZone: 'Asia/Karachi',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '—';
  }
}

/** Heuristic: clearedBy matches the order booker's own name → cleared from the mobile app. */
function clearedVia(claim: ClearedClaim): 'app' | 'dashboard' | 'unknown' {
  if (!claim.clearedBy) return 'unknown';
  if (claim.orderBooker && claim.clearedBy.trim().toLowerCase() === claim.orderBooker.name.trim().toLowerCase()) {
    return 'app';
  }
  return 'dashboard';
}

interface AppSettings {
  companyName: string;
  address: string;
  city: string;
  phone: string;
}

/** Cleared amount used consistently on screen cards and in the print report. */
function clearedAmount(claim: ClearedClaim): number {
  return claim.approvedAmount ?? claim.netAmount ?? claim.totalAmount;
}

export function ClearedToday({ user }: ClearedTodayProps) {
  const isAdmin = user.role === 'admin';
  const [date, setDate] = useState<string>(todayPKT());
  const [filterOrderBooker, setFilterOrderBooker] = useState<string>('all');
  const [orderBookers, setOrderBookers] = useState<Array<{ id: string; name: string }>>([]);
  const [search, setSearch] = useState('');
  const [data, setData] = useState<ClearedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<AppSettings | null>(null);

  // Company profile (print header) — available to any logged-in user
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok && !cancelled) setCompany(await res.json());
      } catch { /* silent — fallback header used */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Order booker list for the admin filter dropdown
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/order-bookers');
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && !cancelled) setOrderBookers(list);
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [isAdmin]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('date', date);
      if (isAdmin && filterOrderBooker !== 'all') params.set('orderBookerId', filterOrderBooker);
      const res = await fetch(`/api/claims/cleared?${params.toString()}`);
      if (res.ok) {
        const json: ClearedResponse = await res.json();
        setData(json);
      } else {
        setData({ date, summary: { count: 0, totalNet: 0, byOrderBooker: [] }, claims: [] });
      }
    } catch (error) {
      console.error('Failed to load cleared claims:', error);
    } finally {
      setLoading(false);
    }
  }, [date, filterOrderBooker, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const claims = (data?.claims ?? []).filter((c) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      c.claimNumber.toLowerCase().includes(q) ||
      c.shop?.name?.toLowerCase().includes(q) ||
      c.orderBooker?.name?.toLowerCase().includes(q) ||
      (c.clearedBy ?? '').toLowerCase().includes(q)
    );
  });

  const summary = data?.summary;
  const isToday = date === todayPKT();
  const dayLabel = isToday
    ? 'Today'
    : date === shiftDay(todayPKT(), -1)
      ? 'Yesterday'
      : new Date(`${date}T12:00:00.000Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // ─── Print report data (matches the on-screen filtered claims) ───
  const printGroups = useMemo(() => {
    const map = new Map<string, { id: string | null; name: string; claims: ClearedClaim[]; total: number }>();
    for (const c of claims) {
      const key = c.orderBookerId ?? '__none__';
      if (!map.has(key)) {
        map.set(key, { id: c.orderBookerId, name: c.orderBooker?.name ?? 'Unassigned', claims: [], total: 0 });
      }
      const g = map.get(key)!;
      g.claims.push(c);
      g.total += clearedAmount(c);
    }
    return [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [claims]);

  const printTotal = useMemo(() => claims.reduce((sum, c) => sum + clearedAmount(c), 0), [claims]);
  const printShops = useMemo(() => new Set(claims.map(c => c.shopId)).size, [claims]);
  const canPrint = !loading && claims.length > 0;
  const handlePrint = () => window.print();

  const fullDate = new Date(`${date}T12:00:00.000Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const dateTag = isToday ? ' (Today)' : date === shiftDay(todayPKT(), -1) ? ' (Yesterday)' : '';
  const selectedOBName = isAdmin && filterOrderBooker !== 'all'
    ? orderBookers.find(o => o.id === filterOrderBooker)?.name
    : null;

  return (
    <div className="print-area">
      <div className="page-head no-print">
        <div>
          <div className="h1">Cleared Today</div>
          <div className="sub">
            {dayLabel} ke clear kiye gaye claims — kis order booker ne kis shop ka claim clear kiya
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-o" onClick={() => setDate((d) => shiftDay(d, -1))} title="Previous day">
            <ChevronLeft className="ic sm" />
          </button>
          <input
            type="date"
            className="af-inp"
            style={{ width: 150 }}
            value={date}
            max={todayPKT()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <button className="btn btn-o" onClick={() => setDate(todayPKT())} disabled={isToday}>
            <CalendarDays className="ic sm" /> Today
          </button>
          <button className="btn btn-o" onClick={() => setDate((d) => shiftDay(d, 1))} disabled={isToday} title="Next day">
            <ChevronRight className="ic sm" />
          </button>
          <button className="btn btn-o" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="ic sm animate-spin" /> : <RefreshCw className="ic sm" />} Refresh
          </button>
          <button className="btn" onClick={handlePrint} disabled={!canPrint} title="Print cleared claims report">
            <Printer className="ic sm" /> Print
          </button>
        </div>
      </div>

      {/* Mini stats */}
      <div className="mini-stats no-print">
        <div className="mstat"><BadgeCheck className="ic sm" /><b>{summary?.count ?? 0}</b> claims cleared</div>
        <div className="mstat"><Banknote className="ic sm" /><b>{formatAmount(summary?.totalNet ?? 0)}</b> total cleared</div>
        <div className="mstat"><UserCheck className="ic sm" /><b>{summary?.byOrderBooker.length ?? 0}</b> order bookers</div>
        <div className="mstat"><Store className="ic sm" /><b>{new Set((data?.claims ?? []).map(c => c.shopId)).size}</b> shops</div>
      </div>

      {/* Filters */}
      <div className="filters card no-print">
        <div className="f-search">
          <Search className="ic sm" />
          <input
            placeholder="Search claim #, shop, order booker…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {isAdmin && (
          <select className="sel" value={filterOrderBooker} onChange={(e) => setFilterOrderBooker(e.target.value)}>
            <option value="all">All Order Bookers</option>
            {orderBookers.map(ob => <option key={ob.id} value={ob.id}>{ob.name}</option>)}
          </select>
        )}
        <div className="spacer" />
      </div>

      {/* Per order booker breakdown */}
      {summary && summary.byOrderBooker.length > 0 && (
        <div className="card no-print" style={{ marginBottom: 14 }}>
          <div className="card-h">
            <div className="card-t">By Order Booker</div>
          </div>
          <div className="card-b" style={{ display: 'grid', gap: 9 }}>
            {summary.byOrderBooker.map(ob => (
              <div key={ob.id ?? 'none'} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div className="av" style={{ width: 32, height: 32, fontSize: 12 }}>
                  {ob.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{ob.name}</div>
                  <div className="small muted">{ob.count} claim{ob.count === 1 ? '' : 's'} cleared</div>
                </div>
                <div className="chip"><Banknote className="ic" /> {formatAmount(ob.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cleared claims list (screen cards — print uses the report table below) */}
      <div className="no-print">
      {loading && claims.length === 0 ? (
        <div className="empty-state" style={{ minHeight: 320 }}>
          <Loader2 className="ic animate-spin" />
          <p className="small">Loading cleared claims…</p>
        </div>
      ) : claims.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ minHeight: 240 }}>
            <BadgeCheck className="ic" />
            <p style={{ color: 'var(--af-text)', fontWeight: 600 }}>No claims cleared on {dayLabel}</p>
            <p className="small">
              Jab order booker app se claim clear karega ya aap dashboard se clear karenge, wo yahan aa jayega.
            </p>
          </div>
        </div>
      ) : (
        claims.map((claim) => {
          const via = clearedVia(claim);
          return (
            <div className="claim-card" key={claim.id}>
              <div className="cc-h">
                <span style={{ fontWeight: 800, color: 'var(--af-primary)', fontSize: 14.5 }}>{claim.claimNumber}</span>
                <span className="bdg cleared">Cleared</span>
                <span className="chip" style={{ marginLeft: 'auto' }}>
                  {via === 'app' ? <Smartphone className="ic" /> : <Monitor className="ic" />}
                  {formatTimePKT(claim.clearedDate)} PKT
                </span>
              </div>

              <div className="cc-b">
                <div className="cc-grid">
                  <div className="cc-cell"><div className="k">Shop</div><div className="v">{claim.shop?.name ?? '—'}</div></div>
                  <div className="cc-cell"><div className="k">Company</div><div className="v">{claim.company?.name ?? '—'}</div></div>
                  <div className="cc-cell"><div className="k">Order Booker</div><div className="v">{claim.orderBooker?.name ?? '—'}</div></div>
                  <div className="cc-cell"><div className="k">Cleared By</div><div className="v">{claim.clearedBy ?? '—'}</div></div>
                  <div className="cc-cell"><div className="k">Claim Date</div><div className="v">{formatDatePKT(claim.date)}</div></div>
                  <div className="cc-cell">
                    <div className="k">Cleared Amount</div>
                    <div className="v" style={{ color: 'var(--af-ok)' }}>{formatAmount(claim.approvedAmount ?? claim.netAmount ?? claim.totalAmount)}</div>
                  </div>
                </div>

                <div className="small muted" style={{ background: 'var(--af-surface2)', borderRadius: 9, padding: '9px 12px' }}>
                  📦 {claim.claimItems.length} items · Net {formatAmount(claim.netAmount)}
                  {claim.deductionAmount > 0 ? ` · Deduction ${formatAmount(claim.deductionAmount)}` : ''}
                </div>
              </div>
            </div>
          );
        })
      )}
      </div>

      {/* ═══════════ PRINT-ONLY: professional daily cleared report ═══════════ */}
      {canPrint && (
        <>
          {/* Company header */}
          <div className="hidden print-block">
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1.2, textAlign: 'center', color: '#1e1b4b' }}>
              {(company?.companyName || 'Al-Falah Traders').toUpperCase()}
            </div>
            {(company?.address || company?.city || company?.phone) ? (
              <div style={{ fontSize: 10.5, textAlign: 'center', color: '#374151', marginTop: 2 }}>
                {[company?.address, company?.city].filter(Boolean).join(', ')}{company?.phone ? ` · ${company.phone}` : ''}
              </div>
            ) : null}
            <div style={{ fontSize: 15, fontWeight: 800, textAlign: 'center', marginTop: 8, color: '#111827' }}>
              Cleared Claims Report
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', marginTop: 2, color: '#1f2937' }}>
              {fullDate}{dateTag}
            </div>
            <div style={{ fontSize: 9.5, textAlign: 'center', color: '#4b5563', marginTop: 3 }}>
              Order Booker: {selectedOBName ?? 'All'} · Printed by: {user.name} · Generated: {
                new Date().toLocaleString('en-GB', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              } PKT
            </div>
            <div style={{ borderTop: '2.5px solid #1e1b4b', marginTop: 7 }} />
          </div>

          {/* Summary line */}
          <div className="hidden print-block print-summary" style={{ marginTop: 5 }}>
            <span className="print-summary-item"><span className="print-summary-label">Claims Cleared:</span> <span className="print-summary-value">{claims.length}</span></span>
            <span className="print-summary-item"><span className="print-summary-label">Total Cleared:</span> <span className="print-summary-value">{formatAmount(printTotal)}</span></span>
            <span className="print-summary-item"><span className="print-summary-label">Order Bookers:</span> <span className="print-summary-value">{printGroups.length}</span></span>
            <span className="print-summary-item"><span className="print-summary-label">Shops:</span> <span className="print-summary-value">{printShops}</span></span>
          </div>

          {/* Grouped table */}
          <div className="hidden print-block" style={{ marginTop: 6 }}>
            <table className="print-table cleared-tbl">
              <thead>
                <tr>
                  <th style={{ width: 24 }}>#</th>
                  <th>Claim #</th>
                  <th>Shop</th>
                  <th>Company</th>
                  <th style={{ width: 62 }}>Claim Date</th>
                  <th style={{ width: 36 }}>Items</th>
                  <th>Cleared By</th>
                  <th style={{ width: 46 }}>Time</th>
                  <th style={{ width: 62 }}>Via</th>
                  <th style={{ width: 82, textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {printGroups.map(g => (
                  <Fragment key={g.id ?? 'none'}>
                    <tr className="grp">
                      <td colSpan={10}>
                        {g.name.toUpperCase()} — {g.claims.length} claim{g.claims.length === 1 ? '' : 's'} · {formatAmount(g.total)}
                      </td>
                    </tr>
                    {g.claims.map((c, i) => {
                      const via = clearedVia(c);
                      return (
                        <tr key={c.id}>
                          <td style={{ textAlign: 'center' }}>{i + 1}</td>
                          <td style={{ fontWeight: 700 }}>{c.claimNumber}</td>
                          <td>{c.shop?.name ?? '—'}</td>
                          <td>{c.company?.name ?? '—'}</td>
                          <td>{formatDatePKT(c.date)}</td>
                          <td style={{ textAlign: 'center' }}>{c.claimItems.length}</td>
                          <td>{c.clearedBy ?? '—'}</td>
                          <td>{formatTimePKT(c.clearedDate)}</td>
                          <td>{via === 'app' ? 'App' : via === 'dashboard' ? 'Dashboard' : '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatAmount(clearedAmount(c))}</td>
                        </tr>
                      );
                    })}
                    <tr className="sub">
                      <td colSpan={9} style={{ textAlign: 'right' }}>Subtotal — {g.name}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(g.total)}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={9}>GRAND TOTAL — {claims.length} claim{claims.length === 1 ? '' : 's'} · {printGroups.length} order booker{printGroups.length === 1 ? '' : 's'}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(printTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Signature block */}
          <div className="hidden print-block">
            <div style={{ display: 'flex', gap: 48, marginTop: 34 }}>
              {['Prepared By', 'Verified By', 'Authorized Signature'].map(role => (
                <div key={role} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ borderTop: '1px dotted #555', paddingTop: 4, fontSize: 10, fontWeight: 700, color: '#111827' }}>{role}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
