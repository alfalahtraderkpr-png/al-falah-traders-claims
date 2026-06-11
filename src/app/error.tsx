'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
    
    // If this is a "Cannot access before initialization" error, 
    // it's likely caused by stale Service Worker cache.
    // Force clear caches and reload.
    if (error.message && error.message.includes('before initialization')) {
      if ('caches' in window) {
        caches.keys().then((names) => {
          for (const name of names) {
            caches.delete(name);
          }
        });
      }
      // Unregister old service worker and reload
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister();
          });
          // Reload after clearing cache and SW
          setTimeout(() => window.location.reload(), 500);
        });
      } else {
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
          <span className="text-red-600 text-2xl">!</span>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong!</h2>
        <p className="text-gray-600 mb-2 text-sm">
          An unexpected error occurred. Please try again.
        </p>
        {error.message && (
          <p className="text-xs text-gray-400 mb-4 bg-gray-50 rounded p-2 break-all">
            {error.message}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
            onClick={() => {
              // Clear all caches before reset
              if ('caches' in window) {
                caches.keys().then((names) => {
                  for (const name of names) caches.delete(name);
                });
              }
              reset();
            }}
          >
            Try Again
          </button>
          <button
            className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
            onClick={() => window.location.href = '/'}
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
