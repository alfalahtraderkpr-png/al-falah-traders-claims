'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Clock, CheckCircle2, DollarSign, XCircle, Banknote, TrendingUp, RefreshCw, Store, AlertCircle, Split } from 'lucide-react';

interface DashboardProps {
  user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
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
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  approved: 'bg-green-100 text-green-800 border-green-300',
  partial: 'bg-orange-100 text-orange-800 border-orange-300',
  cleared: 'bg-blue-100 text-blue-800 border-blue-300',
  rejected: 'bg-red-100 text-red-800 border-red-300',
  // Legacy mapping
  arrived_approved: 'bg-green-100 text-green-800 border-green-300',
  partially_approved: 'bg-orange-100 text-orange-800 border-orange-300',
  partially_cleared: 'bg-orange-100 text-orange-800 border-orange-300',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  partial: 'Partial',
  cleared: 'Cleared',
  rejected: 'Rejected',
  arrived_approved: 'Approved',
  partially_approved: 'Partial',
  partially_cleared: 'Partial',
};

export function Dashboard({ user }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcResult, setRecalcResult] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    try {
      const params = new URLSearchParams();
      if (user.role === 'orderbooker' && user.orderBookerId) {
        params.set('orderBookerId', user.orderBookerId);
      }
      const res = await fetch(`/api/dashboard?${params}`);
      if (res.ok) {
        const result = await res.json();
        if (result && typeof result === 'object' && result.totalClaims !== undefined) {
          setData(result);
        }
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
    } catch (error) {
      setRecalcResult('Network error!');
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const formatAmount = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  const cards = [
    {
      title: 'Total Claims',
      value: data.totalClaims,
      icon: FileText,
      gradient: 'from-emerald-500 to-emerald-700',
      bgLight: 'bg-emerald-50',
      textColor: 'text-emerald-700',
      iconBg: 'bg-emerald-100',
    },
    {
      title: 'Pending',
      subtitle: 'Stock Not Received',
      value: data.pendingClaims.count,
      extra: formatAmount(data.pendingClaims.totalAmount),
      icon: Clock,
      gradient: 'from-yellow-500 to-amber-600',
      bgLight: 'bg-yellow-50',
      textColor: 'text-yellow-700',
      iconBg: 'bg-yellow-100',
    },
    {
      title: 'Approved',
      subtitle: 'Stock Arrived, Payment Pending',
      value: data.approvedClaims.count,
      extra: formatAmount(data.approvedClaims.totalAmount),
      icon: CheckCircle2,
      gradient: 'from-green-500 to-green-700',
      bgLight: 'bg-green-50',
      textColor: 'text-green-700',
      iconBg: 'bg-green-100',
    },
    {
      title: 'Partially Cleared',
      subtitle: 'Partial Amount Deducted',
      value: data.partiallyClearedClaims.count,
      extra: formatAmount(data.partiallyClearedClaims.approvedAmount || 0),
      icon: Split,
      gradient: 'from-orange-500 to-orange-700',
      bgLight: 'bg-orange-50',
      textColor: 'text-orange-700',
      iconBg: 'bg-orange-100',
    },
    {
      title: 'Cleared',
      subtitle: 'Full Amount Settled',
      value: data.clearedClaims.count,
      extra: formatAmount(data.clearedClaims.approvedAmount),
      icon: Banknote,
      gradient: 'from-blue-500 to-blue-700',
      bgLight: 'bg-blue-50',
      textColor: 'text-blue-700',
      iconBg: 'bg-blue-100',
    },
    {
      title: 'Rejected',
      value: data.rejectedClaims.count,
      extra: formatAmount(data.rejectedClaims.totalAmount),
      icon: XCircle,
      gradient: 'from-red-500 to-red-700',
      bgLight: 'bg-red-50',
      textColor: 'text-red-700',
      iconBg: 'bg-red-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-emerald-800 flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              Dashboard
            </h2>
            <p className="text-muted-foreground">Welcome back, {user.name}</p>
          </div>
          {user.role === 'admin' && (
            <div className="flex flex-col items-end gap-2">
              <Button
                variant="outline"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 btn-enhanced"
                onClick={handleRecalculate}
                disabled={recalculating}
              >
                {recalculating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Refreshing...</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" /> Refresh All Claims</>
                )}
              </Button>
              {recalcResult && (
                <span className="text-xs text-emerald-600 font-medium animate-scale-in">{recalcResult}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Workflow Progress Indicator */}
      <Card className="shadow-sm animate-fade-in-up border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2 flex-1">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-yellow-100 border-2 border-yellow-400 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <span className="text-xs font-medium mt-1 text-yellow-700">Pending</span>
                <span className="text-xs text-muted-foreground">Stock not received</span>
              </div>
              <div className="flex-1 h-0.5 bg-gradient-to-r from-yellow-300 to-green-300 mx-1" />
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-green-100 border-2 border-green-400 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-xs font-medium mt-1 text-green-700">Approved</span>
                <span className="text-xs text-muted-foreground">Stock arrived</span>
              </div>
              <div className="flex-1 h-0.5 bg-gradient-to-r from-green-300 to-orange-300 mx-1" />
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-orange-100 border-2 border-orange-400 flex items-center justify-center">
                  <Split className="h-5 w-5 text-orange-600" />
                </div>
                <span className="text-xs font-medium mt-1 text-orange-700">Partial</span>
                <span className="text-xs text-muted-foreground">Partial deducted</span>
              </div>
              <div className="flex-1 h-0.5 bg-gradient-to-r from-orange-300 to-blue-300 mx-1" />
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-blue-100 border-2 border-blue-400 flex items-center justify-center">
                  <Banknote className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-xs font-medium mt-1 text-blue-700">Cleared</span>
                <span className="text-xs text-muted-foreground">Full settled</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 stagger-children">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className={`${card.bgLight} border-0 shadow-sm card-hover animate-pop-in cursor-default overflow-hidden relative`}
            >
              <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl ${card.gradient} opacity-10 rounded-bl-full`} />
              <CardHeader className="flex flex-row items-center justify-between pb-1 relative z-10 p-3">
                <CardTitle className="text-xs font-medium opacity-80">
                  {card.title}
                </CardTitle>
                <div className={`${card.iconBg} p-1.5 rounded-lg transition-transform duration-200 hover:scale-110`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10 p-3 pt-0">
                <div className="text-xl font-bold">{card.value}</div>
                {card.subtitle && (
                  <p className="text-[10px] opacity-60 mt-0.5">{card.subtitle}</p>
                )}
                {card.extra && (
                  <p className="text-xs opacity-70 mt-1 font-medium">{card.extra}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Top Outstanding Shops & Recent Claims */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Outstanding Shops */}
        <Card className="shadow-sm animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-orange-600" />
              Top Outstanding Shops
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!data.topOutstandingShops || data.topOutstandingShops.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-10 w-10 text-green-300 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No outstanding claims!</p>
                <p className="text-sm text-muted-foreground mt-1">All claims are cleared</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">#</th>
                      <th className="text-left py-2 px-2 font-medium">Shop</th>
                      <th className="text-left py-2 px-2 font-medium">Company</th>
                      <th className="text-right py-2 px-2 font-medium">Outstanding</th>
                      <th className="text-center py-2 px-2 font-medium">Claims</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topOutstandingShops.map((shop, index) => (
                      <tr
                        key={`${shop.shopId}-${shop.companyName}`}
                        className="border-b table-row-hover animate-fade-in-up"
                        style={{ animationDelay: `${index * 50}ms`}}
                      >
                        <td className="py-2 px-2 text-muted-foreground">{index + 1}</td>
                        <td className="py-2 px-2 font-medium truncate max-w-[120px]" title={shop.shopName}>{shop.shopName}</td>
                        <td className="py-2 px-2 text-muted-foreground truncate max-w-[100px]" title={shop.companyName}>{shop.companyName}</td>
                        <td className="py-2 px-2 text-right font-bold text-red-600">{formatAmount(shop.totalPendingAmount)}</td>
                        <td className="py-2 px-2 text-center">
                          <Badge className="bg-orange-100 text-orange-800 border border-orange-300 text-xs">
                            {shop.pendingClaimCount}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Claims */}
        <Card className="shadow-sm animate-fade-in-up" style={{ animationDelay: '250ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Recent Claims
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentClaims.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No claims yet</p>
                <p className="text-sm text-muted-foreground mt-1">Claims will appear here once created</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">Claim #</th>
                      <th className="text-left py-2 px-2 font-medium">Shop</th>
                      <th className="text-right py-2 px-2 font-medium">Amount</th>
                      <th className="text-center py-2 px-2 font-medium">Status</th>
                      <th className="text-left py-2 px-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentClaims.map((claim, index) => (
                      <tr
                        key={claim.id}
                        className="border-b table-row-hover animate-fade-in-up"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <td className="py-2 px-2 font-medium text-emerald-700">{claim.claimNumber}</td>
                        <td className="py-2 px-2 truncate max-w-[120px]" title={claim.shop.name}>{claim.shop.name}</td>
                        <td className="py-2 px-2 text-right font-medium">{formatAmount(claim.totalAmount)}</td>
                        <td className="py-2 px-2 text-center">
                          <Badge className={`${statusColors[claim.status]} border text-xs`}>
                            {statusLabels[claim.status]}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">{new Date(claim.date).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
