import { TIMEZONE_JAKARTA } from '../config/constants';

/**
 * Format currency to Rupiah string.
 * Example: 25000 -> "Rp 25.000"
 */
export function formatRupiah(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount)) return 'Rp 0';
  const rounded = Math.round(amount);
  const formatted = new Intl.NumberFormat('id-ID').format(rounded);
  return `Rp ${formatted}`;
}

/**
 * Format 3-digit order code.
 * Example: 1 -> "001", 42 -> "042"
 */
export function formatOrderCode(orderNumber: number): string {
  return String(orderNumber).padStart(3, '0');
}

/**
 * Returns dateKey in format "YYYY-MM-DD" according to Asia/Jakarta timezone.
 */
export function getDateKeyJakarta(date: Date = new Date()): string {
  // Use Intl.DateTimeFormat with Asia/Jakarta to ensure accurate dateKey regardless of user browser timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_JAKARTA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // outputs "YYYY-MM-DD" in en-CA
}

/**
 * Format time only (HH:mm) in Asia/Jakarta
 */
export function formatTimeJakarta(dateOrTimestamp: any): string {
  if (!dateOrTimestamp) return '-';
  const date =
    typeof dateOrTimestamp.toDate === 'function'
      ? dateOrTimestamp.toDate()
      : new Date(dateOrTimestamp);

  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TIMEZONE_JAKARTA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Format full date and time in Indonesian
 */
export function formatDateTimeJakarta(dateOrTimestamp: any): string {
  if (!dateOrTimestamp) return '-';
  const date =
    typeof dateOrTimestamp.toDate === 'function'
      ? dateOrTimestamp.toDate()
      : new Date(dateOrTimestamp);

  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TIMEZONE_JAKARTA,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Format elapsed milliseconds into mm:ss
 */
export function formatElapsedDuration(elapsedMs: number): string {
  if (elapsedMs < 0) elapsedMs = 0;
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
