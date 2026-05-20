'use client';

import { useState, useEffect } from 'react';
import { LoginForm } from '@/components/login-form';
import { AppLayout } from '@/components/app-layout';
import { Dashboard } from '@/components/dashboard';
import { ClaimList } from '@/components/claim-list';
import { MasterData } from '@/components/master-data';
import { Reports } from '@/components/reports';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  orderBookerId: string | null;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch {
        // Not authenticated
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100">
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-lg">AF</span>
          </div>
          <p className="text-emerald-700 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <Dashboard user={user} />;
      case 'claims':
        return <ClaimList user={user} />;
      case 'companies':
      case 'products':
      case 'suppliers':
      case 'shops':
      case 'order-bookers':
        return <MasterData initialTab={activeSection} />;
      case 'reports':
        return <Reports />;
      default:
        return <Dashboard user={user} />;
    }
  };

  return (
    <AppLayout
      user={user}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      onLogout={handleLogout}
    >
      {renderSection()}
    </AppLayout>
  );
}
