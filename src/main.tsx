import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';
import { APP_VERSION } from './version';

// Flush outdated caches from previous versions so users never get stuck on an old version
if ('caches' in window) {
  caches.keys().then((keys) => {
    keys.forEach((key) => {
      if (key.includes('display-') && !key.includes(APP_VERSION)) {
        caches.delete(key);
      }
    });
  }).catch(() => {});
}

// Register service worker helper to cache only basic display files (HTML/CSS/JS/icons)
// Note: Student records, financial details, and credentials are never stored or cached
registerSW({
  immediate: true,
  onNeedRefresh() {
    // A new service worker downloaded and is waiting. Surface it in the UI.
    window.dispatchEvent(new Event('pwa:need-refresh'));
  },
  onOfflineReady() {
    // Basic display assets cached for reliable loading
  },
});

createRoot(document.getElementById('root')!).render(<App />);

