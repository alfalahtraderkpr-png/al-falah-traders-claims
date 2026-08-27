'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { ClaimForm } from './claim-form';
import { ClaimDetail } from './claim-detail';
import {
  Loader2, Plus, Search, Eye, Trash2, CheckCircle, XCircle, Banknote, FileText,
  AlertTriangle, RotateCcw, MessageCircle, Lock, Download, MoreHorizontal, Split,
  ChevronLeft, ChevronRight, FileDown, FileSpreadsheet, Lightbulb,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { logAction } from '@/lib/audit';

interface ClaimListProps {
  user: { id: string; name: string; email: string; role: string; orderBookerId: string | null };
  autoOpenForm?: boolean;
  onAutoOpenHandled?: () => void;
}

// Map internal status → mockup badge class
const statusBdg: Record<string, string> = {
  pending: 'pending',
  approved: 'arrived',
  partial: 'partial',
  cleared: 'cleared',
  rejected: 'rejected',
  // Legacy statuses (old data compatibility)
  arrived_approved: 'arrived',
  partially_approved: 'partial',
  partially_cleared: 'partial',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  approved: 'Arrived',
  partial: 'Partial',
  cleared: 'Cleared',
  rejected: 'Rejected',
  // Legacy
  arrived_approved: 'Arrived',
  partially_approved: 'Partial',
  partially_cleared: 'Partial',
};

// Order booker sees "Stock Not Received" instead of "Pending"
const statusLabelsOB: Record<string, string> = {
  ...statusLabels,
  pending: 'Stock Not Received',
};

const getStatusLabel = (status: string, isOrderBooker: boolean) => {
  return isOrderBooker ? (statusLabelsOB[status] || status) : (statusLabels[status] || status);
};

// Helper: normalize legacy status to current status
const normalizeStatus = (status: string) => {
  if (status === 'arrived_approved') return 'approved';
  if (status === 'partially_approved' || status === 'partially_cleared') return 'partial';
  return status;
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

const PAGE_SIZE = 20;

export function ClaimList({ user, autoOpenForm, onAutoOpenHandled }: ClaimListProps) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orderBookers, setOrderBookers] = useState<OrderBooker[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

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
  const [quickClaimFrom, setQuickClaimFrom] = useState<Claim | null>(null);

  const isAdmin = user.role === 'admin';

  // Confirm dialog state for destructive actions
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'approve' | 'reject' | 'delete' | 'clear' | 'change_status';
    claim: Claim;
    value: string;
    newStatus?: string;
  } | null>(null);

  // Auto-open the New Claim form (triggered by FAB / topbar button)
  useEffect(() => {
    if (autoOpenForm) {
      setShowForm(true);
      onAutoOpenHandled?.();
    }
  }, [autoOpenForm, onAutoOpenHandled]);

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

  // Reset pagination whenever the result set / filters change
  useEffect(() => {
    setPage(1);
  }, [claims.length, filterStatus, filterCompany, filterSupplier, filterOrderBooker, filterDateFrom, filterDateTo, search]);

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

  const handlePartiallyClear = async (id: string, clearedAmount: number) => {
    try {
      const res = await fetch(`/api/claims/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'partial', clearedAmount }),
      });
      if (res.ok) {
        logAction({ userName: user.name, action: 'partial', entity: 'claim', entityId: id, details: JSON.stringify({ clearedAmount }) });
        loadClaims();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to mark as partial');
      }
    } catch (error) {
      console.error('Partial clear error:', error);
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

  // Action dialog state
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

  const formatAmount = (amount: number) => `Rs ${amount.toLocaleString()}`;

  // 24-hour edit lock check
  const isOlderThan24hr = (claim: Claim) => {
    return new Date(claim.createdAt).getTime() + 24 * 60 * 60 * 1000 < Date.now();
  };

  // WhatsApp helper function
  const getWhatsAppText = (claim: Claim) => {
    const formatAmt = (a: number) => `Rs. ${a.toLocaleString()}`;
    const normStatus = normalizeStatus(claim.status);
    if (normStatus === 'cleared') {
      return `\u2705 Al-Falah Traders - Claim Cleared\n\nClaim ID: ${claim.claimNumber}\nShop: ${claim.shop.name}\nCompany: ${claim.company.name}\nTotal Claim: ${formatAmt(claim.totalAmount)}${claim.approvedAmount ? `\nCleared Amount: ${formatAmt(claim.approvedAmount)}` : ''}\n\nClaim clear ho chuki hai. JazakAllah.`;
    } else if (normStatus === 'approved') {
      return `\u2705 Al-Falah Traders - Claim Approved\n\nClaim ID: ${claim.claimNumber}\nShop: ${claim.shop.name}\nCompany: ${claim.company.name}\nTotal Claim: ${formatAmt(claim.totalAmount)}${claim.approvedAmount ? `\nApproved Amount: ${formatAmt(claim.approvedAmount)}` : ''}\n\nClaim approve ho chuki hai.`;
    } else if (normStatus === 'partial') {
      return `\u2705 Al-Falah Traders - Claim Partial\n\nClaim ID: ${claim.claimNumber}\nShop: ${claim.shop.name}\nCompany: ${claim.company.name}\nTotal Claim: ${formatAmt(claim.totalAmount)}${claim.approvedAmount ? `\nCleared So Far: ${formatAmt(claim.approvedAmount)}` : ''}${claim.approvedAmount ? `\nRemaining: ${formatAmt(claim.totalAmount - claim.approvedAmount)}` : ''}\n\nPartial amount deduct hui hai.`;
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
  // FLOW: pending → approved → partial → cleared
  const renderDropdownItems = (claim: Claim) => {
    const items: React.ReactNode[] = [];
    const normStatus = normalizeStatus(claim.status);

    // ===== PENDING claims =====
    if (normStatus === 'pending') {
      if (isAdmin) {
        items.push(
          <DropdownMenuItem key="quick" onClick={() => { setQuickClaimFrom(claim); setShowForm(true); }} className="cursor-pointer">
            📋 Quick Claim
          </DropdownMenuItem>,
          <DropdownMenuItem key="edit" onClick={() => { setEditClaim(claim); setShowForm(true); }} className="cursor-pointer" disabled={isOlderThan24hr(claim)}>
            ✏️ Edit Claim {isOlderThan24hr(claim) ? '(Locked)' : ''}
          </DropdownMenuItem>,
          <DropdownMenuSeparator key="sep-pending1" />,
          <DropdownMenuItem key="approve" onClick={() => setConfirmDialog({ type: 'approve', claim, value: '' })} className="cursor-pointer">
            ✅ Approve (Stock Arrived)
          </DropdownMenuItem>,
          <DropdownMenuItem key="partial" onClick={() => { setActionDialog({ type: 'partial_clear', claim }); setActionValue(''); }} className="cursor-pointer">
            ⚠️ Partially Clear (Deduct Partial Amount)
          </DropdownMenuItem>,
          <DropdownMenuItem key="reject" onClick={() => setConfirmDialog({ type: 'reject', claim, value: '' })} className="cursor-pointer">
            ✖ Reject Claim
          </DropdownMenuItem>,
          <DropdownMenuSeparator key="sep-pending2" />,
          <DropdownMenuItem key="delete" onClick={() => setConfirmDialog({ type: 'delete', claim, value: '' })} className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700">
            🗑️ Delete Claim
          </DropdownMenuItem>
        );
      }
      // Order booker: Edit own pending claims < 24hr
      if (!isAdmin && user.role === 'orderbooker' && claim.orderBookerId === user.orderBookerId && !isOlderThan24hr(claim)) {
        items.push(
          <DropdownMenuItem key="quick-ob" onClick={() => { setQuickClaimFrom(claim); setShowForm(true); }} className="cursor-pointer">
            📋 Quick Claim
          </DropdownMenuItem>,
          <DropdownMenuItem key="edit-ob" onClick={() => { setEditClaim(claim); setShowForm(true); }} className="cursor-pointer">
            ✏️ Edit Claim
          </DropdownMenuItem>
        );
      }
    }

    // ===== APPROVED claims (Stock arrived, payment NOT deducted from shopkeeper) =====
    if (isAdmin && normStatus === 'approved') {
      items.push(
        <DropdownMenuItem key="partial-clear" onClick={() => { setActionDialog({ type: 'partial_clear', claim }); setActionValue(''); }} className="cursor-pointer">
          💰 Partially Clear (Deduct Partial Amount)
        </DropdownMenuItem>,
        <DropdownMenuItem key="full-clear" onClick={() => setConfirmDialog({ type: 'clear', claim, value: '' })} className="cursor-pointer">
          💰 Full Clear (Deduct Full Amount)
        </DropdownMenuItem>,
        <DropdownMenuSeparator key="sep-approved1" />,
        <DropdownMenuItem key="status-pending" onClick={() => setConfirmDialog({ type: 'change_status', claim, value: '', newStatus: 'pending' })} className="cursor-pointer">
          🔄 Back to Pending
        </DropdownMenuItem>,
        <DropdownMenuItem key="status-reject" onClick={() => setConfirmDialog({ type: 'change_status', claim, value: '', newStatus: 'rejected' })} className="cursor-pointer">
          🔄 Reject Claim
        </DropdownMenuItem>
      );
    }

    // ===== PARTIAL claims (Some amount deducted, more pending) =====
    if (isAdmin && normStatus === 'partial') {
      items.push(
        <DropdownMenuItem key="partial-clear-more" onClick={() => { setActionDialog({ type: 'partial_clear', claim }); setActionValue(''); }} className="cursor-pointer">
          💰 Partially Clear More
        </DropdownMenuItem>,
        <DropdownMenuItem key="full-clear-partial" onClick={() => setConfirmDialog({ type: 'clear', claim, value: '' })} className="cursor-pointer">
          💰 Full Clear (Deduct Remaining)
        </DropdownMenuItem>,
        <DropdownMenuSeparator key="sep-partial1" />,
        <DropdownMenuItem key="status-pending-partial" onClick={() => setConfirmDialog({ type: 'change_status', claim, value: '', newStatus: 'pending' })} className="cursor-pointer">
          🔄 Back to Pending
        </DropdownMenuItem>,
        <DropdownMenuItem key="status-approved-partial" onClick={() => setConfirmDialog({ type: 'change_status', claim, value: '', newStatus: 'approved' })} className="cursor-pointer">
          🔄 Back to Approved
        </DropdownMenuItem>,
        <DropdownMenuItem key="status-reject-partial" onClick={() => setConfirmDialog({ type: 'change_status', claim, value: '', newStatus: 'rejected' })} className="cursor-pointer">
          🔄 Reject Claim
        </DropdownMenuItem>
      );
    }

    // ===== CLEARED claims (Full amount settled) =====
    if (isAdmin && normStatus === 'cleared') {
      items.push(
        <DropdownMenuItem key="status-pending-cleared" onClick={() => setConfirmDialog({ type: 'change_status', claim, value: '', newStatus: 'pending' })} className="cursor-pointer">
          🔄 Back to Pending
        </DropdownMenuItem>,
        <DropdownMenuItem key="status-approved-cleared" onClick={() => setConfirmDialog({ type: 'change_status', claim, value: '', newStatus: 'approved' })} className="cursor-pointer">
          🔄 Back to Approved
        </DropdownMenuItem>,
        <DropdownMenuItem key="status-partial" onClick={() => setConfirmDialog({ type: 'change_status', claim, value: '', newStatus: 'partial' })} className="cursor-pointer">
          🔄 Back to Partially Cleared
        </DropdownMenuItem>
      );
    }

    // ===== REJECTED claims =====
    if (isAdmin && normStatus === 'rejected') {
      items.push(
        <DropdownMenuItem key="status-pending-rejected" onClick={() => setConfirmDialog({ type: 'change_status', claim, value: '', newStatus: 'pending' })} className="cursor-pointer">
          🔄 Back to Pending
        </DropdownMenuItem>,
        <DropdownMenuItem key="status-approved-rejected" onClick={() => setConfirmDialog({ type: 'change_status', claim, value: '', newStatus: 'approved' })} className="cursor-pointer">
          🔄 Approve Directly
        </DropdownMenuItem>
      );
    }

    // Order booker: Resubmit rejected claims
    if (!isAdmin && user.role === 'orderbooker' && normStatus === 'rejected' && claim.orderBookerId === user.orderBookerId) {
      items.push(
        <DropdownMenuItem key="resubmit-ob" onClick={() => { setEditClaim(claim); setShowForm(true); }} className="cursor-pointer">
          ✏️ Edit & Resubmit
        </DropdownMenuItem>
      );
    }

    return items;
  };

  // ── Client-side pagination (20 per page — mockup spec) ──────────
  const totalPages = Math.max(1, Math.ceil(claims.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedClaims = useMemo(
    () => claims.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [claims, safePage]
  );
  const pageNumbers = useMemo(() => {
    const pages: (number | '…')[] = [];
    const push = (p: number | '…') => pages.push(p);
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) push(i);
    } else {
      push(1);
      if (safePage > 3) push('…l');
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) push(i);
      if (safePage < totalPages - 2) push('…r');
      push(totalPages);
    }
    return pages;
  }, [totalPages, safePage]);

  const totals = useMemo(() => {
    const processed = claims.reduce((s, c) => s + c.totalAmount, 0);
    const pendingCount = claims.filter((c) => normalizeStatus(c.status) === 'pending').length;
    return { processed, pendingCount };
  }, [claims]);

  const filtersActive = filterStatus !== 'all' || filterCompany !== 'all' || filterSupplier !== 'all' ||
    filterOrderBooker !== 'all' || !!filterDateFrom || !!filterDateTo || !!search;

  const companyChipIdx = (name: string) => {
    const i = companies.findIndex((c) => c.name === name);
    return i >= 0 ? i % 3 : 0;
  };
  const chipCls = ['c1', 'c2', 'c3'];

  const handleExportPDF = async () => {
    try {
      const url = `/api/export/report-pdf?type=summary&t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `al-falah-claims-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      alert('PDF export failed. Please try again.');
    }
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
    <>
      <div className="page-head">
        <div>
          <div className="h1">{user.role === 'orderbooker' ? 'My Claims' : 'Claims'}</div>
          <div className="sub">
            {claims.length} total claims · {formatAmount(totals.processed)} processed ·{' '}
            <span style={{ color: 'var(--af-warn)', fontWeight: 600 }}>{totals.pendingCount} pending</span>
          </div>
        </div>
        <div className="ph-actions">
          {isAdmin && (
            <>
              <button className="btn btn-o" onClick={handleExportPDF}>
                <FileDown className="ic sm" /> PDF
              </button>
              <button className="btn btn-o" onClick={() => window.open('/api/export/claims', '_blank')}>
                <FileSpreadsheet className="ic sm" /> Excel
              </button>
            </>
          )}
          <button className="btn btn-p" onClick={() => setShowForm(true)}>
            <Plus className="ic sm" /> New Claim
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters card">
        <div className="f-search">
          <Search className="ic sm" />
          <input
            placeholder="Search by claim # or shop name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="sel" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="pending">{isAdmin ? 'Pending' : 'Stock Not Received'}</option>
          <option value="approved">Arrived &amp; Approved</option>
          <option value="partial">Partially Cleared</option>
          <option value="cleared">Cleared</option>
          <option value="rejected">Rejected</option>
        </select>
        {isAdmin && (
          <select className="sel" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
            <option value="all">All Companies</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {isAdmin && (
          <select className="sel" value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)}>
            <option value="all">All Suppliers</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {isAdmin && (
          <select className="sel" value={filterOrderBooker} onChange={(e) => setFilterOrderBooker(e.target.value)}>
            <option value="all">All Order Bookers</option>
            {orderBookers.map((ob) => <option key={ob.id} value={ob.id}>{ob.name}</option>)}
          </select>
        )}
        <input
          className="input"
          type="date"
          style={{ width: 'auto' }}
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          title="Date from"
        />
        <div className="spacer" />
        {filtersActive && (
          <span className="chip">Filters active</span>
        )}
      </div>

      {/* Claims table */}
      {loading ? (
        <div className="card"><div className="empty-state" style={{ minHeight: 260 }}>
          <Loader2 className="ic animate-spin" />
          <p className="small">Loading claims…</p>
        </div></div>
      ) : claims.length === 0 ? (
        <div className="card"><div className="empty-state" style={{ minHeight: 260 }}>
          <FileText className="ic" />
          <p style={{ color: 'var(--af-text)', fontWeight: 600 }}>No claims found</p>
          <p className="small">Try adjusting your filters or create a new claim</p>
        </div></div>
      ) : (
        <div className="card tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {isAdmin && (
                  <th style={{ width: 36 }}>
                    <Checkbox
                      checked={selectedClaims.size === claims.length && claims.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                )}
                <th>Claim #</th>
                <th>Date</th>
                <th>Company</th>
                <th>Shop</th>
                <th>Order Booker</th>
                <th>Entered By</th>
                <th className="num">Items</th>
                <th className="num">Total</th>
                <th className="num">Net Amount</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedClaims.map((claim) => {
                const norm = normalizeStatus(claim.status);
                return (
                  <tr key={claim.id} className={norm === 'pending' ? 'row-warn' : ''}>
                    {isAdmin && (
                      <td>
                        <Checkbox
                          checked={selectedClaims.has(claim.id)}
                          onCheckedChange={() => toggleClaim(claim.id)}
                        />
                      </td>
                    )}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          className="strong claim-no"
                          style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit' }}
                          onClick={() => setViewClaim(claim)}
                          title="Click to view claim details"
                        >
                          {claim.claimNumber}
                        </button>
                        {isOlderThan24hr(claim) && norm === 'pending' && (
                          <span title="Edit locked (24hr passed)" style={{ color: 'var(--af-text3)', display: 'inline-flex' }}>
                            <Lock className="ic sm" style={{ width: 13, height: 13 }} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{new Date(claim.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td><span className={`chip ${chipCls[companyChipIdx(claim.company.name)]}`}>{claim.company.name}</span></td>
                    <td>{claim.shop.name}</td>
                    <td>{claim.orderBooker?.name || '-'}</td>
                    <td>{claim.createdBy || '-'}</td>
                    <td className="num">{claim.claimItems.length}</td>
                    <td className="num">
                      {claim.deductionAmount > 0 ? (
                        <div>
                          <div>{formatAmount(claim.totalAmount)}</div>
                          <div className="small" style={{ color: 'var(--af-warn)' }}>−{formatAmount(claim.deductionAmount)} ({claim.company.claimDeductionPercent}%)</div>
                        </div>
                      ) : formatAmount(claim.totalAmount)}
                    </td>
                    <td className="num strong">
                      {norm === 'rejected' ? '—' : formatAmount(claim.netAmount || claim.totalAmount)}
                      {norm !== 'pending' && norm !== 'rejected' && claim.approvedAmount ? (
                        <div className="small" style={{ color: 'var(--af-info)' }}>paid {formatAmount(claim.approvedAmount)}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className={`bdg ${statusBdg[claim.status] || 'neutral'}`}>
                        {getStatusLabel(claim.status, !isAdmin)}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="ra" title="View Details" onClick={() => setViewClaim(claim)}>
                          <Eye className="ic sm" />
                        </button>
                        <button className="ra violet" title="Share on WhatsApp" onClick={() => handleWhatsApp(claim)}>
                          <MessageCircle className="ic sm" />
                        </button>
                        {renderDropdownItems(claim).length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="ra" title="More Actions">
                                <MoreHorizontal className="ic sm" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[220px]">
                              {renderDropdownItems(claim)}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="tbl-foot">
            <span>Showing <b style={{ color: 'var(--af-text)' }}>{pagedClaims.length}</b> of {claims.length} claims</span>
            <div className="pager">
              <button className="pg" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} title="Previous page">
                <ChevronLeft className="ic sm" />
              </button>
              {pageNumbers.map((p, i) =>
                p === '…l' || p === '…r' ? (
                  <span key={`e${i}`} style={{ color: 'var(--af-text3)', padding: '0 2px', alignSelf: 'center' }}>…</span>
                ) : (
                  <button
                    key={p}
                    className={`pg ${p === safePage ? 'active' : ''}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                )
              )}
              <button className="pg" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} title="Next page">
                <ChevronRight className="ic sm" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="note">
        <Lightbulb className="ic" />
        <div><b>Pagination + fast load:</b> Ab poori list ek saath load nahi hogi — 20 claims per page. Is se 1000+ claims par bhi speed same rahegi. <b>Pending rows</b> par soft amber highlight taake attention jaye.</div>
      </div>

      {/* Action Dialog (for partial clear amount entry) */}
      {actionDialog && (
        <div className="af-ovl" onClick={() => setActionDialog(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dlg-h">
              <div className="dlg-t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {actionDialog.type === 'partial_clear' && <><Split className="ic sm" style={{ color: 'var(--af-warn)' }} /> Partially Clear — Deduct Amount</>}
                {actionDialog.type === 'clear' && <><Banknote className="ic sm" style={{ color: 'var(--af-info)' }} /> Full Clear — Deduct Full Amount</>}
                {actionDialog.type === 'reject' && <><XCircle className="ic sm" style={{ color: 'var(--af-bad)' }} /> Reject Claim</>}
              </div>
              <button className="icon-btn" onClick={() => setActionDialog(null)} aria-label="Close"><XCircle className="ic sm" /></button>
            </div>
            <div className="dlg-b">
              <p className="small" style={{ color: 'var(--af-text2)' }}>
                Claim: <strong style={{ color: 'var(--af-text)' }}>{actionDialog.claim.claimNumber}</strong> — Total: {formatAmount(actionDialog.claim.totalAmount)}
                {actionDialog.claim.approvedAmount && normalizeStatus(actionDialog.claim.status) !== 'pending' && (
                  <span style={{ color: 'var(--af-ok)' }}> (Already Deducted: {formatAmount(actionDialog.claim.approvedAmount)})</span>
                )}
              </p>
              {actionDialog.type === 'partial_clear' && (
                <div className="field">
                  <label className="label">Amount to Deduct from Shopkeeper (Rs.)</label>
                  <input
                    className="input"
                    type="number"
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    placeholder={`Enter amount to deduct (max: ${actionDialog.claim.netAmount || actionDialog.claim.totalAmount})`}
                    autoFocus
                  />
                  <p className="small muted">
                    Net claim amount: {formatAmount(actionDialog.claim.netAmount || actionDialog.claim.totalAmount)}
                    {actionDialog.claim.approvedAmount && normalizeStatus(actionDialog.claim.status) === 'partial' && (
                      <span> | Remaining: {formatAmount((actionDialog.claim.netAmount || actionDialog.claim.totalAmount) - actionDialog.claim.approvedAmount)}</span>
                    )}
                  </p>
                </div>
              )}
              {actionDialog.type === 'clear' && (
                <div className="field">
                  <label className="label">Cleared By <span className="req">*</span></label>
                  <input
                    className="input"
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    placeholder="Enter name of person who cleared"
                    autoFocus
                  />
                </div>
              )}
              {actionDialog.type === 'reject' && (
                <div className="field">
                  <label className="label">Reject Reason <span className="req">*</span></label>
                  <input
                    className="input"
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    placeholder="Enter reason for rejection"
                    autoFocus
                  />
                </div>
              )}
            </div>
            <div className="dlg-f">
              <button className="btn btn-g" onClick={() => setActionDialog(null)}>Cancel</button>
              <button
                className={`btn ${actionDialog.type === 'reject' ? 'btn-d' : actionDialog.type === 'partial_clear' ? 'btn-p' : 'btn-p'}`}
                onClick={() => {
                  if (actionDialog.type === 'partial_clear') {
                    handlePartiallyClear(actionDialog.claim.id, Number(actionValue));
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
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog for Destructive Actions */}
      {confirmDialog && (
        <div className="af-ovl">
          <div className="dialog">
            <div className="dlg-h">
              <div className="dlg-t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {confirmDialog.type === 'approve' && <><CheckCircle className="ic sm" style={{ color: 'var(--af-ok)' }} /> Approve Claim (Stock Arrived)</>}
                {confirmDialog.type === 'reject' && <><XCircle className="ic sm" style={{ color: 'var(--af-bad)' }} /> Reject Claim</>}
                {confirmDialog.type === 'delete' && <><Trash2 className="ic sm" style={{ color: 'var(--af-bad)' }} /> Delete Claim</>}
                {confirmDialog.type === 'clear' && <><Banknote className="ic sm" style={{ color: 'var(--af-info)' }} /> Full Clear Payment</>}
                {confirmDialog.type === 'change_status' && <><RotateCcw className="ic sm" style={{ color: 'var(--af-warn)' }} /> Change Status</>}
              </div>
            </div>
            <div className="dlg-b">
              {/* Claim info summary */}
              <div style={{ background: 'var(--af-surface2)', border: '1px solid var(--af-border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="muted">Claim #</span>
                  <b>{confirmDialog.claim.claimNumber}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="muted">Company</span>
                  <span style={{ fontWeight: 600, color: 'var(--af-text)' }}>{confirmDialog.claim.company.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="muted">Shop</span>
                  <span style={{ fontWeight: 600, color: 'var(--af-text)' }}>{confirmDialog.claim.shop.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="muted">Total Amount</span>
                  <b style={{ color: 'var(--af-primary)' }}>{formatAmount(confirmDialog.claim.totalAmount)}</b>
                </div>
              </div>

              {confirmDialog.type === 'approve' && (
                <p className="small" style={{ color: 'var(--af-text2)', lineHeight: 1.6 }}>
                  Are you sure you want to approve this claim? This confirms that stock has arrived on the floor. Amount deduction from shopkeeper is still pending.
                </p>
              )}

              {confirmDialog.type === 'reject' && (
                <div className="field">
                  <label className="label">Reject Reason <span className="req">*</span></label>
                  <input
                    className="input"
                    value={confirmDialog.value}
                    onChange={(e) => setConfirmDialog({ ...confirmDialog, value: e.target.value })}
                    placeholder="Enter reason for rejection"
                    autoFocus
                  />
                </div>
              )}

              {confirmDialog.type === 'delete' && (
                <>
                  <p className="small" style={{ color: 'var(--af-text2)', fontWeight: 500, lineHeight: 1.6 }}>
                    Claim <b>Trash</b> mein chale jayega — 30 din tak wapis recover kiya ja sakta hai (System → Trash).
                    Uske baad ye permanently delete ho jayega.
                  </p>
                  <div className="field">
                    <label className="label">
                      Type <strong>{confirmDialog.claim.claimNumber}</strong> to confirm
                    </label>
                    <input
                      className="input"
                      value={confirmDialog.value}
                      onChange={(e) => setConfirmDialog({ ...confirmDialog, value: e.target.value })}
                      placeholder={`Type "${confirmDialog.claim.claimNumber}" to confirm`}
                      autoFocus
                    />
                  </div>
                </>
              )}

              {confirmDialog.type === 'clear' && (
                <div className="field">
                  <label className="label">Cleared By <span className="req">*</span></label>
                  <input
                    className="input"
                    value={confirmDialog.value}
                    onChange={(e) => setConfirmDialog({ ...confirmDialog, value: e.target.value })}
                    placeholder="Enter name of person who cleared this claim"
                    autoFocus
                  />
                  <p className="small muted">Full amount will be deducted from shopkeeper&apos;s account.</p>
                </div>
              )}

              {confirmDialog.type === 'change_status' && confirmDialog.newStatus && (
                <p className="small" style={{ color: 'var(--af-text2)', lineHeight: 1.6 }}>
                  Are you sure you want to change the status of this claim from{' '}
                  <strong>{statusLabels[confirmDialog.claim.status]}</strong> to{' '}
                  <strong>{statusLabels[confirmDialog.newStatus]}</strong>?
                </p>
              )}
            </div>
            <div className="dlg-f">
              <button className="btn btn-g" onClick={() => setConfirmDialog(null)}>Cancel</button>
              <button
                className={`btn ${confirmDialog.type === 'approve' ? 'btn-s' : (confirmDialog.type === 'reject' || confirmDialog.type === 'delete') ? 'btn-d' : 'btn-p'}`}
                onClick={handleConfirm}
                disabled={
                  (confirmDialog.type === 'reject' || confirmDialog.type === 'clear') ? !confirmDialog.value.trim() :
                  confirmDialog.type === 'delete' ? confirmDialog.value !== confirmDialog.claim.claimNumber :
                  false
                }
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {isAdmin && selectedClaims.size > 0 && (
        <div className="bottomnav" style={{ display: 'flex', position: 'fixed', zIndex: 70, padding: '10px 14px', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--af-primary)' }}>
            {selectedClaims.size} claim{selectedClaims.size > 1 ? 's' : ''} selected
          </span>
          <button className="btn btn-g btn-sm" onClick={() => setSelectedClaims(new Set())}>Clear</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-s btn-sm" onClick={() => handleBulkAction('approve')} disabled={bulkProcessing}>
              {bulkProcessing ? <Loader2 className="ic sm animate-spin" /> : <CheckCircle className="ic sm" />} Approve All
            </button>
            <button className="btn btn-d btn-sm" onClick={() => handleBulkAction('reject')} disabled={bulkProcessing}>
              {bulkProcessing ? <Loader2 className="ic sm animate-spin" /> : <XCircle className="ic sm" />} Reject All
            </button>
            {Array.from(selectedClaims).every(id => {
              const claim = claims.find(c => c.id === id);
              const norm = normalizeStatus(claim?.status || '');
              return norm === 'approved' || norm === 'partial';
            }) && (
              <button className="btn btn-p btn-sm" onClick={() => handleBulkAction('clear')} disabled={bulkProcessing}>
                {bulkProcessing ? <Loader2 className="ic sm animate-spin" /> : <Banknote className="ic sm" />} Clear All
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
