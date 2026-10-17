/**
 * Utilitas validasi dan pemformatan URL untuk QR Meja & Web App.
 */

export const FORBIDDEN_URL_PATTERNS = [
  'aistudio',
  'ai.studio',
  'ais-dev',
  'ais-pre',
  'usercontent.goog',
  'localhost',
  '127.0.0.1',
];

export const FORBIDDEN_URL_ERROR_MESSAGE =
  'Alamat ini hanya untuk uji coba, QR tidak akan bisa dipakai pelanggan';

/**
 * Memeriksa apakah URL mengandung domain terlarang untuk QR produksi pelanggan
 */
export function isForbiddenUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().trim();
  return FORBIDDEN_URL_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Menghapus trailing slash dan hash dari URL dasar
 */
export function sanitizeBaseUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  return url.trim().replace(/\/+$/, '').replace(/#.*$/, '');
}

/**
 * Menghasilkan URL pemesanan meja lengkap (HashRouter dengan parameter nomor meja)
 */
export function buildTableOrderUrl(baseUrl: string, tableNumber: number | string): string {
  const cleanBase = sanitizeBaseUrl(baseUrl);
  return `${cleanBase}/#/menu?table=${tableNumber}`;
}
