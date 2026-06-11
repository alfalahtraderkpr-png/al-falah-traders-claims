'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClaimForm } from './claim-form';
import { ClaimDetail } from './claim-detail';
import { Loader2, Plus, Search, Filter, Eye, Trash2, CheckCircle, XCircle, Banknote, FileText, AlertTriangle, RotateCcw, MessageCircle, Lock, Download, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { logAction } from '@/lib/audit';

interface ClaimListProps {
  user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
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

interface Company { id: string; name: string; multiTierPricing?: boolean; claimDeductionPercent?: number }
interface Supplier { id: string; name: string }
interface OrderBooker { id: string; name: string }

interface Claim {
  id: string;
  claimNumber: string;
  date: string;
  totalAmount: number;
  deductionAmount: number;
  netAmount: number;
  approvedAmount: number | null;
  status: string;
  companyId: string;
  shopId: string;
  supplierId: string;
  orderBookerId: string | null;
  company: { name: string; claimDeductionPercent?: number };
  shop: { id: string; name: string; address: string };
  supplier: { name: string };
  orderBooker: { name: string } | null;
  claimItems: Array<{
    id: string;
    productId: string;
    quantity: number;
    amount: number;
    product: { name: string; price: number; claimPrice: number; unit: string; wholesalePrice: number | null; lmtPrice: number | null; company: { multiTierPricing: boolean } };
  }>;
  clearedBy: string | null;
  clearedDate: string | null;
  rejectReason: string | null;
  createdBy: string | null;
  createdAt: string;
}

export function ClaimList({ user }: ClaimListProps) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orderBookers, setOrderBookers] = useState<OrderBooker[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [filterOrderBooker, setFilterOrderBooker] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [search, setSearch] = useState('');

  // View state
  const [showForm, setShowForm] = useState(false);
  const [editClaim, setEditClaim] = useState<Claim | null>(null);
  const [viewClaim, setViewClaim] = useState<Claim | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [quickClaimFrom, setQuickClaimFrom] = useState<Claim | null>(null);

  const isAdmin = user.role === 'admin';

  // Confirm dialog state for destructive actions
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'approve' | 'reject' | 'delete' | 'clear' | 'change_status';
    claim: Claim;
    value: string;
    newStatus?: string;
  } | null>(null);

  const loadFilters = useCallback(async () => {
    try {
      const [compRes, supRes, obRes] = await Promise.all([
        fetch('/api/companies'),
        fetch('/api/suppliers'),
        fetch('/api/order-bookers'),
      ]);
      if (compRes.ok) { const data = await compRes.json(); if (Array.isArray(data)) setCompanies(data); }
      if (supRes.ok) { const data = await supRes.json(); if (Array.isArray(data)) setSuppliers(data); }
      if (obRes.ok) { const data = await obRes.json(); if (Array.isArray(data)) setOrderBookers(data); }
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  }, []);

  const loadClaims = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterCompany !== 'all') params.set('companyId', filterCompany);
      if (filterSupplier !== 'all') params.set('supplierId', filterSupplier);
      if (filterOrderBooker !== 'all') params.set('orderBookerId', filterOrderBooker);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);
      if (search) params.set('search', search);

      if (user.role === 'orderbooker' && user.orderBookerId) {
        params.set('orderBookerId', user.orderBookerId);
      }

      const res = await fetch(`/api/claims?${params}`);
      if (res.ok) { const data = await res.json(); if (Array.isArray(data)) setClaims(data); }
    } catch (error) {
      console.error('Failed to load claims:', error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterCompany, filterSupplier, filterOrderBooker, filterDateFrom, filterDateTo, search, user]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/claims/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (res.ok) {
        logAction({ userName: user.name, action: 'approve', entity: 'claim', entityId: id });
        loadClaims();
      }
    } catch (error) {
      console.error('Approve error:', error);
    }
  };

  const handlePartialApprove = async (id: string, amount: number) => {
    try {
      const res = await fetch(`/api/claims/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'partial_approve', approvedAmount: amount }),
      });
      if (res.ok) {
        loadClaims();
      }
    } catch (error) {
      console.error('Partial approve error:', error);
    }
  };

  const handleClear = async (id: string, clearedBy: string) => {
    try {
      const res = await fetch(`/api/claims/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear', clearedBy }),
      });
      if (res.ok) {
        logAction({ userName: user.name, action: 'clear', entity: 'claim', entityId: id, details: JSON.stringify({ clearedBy }) });
        loadClaims();
      }
    } catch (error) {
      console.error('Clear error:', error);
    }
  };

  const handleReject = async (id: string, reason: string) => {
    try {
      const res = await fetch(`/api/claims/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejectReason: reason }),
      });
      if (res.ok) {
        logAction({ userName: user.name, action: 'reject', entity: 'claim', entityId: id, details: JSON.stringify({ reason }) });
        loadClaims();
      }
    } catch (error) {
      console.error('Reject error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/claims/${id}`, { method: 'DELETE' });
      if (res.ok) {
        logAction({ userName: user.name, action: 'delete', entity: 'claim', entityId: id });
        loadClaims();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete');
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleChangeStatus = async (id: string, newStatus: string, extraData?: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/claims/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_status', newStatus, ...extraData }),
      });
      if (res.ok) {
        logAction({ userName: user.name, action: 'status_change', entity: 'claim', entityId: id, details: JSON.stringify({ newStatus }) });
        loadClaims();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to change status');
      }
    } catch (error) {
      console.error('Change status error:', error);
    }
  };

  // Action dialog state (for partial approve amount entry)
  const [actionDialog, setActionDialog] = useState<{ type: string; claim: Claim } | null>(null);
  const [actionValue, setActionValue] = useState('');

  // Bulk selection state
  const [selectedClaims, setSelectedClaims] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const toggleClaim = (id: string) => {
    setSelectedClaims(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedClaims.size === claims.length) {
      setSelectedClaims(new Set());
    } else {
      setSelectedClaims(new Set(claims.map(c => c.id)));
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject' | 'clear') => {
    const selectedIds = Array.from(selectedClaims);
    if (selectedIds.length === 0) return;

    const confirmMsg = action === 'approve'
      ? `Approve ${selectedIds.length} selected claims?`
      : action === 'reject'
      ? `Reject ${selectedIds.length} selected claims?`
      : `Clear ${selectedIds.length} selected claims?`;
    
    if (!confirm(confirmMsg)) return;
    
    let clearedBy = '';
    if (action === 'clear') {
      clearedBy = prompt('Enter name of person who cleared these claims:') || '';
      if (!clearedBy.trim()) return;
    }

    setBulkProcessing(true);
    let successCount = 0;

    for (const id of selectedIds) {
      try {
        let body: Record<string, unknown>;
        if (action === 'approve') {
          body = { action: 'approve' };
        } else if (action === 'reject') {
          body = { action: 'reject', rejectReason: 'Bulk rejection' };
        } else {
          body = { action: 'clear', clearedBy };
        }
        const res = await fetch(`/api/claims/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          successCount++;
          if (action === 'approve') logAction({ userName: user.name, action: 'bulk_approve', entity: 'claim', entityId: id });
          else if (action === 'reject') logAction({ userName: user.name, action: 'bulk_reject', entity: 'claim', entityId: id });
          else if (action === 'clear') logAction({ userName: user.name, action: 'bulk_clear', entity: 'claim', entityId: id, details: JSON.stringify({ clearedBy }) });
        }
      } catch {
        // continue
      }
    }

    setBulkProcessing(false);
    setSelectedClaims(new Set());
    loadClaims();
    alert(`${successCount} of ${selectedIds.length} claims ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'cleared'} successfully.`);
  };


  const formatAmount = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  // 24-hour edit lock check
  const isOlderThan24hr = (claim: Claim) => {
    return new Date(claim.createdAt).getTime() + 24 * 60 * 60 * 1000 < Date.now();
  };

  // WhatsApp helper function
  const getWhatsAppText = (claim: Claim) => {
    const formatAmt = (a: number) => `Rs. ${a.toLocaleString()}`;
    if (claim.status === 'cleared') {
      return `\u2705 Al-Falah Traders - Claim Cleared\n\nClaim ID: ${claim.claimNumber}\nShop: ${claim.shop.name}\nCompany: ${claim.company.name}\nTotal Claim: ${formatAmt(claim.totalAmount)}${claim.approvedAmount ? `\nCleared Amount: ${formatAmt(claim.approvedAmount)}` : ''}\n\nClaim clear ho chuki hai. JazakAllah.`;
    } else if (claim.status === 'approved' || claim.status === 'partially_approved') {
      return `\u2705 Al-Falah Traders - Claim Approved\n\nClaim ID: ${claim.claimNumber}\nShop: ${claim.shop.name}\nCompany: ${claim.company.name}\nTotal Claim: ${formatAmt(claim.totalAmount)}${claim.approvedAmount ? `\nApproved Amount: ${formatAmt(claim.approvedAmount)}` : ''}\n\nClaim approve ho chuki hai.`;
    } else {
      return `\u2705 Al-Falah Traders - Expiry Stock Received\n\nClaim ID: ${claim.claimNumber}\nShop: ${claim.shop.name}\nCompany: ${claim.company.name}\nAmount: ${formatAmt(claim.totalAmount)}\nDate: ${new Date(claim.date).toLocaleDateString()}\n\nClaim receive ho chuki hai. JazakAllah.`;
    }
  };

  const handleWhatsApp = (claim: Claim) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(getWhatsAppText(claim))}`, '_blank');
  };

  // Confirm dialog handler
  const handleConfirm = async () => {
    if (!confirmDialog) return;
    const { type, claim, value, newStatus } = confirmDialog;

    switch (type) {
      case 'approve':
        await handleApprove(claim.id);
        break;
      case 'reject':
        if (!value.trim()) return;
        await handleReject(claim.id, value);
        break;
      case 'delete':
        if (value !== claim.claimNumber) {
          alert('Claim number does not match!');
          return;
        }
        await handleDelete(claim.id);
        break;
      case 'clear':
        if (!value.trim()) return;
        await handleClear(claim.id, value);
        break;
      case 'change_status':
        if (newStatus) await handleChangeStatus(claim.id, newStatus);
        break;
    }
    setConfirmDialog(null);
  };

  // Keyboard shortcuts: Ctrl+N = New Claim, Esc = Close detail/form
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        // Only for admin or orderbooker
        if (user.role === 'admin' || user.role === 'orderbooker') {
          e.preventDefault();
          setShowForm(true);
        }
      }
      if (e.key === 'Escape') {
        if (confirmDialog) setConfirmDialog(null);
        else if (viewClaim) setViewClaim(null);
        else if (showForm) { setShowForm(false); setEditClaim(null); setQuickClaimFrom(null); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewClaim, showForm, user.role, confirmDialog]);

  // Helper: render the ⋯ dropdown menu items based on claim status and user role
  const renderDropdownItems = (claim: Claim) => {
    const items: React.ReactNode[] = [];

    // Pending claims
    if (claim.status === 'pending') {
      if (isAdmin) {
        items.push(
          <DropdownMenuItem key="quick" onClick={() => { setQuickClaimFrom(claim); setShowForm(true); }} className="text-teal-700 focus:bg-teal-50 focus:text-teal-800 cursor-pointer">
            📋 Quick Claim
          </DropdownMenuItem>,
          <DropdownMenuItem key="edit" onClick={() => { setEditClaim(claim); setShowForm(true); }} className="text-emerald-700 focus:bg-emerald-50 focus:text-emerald-800 cursor-pointer" disabled={isOlderThan24hr(claim)}>
            ✏️ Edit Claim {isOlderThan24hr(claim) ? '(Locked)' : ''}
          </DropdownMenuItem>,
          <DropdownMenuSeparator key="sep-pending1" />,
          <DropdownMenuItem key="approve" onClick={() => setConfirmDialog({ type: 'approve', claim, value: '' })} className="text-green-700 focus:bg-green-50 focus:text-green-800 cursor-pointer">
            ✅ Approve Claim
          </DropdownMenuItem>,
          <DropdownMenuItem key="partial" onClick={() => { setActionDialog({ type: 'partial', claim }); setActionValue(''); }} className="text-orange-700 focus:bg-orange-50 focus:text-orange-800 cursor-pointer">
            ⚠️ Partial Approve
          </DropdownMenuItem>,
          <DropdownMenuItem key="reject" onClick={() => setConfirmDialog({ type: 'reject', claim, value: '' })} className="text-red-700 focus:bg-red-50 focus:text-red-800 cursor-pointer">
            ✖ Reject Claim
          </DropdownMenuItem>,
          <DropdownMenuSeparator key="sep-pending2" />,
          <DropdownMenuItem key="delete" onClick={() => setConfirmDialog({ type: 'delete', claim, value: '' })} className="text-red-700 focus:bg-red-50 focus:text-red-800 cursor-pointer">
            🗑️ Delete Claim
          </DropdownMenuItem>
        );
      }
      // Order booker: Edit own pending claims < 24hr
      if (!isAdmin && user.role === 'orderbooker' && claim.orderBookerId === user.orderBookerId && !isOlderThan24hr(claim)) {
        items.push(
          <DropdownMenuItem key="quick-ob" onClick={() => { setQuickClaimFrom(claim); setShowForm(true); }} className="text-teal-700 focus:bg-teal-50 focus:text-teal-800 cursor-pointer">
            📋 Quick Claim
          </DropdownMenuItem>,
          <DropdownMenuItem key="edit-ob" onClick={() => { setEditClaim(claim); setShowForm(true); }} className="text-emerald-700 focus:bg-emerald-50 focus:text-emerald-800 cursor-pointer">
            ✏️ Edit Claim
          </DropdownMenuItem>
        );
      }
    }

    // Approved claims
    if (isAdmin && claim.status === 'approved') {
      items.push(
        <DropdownMenuItem key="clear" onClick={() => setConfirmDialog({ type: 'clear', claim, value: '' })} className="text-blue-700 focus:bg-blue-50 focus:text-blue-800 cursor-pointer">
          💰 Clear Payment
        </DropdownMenuItem>,
        <DropdownMenuSeparator key="sep-approved1" />,
        <DropdownMenuItem key="status-pending" onClick={() => setConfirmDialog({ type: 'change_status', claim, value: '', newStatus: 'pending' })} className="text-yellow-700 focus:bg-yellow-50 focus:text-yellow-800 cursor-pointer">
          🔄 Change Status &gt; Pending
        </DropdownMenuItem>,
        <DropdownMenuItem key="status-partial" onClick={() => { setActionDialog({ type: 'change_partial', claim }); setActionValue(''); }} className="text-orange-700 focus:bg-orange-50 focus:text-orange-800 cursor-pointer">
          🔄 Change Status &gt; Partial Approve
        </DropdownMenuItem>,
        <DropdownMenuItem key="status-reject" onClick={() => setConfirmDialog({ type: 'change_status', claim, value: '', newStatus: 'rejected' })} className="text-red-700 focus:bg-red-50 focus:text-red-800 cursor-pointer">
          🔄 Change Status &gt; Rejected
        </DropdownMenuItem>
      );
    }

    // Partially approved claims
    if (isAdmin && claim.status === 'partially_approved') {
      items.push(
        <DropdownMenuItem key="clear-partial" onClick={() => setConfirmDialog({ type: 'clear', claim, value: '' })} className="text-blue-700 focus:bg-blue-50 focus:text-blue-800 cursor-pointer">
          💰 Clear Payment
        </DropdownMenuItem>,
        <DropdownMenuSeparator key="sep-partial1" />,
        <DropdownMenuItem key="status-pending-partial" onClick={() => setConfirmDialog({ type: 'change_status', claim, value: '', newStatus: 'pending' })} className="text-yellow-700 focus:bg-yellow-50 focus:text-yellow-800 cursor-pointer">
          🔄 Change Status &gt; Pending
        </DropdownMenuItem>,
        <DropdownMenuItem key="status-approved-partial" onClick={() => setConfirmDialog({ type: 'change_status', claim, value: '', newStatus: 'approved' })} className="text-green-700 focus:bg-green-50 focus:text-green-800 cursor-pointer">
          🔄 Change Status &gt; Approved
        </DropdownMenuItem>,
        <DropdownMenuItem key="status-change-partial-amount" onClick={() => { setActionDialog({ type: 'change_partial', claim }); setActionValue(''); }} className="text-orange-700 focus:bg-orange-50 focus:text-orange-800 cursor-pointer">
          🔄 Change Status &gt; Change Partial Amount
        </DropdownMenuItem>,
        <DropdownMenuItem key="status-reject-partial" onClick={() => setConfirmDialog({ type: 'change_status', claim, value: '', newStatus: 'rejected' })} className="text-red-700 focus:bg-red-50 focus:text-red-800 cursor-pointer">
          🔄 Change Status &gt; Rejected
        </DropdownMenuItem>
      );
    }

    // Cleared claims
    if (isAdmin && claim.status === 'cleared') {
      items.push(
        <DropdownMenuItem key="status-pending-cleared" onClick={() => setConfirmDialog({ type: 'change_status', claim, value: '', newStatus: 'pending' })} className="text-yellow-700 focus:bg-yellow-50 focus:text-yellow-800 cursor-pointer">
          🔄 Change Status &gt; Pending
        </DropdownMenuItem>,
        <DropdownMenuItem key="status-approved-cleared" onClick={() => setConfirmDialog({ type: 'change_status', claim, value: '', newStatus: 'approved' })} className="text-green-700 focus:bg-green-50 focus:text-green-800 cursor-pointer">
          🔄 Change Status &gt; Approved
        </DropdownMenuItem>,
        <DropdownMenuSeparator key="sep-cleared1" />,
        <DropdownMenuItem key="status-partial-cleared" onClick={() => { setActionDialog({ type: 'change_partial', claim }); setActionValue(''); }} className="text-orange-700 focus:bg-orange-50 focus:text-orange-800 cursor-pointer">
          🔄 Change Status &gt; Partial
        </DropdownMenuItem>
      );
    }

    // Rejected claims
    if (isAdmin && claim.status === 'rejected') {
      items.push(
        <DropdownMenuItem key="status-pending-rejected" onClick={() => setConfirmDialog({ type: 'change_status', claim, value: '', newStatus: 'pending' })} className="text-yellow-700 focus:bg-yellow-50 focus:text-yellow-800 cursor-pointer">
          🔄 Change Status &gt; Pending
        </DropdownMenuItem>,
        <DropdownMenuItem key="status-approved-rejected" onClick={() => setConfirmDialog({ type: 'change_status', claim, value: '', newStatus: 'approved' })} className="text-green-700 focus:bg-green-50 focus:text-green-800 cursor-pointer">
          🔄 Change Status &gt; Approved
        </DropdownMenuItem>,
        <DropdownMenuSeparator key="sep-rejected1" />,
        <DropdownMenuItem key="status-partial-rejected" onClick={() => { setActionDialog({ type: 'change_partial', claim }); setActionValue(''); }} className="text-orange-700 focus:bg-orange-50 focus:text-orange-800 cursor-pointer">
          🔄 Change Status &gt; Partial Approve
        </DropdownMenuItem>
      );
    }

    return items;
  };

  if (showForm) {
    return (
      <ClaimForm
        claim={editClaim}
        companies={companies}
        user={user}
        existingClaims={claims}
        quickClaim={quickClaimFrom ? { companyId: quickClaimFrom.companyId, shopId: quickClaimFrom.shopId, supplierId: quickClaimFrom.supplierId, orderBookerId: quickClaimFrom.orderBookerId, claimNumber: quickClaimFrom.claimNumber } : null}
        onSave={() => {
          setShowForm(false);
          setEditClaim(null);
          setQuickClaimFrom(null);
          loadClaims();
        }}
        onCancel={() => {
          setShowForm(false);
          setEditClaim(null);
          setQuickClaimFrom(null);
        }}
      />
    );
  }

  if (viewClaim) {
    return (
      <ClaimDetail
        claim={viewClaim}
        user={user}
        onBack={() => {
          setViewClaim(null);
          loadClaims();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-bold text-emerald-800 flex items-center gap-2">
            <FileText className="h-6 w-6" />
            {user.role === 'orderbooker' ? 'My Claims' : 'Claims Management'}
          </h2>
          <p className="text-muted-foreground">{claims.length} claims found</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              onClick={() => window.open('/api/export/claims', '_blank')}
            >
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
          )}
          <Button
            className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg btn-enhanced btn-ripple text-sm font-semibold px-6 py-3 rounded-xl"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-5 w-5 mr-2" />
            New Claim
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <Card className="shadow-sm animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by claim # or shop name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant={showFilters ? 'default' : 'outline'}
              onClick={() => setShowFilters(!showFilters)}
              className={`shrink-0 btn-enhanced ${showFilters ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}`}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          <div className={`grid transition-all duration-300 ease-in-out ${showFilters ? 'grid-rows-[1fr] opacity-100 mt-4 pt-4 border-t' : 'grid-rows-[0fr] opacity-0 overflow-hidden'}`}>
            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="partially_approved">Partially Approved</SelectItem>
                    <SelectItem value="cleared">Cleared</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>

                {isAdmin && (
                  <Select value={filterCompany} onValueChange={setFilterCompany}>
                    <SelectTrigger>
                      <SelectValue placeholder="Company" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Companies</SelectItem>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {isAdmin && (
                  <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                    <SelectTrigger>
                      <SelectValue placeholder="Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Suppliers</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {isAdmin && (
                  <Select value={filterOrderBooker} onValueChange={setFilterOrderBooker}>
                    <SelectTrigger>
                      <SelectValue placeholder="Order Booker" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Order Bookers</SelectItem>
                      {orderBookers.map((ob) => (
                        <SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    placeholder="From"
                    className="text-xs"
                  />
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    placeholder="To"
                    className="text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Claims Cards (Mobile) / Table (Desktop) */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading claims...</p>
          </div>
        </div>
      ) : claims.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-muted-foreground text-lg font-medium">No claims found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or create a new claim</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="sm:hidden space-y-3 overflow-y-auto max-h-[calc(100vh-250px)] pb-4">
            {claims.map((claim, index) => (
              <Card
                key={claim.id}
                className="shadow-sm animate-fade-in-up overflow-hidden"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <CardContent className="p-4">
                  {/* Card Header: Checkbox + Claim # + Status */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      {isAdmin && (
                        <Checkbox
                          checked={selectedClaims.has(claim.id)}
                          onCheckedChange={() => toggleClaim(claim.id)}
                          className="mr-1"
                        />
                      )}
                      <button
                        onClick={() => setViewClaim(claim)}
                        className="font-bold text-emerald-700 text-base hover:text-emerald-900 hover:underline cursor-pointer transition-colors"
                        title="Click to view claim details"
                      >
                        {claim.claimNumber}
                      </button>
                      {isOlderThan24hr(claim) && claim.status === 'pending' && (
                        <span title="Edit locked (24hr passed)" className="text-gray-400">
                          <Lock className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    <Badge className={`${statusColors[claim.status]} border text-xs`}>
                      {statusLabels[claim.status]}
                    </Badge>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm mb-3">
                    <div>
                      <span className="text-muted-foreground text-xs">Date</span>
                      <p className="font-medium">{new Date(claim.date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Company</span>
                      <p className="font-medium">{claim.company.name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Shop</span>
                      <p className="font-medium truncate">{claim.shop.name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Supplier</span>
                      <p className="font-medium truncate">{claim.supplier.name}</p>
                    </div>
                    {claim.createdBy && (
                      <div>
                        <span className="text-muted-foreground text-xs">Entered By</span>
                        <p className="font-medium text-purple-700">{claim.createdBy}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground text-xs">Total Claim</span>
                      <p className="font-bold text-emerald-700">{formatAmount(claim.totalAmount)}</p>
                    </div>
                    {claim.deductionAmount > 0 && (
                      <div>
                        <span className="text-muted-foreground text-xs">Deduction ({claim.company.claimDeductionPercent}%)</span>
                        <p className="font-bold text-amber-700">-{formatAmount(claim.deductionAmount)}</p>
                      </div>
                    )}
                    {claim.deductionAmount > 0 && (
                      <div>
                        <span className="text-muted-foreground text-xs">Net Amount</span>
                        <p className="font-bold text-blue-700">{formatAmount(claim.netAmount)}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground text-xs">
                        {claim.status === 'cleared' ? 'Cleared' : claim.status === 'rejected' ? 'Rejected' : 'Approved'}
                      </span>
                      <p className={`font-medium ${claim.status === 'cleared' ? 'text-blue-700' : 'text-green-700'}`}>
                        {claim.approvedAmount ? formatAmount(claim.approvedAmount) : '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Remaining</span>
                      <p className={`font-medium ${claim.totalAmount - (claim.approvedAmount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {claim.status === 'rejected' ? '-' : formatAmount(claim.totalAmount - (claim.approvedAmount || 0))}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Status</span>
                      <p>
                        <Badge className={`${statusColors[claim.status]} border text-xs`}>
                          {statusLabels[claim.status]}
                        </Badge>
                      </p>
                    </div>
                  </div>

                  {/* Safe Actions - Always visible + ⋯ More Actions Menu */}
                  <div className="flex gap-2 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-blue-300 text-blue-600 hover:bg-blue-50 rounded-lg"
                      onClick={() => setViewClaim(claim)}
                    >
                      <Eye className="h-4 w-4 mr-1" /> View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-green-400 text-green-600 hover:bg-green-50 rounded-lg"
                      onClick={() => handleWhatsApp(claim)}
                    >
                      <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                    </Button>
                    {/* ⋯ More Actions Menu */}
                    {renderDropdownItems(claim).length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="px-3 rounded-lg">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[200px]">
                          {renderDropdownItems(claim)}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table View */}
          <Card className="hidden sm:block shadow-sm animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[calc(100vh-280px)]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b bg-gray-50 dark:bg-gray-800/50">
                      {isAdmin && (
                        <th className="py-3 px-2 font-medium">
                          <Checkbox
                            checked={selectedClaims.size === claims.length && claims.length > 0}
                            onCheckedChange={toggleAll}
                          />
                        </th>
                      )}
                      <th className="text-left py-3 px-4 font-medium">Claim #</th>
                      <th className="text-left py-3 px-4 font-medium">Date</th>
                      <th className="text-left py-3 px-4 font-medium">Company</th>
                      <th className="text-left py-3 px-4 font-medium">Shop</th>
                      <th className="text-left py-3 px-4 font-medium">Order Booker</th>
                      <th className="text-left py-3 px-4 font-medium">Entered By</th>
                      <th className="text-right py-3 px-4 font-medium">Total Claim</th>
                      <th className="text-right py-3 px-4 font-medium">Cleared</th>
                      <th className="text-right py-3 px-4 font-medium">Remaining</th>
                      <th className="text-center py-3 px-4 font-medium">Status</th>
                      <th className="text-center py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map((claim, index) => (
                      <tr
                        key={claim.id}
                        className="border-b table-row-hover animate-fade-in-up"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        {isAdmin && (
                          <td className="py-3 px-2">
                            <Checkbox
                              checked={selectedClaims.has(claim.id)}
                              onCheckedChange={() => toggleClaim(claim.id)}
                            />
                          </td>
                        )}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setViewClaim(claim)}
                              className="font-medium text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer transition-colors text-left"
                              title="Click to view claim details"
                            >
                              {claim.claimNumber}
                            </button>
                            {isOlderThan24hr(claim) && claim.status === 'pending' && (
                              <span title="Edit locked (24hr passed)" className="text-gray-400">
                                <Lock className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">{new Date(claim.date).toLocaleDateString()}</td>
                        <td className="py-3 px-4">{claim.company.name}</td>
                        <td className="py-3 px-4">{claim.shop.name}</td>
                        <td className="py-3 px-4">{claim.orderBooker?.name || '-'}</td>
                        <td className="py-3 px-4">{claim.createdBy || '-'}</td>
                        <td className="py-3 px-4 text-right font-medium">
                          {claim.deductionAmount > 0 ? (
                            <div>
                              <div className="text-blue-700">{formatAmount(claim.netAmount)}</div>
                              <div className="text-xs text-amber-600">-{formatAmount(claim.deductionAmount)} ({claim.company.claimDeductionPercent}%)</div>
                            </div>
                          ) : formatAmount(claim.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-blue-700">
                          {claim.approvedAmount ? formatAmount(claim.approvedAmount) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          {claim.status === 'rejected' ? '-' : (
                            <span className={claim.totalAmount - (claim.approvedAmount || 0) > 0 ? 'text-red-600' : 'text-green-600'}>
                              {formatAmount(claim.totalAmount - (claim.approvedAmount || 0))}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={`${statusColors[claim.status]} border text-xs transition-transform duration-200 hover:scale-105 cursor-default`}>
                            {statusLabels[claim.status]}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View - always available */}
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 border-blue-300 text-blue-600 hover:bg-blue-100 hover:text-blue-800 btn-enhanced btn-ripple rounded-lg"
                              onClick={() => setViewClaim(claim)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            {/* WhatsApp Quick Share */}
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 border-green-400 text-green-600 hover:bg-green-100 hover:text-green-800 btn-enhanced btn-ripple rounded-lg"
                              onClick={() => handleWhatsApp(claim)}
                              title="Share on WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>

                            {/* ⋯ More Actions Menu */}
                            {renderDropdownItems(claim).length > 0 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-gray-800 btn-enhanced btn-ripple rounded-lg"
                                    title="More Actions"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-[220px]">
                                  {renderDropdownItems(claim)}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Action Dialog (for partial approve amount entry) */}
      {actionDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setActionDialog(null)}>
          <Card className="w-full max-w-md animate-scale-in shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {actionDialog.type === 'partial' && <><AlertTriangle className="h-5 w-5 text-orange-500" /> Partial Approve</>}
                {actionDialog.type === 'change_partial' && <><AlertTriangle className="h-5 w-5 text-orange-500" /> Change to Partial Approve</>}
                {actionDialog.type === 'clear' && <><Banknote className="h-5 w-5 text-blue-500" /> Clear Claim</>}
                {actionDialog.type === 'reject' && <><XCircle className="h-5 w-5 text-red-500" /> Reject Claim</>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Claim: <strong>{actionDialog.claim.claimNumber}</strong> — Total: {formatAmount(actionDialog.claim.totalAmount)}
                {actionDialog.claim.approvedAmount && actionDialog.claim.status !== 'pending' && (
                  <span className="ml-2 text-green-600">(Current Approved: {formatAmount(actionDialog.claim.approvedAmount)})</span>
                )}
              </p>
              {(actionDialog.type === 'partial' || actionDialog.type === 'change_partial') && (
                <div>
                  <label className="text-sm font-medium">Approved Amount (Rs.)</label>
                  <Input
                    type="number"
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    placeholder={`Enter approved amount (max: ${actionDialog.claim.totalAmount})`}
                    className="mt-1"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-1">Total claim amount: {formatAmount(actionDialog.claim.totalAmount)}</p>
                </div>
              )}
              {actionDialog.type === 'clear' && (
                <div>
                  <label className="text-sm font-medium">Cleared By *</label>
                  <Input
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    placeholder="Enter name of person who cleared"
                    className="mt-1"
                    autoFocus
                  />
                </div>
              )}
              {actionDialog.type === 'reject' && (
                <div>
                  <label className="text-sm font-medium">Reject Reason *</label>
                  <Input
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    placeholder="Enter reason for rejection"
                    className="mt-1"
                    autoFocus
                  />
                </div>
              )}
              <div className="flex gap-3 justify-end pt-2">
                <Button variant="outline" onClick={() => setActionDialog(null)} className="btn-enhanced">
                  Cancel
                </Button>
                <Button
                  className={`btn-enhanced text-white shadow-md ${
                    actionDialog.type === 'reject'
                      ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                      : actionDialog.type === 'partial' || actionDialog.type === 'change_partial'
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
                      : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
                  }`}
                  onClick={() => {
                    if (actionDialog.type === 'partial') {
                      handlePartialApprove(actionDialog.claim.id, Number(actionValue));
                    } else if (actionDialog.type === 'change_partial') {
                      handleChangeStatus(actionDialog.claim.id, 'partially_approved', { approvedAmount: Number(actionValue) });
                    } else if (actionDialog.type === 'clear') {
                      handleClear(actionDialog.claim.id, actionValue);
                    } else if (actionDialog.type === 'reject') {
                      handleReject(actionDialog.claim.id, actionValue);
                    }
                    setActionDialog(null);
                  }}
                  disabled={(actionDialog.type === 'clear' || actionDialog.type === 'reject') ? !actionValue.trim() : !actionValue}
                >
                  Confirm
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirm Dialog for Destructive Actions */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl animate-scale-in">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {confirmDialog.type === 'approve' && <><CheckCircle className="h-5 w-5 text-green-500" /> Approve Claim</>}
                {confirmDialog.type === 'reject' && <><XCircle className="h-5 w-5 text-red-500" /> Reject Claim</>}
                {confirmDialog.type === 'delete' && <><Trash2 className="h-5 w-5 text-red-500" /> Delete Claim</>}
                {confirmDialog.type === 'clear' && <><Banknote className="h-5 w-5 text-blue-500" /> Clear Payment</>}
                {confirmDialog.type === 'change_status' && <><RotateCcw className="h-5 w-5 text-yellow-500" /> Change Status</>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Claim info summary */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Claim #</span>
                  <span className="font-bold">{confirmDialog.claim.claimNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Company</span>
                  <span className="font-medium">{confirmDialog.claim.company.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shop</span>
                  <span className="font-medium">{confirmDialog.claim.shop.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-bold text-emerald-700">{formatAmount(confirmDialog.claim.totalAmount)}</span>
                </div>
              </div>

              {/* Approve confirmation */}
              {confirmDialog.type === 'approve' && (
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to approve this claim? This will set the approved amount to the full claim amount.
                </p>
              )}

              {/* Reject reason input */}
              {confirmDialog.type === 'reject' && (
                <div>
                  <label className="text-sm font-medium">Reject Reason *</label>
                  <Input
                    value={confirmDialog.value}
                    onChange={(e) => setConfirmDialog({ ...confirmDialog, value: e.target.value })}
                    placeholder="Enter reason for rejection"
                    className="mt-1"
                    autoFocus
                  />
                </div>
              )}

              {/* Delete claim number confirmation */}
              {confirmDialog.type === 'delete' && (
                <>
                  <p className="text-sm text-red-600 font-medium">
                    This action cannot be undone. This will permanently delete the claim and all its items.
                  </p>
                  <div>
                    <label className="text-sm font-medium">
                      Type <strong>{confirmDialog.claim.claimNumber}</strong> to confirm
                    </label>
                    <Input
                      value={confirmDialog.value}
                      onChange={(e) => setConfirmDialog({ ...confirmDialog, value: e.target.value })}
                      placeholder={`Type "${confirmDialog.claim.claimNumber}" to confirm`}
                      className="mt-1"
                      autoFocus
                    />
                  </div>
                </>
              )}

              {/* Clear payment - enter cleared by name */}
              {confirmDialog.type === 'clear' && (
                <div>
                  <label className="text-sm font-medium">Cleared By *</label>
                  <Input
                    value={confirmDialog.value}
                    onChange={(e) => setConfirmDialog({ ...confirmDialog, value: e.target.value })}
                    placeholder="Enter name of person who cleared this claim"
                    className="mt-1"
                    autoFocus
                  />
                </div>
              )}

              {/* Change status confirmation */}
              {confirmDialog.type === 'change_status' && confirmDialog.newStatus && (
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to change the status of this claim from{' '}
                  <strong>{statusLabels[confirmDialog.claim.status]}</strong> to{' '}
                  <strong>{statusLabels[confirmDialog.newStatus]}</strong>?
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConfirmDialog(null)}
                >
                  Cancel
                </Button>
                <Button
                  className={`flex-1 text-white shadow-md ${
                    confirmDialog.type === 'approve'
                      ? 'bg-green-600 hover:bg-green-700'
                      : confirmDialog.type === 'reject' || confirmDialog.type === 'delete'
                      ? 'bg-red-600 hover:bg-red-700'
                      : confirmDialog.type === 'clear'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-yellow-600 hover:bg-yellow-700'
                  }`}
                  onClick={handleConfirm}
                  disabled={
                    (confirmDialog.type === 'reject' || confirmDialog.type === 'clear') ? !confirmDialog.value.trim() :
                    confirmDialog.type === 'delete' ? confirmDialog.value !== confirmDialog.claim.claimNumber :
                    false
                  }
                >
                  Confirm
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {isAdmin && selectedClaims.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t shadow-lg animate-fade-in-up">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-emerald-800">
                {selectedClaims.size} claim{selectedClaims.size > 1 ? 's' : ''} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedClaims(new Set())}
              >
                Cancel
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleBulkAction('approve')}
                disabled={bulkProcessing}
              >
                {bulkProcessing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                Approve All
              </Button>
              <Button
                size="sm"
                className="bg-red-500 hover:bg-red-600 text-white"
                onClick={() => handleBulkAction('reject')}
                disabled={bulkProcessing}
              >
                {bulkProcessing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                Reject All
              </Button>
              {Array.from(selectedClaims).every(id => {
                const claim = claims.find(c => c.id === id);
                return claim?.status === 'approved' || claim?.status === 'partially_approved';
              }) && (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => handleBulkAction('clear')}
                  disabled={bulkProcessing}
                >
                  {bulkProcessing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Banknote className="h-4 w-4 mr-1" />}
                  Clear All
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
