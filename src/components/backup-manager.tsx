'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  DatabaseBackup,
  FileSpreadsheet,
  FileJson,
  Upload,
  HardDriveDownload,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  FileText,
  Building2,
  Package,
  Store,
  Users,
  ImageIcon,
  Info,
  AlertTriangle,
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
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
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
          'Claim Items': (t.claimItems || []).length,
          Companies: (t.companies || []).length,
          Products: (t.products || []).length,
          Suppliers: (t.suppliers || []).length,
          Shops: (t.shops || []).length,
          'Order Bookers': (t.orderBookers || []).length,
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

  const statCards = stats
    ? [
        { label: 'Claims', value: stats.counts.claims, icon: FileText, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40' },
        { label: 'Claim Items', value: stats.counts.claimItems, icon: Package, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/40' },
        { label: 'Companies', value: stats.counts.companies, icon: Building2, color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/40' },
        { label: 'Products', value: stats.counts.products, icon: Package, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/40' },
        { label: 'Shops', value: stats.counts.shops, icon: Store, color: 'text-pink-600 bg-pink-100 dark:bg-pink-900/40' },
        { label: 'Users', value: stats.counts.users, icon: Users, color: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/40' },
        { label: 'Photos', value: stats.counts.attachments, icon: ImageIcon, color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/40' },
        { label: 'Est. Backup Size', value: formatBytes(stats.estimatedTotalBytes), icon: HardDriveDownload, color: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40' },
      ]
    : [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ---------- Header ---------- */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-800 dark:to-emerald-900 text-white p-6 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
            <DatabaseBackup className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Backup &amp; Restore</h2>
            <p className="text-emerald-100/90 text-sm mt-1">
              Download a complete copy of all your data — claims, companies, products, shops, users and photos — or restore everything from a previous backup file.
            </p>
            <p className="text-emerald-200/70 text-xs mt-2">
              Last backup downloaded: <strong>{formatDate(lastBackup)}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* ---------- Data Overview ---------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <HardDriveDownload className="h-4 w-4 text-emerald-600" />
            What&apos;s in your database right now
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : !stats ? (
            <div className="flex items-center gap-2 text-amber-600 text-sm py-4">
              <AlertTriangle className="h-4 w-4" /> Could not load database stats.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {statCards.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="rounded-xl border bg-card p-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-bold leading-tight">{s.value}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- Download Backup ---------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileJson className="h-4 w-4 text-emerald-600" />
            Download Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            {/* JSON full backup */}
            <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-900 p-4 bg-emerald-50/50 dark:bg-emerald-950/30">
              <div className="flex items-center gap-2 mb-1">
                <FileJson className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold text-sm">Full Backup (JSON)</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                Complete copy of <strong>everything</strong> including photos. This is the file you use to restore the system later.
                {stats && stats.counts.attachments > 0 && ` Contains ${stats.counts.attachments} photo(s).`}
              </p>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={handleDownloadJson}
                disabled={busyDownloading}
              >
                {busyDownloading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Working…
                  </>
                ) : (
                  <>
                    <HardDriveDownload className="h-4 w-4 mr-2" /> Download Full Backup
                  </>
                )}
              </Button>
            </div>

            {/* Excel backup */}
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-1">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-sm">Excel Backup (for records)</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                Human-readable Excel workbook with every table on a separate sheet — Claims, Products, Shops, Users, Price History, Audit Log and more. Great for record-keeping. <span className="text-muted-foreground/70">(No photos; cannot be used for restore.)</span>
              </p>
              <Button variant="outline" className="w-full border-green-300 text-green-700 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950" onClick={handleDownloadExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Download Excel
              </Button>
            </div>
          </div>

          {/* Download progress */}
          {(busyDownloading || dlPhase === 'done' || dlPhase === 'error') && (
            <div className={`rounded-lg p-3 text-sm ${dlPhase === 'error' ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300' : dlPhase === 'done' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-gray-50 dark:bg-gray-900'}`}>
              {busyDownloading && <Progress value={dlProgress} className="h-2 mb-2" />}
              <div className="flex items-start gap-2">
                {dlPhase === 'done' && <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />}
                {dlPhase === 'error' && <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
                <span>{dlMessage}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- Restore ---------- */}
      <Card className="border-amber-200 dark:border-amber-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4 text-amber-600" />
            Restore from Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-3 flex gap-2 text-sm text-amber-800 dark:text-amber-200">
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="leading-relaxed">
              <strong>Warning:</strong> Restoring <u>replaces ALL current data</u> (claims, companies, products, shops, users, photos — everything) with the contents of the backup file. This cannot be undone. Download a fresh backup first if you want to keep the current data.
            </p>
          </div>

          {/* Step 1: choose file */}
          <div>
            <label className="block text-sm font-medium mb-2">1. Choose a backup file (.json)</label>
            <div className="flex items-center gap-3">
              <Input
                type="file"
                accept="application/json,.json"
                onChange={handleFileSelect}
                disabled={busyRestoring}
                className="cursor-pointer file:cursor-pointer"
              />
            </div>
            {restoreError && !busyRestoring && (
              <p className="text-sm text-red-600 mt-2 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> {restoreError}
              </p>
            )}
          </div>

          {/* Step 2: preview */}
          {filePreview && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <label className="block text-sm font-medium">2. Check what&apos;s inside this backup</label>
              <p className="text-xs text-muted-foreground">Backup created: {formatDate(filePreview.createdAt)}</p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {Object.entries(filePreview.counts).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-muted/60 dark:bg-muted/30 p-2 text-center">
                    <p className="text-base font-bold">{v}</p>
                    <p className="text-[10px] text-muted-foreground">{k}</p>
                  </div>
                ))}
              </div>

              <label className="block text-sm font-medium pt-1">3. Type <strong>RESTORE</strong> to confirm</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type RESTORE here"
                  disabled={busyRestoring || restorePhase === 'done'}
                  className="sm:max-w-xs"
                />
                <Button
                  variant="destructive"
                  onClick={handleRestore}
                  disabled={confirmText !== 'RESTORE' || busyRestoring || restorePhase === 'done'}
                >
                  {busyRestoring ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Restoring…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" /> Restore Everything
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Restore progress */}
          {(busyRestoring || restorePhase === 'done' || restorePhase === 'error') && (
            <div className={`rounded-lg p-3 text-sm ${restorePhase === 'error' ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300' : restorePhase === 'done' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-gray-50 dark:bg-gray-900'}`}>
              {busyRestoring && <Progress value={restoreProgress} className="h-2 mb-2" />}
              <div className="flex items-start gap-2">
                {restorePhase === 'done' && <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />}
                {restorePhase === 'error' && <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
                <div>
                  <p>{restoreMessage}</p>
                  {restorePhase === 'error' && restoreError && <p className="mt-1">{restoreError}</p>}
                  {restorePhase === 'done' && (
                    <p className="text-xs mt-1 opacity-80">
                      Tip: refresh the page (pull down or press F5) so every screen reloads the restored data.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- Tips ---------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-emerald-600" />
            Backup Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2 leading-relaxed">
            <li>• Download a <strong>Full Backup (JSON)</strong> at least once a week — it is the only file that can fully restore the system, photos included.</li>
            <li>• Keep backup files in more than one place: your phone, a laptop, WhatsApp to yourself, email, or Google Drive.</li>
            <li>• The Excel backup is for reading and record-keeping — it cannot be restored, so always keep a JSON backup too.</li>
            <li>• Always download a fresh backup <strong>before</strong> restoring an old one — that way nothing is ever lost.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
