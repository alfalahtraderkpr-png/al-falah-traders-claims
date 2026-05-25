'use client';

import { useState } from 'react';
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
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Section = 'dashboard' | 'claims' | 'companies' | 'products' | 'suppliers' | 'shops' | 'order-bookers' | 'users' | 'reports';

interface AppLayoutProps {
  user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const adminNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'claims', label: 'Claims', icon: FileText },
  { id: 'companies', label: 'Companies', icon: Building2 },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'suppliers', label: 'Suppliers', icon: Truck },
  { id: 'shops', label: 'Shops', icon: Store },
  { id: 'order-bookers', label: 'Order Bookers', icon: UserCheck },
  { id: 'users', label: 'Users', icon: Shield },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

const orderBookerNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'claims', label: 'My Claims', icon: FileText },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

export function AppLayout({ user, activeSection, onSectionChange, onLogout, children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdmin = user.role === 'admin';
  const navItems = isAdmin ? adminNavItems : orderBookerNavItems;
  const activeIndex = navItems.findIndex(item => item.id === activeSection);

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-emerald-900 via-emerald-900 to-emerald-950 text-white flex flex-col transform transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-emerald-800/50">
          <div className="flex items-center gap-3 animate-slide-in-left">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg">
              <span className="font-bold text-sm">AF</span>
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight">AL FALAH</h1>
              <p className="text-emerald-300 text-xs">TRADERS</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-white hover:bg-emerald-800 transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation with sliding indicator */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto relative">
          {/* Sliding indicator pill */}
          {activeIndex >= 0 && (
            <div
              className="absolute left-2 right-2 h-10 bg-emerald-700/60 rounded-lg transition-all duration-300 ease-out z-0"
              style={{
                top: `${12 + activeIndex * 44}px`,
              }}
            />
          )}

          {/* Nav items */}
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSectionChange(item.id);
                  setSidebarOpen(false);
                }}
                className={`relative z-10 w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-200 mb-1 ${
                  isActive
                    ? 'text-white font-medium'
                    : 'text-emerald-200/70 hover:text-white hover:bg-emerald-800/30'
                }`}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className={`flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200 ${
                  isActive 
                    ? 'bg-white/15' 
                    : ''
                }`}>
                  <Icon className={`h-4 w-4 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                </div>
                <span className="flex-1 text-left">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User info & Logout */}
        <div className="p-3 border-t border-emerald-800/50">
          <div className="flex items-center gap-3 mb-3 px-2 py-2 rounded-lg bg-emerald-800/30">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-emerald-300/70">{user.role === 'admin' ? 'Administrator' : 'Order Booker'}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-emerald-200/70 hover:bg-red-900/30 hover:text-red-300 transition-all duration-200 rounded-lg"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b shadow-sm sticky top-0 z-30">
          <div className="flex items-center justify-between px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden hover:bg-emerald-50 transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-emerald-800 capitalize animate-fade-in">
                {activeSection === 'order-bookers' ? 'Order Bookers' : activeSection === 'users' ? 'Users' : activeSection.replace('-', ' ')}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:block">
                {user.name}
              </span>
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full flex items-center justify-center ring-2 ring-emerald-300/30">
                <span className="text-emerald-700 font-medium text-xs">
                  {user.name.charAt(0)}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
