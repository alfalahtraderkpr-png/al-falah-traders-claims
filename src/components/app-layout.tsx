'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Section = 'dashboard' | 'claims' | 'companies' | 'products' | 'suppliers' | 'shops' | 'order-bookers' | 'users' | 'reports' | 'stock-not-received';

interface AppLayoutProps {
  user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const adminNavGroups = [
  {
    label: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'claims', label: 'Claims', icon: FileText },
      { id: 'stock-not-received', label: 'Stock Not Received', icon: AlertTriangle },
      { id: 'reports', label: 'Reports', icon: BarChart3 },
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
    label: 'Administration',
    items: [{ id: 'users', label: 'Users', icon: Shield }],
  },
];

const orderBookerNavGroups = [
  {
    label: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'claims', label: 'My Claims', icon: FileText },
      { id: 'stock-not-received', label: 'Stock Not Received', icon: AlertTriangle },
      { id: 'reports', label: 'Reports', icon: BarChart3 },
    ],
  },
];

const sectionTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  claims: 'Claims',
  'stock-not-received': 'Stock Not Received',
  companies: 'Companies',
  products: 'Products',
  suppliers: 'Suppliers',
  shops: 'Shops',
  'order-bookers': 'Order Bookers',
  users: 'Users',
  reports: 'Reports',
};

export function AppLayout({ user, activeSection, onSectionChange, onLogout, children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const isAdmin = user.role === 'admin';
  const navGroups = isAdmin ? adminNavGroups : orderBookerNavGroups;

  const handleSection = (id: string) => {
    onSectionChange(id);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-[#12102c]/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — deep indigo */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-[#1e1b4b] via-[#26235c] to-[#312e81] text-white flex flex-col transform transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-4 py-[18px] border-b border-white/[0.09] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center shadow-[0_6px_18px_rgba(99,102,241,0.45)]">
              <span className="font-extrabold text-sm tracking-wide">AF</span>
            </div>
            <div>
              <h1 className="font-extrabold text-sm leading-tight tracking-wide">AL FALAH</h1>
              <p className="text-[#a5a3e8] text-[10.5px] tracking-[1.2px] font-semibold">TRADERS</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-white hover:bg-white/10 transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 px-2.5 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-1">
              <p className="text-[10px] font-bold tracking-[1.4px] text-[#7b7ac0] px-3 pt-3 pb-1.5 uppercase">
                {group.label}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSection(item.id)}
                    className={`nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] transition-all duration-200 mb-0.5 ${
                      isActive
                        ? 'active bg-indigo-500/30 text-white font-semibold shadow-[inset_0_0_0_1px_rgba(139,92,246,0.35)]'
                        : 'text-[#c3c1f0] hover:text-white hover:bg-white/[0.07]'
                    }`}
                  >
                    <Icon className={`h-[17px] w-[17px] transition-transform duration-200 ${isActive ? 'scale-110 text-violet-300' : 'opacity-85'}`} />
                    <span className="flex-1 text-left">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User info & Logout */}
        <div className="p-3.5 border-t border-white/[0.09] shrink-0">
          <div className="flex items-center gap-3 mb-3 px-2 py-2 rounded-[10px] bg-white/[0.06]">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white truncate">{user.name}</p>
              <p className="text-[10.5px] text-[#a5a3e8]">{user.role === 'admin' ? 'Administrator' : 'Order Booker'}</p>
            </div>
            <button
              onClick={onLogout}
              title="Logout"
              className="text-[#a5a3e8] hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-30 shrink-0">
          <div className="flex items-center justify-between px-4 md:px-6 py-3">
            <div className="flex items-center gap-2.5">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden hover:bg-secondary transition-colors"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="hidden sm:block w-1 h-6 rounded-full bg-gradient-to-b from-indigo-500 to-violet-500" />
              <h2 className="text-lg font-bold text-foreground tracking-tight animate-fade-in">
                {sectionTitles[activeSection] || activeSection}
              </h2>
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="icon"
                className="rounded-[10px] hover:border-primary hover:text-primary transition-colors"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
              </Button>
              <div className="hidden sm:flex items-center gap-2.5 pl-1.5 pr-3.5 py-1 rounded-full border border-border bg-card">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-full flex items-center justify-center ring-2 ring-indigo-500/20">
                  <span className="text-white font-semibold text-xs">{user.name.charAt(0)}</span>
                </div>
                <div className="leading-tight">
                  <p className="text-[12.5px] font-semibold text-foreground">{user.name}</p>
                  <p className="text-[10.5px] text-muted-foreground">{isAdmin ? 'Administrator' : 'Order Booker'}</p>
                </div>
              </div>
              {/* Mobile avatar */}
              <div className="sm:hidden w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-xs">{user.name.charAt(0)}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 page-enter pb-24 lg:pb-6">
            {children}
          </div>
        </main>

        {/* Mobile bottom nav with FAB */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/90 backdrop-blur-xl border-t border-border px-2.5 pt-2 pb-[calc(10px+env(safe-area-inset-bottom))]">
          <div className="flex items-center">
            <button
              onClick={() => handleSection('dashboard')}
              className={`flex-1 flex flex-col items-center gap-0.5 text-[10px] font-semibold py-1.5 rounded-[10px] transition-colors ${
                activeSection === 'dashboard' ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <LayoutDashboard className="h-[19px] w-[19px]" />
              Home
            </button>
            <button
              onClick={() => handleSection('claims')}
              className={`flex-1 flex flex-col items-center gap-0.5 text-[10px] font-semibold py-1.5 rounded-[10px] transition-colors ${
                activeSection === 'claims' ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <FileText className="h-[19px] w-[19px]" />
              Claims
            </button>
            <button
              onClick={() => handleSection('claims')}
              title="New Claim"
              className="flex-none w-[52px] h-[52px] -mt-6 mx-1.5 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-[0_10px_24px_rgba(79,70,229,0.45)] active:scale-95 transition-transform"
            >
              <Plus className="h-6 w-6" />
            </button>
            <button
              onClick={() => handleSection('stock-not-received')}
              className={`flex-1 flex flex-col items-center gap-0.5 text-[10px] font-semibold py-1.5 rounded-[10px] transition-colors ${
                activeSection === 'stock-not-received' ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <AlertTriangle className="h-[19px] w-[19px]" />
              Stock
            </button>
            <button
              onClick={() => handleSection('reports')}
              className={`flex-1 flex flex-col items-center gap-0.5 text-[10px] font-semibold py-1.5 rounded-[10px] transition-colors ${
                activeSection === 'reports' ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <BarChart3 className="h-[19px] w-[19px]" />
              Reports
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
