import React, { useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import { AppRoutes } from './app/routes';
import { VersionNotificationBanner } from './components/common/VersionNotificationBanner';

export default function App() {
  // Register simple PWA service worker
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.log('SW registration notice:', err));
    }
  }, []);

  return (
    <HashRouter>
      <VersionNotificationBanner />
      <AppRoutes />
    </HashRouter>
  );
}
