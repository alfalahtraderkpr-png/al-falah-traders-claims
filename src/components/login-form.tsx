'use client';

import { useState, useEffect } from 'react';
import { Loader2, Eye, EyeOff, ArrowRight, Smartphone } from 'lucide-react';

interface LoginFormProps {
  onLogin: (user: { id: string; name: string; email: string; role: string; orderBookerId: string | null }) => void;
}

interface PublicStats {
  claims: number;
  companies: number;
  shops: number;
  orderBookers: number;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<PublicStats | null>(null);

  // Live system stats for the brand panel tiles (falls back silently)
  useEffect(() => {
    fetch('/api/public-stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d === 'object') setStats(d); })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      onLogin(data.user);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      {/* Mobile brand strip */}
      <div className="lb-mobile">
        <div className="brand-tile">AF</div>
        <div>
          <div className="brand-name">AL FALAH</div>
          <div className="brand-sub" style={{ color: '#b4b2ea' }}>TRADERS · CMS</div>
        </div>
      </div>

      {/* Brand panel (desktop) */}
      <div className="login-brand">
        <div className="lb-inner">
          <div className="lb-brand">
            <div className="brand-tile">AF</div>
            <div>
              <div className="brand-name">AL FALAH</div>
              <div className="brand-sub">TRADERS · CLAIM MANAGEMENT</div>
            </div>
          </div>
          <div className="lb-hero">
            <div className="lb-h1">Claims ka poora <span>control</span>, ek hi jagah.</div>
            <p className="lb-p">Order bookers se stock verification tak — har claim, har deduction, har payment. Ab sab kuch ek clean, fast system mein.</p>
            <div className="lb-stats">
              <div className="lb-stat"><b>{stats ? stats.claims.toLocaleString() : '—'}</b><span>CLAIMS PROCESSED</span></div>
              <div className="lb-stat"><b>{stats ? stats.companies : '—'}</b><span>COMPANIES</span></div>
              <div className="lb-stat"><b>{stats ? stats.shops : '—'}</b><span>SHOPS</span></div>
              <div className="lb-stat"><b>{stats ? stats.orderBookers : '—'}</b><span>ORDER BOOKERS</span></div>
            </div>
          </div>
          <div className="lb-foot">© 2026 Al Falah Traders · Claim Management System v1.0</div>
        </div>
      </div>

      {/* Login panel */}
      <div className="login-panel">
        <div className="login-card">
          <div>
            <div className="lc-h">Welcome back 👋</div>
            <div className="lc-sub">Sign in to your account to continue</div>
          </div>

          {error && (
            <div style={{ background: 'var(--af-bad-soft)', color: 'var(--af-bad)', border: '1px solid color-mix(in srgb, var(--af-bad) 30%, transparent)', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 19 }}>
            <div className="field">
              <label className="label" htmlFor="email">Email address <span className="req">*</span></label>
              <input
                id="email"
                className="input"
                type="email"
                placeholder="admin@alfalah.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="password">Password <span className="req">*</span></label>
              <div className="pw-wrap">
                <input
                  id="password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="pw-eye"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="ic sm" /> : <Eye className="ic sm" />}
                </button>
              </div>
            </div>

            <div className="lc-row">
              <label className="chk">
                <input
                  type="checkbox"
                  className="af-chk"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Keep me signed in
              </label>
              <a className="lnk" href="#" onClick={(e) => e.preventDefault()}>Forgot password?</a>
            </div>

            <button className="btn btn-p btn-lg btn-block" type="submit" disabled={loading}>
              {loading ? (
                <><Loader2 className="ic sm animate-spin" /> Signing in…</>
              ) : (
                <>Sign In <ArrowRight className="ic sm" /></>
              )}
            </button>
          </form>

          <div className="pwa-hint">
            <Smartphone className="ic sm" />
            Install as app — mobile pe bhi fast chalta hai (PWA supported)
          </div>
        </div>
      </div>
    </div>
  );
}
