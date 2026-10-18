import React, { useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import { AppRoutes } from './app/routes';
import { VersionNotificationBanner } from './components/common/VersionNotificationBanner';

export default function App() {
  // Register PWA service worker ONLY in real production (never in AI Studio preview or local dev)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const host = window.location.hostname;
      const isDevOrPreview =
        import.meta.env.DEV ||
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.includes('aistudio') ||
        host.includes('ai.studio') ||
        host.includes('ais-dev') ||
        host.includes('ais-pre') ||
        host.includes('usercontent.goog');

      if (!isDevOrPreview && import.meta.env.PROD) {
        navigator.serviceWorker
          .register('/sw.js')
          .catch((err) => console.log('SW registration notice:', err));
      } else {
        // Di lingkungan dev atau preview AI Studio, bersihkan service worker jika pernah terpasang
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister();
          }
        }).catch(() => {});
      }
    }
  }, []);

  return (
    <HashRouter>
      <VersionNotificationBanner />
      <AppRoutes />
    </HashRouter>
  );
}
