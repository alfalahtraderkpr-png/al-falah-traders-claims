'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard,
  FileText,
  Building2,
  Package,
  Store,
  UserCheck,
  BarChart3,
  LogOut,
  Menu,
  X,
  Truck,
  Shield,
  Sun,
  Moon,
  AlertTriangle,
  Plus,
  Search,
  Bell,
  DatabaseBackup,
  Trash2,
  Settings as SettingsIcon,
} from 'lucide-react';

interface AppLayoutProps {
  user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
  onNewClaim?: () => void;
  children: React.ReactNode;
}

const adminNavGroups = [
  {
    label: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, cnt: 'total' as const },
      { id: 'claims', label: 'Claims', icon: FileText, cnt: 'total' as const },
      { id: 'stock-not-received', label: 'Stock Not Received', icon: AlertTriangle, cnt: 'pending' as const },
    ],
  },
  {
    label: 'Master Data',
    items: [
      { id: 'companies', label: 'Companies', icon: Building2 },
      { id: 'products', label: 'Products', icon: Package },
      { id: 'suppliers', label: 'Suppliers', icon: Truck },
      { id: 'shops', label: 'Shops', icon: Store },
      { id: 'order-bookers', label: 'Order Bookers', icon: UserCheck },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'users', label: 'Users', icon: Shield },
      { id: 'reports', label: 'Reports', icon: BarChart3 },
      { id: 'backup', label: 'Backup', icon: DatabaseBackup },
      { id: 'trash', label: 'Trash', icon: Trash2 },
      { id: 'settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
];

const orderBookerNavGroups = [
  {
    label: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'claims', label: 'My Claims', icon: FileText },
      { id: 'stock-not-received', label: 'Stock Not Received', icon: AlertTriangle },
    ],
  },
  {
    label: 'System',
    items: [{ id: 'reports', label: 'Reports', icon: BarChart3 }],
  },
];

export function AppLayout({ user, activeSection, onSectionChange, onLogout, onNewClaim, children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [counts, setCounts] = useState<{ total: number; pending: number }>({ total: 0, pending: 0 });

  const isAdmin = user.role === 'admin';
  const navGroups = isAdmin ? adminNavGroups : orderBookerNavGroups;

  useEffect(() => setMounted(true), []);

  // Sidebar badge counts (total claims + pending stock)
  useEffect(() => {
    let cancelled = false;
    const loadCounts = async () => {
      try {
        const params = new URLSearchParams();
        if (!isAdmin && user.orderBookerId) params.set('orderBookerId', user.orderBookerId);
        const res = await fetch(`/api/dashboard?${params}`);
        if (res.ok && !cancelled) {
          const d = await res.json();
          if (d && typeof d === 'object' && d.totalClaims !== undefined) {
            setCounts({ total: d.totalClaims || 0, pending: d.pendingClaims?.count || 0 });
          }
        }
      } catch { /* silent */ }
    };
    loadCounts();
    return () => { cancelled = true; };
  }, [activeSection, isAdmin, user.orderBookerId]);

  const handleSection = useCallback((id: string) => {
    onSectionChange(id);
    setSidebarOpen(false);
  }, [onSectionChange]);

  const handleNewClaim = useCallback(() => {
    if (onNewClaim) onNewClaim();
    else onSectionChange('claims');
    setSidebarOpen(false);
  }, [onNewClaim, onSectionChange]);

  const currentTheme = mounted ? (theme === 'system' ? resolvedTheme : theme) : 'light';
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="af-app">
      {/* Mobile drawer backdrop */}
      {sidebarOpen && (
        <div className="af-drawer-bg lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — deep indigo (mockup .side) */}
      <aside className={`side ${sidebarOpen ? 'open' : ''}`}>
        <div className="side-brand">
          <div className="brand-tile">AF</div>
          <div>
            <div className="brand-name">AL FALAH</div>
            <div className="brand-sub">TRADERS · CMS</div>
          </div>
          <button
            className="out"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="ic sm" />
          </button>
        </div>

        <nav className="side-nav">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="side-lbl">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    className={`snav ${isActive ? 'active' : ''}`}
                    onClick={() => handleSection(item.id)}
                  >
                    <Icon className="ic" />
                    {item.label}
                    {'cnt' in item && item.cnt === 'total' && counts.total > 0 && (
                      <span className="cnt">{counts.total}</span>
                    )}
                    {'cnt' in item && item.cnt === 'pending' && counts.pending > 0 && (
                      <span className="cnt">{counts.pending}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="side-foot">
          <div className="av">{initials}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="nm">{user.name}</div>
            <div className="rl">{isAdmin ? 'Administrator' : 'Order Booker'}</div>
          </div>
          <button className="out" title="Logout" onClick={onLogout}>
            <LogOut className="ic sm" />
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="main">
        {/* Topbar (mockup .topbar) */}
        <div className="topbar">
          <button className="icon-btn tb-burger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu className="ic" />
          </button>
          <div className="tb-search">
            <Search className="ic sm" />
            <input
              placeholder="Search claims, shops, products…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSection('claims');
              }}
            />
            <kbd>/</kbd>
          </div>
          <div className="tb-right">
            <button
              className="icon-btn"
              title={currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
            >
              {mounted && currentTheme === 'dark' ? <Sun className="ic" /> : <Moon className="ic" />}
            </button>
            <button className="icon-btn" title="Notifications">
              <Bell className="ic" />
              <span className="dot" />
            </button>
            <button className="btn btn-p btn-sm" onClick={handleNewClaim}>
              <Plus className="ic sm" />
              New Claim
            </button>
            <div className="av chip">
              <div className="av">{initials}</div>
              <div>
                <div className="nm">{user.name}</div>
                <div className="rl">{isAdmin ? 'Administrator' : 'Order Booker'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content (mockup .content) */}
        <main className="content">{children}</main>

        {/* Mobile bottom nav (mockup .bottomnav) */}
        <nav className="bottomnav">
          <button
            className={`bn ${activeSection === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleSection('dashboard')}
          >
            <LayoutDashboard className="ic" />
            Home
          </button>
          <button
            className={`bn ${activeSection === 'claims' ? 'active' : ''}`}
            onClick={() => handleSection('claims')}
          >
            <FileText className="ic" />
            Claims
          </button>
          <button className="bn-fab" onClick={handleNewClaim} title="New Claim">
            <Plus className="ic lg" />
          </button>
          <button
            className={`bn ${activeSection === 'stock-not-received' ? 'active' : ''}`}
            onClick={() => handleSection('stock-not-received')}
          >
            <AlertTriangle className="ic" />
            Stock
          </button>
          <button
            className={`bn ${activeSection === 'reports' ? 'active' : ''}`}
            onClick={() => handleSection('reports')}
          >
            <BarChart3 className="ic" />
            Reports
          </button>
        </nav>
      </div>
    </div>
  );
}
