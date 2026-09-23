'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, Search, RefreshCw, BadgeCheck, Store, UserCheck,
  Banknote, CalendarDays, ChevronLeft, ChevronRight, Smartphone, Monitor,
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

export function ClearedToday({ user }: ClearedTodayProps) {
  const isAdmin = user.role === 'admin';
  const [date, setDate] = useState<string>(todayPKT());
  const [filterOrderBooker, setFilterOrderBooker] = useState<string>('all');
  const [orderBookers, setOrderBookers] = useState<Array<{ id: string; name: string }>>([]);
  const [search, setSearch] = useState('');
  const [data, setData] = useState<ClearedResponse | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <>
      <div className="page-head">
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
        </div>
      </div>

      {/* Mini stats */}
      <div className="mini-stats">
        <div className="mstat"><BadgeCheck className="ic sm" /><b>{summary?.count ?? 0}</b> claims cleared</div>
        <div className="mstat"><Banknote className="ic sm" /><b>{formatAmount(summary?.totalNet ?? 0)}</b> total cleared</div>
        <div className="mstat"><UserCheck className="ic sm" /><b>{summary?.byOrderBooker.length ?? 0}</b> order bookers</div>
        <div className="mstat"><Store className="ic sm" /><b>{new Set((data?.claims ?? []).map(c => c.shopId)).size}</b> shops</div>
      </div>

      {/* Filters */}
      <div className="filters card">
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
        <div className="card" style={{ marginBottom: 14 }}>
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

      {/* Cleared claims list */}
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
    </>
  );
}
