import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Pemulihan otomatis saat terjadi error modul dinamis / Vite chunk hash mismatch setelah deploy baru
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const reloadKey = 'app_reload_on_deploy_error';
  try {
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, 'true');
      console.warn('[Vite Preload Error] Memuat ulang halaman untuk mengambil bundel versi terbaru...');
      window.location.reload();
    }
  } catch {
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(<App />);
