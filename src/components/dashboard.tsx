'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Clock, CheckCircle2, DollarSign, XCircle, Banknote, TrendingUp } from 'lucide-react';

interface DashboardProps {
  user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
}

interface DashboardData {
  totalClaims: number;
  pendingClaims: { count: number; totalAmount: number };
  approvedClaims: { count: number; totalAmount: number; approvedAmount: number };
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
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  approved: 'bg-green-100 text-green-800 border-green-300',
  partially_approved: 'bg-orange-100 text-orange-800 border-orange-300',
  cleared: 'bg-blue-100 text-blue-800 border-blue-300',
  rejected: 'bg-red-100 text-red-800 border-red-300',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  partially_approved: 'Partial',
  cleared: 'Cleared',
  rejected: 'Rejected',
};

export function Dashboard({ user }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

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
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
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
      title: 'Pending Claims',
      value: data.pendingClaims.count,
      subtitle: formatAmount(data.pendingClaims.totalAmount),
      icon: Clock,
      gradient: 'from-yellow-500 to-amber-600',
      bgLight: 'bg-yellow-50',
      textColor: 'text-yellow-700',
      iconBg: 'bg-yellow-100',
    },
    {
      title: 'Approved Claims',
      value: data.approvedClaims.count,
      subtitle: `${formatAmount(data.approvedClaims.approvedAmount)}`,
      icon: CheckCircle2,
      gradient: 'from-green-500 to-green-700',
      bgLight: 'bg-green-50',
      textColor: 'text-green-700',
      iconBg: 'bg-green-100',
    },
    {
      title: 'Cleared Claims',
      value: data.clearedClaims.count,
      subtitle: formatAmount(data.clearedClaims.approvedAmount),
      icon: Banknote,
      gradient: 'from-blue-500 to-blue-700',
      bgLight: 'bg-blue-50',
      textColor: 'text-blue-700',
      iconBg: 'bg-blue-100',
    },
    {
      title: 'Rejected Claims',
      value: data.rejectedClaims.count,
      subtitle: formatAmount(data.rejectedClaims.totalAmount),
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
        <h2 className="text-2xl font-bold text-emerald-800 flex items-center gap-2">
          <TrendingUp className="h-6 w-6" />
          Dashboard
        </h2>
        <p className="text-muted-foreground">Welcome back, {user.name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 stagger-children">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className={`${card.bgLight} border-0 shadow-sm card-hover animate-fade-in-up cursor-default overflow-hidden relative`}
            >
              <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl ${card.gradient} opacity-10 rounded-bl-full`} />
              <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
                <CardTitle className="text-sm font-medium opacity-80">
                  {card.title}
                </CardTitle>
                <div className={`${card.iconBg} p-2 rounded-lg transition-transform duration-200 hover:scale-110`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-2xl font-bold">{card.value}</div>
                {card.subtitle && (
                  <p className="text-xs opacity-70 mt-1">{card.subtitle}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-sm animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Recent claims
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentClaims.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-muted-foreground text-lg font-medium">No claims yet</p>
              <p className="text-sm text-muted-foreground mt-1">Claims will appear here once created</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Claim #</th>
                    <th className="text-left py-3 px-2 font-medium">Date</th>
                    <th className="text-left py-3 px-2 font-medium">Company</th>
                    <th className="text-left py-3 px-2 font-medium">Shop</th>
                    <th className="text-right py-3 px-2 font-medium">Amount</th>
                    <th className="text-center py-3 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentClaims.map((claim, index) => (
                    <tr
                      key={claim.id}
                      className="border-b table-row-hover animate-fade-in-up"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td className="py-3 px-2 font-medium text-emerald-700">{claim.claimNumber}</td>
                      <td className="py-3 px-2">{new Date(claim.date).toLocaleDateString()}</td>
                      <td className="py-3 px-2">{claim.company.name}</td>
                      <td className="py-3 px-2">{claim.shop.name}</td>
                      <td className="py-3 px-2 text-right font-medium">{formatAmount(claim.totalAmount)}</td>
                      <td className="py-3 px-2 text-center">
                        <Badge className={`${statusColors[claim.status]} border text-xs transition-transform duration-200 hover:scale-105`}>
                          {statusLabels[claim.status]}
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
    </div>
  );
}
