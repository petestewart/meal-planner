'use client';

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      // Hide the "reconnected" message after 3 seconds
      setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  if (showReconnected) {
    return (
      <div
        className="fixed top-0 inset-x-0 z-50 bg-green-500 text-white px-4 py-2 text-center text-sm animate-in slide-in-from-top duration-300"
        role="status"
        aria-live="polite"
      >
        <RefreshCw className="inline-block h-4 w-4 mr-2" />
        Back online! Syncing changes...
      </div>
    );
  }

  return (
    <div
      className="fixed top-0 inset-x-0 z-50 bg-amber-500 text-amber-50 px-4 py-2 text-center text-sm animate-in slide-in-from-top duration-300"
      role="alert"
      aria-live="assertive"
    >
      <WifiOff className="inline-block h-4 w-4 mr-2" />
      You&apos;re offline. Changes will sync when you reconnect.
    </div>
  );
}
