'use client';

import { useEffect, useState } from 'react';
import {
  Settings, Building2, MapPin, Phone, Mail, Save, RotateCw, CheckCircle2,
  AlertTriangle, DatabaseBackup, Trash2, FileSpreadsheet,
} from 'lucide-react';

interface AppSettings {
  id: string;
  companyName: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  updatedAt: string;
}

export function SettingsManager({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const [form, setForm] = useState({ companyName: '', address: '', city: '', phone: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'bad'; text: string } | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/settings', { cache: 'no-store' });
        if (res.ok) {
          const s: AppSettings = await res.json();
          setForm({
            companyName: s.companyName || '',
            address: s.address || '',
            city: s.city || '',
            phone: s.phone || '',
            email: s.email || '',
          });
          setUpdatedAt(s.updatedAt || null);
        }
      } catch {
        setMessage({ type: 'bad', text: 'Settings load nahi ho sakin' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!form.companyName.trim()) {
      setMessage({ type: 'bad', text: 'Company name khali nahi ho sakta' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const s: AppSettings = await res.json();
        setUpdatedAt(s.updatedAt);
        setMessage({ type: 'ok', text: 'Settings save ho gayi ✓ — ab ye naam receipts aur reports mein dikhega' });
      } else {
        const j = await res.json().catch(() => ({}));
        setMessage({ type: 'bad', text: j.error || 'Save failed' });
      }
    } catch {
      setMessage({ type: 'bad', text: 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state" style={{ minHeight: 320 }}>
        <RotateCw className="ic animate-spin" />
        <p className="small">Loading settings…</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="h1">Settings ⚙️</div>
          <div className="sub">Company profile — receipts, reports aur WhatsApp shares mein yehi details use hongi</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-p" onClick={handleSave} disabled={saving}>
            {saving ? <RotateCw className="ic sm animate-spin" /> : <Save className="ic sm" />}
            Save Changes
          </button>
        </div>
      </div>

      {message && (
        <div className={`note ${message.type === 'bad' ? 'bad-note' : 'ok-note'}`}>
          {message.type === 'ok'
            ? <CheckCircle2 className="ic" />
            : <AlertTriangle className="ic" />}
          <div>{message.text}</div>
        </div>
      )}

      <div className="dash-grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        {/* Profile form */}
        <div className="card">
          <div className="card-h">
            <div className="card-t"><Building2 className="ic sm" /> Company Profile</div>
            <div className="card-sub">Ye details print receipts aur Excel/PDF reports ke header mein aati hain</div>
          </div>
          <div className="card-b">
            <div className="form-grid">
              <div className="field">
                <label className="label">Company Name <span className="req">*</span></label>
                <input
                  className="input"
                  placeholder="Al-Falah Traders"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="label"><MapPin className="ic" style={{ width: 12, height: 12, verticalAlign: -1, marginRight: 4 }} />Address</label>
                <input
                  className="input"
                  placeholder="Shop address, area, city"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="label"><Building2 className="ic" style={{ width: 12, height: 12, verticalAlign: -1, marginRight: 4 }} />City (receipt stamp par yehi show hoga)</label>
                <input
                  className="input"
                  placeholder="Khanpur"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="label"><Phone className="ic" style={{ width: 12, height: 12, verticalAlign: -1, marginRight: 4 }} />Phone</label>
                <input
                  className="input"
                  placeholder="0300-1234567"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="label"><Mail className="ic" style={{ width: 12, height: 12, verticalAlign: -1, marginRight: 4 }} />Email</label>
                <input
                  className="input"
                  type="email"
                  placeholder="info@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            {updatedAt && (
              <div className="small muted" style={{ marginTop: 10 }}>
                Last updated: {new Date(updatedAt).toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-h"><div className="card-t"><Settings className="ic sm" /> Data & Safety</div></div>
            <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-o btn-block" onClick={() => onNavigate?.('backup')}>
                <DatabaseBackup className="ic sm" /> Backup & Restore
              </button>
              <button className="btn btn-o btn-block" onClick={() => onNavigate?.('trash')}>
                <Trash2 className="ic sm" /> Trash (30 din recovery)
              </button>
              <a className="btn btn-o btn-block" href="/api/export/report-excel?type=all&t=1" target="_blank" rel="noreferrer">
                <FileSpreadsheet className="ic sm" /> All Reports Excel
              </a>
            </div>
          </div>

          <div className="card">
            <div className="card-b">
              <div className="strong" style={{ fontSize: 13.5, marginBottom: 6 }}>💡 Tips</div>
              <ul className="small muted" style={{ lineHeight: 1.9, paddingLeft: 18, margin: 0 }}>
                <li>Company name badalne se receipts pr turant naya naam aayega</li>
                <li>Address aur City receipt ke header + stamp par show hoti hai</li>
                <li>Phone number receipt header aur WhatsApp messages mein included hai</li>
                <li>Har hafte ek backup download karna achi aadat hai</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
