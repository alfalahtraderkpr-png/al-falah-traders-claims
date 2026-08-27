'use client';

import { useState, useEffect, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, Plus, Trash2, Key, ShieldCheck, UserCheck, Search, Copy, Check,
  Mail, Calendar, Building2, User, Lightbulb,
} from 'lucide-react';

interface OrderBooker {
  id: string;
  name: string;
}

interface Company {
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
  assignedCompanies?: Company[]; // populated for order bookers
  createdAt: string;
}

const AV_GRADIENTS = [
  'linear-gradient(135deg,#4f46e5,#7c3aed)',
  'linear-gradient(135deg,#4f46e5,#6366f1)',
  'linear-gradient(135deg,#7c3aed,#8b5cf6)',
  'linear-gradient(135deg,#0d9488,#14b8a6)',
  'linear-gradient(135deg,#0369a1,#0ea5e9)',
];

export function UsersManager() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [orderBookers, setOrderBookers] = useState<OrderBooker[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [companiesDialogOpen, setCompaniesDialogOpen] = useState(false);
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
    assignedCompanyIds: [] as string[],
  });
  const [newPassword, setNewPassword] = useState('');
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [usersRes, obRes, compRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/order-bookers'),
        fetch('/api/companies'),
      ]);
      if (usersRes.ok) {
        const data = await usersRes.json();
        if (Array.isArray(data)) setUsers(data);
      }
      if (obRes.ok) {
        const data = await obRes.json();
        if (Array.isArray(data)) setOrderBookers(data);
      }
      if (compRes.ok) {
        const data = await compRes.json();
        if (Array.isArray(data)) setCompanies(data);
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
        body: JSON.stringify({
          ...form,
          assignedCompanyIds: form.role === 'orderbooker' ? form.assignedCompanyIds : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to create user');
        return;
      }
      setDialogOpen(false);
      setForm({ name: '', email: '', password: '', role: 'orderbooker', orderBookerId: '', assignedCompanyIds: [] });
      load();
    } catch (e) {
      console.error(e);
      alert('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCompanies = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Send only fields we want to update
          name: selectedUser.name,
          email: selectedUser.email,
          role: selectedUser.role,
          orderBookerId: selectedUser.orderBookerId,
          assignedCompanyIds: form.assignedCompanyIds,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Failed to update companies');
        return;
      }
      setCompaniesDialogOpen(false);
      setSelectedUser(null);
      setForm((prev) => ({ ...prev, assignedCompanyIds: [] }));
      load();
    } catch (e) {
      console.error(e);
      alert('Network error');
    } finally {
      setSaving(false);
    }
  };

  const openCompaniesDialog = (user: UserItem) => {
    setSelectedUser(user);
    setForm((prev) => ({
      ...prev,
      assignedCompanyIds: user.assignedCompanies?.map((c) => c.id) || [],
    }));
    setCompaniesDialogOpen(true);
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

  const initials = (name: string) =>
    name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="h1">Users &amp; Access</div>
          <div className="sub">System logins aur permissions manage karein</div>
        </div>
        <div className="ph-actions">
          {obUsers.length > 0 && (
            <button className="btn btn-do" onClick={handleBulkDeleteOB} disabled={bulkDeleting}>
              {bulkDeleting ? <Loader2 className="ic sm animate-spin" /> : <Trash2 className="ic sm" />} Reset All OB Logins
            </button>
          )}
          <button
            className="btn btn-p"
            onClick={() => {
              setForm({ name: '', email: '', password: '', role: 'orderbooker', orderBookerId: '', assignedCompanyIds: [] });
              setDialogOpen(true);
            }}
          >
            <Plus className="ic sm" /> Add User
          </button>
        </div>
      </div>

      {/* Mini stats */}
      <div className="mini-stats">
        <div className="mstat"><ShieldCheck className="ic sm" /><b>{adminUsers.length}</b> admin</div>
        <div className="mstat"><UserCheck className="ic sm" /><b>{obUsers.length}</b> order booker logins</div>
        <div className="mstat"><User className="ic sm" /><b>{filteredUsers.length}</b> total users</div>
      </div>

      {/* Search */}
      <div className="filters card">
        <div className="f-search">
          <Search className="ic sm" />
          <input placeholder="Search by name, email, or order booker…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="spacer" />
      </div>

      {loading ? (
        <div className="card"><div className="empty-state" style={{ minHeight: 220 }}>
          <Loader2 className="ic animate-spin" />
          <p className="small">Loading users…</p>
        </div></div>
      ) : (
        <div className="card tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>User</th><th>Role</th><th>Linked Order Booker</th><th>Assigned Companies</th><th>Created</th><th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--af-text3)' }} className="small">No users found</td></tr>
              ) : filteredUsers.map((user, index) => (
                <tr key={user.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <div className="av" style={{ background: AV_GRADIENTS[index % AV_GRADIENTS.length] }}>{initials(user.name)}</div>
                      <div>
                        <div className="strong">{user.name}</div>
                        <div className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Mail className="ic" style={{ width: 11, height: 11 }} />{user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`bdg ${user.role === 'admin' ? 'admin' : 'ob'}`}>
                      {user.role === 'admin' ? 'Admin' : 'Order Booker'}
                    </span>
                  </td>
                  <td>{user.orderBooker?.name || <span className="muted">—</span>}</td>
                  <td>
                    {user.role === 'admin' ? (
                      <span className="chip">All companies</span>
                    ) : user.assignedCompanies && user.assignedCompanies.length > 0 ? (
                      <div className="chips">
                        {user.assignedCompanies.map((c, i) => (
                          <span className={`chip ${i % 3 === 0 ? 'c1' : i % 3 === 1 ? 'c2' : 'c3'}`} key={c.id}>{c.name}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="small" style={{ color: 'var(--af-warn)' }}>No company assigned</span>
                    )}
                  </td>
                  <td className="small">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Calendar className="ic" style={{ width: 12, height: 12 }} />
                      {new Date(user.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      {user.role === 'orderbooker' && (
                        <button className="ra" title="Assign companies" onClick={() => openCompaniesDialog(user)}>
                          <Building2 className="ic sm" />
                        </button>
                      )}
                      <button
                        className="ra"
                        title="Change password"
                        onClick={() => {
                          setSelectedUser(user);
                          setNewPassword('');
                          setPasswordDialogOpen(true);
                        }}
                      >
                        <Key className="ic sm" />
                      </button>
                      {user.role !== 'admin' && (
                        <button className="ra danger" title="Delete login" onClick={() => handleDelete(user)}>
                          <Trash2 className="ic sm" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Order Bookers without login */}
      {availableOrderBookers.length > 0 && (
        <div className="card" style={{ borderStyle: 'dashed', borderColor: 'color-mix(in srgb, var(--af-warn) 40%, var(--af-border))' }}>
          <div className="card-h">
            <div>
              <div className="card-t"><User className="ic sm" /> Order Bookers without Login ({availableOrderBookers.length})</div>
              <div className="card-sub">In order bookers ka login account nahi hai — card click karke account banayein</div>
            </div>
          </div>
          <div className="card-b">
            <div className="ob-grid">
              {availableOrderBookers.map((ob, index) => (
                <button
                  key={ob.id}
                  className="ob-card"
                  style={{ cursor: 'pointer', borderStyle: 'dashed', borderColor: 'color-mix(in srgb, var(--af-warn) 40%, var(--af-border))', textAlign: 'left', fontFamily: 'inherit' }}
                  onClick={() => {
                    setForm({
                      name: ob.name,
                      email: `${ob.name.toLowerCase().replace(/\s+/g, '')}@alfalah.com`,
                      password: `${ob.name.toLowerCase().replace(/\s+/g, '')}@123`,
                      role: 'orderbooker',
                      orderBookerId: ob.id,
                      assignedCompanyIds: [],
                    });
                    setDialogOpen(true);
                  }}
                >
                  <div className="ob-top">
                    <div className="av" style={{ width: 46, height: 46, fontSize: 15, background: AV_GRADIENTS[(index + 3) % AV_GRADIENTS.length] }}>
                      {ob.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--af-text)' }}>{ob.name}</div>
                      <span className="bdg rejected" style={{ marginTop: 4 }}>No login</span>
                    </div>
                  </div>
                  <span className="btn btn-o btn-sm btn-block">
                    <Plus className="ic sm" /> Create Login
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="note">
        <Lightbulb className="ic" />
        <div><b>Permissions:</b> Order booker sirf apni assigned companies aur apni hi claims dekh sakta hai (server-side enforce hota hai). Admin sab kuch dekh sakta hai.</div>
      </div>

      {/* Create User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="af-dialog sm:max-w-[460px] max-h-[90vh] overflow-y-auto">
          <div className="dlg-h">
            <DialogTitle className="dlg-t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck className="ic sm" style={{ color: 'var(--af-primary)' }} /> Create Login Account
            </DialogTitle>
          </div>
          <div className="dlg-b">
            <div className="field">
              <label className="label">Role</label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v, orderBookerId: v === 'admin' ? '' : form.orderBookerId })}
              >
                <SelectTrigger className="af-sel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="orderbooker">Order Booker</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.role === 'orderbooker' && (
              <div className="field">
                <label className="label">Order Booker</label>
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
                  <SelectTrigger className="af-sel"><SelectValue placeholder="Select Order Booker" /></SelectTrigger>
                  <SelectContent>
                    {availableOrderBookers.map((ob) => (
                      <SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="field">
              <label className="label">Full Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter full name" />
            </div>

            <div className="field">
              <label className="label">Email (Login ID)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" style={{ flex: 1 }} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
                <button className="ra" type="button" style={{ width: 40, height: 40 }} title="Copy email" onClick={() => copyToClipboard(form.email, 'form-email')}>
                  {copied === 'form-email' ? <Check className="ic sm" style={{ color: 'var(--af-ok)' }} /> : <Copy className="ic sm" />}
                </button>
              </div>
            </div>

            <div className="field">
              <label className="label">Password</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" style={{ flex: 1 }} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Enter password" />
                <button className="ra" type="button" style={{ width: 40, height: 40 }} title="Copy password" onClick={() => copyToClipboard(form.password, 'form-password')}>
                  {copied === 'form-password' ? <Check className="ic sm" style={{ color: 'var(--af-ok)' }} /> : <Copy className="ic sm" />}
                </button>
              </div>
              <p className="small muted">Yeh credentials order booker ko deinge jahan se wo login karega</p>
            </div>

            {form.role === 'orderbooker' && (
              <div style={{ borderTop: '1px solid var(--af-border)', paddingTop: 15 }}>
                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Building2 className="ic sm" style={{ color: 'var(--af-primary)' }} /> Assigned Companies
                </label>
                <p className="small muted" style={{ marginTop: 4, marginBottom: 10 }}>
                  Order booker ko sirf inhi companies ke products aur shops dikhenge. At least ek company zaroor assign karein.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 8 }}>
                  {companies.length === 0 ? (
                    <p className="small" style={{ color: 'var(--af-warn)' }}>Koi company define nahi hai. Pehle Master Data mein companies add karein.</p>
                  ) : companies.map((c) => {
                    const isAssigned = form.assignedCompanyIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`btn btn-sm ${isAssigned ? 'btn-p' : 'btn-o'}`}
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            assignedCompanyIds: isAssigned
                              ? prev.assignedCompanyIds.filter((id) => id !== c.id)
                              : [...prev.assignedCompanyIds, c.id],
                          }));
                        }}
                      >
                        {isAssigned && <Check className="ic sm" style={{ width: 12, height: 12 }} />}
                        {c.name}
                      </button>
                    );
                  })}
                </div>
                {form.assignedCompanyIds.length === 0 && (
                  <p className="small" style={{ color: 'var(--af-warn)', marginTop: 8 }}>
                    ⚠ No company selected — user will see nothing after login.
                  </p>
                )}
              </div>
            )}

            {form.role === 'orderbooker' && form.orderBookerId && (
              <div className="info-tile">
                <div className="k">Login Credentials</div>
                <div className="v" style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {form.email} · {form.password}
                </div>
              </div>
            )}
          </div>
          <div className="dlg-f">
            <button className="btn btn-g" onClick={() => setDialogOpen(false)}>Cancel</button>
            <button className="btn btn-p" onClick={handleCreate} disabled={saving}>
              {saving ? (<><Loader2 className="ic sm animate-spin" /> Creating…</>) : (<><Check className="ic sm" /> Create Login</>)}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Companies Dialog */}
      <Dialog open={companiesDialogOpen} onOpenChange={setCompaniesDialogOpen}>
        <DialogContent className="af-dialog sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
          <div className="dlg-h">
            <DialogTitle className="dlg-t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 className="ic sm" style={{ color: 'var(--af-primary)' }} /> Assign Companies
            </DialogTitle>
          </div>
          <div className="dlg-b">
            <p className="small" style={{ color: 'var(--af-text2)' }}>
              <b style={{ color: 'var(--af-text)' }}>{selectedUser?.name}</b> ko kaunsi companies assign karni hain?
              Order booker ko sirf inhi companies ke products aur shops dikhenge.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 8 }}>
              {companies.length === 0 ? (
                <p className="small" style={{ color: 'var(--af-warn)' }}>Koi company define nahi hai. Pehle Master Data mein companies add karein.</p>
              ) : companies.map((c) => {
                const isAssigned = form.assignedCompanyIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`btn btn-sm ${isAssigned ? 'btn-p' : 'btn-o'}`}
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        assignedCompanyIds: isAssigned
                          ? prev.assignedCompanyIds.filter((id) => id !== c.id)
                          : [...prev.assignedCompanyIds, c.id],
                      }));
                    }}
                  >
                    {isAssigned && <Check className="ic sm" style={{ width: 12, height: 12 }} />}
                    {c.name}
                  </button>
                );
              })}
            </div>
            {form.assignedCompanyIds.length === 0 && (
              <p className="small" style={{ color: 'var(--af-warn)' }}>
                ⚠ No company selected — user will see nothing after login.
              </p>
            )}
          </div>
          <div className="dlg-f">
            <button className="btn btn-g" onClick={() => setCompaniesDialogOpen(false)}>Cancel</button>
            <button className="btn btn-p" onClick={handleSaveCompanies} disabled={saving}>
              {saving ? (<><Loader2 className="ic sm animate-spin" /> Saving…</>) : (<><Check className="ic sm" /> Save Companies</>)}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="af-dialog sm:max-w-[380px]">
          <div className="dlg-h">
            <DialogTitle className="dlg-t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Key className="ic sm" style={{ color: 'var(--af-info)' }} /> Change Password
            </DialogTitle>
          </div>
          <div className="dlg-b">
            <p className="small" style={{ color: 'var(--af-text2)' }}>
              <b style={{ color: 'var(--af-text)' }}>{selectedUser?.name}</b> ka password change karein
            </p>
            <div className="field">
              <label className="label">New Password</label>
              <input className="input" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" autoFocus />
              <p className="small muted">Minimum 4 characters</p>
            </div>
          </div>
          <div className="dlg-f">
            <button className="btn btn-g" onClick={() => setPasswordDialogOpen(false)}>Cancel</button>
            <button className="btn btn-p" onClick={handleChangePassword} disabled={saving}>
              {saving ? (<><Loader2 className="ic sm animate-spin" /> Updating…</>) : (<><Check className="ic sm" /> Update Password</>)}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
