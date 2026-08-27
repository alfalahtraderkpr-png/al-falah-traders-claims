'use client';

import { useEffect, useState } from 'react';
import {
  FileText,
  AlertTriangle,
  Truck,
  BadgeCheck,
  XCircle,
  Split,
  TrendingUp,
  RefreshCw,
  Plus,
  RotateCw,
  Clock,
  Users,
  Building2,
  ChevronRight,
  Store,
} from 'lucide-react';

interface DashboardProps {
  user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
  onNavigate?: (section: string) => void;
  onNewClaim?: () => void;
}

interface DashboardData {
  totalClaims: number;
  pendingClaims: { count: number; totalAmount: number };
  approvedClaims: { count: number; totalAmount: number; approvedAmount: number };
  partiallyClearedClaims: { count: number; totalAmount: number; approvedAmount: number };
  clearedClaims: { count: number; totalAmount: number; approvedAmount: number };
  rejectedClaims: { count: number; totalAmount: number };
  recentClaims: Array<{
    id: string;
    claimNumber: string;
    date: string;
    totalAmount: number;
    netAmount: number;
    approvedAmount: number | null;
    status: string;
    company: { name: string };
    shop: { name: string };
    supplier: { name: string };
    orderBooker: { name: string } | null;
  }>;
  topOutstandingShops: Array<{
    shopId: string;
    shopName: string;
    companyName: string;
    totalPendingAmount: number;
    pendingClaimCount: number;
  }>;
  oldStuckClaims?: Array<{
    id: string;
    claimNumber: string;
    date: string;
    totalAmount: number;
    netAmount: number;
    status: string;
    company: string;
    shop: string;
    daysOld: number;
  }>;
}

interface ClaimLite {
  id: string;
  claimNumber: string;
  date: string;
  totalAmount: number;
  status: string;
  companyId: string;
  orderBookerId: string | null;
  company: { id: string; name: string };
  orderBooker: { id: string; name: string } | null;
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

const DONUT_COLORS = ['#4f46e5', '#8b5cf6', '#14b8a6', '#0369a1', '#b45309', '#e11d48'];
const chipClass = (i: number) => (i % 3 === 0 ? 'c1' : i % 3 === 1 ? 'c2' : 'c3');

export function Dashboard({ user, onNavigate, onNewClaim }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [claims, setClaims] = useState<ClaimLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcResult, setRecalcResult] = useState<string | null>(null);

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    try {
      const params = new URLSearchParams();
      if (!isAdmin && user.orderBookerId) {
        params.set('orderBookerId', user.orderBookerId);
      }
      const [dashRes, claimsRes] = await Promise.all([
        fetch(`/api/dashboard?${params}`),
        fetch('/api/claims'),
      ]);
      if (dashRes.ok) {
        const result = await dashRes.json();
        if (result && typeof result === 'object' && result.totalClaims !== undefined) {
          setData(result);
        }
      }
      if (claimsRes.ok) {
        const arr = await claimsRes.json();
        if (Array.isArray(arr)) setClaims(arr);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    if (!confirm('Sab existing claims ki amounts recalculate karein? (Claim Rate x Quantity)')) return;
    setRecalculating(true);
    setRecalcResult(null);
    try {
      const res = await fetch('/api/claims/recalculate', { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        setRecalcResult(`${result.updatedClaims} claims update hue (total ${result.totalClaims} claims check kiye)`);
        loadDashboard();
      } else {
        setRecalcResult('Recalculate mein error aaya!');
      }
    } catch {
      setRecalcResult('Network error!');
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state" style={{ minHeight: 320 }}>
        <RotateCw className="ic animate-spin" />
        <p className="small">Loading dashboard…</p>
      </div>
    );
  }

  if (!data) return null;

  const formatAmount = (amount: number) => `Rs ${amount.toLocaleString()}`;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  // ── Charts data (computed client-side from claims) ─────────────
  // Monthly trend — last 6 months
  const monthLabels: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthLabels.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-GB', { month: 'short' }),
    });
  }
  const monthCounts = monthLabels.map((m) => ({
    ...m,
    count: claims.filter((c) => c.date?.slice(0, 7) === m.key).length,
  }));
  const maxMonth = Math.max(1, ...monthCounts.map((m) => m.count));
  const thisMonthCount = monthCounts[monthCounts.length - 1]?.count || 0;
  const lastMonthCount = monthCounts[monthCounts.length - 2]?.count || 0;
  const claimsDelta = lastMonthCount > 0
    ? `${thisMonthCount >= lastMonthCount ? '+' : ''}${Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100)}%`
    : thisMonthCount > 0 ? 'new' : '0%';

  // Claims by company (donut)
  const byCompanyMap = new Map<string, { name: string; count: number }>();
  for (const c of claims) {
    const entry = byCompanyMap.get(c.companyId) || { name: c.company.name, count: 0 };
    entry.count += 1;
    byCompanyMap.set(c.companyId, entry);
  }
  const byCompany = Array.from(byCompanyMap.values()).sort((a, b) => b.count - a.count).slice(0, 6);
  const totalForDonut = byCompany.reduce((s, c) => s + c.count, 0);

  // Donut geometry — r=62, C≈390
  const R = 62;
  const C = 2 * Math.PI * R;
  let donutOffset = 0;

  // Top order bookers
  const obMap = new Map<string, { name: string; count: number; amount: number }>();
  for (const c of claims) {
    if (!c.orderBookerId || !c.orderBooker) continue;
    const entry = obMap.get(c.orderBookerId) || { name: c.orderBooker.name, count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += c.totalAmount;
    obMap.set(c.orderBookerId, entry);
  }
  const topOBs = Array.from(obMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  const maxOBCount = Math.max(1, ...topOBs.map((o) => o.count));

  const rejectionRate = data.totalClaims > 0
    ? ((data.rejectedClaims.count / data.totalClaims) * 100).toFixed(1)
    : '0.0';
  const clearedPct = data.totalClaims > 0
    ? Math.round((data.clearedClaims.count / data.totalClaims) * 100)
    : 0;

  const handleNewClaimClick = () => {
    if (onNewClaim) onNewClaim();
    else if (onNavigate) onNavigate('claims');
  };

  const kpis = [
    {
      lbl: 'Total Claims',
      val: data.totalClaims,
      sub: `${lastMonthCount} last month`,
      icon: FileText,
      delta: <span className={`delta ${thisMonthCount >= lastMonthCount ? 'up' : 'down'}`}><TrendingUp className="ic" />{claimsDelta}</span>,
    },
    {
      lbl: 'Stock Not Received',
      val: data.pendingClaims.count,
      sub: `${formatAmount(data.pendingClaims.totalAmount)} pending value`,
      icon: AlertTriangle,
      style: { '--kb': 'var(--af-warn-soft)', '--kc2': 'var(--af-warn)', '--kc': 'linear-gradient(90deg,#f59e0b,#f97316)' } as React.CSSProperties,
      delta: <span className="delta warn">{data.pendingClaims.count} waiting</span>,
    },
    {
      lbl: 'Arrived & Approved',
      val: data.approvedClaims.count,
      sub: `${formatAmount(data.approvedClaims.totalAmount)} at distribution`,
      icon: Truck,
      style: { '--kb': 'var(--af-teal-soft)', '--kc2': 'var(--af-teal)', '--kc': 'linear-gradient(90deg,#14b8a6,#0d9488)' } as React.CSSProperties,
      delta: <span className="delta up"><TrendingUp className="ic" />+{data.approvedClaims.count}</span>,
    },
    {
      lbl: 'Partially Cleared',
      val: data.partiallyClearedClaims.count,
      sub: `${formatAmount(data.partiallyClearedClaims.approvedAmount || 0)} deducted`,
      icon: Split,
      style: { '--kb': 'var(--af-violet-soft)', '--kc2': 'var(--af-violet)', '--kc': 'linear-gradient(90deg,#7c3aed,#8b5cf6)' } as React.CSSProperties,
    },
    {
      lbl: 'Cleared',
      val: data.clearedClaims.count,
      sub: `${formatAmount(data.clearedClaims.approvedAmount)} settled`,
      icon: BadgeCheck,
      style: { '--kb': 'var(--af-ok-soft)', '--kc2': 'var(--af-ok)', '--kc': 'linear-gradient(90deg,#10b981,#059669)' } as React.CSSProperties,
      delta: <span className="delta up"><TrendingUp className="ic" />{clearedPct}%</span>,
    },
    {
      lbl: 'Rejected',
      val: data.rejectedClaims.count,
      sub: `${rejectionRate}% rejection rate`,
      icon: XCircle,
      style: { '--kb': 'var(--af-bad-soft)', '--kc2': 'var(--af-bad)', '--kc': 'linear-gradient(90deg,#f43f5e,#e11d48)' } as React.CSSProperties,
      delta: <span className="delta down">{rejectionRate}%</span>,
    },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="h1">{greeting}, {user.name} 👋</div>
          <div className="sub">Here&apos;s what&apos;s happening with your claims today · {dateStr}</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-o" onClick={loadDashboard}>
            <RefreshCw className="ic sm" /> Refresh
          </button>
          {isAdmin && (
            <button className="btn btn-g" onClick={handleRecalculate} disabled={recalculating} title="Recalculate claim amounts (Claim Rate × Quantity)">
              {recalculating ? <RotateCw className="ic sm animate-spin" /> : <RotateCw className="ic sm" />}
              Recalculate
            </button>
          )}
          <button className="btn btn-p" onClick={handleNewClaimClick}>
            <Plus className="ic sm" /> New Claim
          </button>
        </div>
      </div>

      {recalcResult && (
        <div className="note">
          <AlertTriangle className="ic" />
          <div><b>Recalculate:</b> {recalcResult}</div>
        </div>
      )}

      {/* Old stuck claims alert (30+ days) */}
      {(data.oldStuckClaims || []).length > 0 && (
        <div className="card" style={{ borderColor: 'color-mix(in srgb, var(--af-bad) 45%, var(--af-border))', background: 'linear-gradient(135deg, var(--af-bad-soft), var(--af-surface) 55%)' }}>
          <div className="card-h">
            <div className="card-t">
              <AlertTriangle className="ic sm" style={{ color: 'var(--af-bad)' }} />
              Purani Claims — 30+ din se atki hui hain ({data.oldStuckClaims!.length})
            </div>
            <button className="btn btn-g btn-sm" onClick={() => onNavigate?.('claims')}>
              View Claims <ChevronRight className="ic sm" />
            </button>
          </div>
          <div className="tbl-wrap card-b tight">
            <table className="tbl" style={{ minWidth: 620 }}>
              <thead>
                <tr><th>Claim #</th><th>Shop</th><th>Company</th><th className="num">Amount</th><th>Kitne Din</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.oldStuckClaims!.slice(0, 5).map((c) => (
                  <tr key={c.id}>
                    <td className="strong claim-no">{c.claimNumber}</td>
                    <td>{c.shop}</td>
                    <td>{c.company}</td>
                    <td className="num strong">{formatAmount(c.netAmount || c.totalAmount)}</td>
                    <td><span className="bdg rejected">{c.daysOld} din</span></td>
                    <td><span className={`bdg ${statusBdg[c.status] || 'neutral'}`}>{statusLbl[c.status] || c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.oldStuckClaims!.length > 5 && (
              <div className="small muted" style={{ padding: '10px 14px', borderTop: '1px solid var(--af-border)' }}>
                Aur {data.oldStuckClaims!.length - 5} purani claims bhi pending hain — Claims page pr dekhen
              </div>
            )}
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
                {k.delta}
              </div>
              <div>
                <div className="kpi-lbl">{k.lbl}</div>
                <div className="kpi-val">{k.val}</div>
                <div className="kpi-sub">{k.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trend + Donut */}
      <div className="dash-grid">
        <div className="card">
          <div className="card-h">
            <div>
              <div className="card-t"><Clock className="ic sm" /> Claims Trend — Last 6 Months</div>
              <div className="card-sub">Number of claims submitted per month</div>
            </div>
            <span className="chip c1">This year</span>
          </div>
          <div className="card-b">
            <div className="bars">
              {monthCounts.map((m, i) => (
                <div className="bar-col" key={m.key}>
                  <div className="bar-val">{m.count}</div>
                  <div
                    className={`bar ${i < monthCounts.length - 2 ? 'dim' : ''}`}
                    style={{ ['--h' as string]: `${Math.max(4, (m.count / maxMonth) * 100)}%` }}
                  />
                  <div className="bar-lbl">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <div className="card-t"><Building2 className="ic sm" /> Claims by Company</div>
          </div>
          <div className="card-b">
            {byCompany.length === 0 ? (
              <div className="empty-state"><FileText className="ic" /><p className="small">No claims yet</p></div>
            ) : (
              <div className="donut-wrap">
                <svg width="150" height="150" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r={R} fill="none" stroke="var(--af-surface2)" strokeWidth="17" />
                  <g transform="rotate(-90 80 80)">
                    {byCompany.map((c, i) => {
                      const frac = totalForDonut > 0 ? c.count / totalForDonut : 0;
                      const len = frac * C;
                      const el = (
                        <circle
                          key={i}
                          cx="80"
                          cy="80"
                          r={R}
                          fill="none"
                          stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                          strokeWidth="17"
                          strokeDasharray={`${len} ${C - len}`}
                          transform={`rotate(${(donutOffset / C) * 360} 80 80)`}
                        />
                      );
                      donutOffset += len;
                      return el;
                    })}
                  </g>
                  <text x="80" y="76" textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--af-text)">{data.totalClaims}</text>
                  <text x="80" y="94" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--af-text3)">TOTAL</text>
                </svg>
                <div className="legend">
                  {byCompany.map((c, i) => (
                    <div className="lg" key={c.name}>
                      <span className="lg-dot" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                      {c.name}
                      <b>{c.count} · {totalForDonut > 0 ? Math.round((c.count / totalForDonut) * 100) : 0}%</b>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent claims + attention / top OBs */}
      <div className="dash-grid" style={{ gridTemplateColumns: '1.8fr 1fr' }}>
        <div className="card">
          <div className="card-h">
            <div className="card-t"><Clock className="ic sm" /> Recent Claims</div>
            <button className="btn btn-g btn-sm" onClick={() => onNavigate?.('claims')}>
              View all <ChevronRight className="ic sm" />
            </button>
          </div>
          <div className="tbl-wrap card-b tight">
            <table className="tbl" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th>Claim #</th><th>Shop</th><th>Company</th><th className="num">Amount</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentClaims.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '28px 0', color: 'var(--af-text3)' }}>No claims yet — create the first one</td></tr>
                ) : (
                  data.recentClaims.map((claim) => (
                    <tr key={claim.id}>
                      <td className="strong claim-no">{claim.claimNumber}</td>
                      <td>{claim.shop.name}</td>
                      <td><span className={`chip ${chipClass(byCompany.findIndex((c) => c.name === claim.company.name) % 3 === 0 ? 0 : byCompany.findIndex((c) => c.name === claim.company.name) % 3)}`}>{claim.company.name}</span></td>
                      <td className="num strong">{formatAmount(claim.netAmount || claim.totalAmount)}</td>
                      <td><span className={`bdg ${statusBdg[claim.status] || 'neutral'}`}>{statusLbl[claim.status] || claim.status}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Needs attention */}
          <div className="card" style={{ borderColor: 'color-mix(in srgb, var(--af-warn) 35%, var(--af-border))', background: 'linear-gradient(135deg, var(--af-warn-soft), var(--af-surface) 60%)' }}>
            <div className="card-b">
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div className="kpi-ic" style={{ '--kb': 'var(--af-warn-soft)', '--kc2': 'var(--af-warn)', background: 'var(--af-surface)' } as React.CSSProperties}>
                  <AlertTriangle className="ic" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--af-text)' }}>Needs your attention</div>
                  <div className="small muted">{data.pendingClaims.count > 0 ? 'Stock not received claims waiting' : 'All caught up'}</div>
                </div>
              </div>
              <div style={{ marginTop: 13, fontSize: 13, color: 'var(--af-text2)', lineHeight: 1.6 }}>
                <b style={{ color: 'var(--af-text)' }}>{data.pendingClaims.count} claims</b> ka stock abhi tak receive nahi hua — {formatAmount(data.pendingClaims.totalAmount)} ka maal distribution par hai.
              </div>
              <button className="btn btn-p btn-sm btn-block" style={{ marginTop: 13 }} onClick={() => onNavigate?.('stock-not-received')}>
                Review Now
              </button>
            </div>
          </div>

          {/* Top order bookers (admin) / Top outstanding shops (OB) */}
          {isAdmin ? (
            <div className="card">
              <div className="card-h"><div className="card-t"><Users className="ic sm" /> Top Order Bookers</div></div>
              <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {topOBs.length === 0 ? (
                  <p className="small muted" style={{ textAlign: 'center', padding: '10px 0' }}>No data yet</p>
                ) : (
                  topOBs.map((ob) => (
                    <div key={ob.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, color: 'var(--af-text)' }}>{ob.name}</span>
                        <span className="muted">{ob.count} · {formatAmount(ob.amount)}</span>
                      </div>
                      <div className="prog"><i style={{ width: `${(ob.count / maxOBCount) * 100}%` }} /></div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-h"><div className="card-t"><Store className="ic sm" /> Outstanding Shops</div></div>
              <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {(data.topOutstandingShops || []).length === 0 ? (
                  <p className="small muted" style={{ textAlign: 'center', padding: '10px 0' }}>No outstanding claims — all clear!</p>
                ) : (
                  data.topOutstandingShops.slice(0, 5).map((s) => {
                    const maxOut = Math.max(1, ...data.topOutstandingShops.map((x) => x.totalPendingAmount));
                    return (
                      <div key={`${s.shopId}-${s.companyName}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, color: 'var(--af-text)' }}>{s.shopName}</span>
                          <span className="muted">{s.pendingClaimCount} · {formatAmount(s.totalPendingAmount)}</span>
                        </div>
                        <div className="prog warn"><i style={{ width: `${(s.totalPendingAmount / maxOut) * 100}%` }} /></div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
