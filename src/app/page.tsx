'use client';

import { useState, useEffect } from 'react';
import { LoginForm } from '@/components/login-form';
import { AppLayout } from '@/components/app-layout';
import { Dashboard } from '@/components/dashboard';
import { ClaimList } from '@/components/claim-list';
import { MasterData } from '@/components/master-data';
import { UsersManager } from '@/components/users-manager';
import { Reports } from '@/components/reports';
import { StockNotReceived } from '@/components/stock-not-received';
import { BackupManager } from '@/components/backup-manager';
import { TrashManager } from '@/components/trash-manager';
import { SettingsManager } from '@/components/settings-manager';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  orderBookerId: string | null;
  assignedCompanyIds?: string[];
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // When true, ClaimList opens the New Claim form immediately on mount
  const [autoOpenNewClaim, setAutoOpenNewClaim] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        // Force update: check for new service worker immediately
        registration.update();
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    // Check if user is already logged in
    // Use AbortController with a short timeout so the page never gets stuck
    // on the "Loading..." state if /api/auth/me is slow or unresponsive.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          signal: controller.signal,
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (err) {
        // Either not authenticated, or fetch was aborted due to timeout.
        // In both cases, fall through to the login screen — never stay stuck.
        if ((err as Error).name === 'AbortError') {
          console.warn('[auth/me] Timed out after 8s — showing login screen');
        } else {
          console.warn('[auth/me] fetch failed:', (err as Error).message);
        }
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    };
    checkAuth();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setActiveSection('dashboard');
  };

  const handleLogout = async () => {
    // Clear cookies by setting them to expired
    document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    document.cookie = 'user-data=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    setUser(null);
    setActiveSection('dashboard');
  };

  // FAB / topbar "New Claim" → jump to claims section and open the form
  const handleNewClaim = () => {
    setActiveSection('claims');
    setAutoOpenNewClaim(true);
  };

  if (loading) {
    return (
      <div className="login" style={{ background: 'var(--af-bg)' }}>
        <div className="login-panel" style={{ flex: 1 }}>
          <div className="login-card" style={{ alignItems: 'center', textAlign: 'center' }}>
            <div className="brand-tile" style={{ width: 64, height: 64, fontSize: 20 }}>AF</div>
            <div>
              <div className="lc-h">AL FALAH TRADERS</div>
              <div className="lc-sub">Connecting to server…</div>
            </div>
            <button
              className="btn btn-o btn-sm"
              onClick={() => { setLoading(false); }}
            >
              Skip to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="login" style={{ background: 'var(--af-bg)' }}>
        <div className="login-panel" style={{ flex: 1 }}>
          <div className="login-card" style={{ alignItems: 'center', textAlign: 'center' }}>
            <div className="brand-tile" style={{ width: 64, height: 64, fontSize: 20, background: 'linear-gradient(135deg,#e11d48,#f43f5e)' }}>!</div>
            <div>
              <div className="lc-h">Something went wrong</div>
              <div className="lc-sub">{error}</div>
            </div>
            <button
              className="btn btn-p btn-block"
              onClick={() => { setError(null); window.location.reload(); }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  const renderSection = () => {
    try {
      switch (activeSection) {
        case 'dashboard':
          return <Dashboard user={user} onNavigate={setActiveSection} onNewClaim={handleNewClaim} />;
        case 'claims':
          return (
            <ClaimList
              user={user}
              autoOpenForm={autoOpenNewClaim}
              onAutoOpenHandled={() => setAutoOpenNewClaim(false)}
            />
          );
        case 'companies':
        case 'products':
        case 'suppliers':
        case 'shops':
        case 'order-bookers':
          return <MasterData initialTab={activeSection} onNavigate={setActiveSection} />;
        case 'users':
          return <UsersManager />;
        case 'stock-not-received':
          return <StockNotReceived user={user} />;
        case 'backup':
          return user.role === 'admin' ? <BackupManager /> : <Dashboard user={user} />;
        case 'trash':
          return user.role === 'admin' ? <TrashManager /> : <Dashboard user={user} />;
        case 'settings':
          return user.role === 'admin' ? <SettingsManager onNavigate={setActiveSection} /> : <Dashboard user={user} />;
        case 'reports':
          return <Reports user={user} />;
        default:
          return <Dashboard user={user} />;
      }
    } catch (err) {
      console.error('Section render error:', err);
      return (
        <div className="card">
          <div className="card-b empty-state">
            <p style={{ color: 'var(--af-bad)', fontWeight: 600 }}>Failed to load this section</p>
            <button className="btn btn-p" onClick={() => setActiveSection('dashboard')}>
              Go to Dashboard
            </button>
          </div>
        </div>
      );
    }
  };

  return (
    <>
      <AppLayout
        user={user}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onLogout={handleLogout}
        onNewClaim={handleNewClaim}
      >
        {renderSection()}
      </AppLayout>
      <PwaInstallPrompt />
    </>
  );
}
