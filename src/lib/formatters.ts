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

/**
 * Konversi angka rupiah ke kalimat bahasa Indonesia (Terbilang).
 * Contoh: 25000 -> "dua puluh lima ribu rupiah"
 */
export function numberToIndonesianWords(n: number): string {
  if (typeof n !== 'number' || isNaN(n) || n <= 0) return 'nol rupiah';

  const satuan = [
    '',
    'satu',
    'dua',
    'tiga',
    'empat',
    'lima',
    'enam',
    'tujuh',
    'delapan',
    'sembilan',
    'sepuluh',
    'sebelas',
  ];

  function convert(num: number): string {
    if (num < 12) {
      return satuan[num];
    } else if (num < 20) {
      return convert(num - 10) + ' belas';
    } else if (num < 100) {
      const rest = num % 10;
      return convert(Math.floor(num / 10)) + ' puluh' + (rest > 0 ? ' ' + convert(rest) : '');
    } else if (num < 200) {
      const rest = num - 100;
      return 'seratus' + (rest > 0 ? ' ' + convert(rest) : '');
    } else if (num < 1000) {
      const rest = num % 100;
      return convert(Math.floor(num / 100)) + ' ratus' + (rest > 0 ? ' ' + convert(rest) : '');
    } else if (num < 2000) {
      const rest = num - 1000;
      return 'seribu' + (rest > 0 ? ' ' + convert(rest) : '');
    } else if (num < 1000000) {
      const rest = num % 1000;
      return convert(Math.floor(num / 1000)) + ' ribu' + (rest > 0 ? ' ' + convert(rest) : '');
    } else if (num < 1000000000) {
      const rest = num % 1000000;
      return convert(Math.floor(num / 1000000)) + ' juta' + (rest > 0 ? ' ' + convert(rest) : '');
    } else if (num < 1000000000000) {
      const rest = num % 1000000000;
      return convert(Math.floor(num / 1000000000)) + ' milyar' + (rest > 0 ? ' ' + convert(rest) : '');
    }
    return String(num);
  }

  const words = convert(Math.floor(n)).trim();
  return words ? `${words} rupiah` : 'nol rupiah';
}

/**
 * Format template suara pesanan baru dengan data pesanan nyata.
 * Placeholder:
 * {nomor}  -> angka biasa (contoh "3" sehingga dibacakan "nomor tiga")
 * {meja}   -> nomor meja
 * {nama}   -> nama pelanggan
 * {total}  -> nominal terbilang dalam kata bahasa Indonesia ("dua puluh lima ribu rupiah")
 * {jumlah} -> total kuantitas item pesanan
 */
export function formatVoiceOrderText(
  template: string,
  order: {
    orderCode?: string;
    tableNumber?: string;
    customerName?: string;
    payableAmount?: number;
    totalPrice?: number;
    items?: Array<{ qty: number }>;
  }
): string {
  const tmpl =
    template || 'Pesanan baru dari meja {meja}, atas nama {nama}. Segera terima.';

  // Format order number as regular integer (e.g. "003" -> "3" to read as "nomor tiga")
  const rawNum = order.orderCode ? order.orderCode.replace(/\D/g, '') : '';
  const parsedNum = rawNum ? parseInt(rawNum, 10) : '';
  const nomorStr = parsedNum ? String(parsedNum) : (order.orderCode || '1');

  const mejaStr = order.tableNumber || '-';
  const namaStr = order.customerName || 'Pelanggan';

  const amount = order.payableAmount ?? order.totalPrice ?? 0;
  const totalStr = numberToIndonesianWords(amount);

  const totalQty = order.items && order.items.length > 0
    ? order.items.reduce((sum, item) => sum + (item.qty || 1), 0)
    : 1;

  return tmpl
    .replace(/{nomor}/g, nomorStr)
    .replace(/{meja}/g, mejaStr)
    .replace(/{nama}/g, namaStr)
    .replace(/{total}/g, totalStr)
    .replace(/{jumlah}/g, String(totalQty));
}
