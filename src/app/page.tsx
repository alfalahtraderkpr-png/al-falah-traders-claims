'use client';

import { useState, useEffect, ComponentType } from 'react';
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

// Error boundary wrapper for safe component rendering
function SafeComponent({ children, name }: { children: React.ReactNode; name: string }) {
  return <>{children}</>;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">!</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
            onClick={() => { setError(null); window.location.reload(); }}
          >
            Refresh Page
          </button>
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
    } catch (err) {
      console.error('Section render error:', err);
      return (
        <div className="text-center py-12">
          <p className="text-red-600 font-medium">Failed to load this section</p>
          <button
            className="mt-4 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
            onClick={() => setActiveSection('dashboard')}
          >
            Go to Dashboard
          </button>
        </div>
      );
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
