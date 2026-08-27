'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed === 'true') return;

    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'dismissed') {
      localStorage.setItem('pwa-install-dismissed', 'true');
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div style={{ background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderRadius: 14, boxShadow: 'var(--af-sh-lg)', padding: 14, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--af-font)' }}>
        <div className="brand-tile" style={{ width: 34, height: 34, borderRadius: 10, fontSize: 11 }}>AF</div>
        <button
          onClick={handleInstall}
          className="btn btn-p btn-sm"
          style={{ flex: 1 }}
        >
          <Download className="ic sm" />
          Install App
        </button>
        <button
          onClick={handleDismiss}
          className="icon-btn"
          style={{ width: 32, height: 32 }}
          aria-label="Dismiss install prompt"
        >
          <X className="ic sm" />
        </button>
      </div>
    </div>
  );
}
