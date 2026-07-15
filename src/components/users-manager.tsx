'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Trash2, Key, Shield, UserCheck, Search, Copy, Check, Lock, Mail, Calendar, User, Eye } from 'lucide-react';

interface OrderBooker {
  id: string;
  name: string;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  orderBookerId: string | null;
  orderBooker: { id: string; name: string } | null;
  createdAt: string;
}

// Action Button Component - Icon top, text bottom
function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
  disabled = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  variant?: 'blue' | 'red' | 'green' | 'amber';
  disabled?: boolean;
}) {
  const colorMap = {
    blue: 'border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300',
    red: 'border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300',
    green: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300',
    amber: 'border-amber-200 text-amber-600 hover:bg-amber-50 hover:border-amber-300',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-xl border-2 bg-white transition-all duration-200 active:scale-95 ${colorMap[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <Icon className="h-4 w-4" />
      <span className="text-[10px] font-semibold leading-tight">{label}</span>
    </button>
  );
}

export function UsersManager() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [orderBookers, setOrderBookers] = useState<OrderBooker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'orderbooker',
    orderBookerId: '',
  });
  const [newPassword, setNewPassword] = useState('');
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [usersRes, obRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/order-bookers'),
      ]);
      if (usersRes.ok) {
        const data = await usersRes.json();
        if (Array.isArray(data)) setUsers(data);
      }
      if (obRes.ok) {
        const data = await obRes.json();
        if (Array.isArray(data)) setOrderBookers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Get order bookers that don't have a login yet
  const availableOrderBookers = orderBookers.filter(
    (ob) => !users.some((u) => u.orderBookerId === ob.id)
  );

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      alert('Sab fields bharna zaroori hai');
      return;
    }
    if (form.role === 'orderbooker' && !form.orderBookerId) {
      alert('Order Booker select karein');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to create user');
        return;
      }
      setDialogOpen(false);
      setForm({ name: '', email: '', password: '', role: 'orderbooker', orderBookerId: '' });
      load();
    } catch (e) {
      console.error(e);
      alert('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: UserItem) => {
    // Admin accounts can never be deleted
    if (user.role === 'admin') {
      alert('Admin account delete nahi ho sakta! Yeh permanent hai.');
      return;
    }
    if (!confirm(`"${user.name}" ka login delete karein?`)) return;
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to delete');
        return;
      }
      load();
    } catch (e) {
      console.error(e);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      alert('Password minimum 4 characters ka hona chahiye');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${selectedUser?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_password', password: newPassword }),
      });
      if (res.ok) {
        setPasswordDialogOpen(false);
        setNewPassword('');
        setSelectedUser(null);
        alert('Password update ho gaya!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update password');
      }
    } catch (e) {
      console.error(e);
      alert('Network error');
    } finally {
      setSaving(false);
    }
  };

  const generateAutoCredentials = (obName: string) => {
    const cleanName = obName.toLowerCase().replace(/\s+/g, '');
    const email = `${cleanName}@alfalah.com`;
    const password = `${cleanName}@123`;
    setForm((prev) => ({ ...prev, email, password }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleBulkDeleteOB = async () => {
    if (!confirm(`Sab order booker login accounts delete karein? (${users.filter(u => u.role === 'orderbooker').length} accounts)`)) return;
    setBulkDeleting(true);
    try {
      const res = await fetch('/api/users?action=delete_all_ob', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        load();
      } else {
        alert(data.error || 'Failed to delete');
      }
    } catch (e) {
      console.error(e);
      alert('Network error');
    } finally {
      setBulkDeleting(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.orderBooker?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const adminUsers = filteredUsers.filter((u) => u.role === 'admin');
  const obUsers = filteredUsers.filter((u) => u.role === 'orderbooker');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-bold text-emerald-800 flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Users Management
          </h2>
          <p className="text-muted-foreground">Login accounts manage karein - Admin & Order Booker</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {obUsers.length > 0 && (
            <ActionButton
              icon={Trash2}
              label="Delete All OB"
              variant="red"
              onClick={handleBulkDeleteOB}
              disabled={bulkDeleting}
            />
          )}
          <ActionButton
            icon={Plus}
            label="Create Login"
            variant="green"
            onClick={() => {
              setForm({ name: '', email: '', password: '', role: 'orderbooker', orderBookerId: '' });
              setDialogOpen(true);
            }}
          />
        </div>
      </div>

      {/* Search */}
      <div className="relative animate-fade-in-up" style={{ animationDelay: '50ms' }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or order booker..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <>
          {/* Admin Users */}
          <Card className="shadow-sm animate-fade-in-up border-emerald-200" style={{ animationDelay: '100ms' }}>
            <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50 to-emerald-100/50 rounded-t-lg">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="bg-emerald-600 text-white rounded-lg p-1.5">
                  <Shield className="h-4 w-4" />
                </div>
                Admin Accounts ({adminUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {adminUsers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Koi admin account nahi mila</p>
              ) : (
                <div className="space-y-3">
                  {adminUsers.map((user) => (
                    <div key={user.id} className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gradient-to-r from-emerald-50/80 to-white rounded-xl border border-emerald-100 hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-emerald-800 truncate">{user.name}</p>
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">
                              <Lock className="h-2.5 w-2.5 mr-0.5" /> Permanent
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                            <span className="flex items-center gap-1 min-w-0 truncate"><Mail className="h-3 w-3 shrink-0" /><span className="truncate">{user.email}</span></span>
                            <span className="flex items-center gap-1 shrink-0"><Calendar className="h-3 w-3" />{new Date(user.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <ActionButton
                          icon={Key}
                          label="Password"
                          variant="blue"
                          onClick={() => {
                            setSelectedUser(user);
                            setNewPassword('');
                            setPasswordDialogOpen(true);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Booker Users */}
          <Card className="shadow-sm animate-fade-in-up border-blue-200" style={{ animationDelay: '150ms' }}>
            <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-t-lg">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="bg-blue-600 text-white rounded-lg p-1.5">
                  <UserCheck className="h-4 w-4" />
                </div>
                Order Booker Accounts ({obUsers.length})
              </CardTitle>
              {obUsers.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">Default password: <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">password123</span> (seed accounts)</p>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              {obUsers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Koi order booker login nahi mila</p>
              ) : (
                <div className="space-y-3">
                  {obUsers.map((user) => (
                    <div key={user.id} className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gradient-to-r from-blue-50/80 to-white rounded-xl border border-blue-100 hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-blue-800 truncate">{user.name}</p>
                            {user.orderBooker?.name && (
                              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">
                                {user.orderBooker.name}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                            <span
                              className="flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors min-w-0 truncate"
                              onClick={() => copyToClipboard(user.email, `email-${user.id}`)}
                              title="Click to copy email"
                            >
                              {copied === `email-${user.id}` ? <Check className="h-3 w-3 shrink-0" /> : <Copy className="h-3 w-3 shrink-0" />}
                              <span className="truncate">{user.email}</span>
                            </span>
                            <span className="flex items-center gap-1 shrink-0"><Calendar className="h-3 w-3" />{new Date(user.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <ActionButton
                          icon={Key}
                          label="Password"
                          variant="blue"
                          onClick={() => {
                            setSelectedUser(user);
                            setNewPassword('');
                            setPasswordDialogOpen(true);
                          }}
                        />
                        <ActionButton
                          icon={Trash2}
                          label="Delete"
                          variant="red"
                          onClick={() => handleDelete(user)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Bookers without login */}
          {availableOrderBookers.length > 0 && (
            <Card className="shadow-sm border-dashed border-amber-300 bg-gradient-to-br from-amber-50/50 to-orange-50/30 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
                  <div className="bg-amber-500 text-white rounded-lg p-1.5">
                    <User className="h-4 w-4" />
                  </div>
                  Order Bookers without Login ({availableOrderBookers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  In order bookers ka login account nahi hai. &quot;+&quot; button se unka account banayein.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {availableOrderBookers.map((ob) => (
                    <button
                      key={ob.id}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-dashed border-amber-300 bg-white hover:bg-amber-50 hover:border-amber-400 transition-all active:scale-95 group"
                      onClick={() => {
                        setForm({
                          name: ob.name,
                          email: `${ob.name.toLowerCase().replace(/\s+/g, '')}@alfalah.com`,
                          password: `${ob.name.toLowerCase().replace(/\s+/g, '')}@123`,
                          role: 'orderbooker',
                          orderBookerId: ob.id,
                        });
                        setDialogOpen(true);
                      }}
                    >
                      <div className="h-9 w-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm group-hover:bg-amber-200 transition-colors">
                        {ob.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-amber-800">{ob.name}</span>
                      <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                        <Plus className="h-3 w-3" /> Create
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Create User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-600" />
              Create Login Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v, orderBookerId: v === 'admin' ? '' : form.orderBookerId })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="orderbooker">Order Booker</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.role === 'orderbooker' && (
              <div>
                <Label>Order Booker</Label>
                <Select
                  value={form.orderBookerId}
                  onValueChange={(v) => {
                    const ob = orderBookers.find((o) => o.id === v);
                    if (ob) {
                      setForm({
                        ...form,
                        orderBookerId: v,
                        name: ob.name,
                      });
                      generateAutoCredentials(ob.name);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Order Booker" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOrderBookers.map((ob) => (
                      <SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Full Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter full name"
              />
            </div>

            <div>
              <Label>Email (Login ID)</Label>
              <div className="flex gap-2">
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => copyToClipboard(form.email, 'form-email')}
                  title="Copy email"
                >
                  {copied === 'form-email' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label>Password</Label>
              <div className="flex gap-2">
                <Input
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Enter password"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => copyToClipboard(form.password, 'form-password')}
                  title="Copy password"
                >
                  {copied === 'form-password' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Yeh credentials order booker ko deinge jahan se wo login karega
              </p>
            </div>

            {form.role === 'orderbooker' && form.orderBookerId && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                <p className="font-medium text-emerald-800 mb-1">Login Credentials:</p>
                <p className="text-emerald-700">Email: <span className="font-mono font-medium">{form.email}</span></p>
                <p className="text-emerald-700">Password: <span className="font-mono font-medium">{form.password}</span></p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 btn-enhanced shadow-md"
              onClick={handleCreate}
              disabled={saving}
            >
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : 'Create Login'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-blue-600" />
              Change Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selectedUser?.name}</span> ka password change karein
            </p>
            <div>
              <Label>New Password</Label>
              <Input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
              <p className="text-xs text-muted-foreground mt-1">Minimum 4 characters</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md"
              onClick={handleChangePassword}
              disabled={saving}
            >
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...</> : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
