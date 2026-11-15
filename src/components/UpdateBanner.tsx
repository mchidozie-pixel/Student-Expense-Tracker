import React, { useState, useEffect, useCallback } from 'react';
import { ArrowUpCircle, RefreshCw } from 'lucide-react';
import { APP_VERSION, compareVersions } from '../version';

interface UpdateBannerProps {
  onUpdateTriggered?: () => void;
}

/**
 * Detects a newly published version in two independent ways:
 * 1. The service worker reports a waiting update (works even when the version
 *    number was not bumped between releases).
 * 2. dist/version.json, generated on every build and served by Firebase
 *    Hosting, reports a higher version than the running bundle.
 */
export const UpdateBanner: React.FC<UpdateBannerProps> = ({ onUpdateTriggered }) => {
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [swReady, setSwReady] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const checkVersion = useCallback(async () => {
    // 1. Ask the browser whether a new service worker is waiting.
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update().catch(() => {});
          if (registration.waiting) setSwReady(true);
        }
      }
    } catch {
      // Service workers unavailable (private mode, unsupported browser)
    }

    // 2. Compare the published version file with the running bundle.
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('json')) return;
      const data = await res.json();
      const published = typeof data?.version === 'string' ? data.version.trim() : '';
      if (published && compareVersions(published, APP_VERSION) > 0) {
        setAvailableVersion(published);
      }
    } catch {
      // Offline or network error - retain current state silently
    }
  }, []);

  useEffect(() => {
    checkVersion();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkVersion();
    };
    const handleFocus = () => checkVersion();
    const handleSwReady = () => {
      setSwReady(true);
      checkVersion();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pwa:need-refresh', handleSwReady);

    // Periodic check every 60 seconds while the app is open
    const interval = setInterval(checkVersion, 60000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pwa:need-refresh', handleSwReady);
      clearInterval(interval);
    };
  }, [checkVersion]);

  const handleUpdate = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    if (onUpdateTriggered) onUpdateTriggered();

    const targetVersion = availableVersion || APP_VERSION;

    // Mark to show "What's new in [version]" once after reload
    try {
      localStorage.setItem('alu_show_whats_new', targetVersion);
      localStorage.setItem('alu_app_version', targetVersion);
    } catch {}

    // Flush old caches so users never get stuck on old files
    try {
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((k) => caches.delete(k)));
      }
    } catch (err) {
      console.warn('Error clearing caches during update', err);
    }

    // Ask a waiting service worker to activate, then reload once it takes over
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration?.waiting) {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 1500);
            navigator.serviceWorker.addEventListener(
              'controllerchange',
              () => {
                clearTimeout(timer);
                resolve();
              },
              { once: true }
            );
            registration.waiting!.postMessage({ type: 'SKIP_WAITING' });
          });
        } else if (registration) {
          await registration.update().catch(() => {});
        }
      }
    } catch {}

    // Reload app to activate new version
    window.location.reload();
  };

  if (!availableVersion && !swReady) return null;

  return (
    <div className="bg-[#0f4c3a] text-white px-3 sm:px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs z-50 border-b border-[#1b6b53] animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-2 min-w-0">
        <ArrowUpCircle className="w-4 h-4 text-emerald-300 shrink-0" />
        <span className="font-semibold truncate">
          Update available
        </span>
        {availableVersion ? (
          <span className="text-[11px] text-emerald-200 hidden sm:inline">
            (v{availableVersion} published)
          </span>
        ) : (
          <span className="text-[11px] text-emerald-200 hidden sm:inline">
            (new version ready)
          </span>
        )}
      </div>

      <button
        type="button"
        disabled={isUpdating}
        onClick={handleUpdate}
        className="px-3.5 py-1 bg-white text-[#0f4c3a] font-bold text-xs rounded-full hover:bg-emerald-50 active:scale-95 transition-all cursor-pointer shrink-0 flex items-center gap-1.5 shadow-xs"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
        <span>{isUpdating ? 'Updating...' : 'Update'}</span>
      </button>
    </div>
  );
};
