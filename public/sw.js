// Service Worker SMART RESTAURANT POS
// Versi cache dinaikkan untuk memastikan pembersihan cache lama
const CACHE_NAME = 'smart-resto-v2';

// PERHATIAN: JANGAN PERNAH memasukkan '/', '/index.html' ke dalam cache ini
// agar browser selalu memuat index.html versi terbaru saat ada deploy baru di Vercel.
const STATIC_ASSETS = [
  '/manifest.json'
];

// 1. Install Event: skipWaiting agar service worker baru langsung aktif tanpa menunggu tab ditutup
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 2. Activate Event: Hapus seluruh cache lama dan klaim semua klien (clients.claim)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Menghapus cache versi lama:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 3. Fetch Event: Navigasi dan index.html selalu diambil langsung dari jaringan (Network First / Only)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Jangan sentuh request ke Firebase, Google APIs, atau endpoint API backend
  if (
    url.origin.includes('firestore') ||
    url.origin.includes('googleapis') ||
    url.origin.includes('firebase') ||
    url.pathname.startsWith('/api')
  ) {
    return;
  }

  // Permintaan navigasi halaman HTML / SPA: SELALU AMBIL DARI JARINGAN (Network First)
  // JANGAN PERNAH mengembalikan index.html basi dari cache lokal
  const isNavigation =
    event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html');

  if (isNavigation) {
    event.respondWith(
      fetch(event.request).catch((err) => {
        console.warn('[SW] Navigasi offline atau jaringan gagal:', err);
        // Jika benar-benar offline dan jaringan gagal total
        return new Response('Koneksi internet terputus. Silakan periksa jaringan Anda dan muat ulang halaman.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
    );
    return;
  }

  // Untuk berkas statis (seperti manifest.json)
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
