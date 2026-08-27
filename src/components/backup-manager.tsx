'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DatabaseBackup,
  FileSpreadsheet,
  FileJson,
  Upload,
  HardDriveDownload,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  RefreshCw,
  FileText,
  Building2,
  Package,
  Store,
  Users,
  ImageIcon,
  Info,
  AlertTriangle,
  Clock,
} from 'lucide-react';

interface BackupStats {
  counts: {
    users: number;
    companies: number;
    products: number;
    suppliers: number;
    shops: number;
    orderBookers: number;
    claims: number;
    claimItems: number;
    priceHistory: number;
    shopCompanyOrderBookers: number;
    creditLimits: number;
    userCompanies: number;
    auditLogs: number;
    attachments: number;
  };
  attachmentBytes: number;
  estimatedTotalBytes: number;
  serverTime: string;
}

type DownloadPhase = 'idle' | 'structure' | 'photos' | 'building' | 'done' | 'error';
type RestorePhase = 'idle' | 'preview' | 'working' | 'photos' | 'done' | 'error';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'never';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      style={{
        height: 8,
        borderRadius: 99,
        background: 'var(--af-surface2)',
        border: '1px solid var(--af-border)',
        overflow: 'hidden',
        marginBottom: 10,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.min(100, Math.max(2, value))}%`,
          borderRadius: 99,
          background: 'linear-gradient(90deg, var(--af-primary), var(--af-violet))',
          transition: 'width .3s ease',
        }}
      />
    </div>
  );
}

export function BackupManager() {
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Download state
  const [dlPhase, setDlPhase] = useState<DownloadPhase>('idle');
  const [dlProgress, setDlProgress] = useState(0);
  const [dlMessage, setDlMessage] = useState('');

  // Restore state
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<{
    createdAt: string;
    counts: Record<string, number>;
    hasAttachments: number;
  } | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [restorePhase, setRestorePhase] = useState<RestorePhase>('idle');
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreMessage, setRestoreMessage] = useState('');
  const [restoreError, setRestoreError] = useState('');

  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const parsedBackupRef = useRef<{ tables: Record<string, unknown>; createdAt?: string } | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/backup', { cache: 'no-store' });
      if (res.ok) setStats(await res.json());
    } catch {
      // keep null — UI shows unavailable state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    setLastBackup(localStorage.getItem('lastBackupAt'));
  }, [loadStats]);

  // ------------------------------------------------------------------
  // DOWNLOAD FULL BACKUP (JSON) — assembled client-side in chunks so
  // photo data never hits the serverless response-size limit
  // ------------------------------------------------------------------
  const handleDownloadJson = async () => {
    if (dlPhase === 'structure' || dlPhase === 'photos' || dlPhase === 'building') return;

    setDlPhase('structure');
    setDlProgress(5);
    setDlMessage('Reading claims, companies, products & all other records…');

    try {
      // 1. Structural data (everything except photo blobs)
      const res = await fetch('/api/backup/data', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to read data (${res.status})`);
      const backup = await res.json();

      const attachmentMeta: Array<{ id: string; claimId: string; type: string; createdAt: string; url: string }> =
        backup.tables.claimAttachments || [];
      const totalAttachments = attachmentMeta.length;

      // 2. Photo blobs — fetched in small pages
      const fullAttachments: Array<{ id: string; claimId: string; type: string; createdAt: string; url: string }> = [];
      if (totalAttachments > 0) {
        setDlPhase('photos');
        setDlMessage(`Downloading photos (0 / ${totalAttachments})…`);
        const pageSize = 3;
        let offset = 0;
        while (offset < totalAttachments) {
          const ares = await fetch(`/api/backup/attachments?offset=${offset}&limit=${pageSize}`, { cache: 'no-store' });
          if (!ares.ok) throw new Error(`Failed to read photos (${ares.status})`);
          const page = await ares.json();
          fullAttachments.push(...page.attachments);
          offset += page.attachments.length;
          if (page.attachments.length === 0) break; // safety against infinite loop
          setDlProgress(10 + Math.round((80 * Math.min(offset, totalAttachments)) / totalAttachments));
          setDlMessage(`Downloading photos (${Math.min(offset, totalAttachments)} / ${totalAttachments})…`);
        }
      }

      // 3. Assemble final file
      setDlPhase('building');
      setDlProgress(95);
      setDlMessage('Building backup file…');

      const finalBackup = {
        app: 'al-falah-traders-claims',
        version: 1,
        createdAt: new Date().toISOString(),
        exportedBy: 'Al Falah Traders Claims System',
        tables: {
          ...backup.tables,
          claimAttachments: fullAttachments.length > 0 ? fullAttachments : attachmentMeta,
        },
      };

      const blob = new Blob([JSON.stringify(finalBackup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      a.href = url;
      a.download = `al-falah-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      localStorage.setItem('lastBackupAt', new Date().toISOString());
      setLastBackup(new Date().toISOString());
      setDlPhase('done');
      setDlProgress(100);
      setDlMessage(
        `Backup downloaded — ${formatBytes(blob.size)}${fullAttachments.length ? ` (incl. ${fullAttachments.length} photos)` : ''}. Keep this file somewhere safe!`,
      );
      loadStats();
    } catch (e) {
      setDlPhase('error');
      setDlMessage(`Backup failed: ${(e as Error).message}. Please try again.`);
    }
  };

  // ------------------------------------------------------------------
  // DOWNLOAD EXCEL BACKUP
  // ------------------------------------------------------------------
  const handleDownloadExcel = () => {
    window.location.href = '/api/backup/export-excel';
    localStorage.setItem('lastBackupAt', new Date().toISOString());
    setLastBackup(new Date().toISOString());
  };

  // ------------------------------------------------------------------
  // RESTORE
  // ------------------------------------------------------------------
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;

    setFile(f);
    setFilePreview(null);
    setConfirmText('');
    setRestorePhase('idle');
    setRestoreError('');
    parsedBackupRef.current = null;

    try {
      const text = await f.text();
      const parsed = JSON.parse(text);
      if (parsed.app !== 'al-falah-traders-claims') {
        setRestoreError('This file is not an Al Falah Traders backup file.');
        return;
      }
      if (!parsed.tables || typeof parsed.tables !== 'object') {
        setRestoreError('Backup file is missing the "tables" section.');
        return;
      }
      const t = parsed.tables as Record<string, unknown[]>;
      parsedBackupRef.current = parsed;

      const attRows = Array.isArray(t.claimAttachments) ? t.claimAttachments : [];
      const withUrl = attRows.filter((a) => (a as { url?: string })?.url);

      setFilePreview({
        createdAt: parsed.createdAt || 'unknown date',
        counts: {
          Claims: (t.claims || []).length,
          Items: (t.claimItems || []).length,
          Companies: (t.companies || []).length,
          Products: (t.products || []).length,
          Shops: (t.shops || []).length,
          Users: (t.users || []).length,
          Photos: withUrl.length,
        },
        hasAttachments: withUrl.length,
      });
      setRestorePhase('preview');
    } catch {
      setRestoreError('Could not read this file. Make sure it is a valid backup JSON file.');
    }
  };

  const handleRestore = async () => {
    const parsed = parsedBackupRef.current;
    if (!parsed || confirmText !== 'RESTORE') return;

    setRestorePhase('working');
    setRestoreProgress(10);
    setRestoreMessage('Validating backup & restoring data…');
    setRestoreError('');

    try {
      const attachments = ((parsed.tables.claimAttachments as Array<{ url?: string }>) || []).filter((a) => a?.url);
      const approxBytes = file ? file.size : 0;
      // Photos can be several MB each — if the whole file is large, send photos
      // separately one-by-one after the main restore.
      const sendPhotosSeparately = approxBytes > 3 * 1024 * 1024 && attachments.length > 0;

      const payload = {
        ...parsed,
        skipAttachments: sendPhotosSeparately,
      };

      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Restore failed');

      setRestoreProgress(sendPhotosSeparately && attachments.length > 0 ? 40 : 100);
      setRestoreMessage(
        `Restored ${result.restored.claims} claims, ${result.restored.companies} companies, ${result.restored.users} users.` +
          (sendPhotosSeparately ? ' Now uploading photos…' : ''),
      );

      // Upload photos one by one
      if (sendPhotosSeparately && attachments.length > 0) {
        setRestorePhase('photos');
        for (let i = 0; i < attachments.length; i++) {
          const ares = await fetch('/api/backup/restore-attachment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attachments: [attachments[i]] }),
          });
          if (!ares.ok) {
            const aerr = await ares.json().catch(() => ({}));
            throw new Error(`Photo ${i + 1} of ${attachments.length} failed: ${aerr.error || ares.status}`);
          }
          setRestoreProgress(40 + Math.round((55 * (i + 1)) / attachments.length));
          setRestoreMessage(`Uploading photos (${i + 1} / ${attachments.length})…`);
        }
      }

      setRestorePhase('done');
      setRestoreProgress(100);
      setRestoreMessage('Restore complete! Data has been replaced with the backup file contents.');
      loadStats();
    } catch (e) {
      setRestorePhase('error');
      setRestoreError((e as Error).message || 'Restore failed');
    }
  };

  const busyDownloading = dlPhase === 'structure' || dlPhase === 'photos' || dlPhase === 'building';
  const busyRestoring = restorePhase === 'working' || restorePhase === 'photos';

  const kpis = stats
    ? [
        { lbl: 'Claims', val: stats.counts.claims, icon: FileText, kb: 'var(--af-primary-soft)', kc2: 'var(--af-primary)' },
        { lbl: 'Companies', val: stats.counts.companies, icon: Building2, kb: 'var(--af-info-soft)', kc2: 'var(--af-info)' },
        { lbl: 'Products', val: stats.counts.products, icon: Package, kb: 'var(--af-warn-soft)', kc2: 'var(--af-warn)' },
        { lbl: 'Shops', val: stats.counts.shops, icon: Store, kb: 'var(--af-violet-soft)', kc2: 'var(--af-violet)' },
        { lbl: 'Users', val: stats.counts.users, icon: Users, kb: 'var(--af-teal-soft)', kc2: 'var(--af-teal)' },
        { lbl: 'Photos', val: stats.counts.attachments, icon: ImageIcon, kb: 'var(--af-bad-soft)', kc2: 'var(--af-bad)' },
      ]
    : [];

  return (
    <>
      {/* ---------- Page head ---------- */}
      <div className="page-head">
        <div>
          <div className="h1">Backup &amp; Restore</div>
          <div className="sub">
            Poora data aik click mein save karein — claims, companies, products, photos, sab kuch · Last backup:{' '}
            <b style={{ color: 'var(--af-text)' }}>{formatDate(lastBackup)}</b>
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-o" onClick={loadStats} disabled={loading}>
            {loading ? <Loader2 className="ic sm animate-spin" /> : <RefreshCw className="ic sm" />} Refresh
          </button>
        </div>
      </div>

      {/* ---------- KPI overview ---------- */}
      {loading && !stats ? (
        <div className="card">
          <div className="empty-state" style={{ minHeight: 180 }}>
            <Loader2 className="ic animate-spin" />
            <p className="small">Loading database overview…</p>
          </div>
        </div>
      ) : stats ? (
        <>
          <div className="kpis">
            {kpis.map((k) => {
              const Icon = k.icon;
              return (
                <div
                  className="kpi"
                  key={k.lbl}
                  style={{ '--kb': k.kb, '--kc2': k.kc2 } as React.CSSProperties}
                >
                  <div className="kpi-top">
                    <div className="kpi-ic">
                      <Icon className="ic" />
                    </div>
                  </div>
                  <div>
                    <div className="kpi-lbl">{k.lbl}</div>
                    <div className="kpi-val">{k.val.toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
            <div
              className="kpi"
              style={{ '--kb': 'var(--af-ok-soft)', '--kc2': 'var(--af-ok)' } as React.CSSProperties}
            >
              <div className="kpi-top">
                <div className="kpi-ic">
                  <HardDriveDownload className="ic" />
                </div>
              </div>
              <div>
                <div className="kpi-lbl">Est. backup size</div>
                <div className="kpi-val">{formatBytes(stats.estimatedTotalBytes)}</div>
                <div className="kpi-sub">
                  {stats.counts.claimItems.toLocaleString()} claim items · {stats.counts.auditLogs.toLocaleString()} audit entries
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="note">
          <AlertTriangle className="ic" />
          <span>
            Could not load database overview. Check your connection and press <b>Refresh</b>.
          </span>
        </div>
      )}

      {/* ---------- Download card ---------- */}
      <div className="card">
        <div className="card-h">
          <div>
            <div className="card-t">
              <DatabaseBackup className="ic sm" /> Download Backup
            </div>
            <div className="card-sub">Har hafte aik full backup zaroor lein — data loss se bachne ka best tareeqa</div>
          </div>
        </div>
        <div className="card-b">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 14 }}>
            {/* JSON full backup */}
            <div
              style={{
                border: '1.5px solid color-mix(in srgb, var(--af-primary) 30%, transparent)',
                background: 'var(--af-primary-soft)',
                borderRadius: 'var(--af-r)',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <FileJson className="ic lg" style={{ color: 'var(--af-primary)' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Full Backup (JSON)</div>
                  <div className="small muted">Complete · Restorable · Photos included</div>
                </div>
              </div>
              <p className="small" style={{ color: 'var(--af-text2)', lineHeight: 1.55, flex: 1 }}>
                Everything in one file — all claims, items, companies, products, shops, suppliers, users, credit limits,
                price history, audit log and photos.
                {stats && stats.counts.attachments > 0 && ` Includes ${stats.counts.attachments} photo(s).`}
                This is the file you use to restore the system.
              </p>
              <button className="btn btn-p btn-block" onClick={handleDownloadJson} disabled={busyDownloading}>
                {busyDownloading ? (
                  <>
                    <Loader2 className="ic sm animate-spin" /> Working…
                  </>
                ) : (
                  <>
                    <HardDriveDownload className="ic sm" /> Download Full Backup
                  </>
                )}
              </button>
            </div>

            {/* Excel backup */}
            <div
              style={{
                border: '1px solid var(--af-border)',
                borderRadius: 'var(--af-r)',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <FileSpreadsheet className="ic lg" style={{ color: 'var(--af-ok)' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Excel Backup</div>
                  <div className="small muted">Readable · For records only</div>
                </div>
              </div>
              <p className="small" style={{ color: 'var(--af-text2)', lineHeight: 1.55, flex: 1 }}>
                Human-readable Excel workbook — every table on its own sheet (Claims, Claim Items, Companies, Products,
                Shops, Suppliers, Order Bookers, Users, Credit Limits, Price History, Audit Log…). Great for
                record-keeping. <span className="muted">Cannot be used for restore.</span>
              </p>
              <button className="btn btn-o btn-block" onClick={handleDownloadExcel}>
                <FileSpreadsheet className="ic sm" /> Download Excel
              </button>
            </div>
          </div>

          {/* Download progress */}
          {(busyDownloading || dlPhase === 'done' || dlPhase === 'error') && (
            <div
              style={{
                marginTop: 14,
                borderRadius: 12,
                padding: '12px 15px',
                fontSize: 12.5,
                lineHeight: 1.5,
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                ...(dlPhase === 'error'
                  ? { background: 'var(--af-bad-soft)', color: 'var(--af-bad)', border: '1px solid color-mix(in srgb, var(--af-bad) 35%, transparent)' }
                  : dlPhase === 'done'
                    ? { background: 'var(--af-ok-soft)', color: 'var(--af-ok)', border: '1px solid color-mix(in srgb, var(--af-ok) 35%, transparent)' }
                    : { background: 'var(--af-surface2)', color: 'var(--af-text2)', border: '1px solid var(--af-border)' }),
              }}
            >
              {dlPhase === 'done' && <CheckCircle2 className="ic sm" style={{ marginTop: 1, flexShrink: 0 }} />}
              {dlPhase === 'error' && <AlertTriangle className="ic sm" style={{ marginTop: 1, flexShrink: 0 }} />}
              <div style={{ flex: 1 }}>
                {busyDownloading && <ProgressBar value={dlProgress} />}
                {dlMessage}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------- Restore card ---------- */}
      <div className="card" style={{ borderColor: 'color-mix(in srgb, var(--af-bad) 30%, transparent)' }}>
        <div className="card-h">
          <div>
            <div className="card-t" style={{ color: 'var(--af-bad)' }}>
              <Upload className="ic sm" /> Restore from Backup
            </div>
            <div className="card-sub">Purane backup file se poora data wapas load karein</div>
          </div>
        </div>
        <div className="card-b">
          <div
            style={{
              display: 'flex',
              gap: 11,
              alignItems: 'flex-start',
              padding: '12px 15px',
              border: `1.5px dashed color-mix(in srgb, var(--af-bad) 45%, transparent)`,
              background: 'var(--af-bad-soft)',
              borderRadius: 12,
              fontSize: 12.5,
              color: 'var(--af-text2)',
              lineHeight: 1.55,
              marginBottom: 16,
            }}
          >
            <ShieldAlert className="ic sm" style={{ color: 'var(--af-bad)', marginTop: 2, flexShrink: 0 }} />
            <span>
              <b style={{ color: 'var(--af-bad)' }}>Warning:</b> Restoring <u>replaces ALL current data</u> (claims,
              companies, products, shops, users, photos — everything) with the contents of the backup file. This cannot
              be undone. Agar current data rakhna hai, to pehle fresh backup download karein.
            </span>
          </div>

          {/* Step 1: choose file */}
          <div className="field" style={{ marginBottom: 14 }}>
            <label className="label" htmlFor="af-backup-file">
              1. Choose a backup file (.json)
            </label>
            <input
              id="af-backup-file"
              type="file"
              accept="application/json,.json"
              onChange={handleFileSelect}
              disabled={busyRestoring}
              className="af-inp"
              style={{ cursor: 'pointer', paddingTop: 8, paddingBottom: 8, height: 'auto' }}
            />
            {restoreError && !busyRestoring && (
              <p className="small" style={{ color: 'var(--af-bad)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle className="ic sm" /> {restoreError}
              </p>
            )}
          </div>

          {/* Step 2 & 3: preview + confirm */}
          {filePreview && (
            <div
              style={{
                border: '1px solid var(--af-border)',
                borderRadius: 'var(--af-r)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div>
                <div className="label">2. Check what&apos;s inside this backup</div>
                <div className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  <Clock className="ic sm" /> Backup created: {formatDate(filePreview.createdAt)}
                </div>
              </div>
              <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8 }}>
                {Object.entries(filePreview.counts).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      background: 'var(--af-surface2)',
                      border: '1px solid var(--af-border)',
                      borderRadius: 10,
                      padding: '9px 6px',
                      textAlign: 'center',
                    }}
                  >
                    <div className="kpi-val" style={{ fontSize: 17 }}>
                      {v.toLocaleString()}
                    </div>
                    <div className="kpi-sub">{k}</div>
                  </div>
                ))}
              </div>

              <div className="field">
                <label className="label">
                  3. Type <b style={{ color: 'var(--af-bad)' }}>RESTORE</b> to confirm
                </label>
                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                  <input
                    className="af-inp"
                    style={{ maxWidth: 230 }}
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type RESTORE here"
                    disabled={busyRestoring || restorePhase === 'done'}
                  />
                  <button
                    className="btn btn-d"
                    onClick={handleRestore}
                    disabled={confirmText !== 'RESTORE' || busyRestoring || restorePhase === 'done'}
                  >
                    {busyRestoring ? (
                      <>
                        <Loader2 className="ic sm animate-spin" /> Restoring…
                      </>
                    ) : (
                      <>
                        <Upload className="ic sm" /> Restore Everything
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Restore progress */}
          {(busyRestoring || restorePhase === 'done' || restorePhase === 'error') && (
            <div
              style={{
                marginTop: 14,
                borderRadius: 12,
                padding: '12px 15px',
                fontSize: 12.5,
                lineHeight: 1.5,
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                ...(restorePhase === 'error'
                  ? { background: 'var(--af-bad-soft)', color: 'var(--af-bad)', border: '1px solid color-mix(in srgb, var(--af-bad) 35%, transparent)' }
                  : restorePhase === 'done'
                    ? { background: 'var(--af-ok-soft)', color: 'var(--af-ok)', border: '1px solid color-mix(in srgb, var(--af-ok) 35%, transparent)' }
                    : { background: 'var(--af-surface2)', color: 'var(--af-text2)', border: '1px solid var(--af-border)' }),
              }}
            >
              {restorePhase === 'done' && <CheckCircle2 className="ic sm" style={{ marginTop: 1, flexShrink: 0 }} />}
              {restorePhase === 'error' && <AlertTriangle className="ic sm" style={{ marginTop: 1, flexShrink: 0 }} />}
              <div style={{ flex: 1 }}>
                {busyRestoring && <ProgressBar value={restoreProgress} />}
                <p>{restoreMessage}</p>
                {restorePhase === 'error' && restoreError && <p style={{ marginTop: 4 }}>{restoreError}</p>}
                {restorePhase === 'done' && (
                  <p className="small" style={{ marginTop: 4, opacity: 0.85 }}>
                    Tip: refresh the page (pull down or press F5) so every screen reloads the restored data.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------- Tips ---------- */}
      <div className="card">
        <div className="card-h">
          <div className="card-t">
            <Info className="ic sm" /> Backup Tips
          </div>
        </div>
        <div className="card-b">
          <div className="note" style={{ marginBottom: 12 }}>
            <DatabaseBackup className="ic" />
            <span>
              <b>Har hafte full backup lein.</b> Full Backup (JSON) hi woh file hai jo poora system restore karti hai —
              photos samet. Excel backup sirf parhne ke liye hai.
            </span>
          </div>
          <ul className="small" style={{ color: 'var(--af-text2)', lineHeight: 1.9, paddingLeft: 18 }}>
            <li>Backup files ko aik se zyada jagah rakhein — phone, laptop, WhatsApp, email ya Google Drive.</li>
            <li>Restore se pehle hamesha fresh backup download karein, taake current data kabhi lost na ho.</li>
            <li>Backup file mein passwords hash form mein hoti hain — file ko safe rakhein, kisi ko na dein.</li>
            <li>Agar restore ke doran koi error aaye, to data bilkul nahi badalta (safe rollback) — dobara try karein.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
