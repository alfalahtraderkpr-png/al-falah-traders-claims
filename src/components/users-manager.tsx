'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Trash2, Key, Shield, UserCheck, Search, Copy, Check } from 'lucide-react';

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
    if (user.role === 'admin') {
      const adminCount = users.filter((u) => u.role === 'admin').length;
      if (adminCount <= 1) {
        alert('Last admin delete nahi ho sakta!');
        return;
      }
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
        <Button
          size="sm"
          className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md btn-enhanced btn-ripple rounded-lg px-4 py-2"
          onClick={() => {
            setForm({ name: '', email: '', password: '', role: 'orderbooker', orderBookerId: '' });
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Create Login
        </Button>
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
          <Card className="shadow-sm animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600" />
                Admin Accounts ({adminUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {adminUsers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Koi admin account nahi mila</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-2 px-4 font-medium">Name</th>
                        <th className="text-left py-2 px-4 font-medium">Email</th>
                        <th className="text-center py-2 px-4 font-medium">Role</th>
                        <th className="text-left py-2 px-4 font-medium">Created</th>
                        <th className="text-center py-2 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map((user) => (
                        <tr key={user.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{user.name}</td>
                          <td className="py-3 px-4 text-muted-foreground">{user.email}</td>
                          <td className="py-3 px-4 text-center">
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Admin</Badge>
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 border-blue-300 text-blue-600 hover:bg-blue-50 rounded-lg"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setNewPassword('');
                                  setPasswordDialogOpen(true);
                                }}
                                title="Change Password"
                              >
                                <Key className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 border-red-300 text-red-500 hover:bg-red-50 rounded-lg"
                                onClick={() => handleDelete(user)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Booker Users */}
          <Card className="shadow-sm animate-fade-in-up" style={{ animationDelay: '150ms' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-600" />
                Order Booker Accounts ({obUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {obUsers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Koi order booker login nahi mila</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-2 px-4 font-medium">Name</th>
                        <th className="text-left py-2 px-4 font-medium">Order Booker</th>
                        <th className="text-left py-2 px-4 font-medium">Email</th>
                        <th className="text-center py-2 px-4 font-medium">Role</th>
                        <th className="text-left py-2 px-4 font-medium">Created</th>
                        <th className="text-center py-2 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {obUsers.map((user) => (
                        <tr key={user.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{user.name}</td>
                          <td className="py-3 px-4">
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                              {user.orderBooker?.name || 'N/A'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground text-xs">{user.email}</span>
                              <button
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                                onClick={() => copyToClipboard(user.email, `email-${user.id}`)}
                                title="Copy email"
                              >
                                {copied === `email-${user.id}` ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3 text-gray-400" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200">Order Booker</Badge>
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 border-blue-300 text-blue-600 hover:bg-blue-50 rounded-lg"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setNewPassword('');
                                  setPasswordDialogOpen(true);
                                }}
                                title="Change Password"
                              >
                                <Key className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 border-red-300 text-red-500 hover:bg-red-50 rounded-lg"
                                onClick={() => handleDelete(user)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Bookers without login */}
          {availableOrderBookers.length > 0 && (
            <Card className="shadow-sm border-dashed border-amber-300 bg-amber-50/30 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
                  <UserCheck className="h-5 w-5" />
                  Order Bookers without Login ({availableOrderBookers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  In order bookers ka login account nahi hai. &quot;Create Login&quot; button se unka account banayein.
                </p>
                <div className="flex flex-wrap gap-2">
                  {availableOrderBookers.map((ob) => (
                    <Button
                      key={ob.id}
                      variant="outline"
                      size="sm"
                      className="border-amber-300 text-amber-700 hover:bg-amber-100 rounded-lg"
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
                      <Plus className="h-3 w-3 mr-1" /> {ob.name}
                    </Button>
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
