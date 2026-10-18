import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  MapPin,
  User,
  Copy,
  Check,
  QrCode,
  Building,
  CreditCard,
  Utensils,
  PlusCircle,
  HelpCircle,
  RefreshCw,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { orderService } from '../../services/orderService';
import { settingsService } from '../../services/settingsService';
import { authService } from '../../services/authService';
import { auth } from '../../config/firebase';
import { Order, Settings } from '../../types';
import { formatRupiah, formatDateTimeJakarta, formatTimeJakarta } from '../../lib/formatters';
import { generateDynamicQris } from '../../lib/qris';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ThemeToggle } from '../../components/layout/ThemeToggle';
import { audioEngine } from '../../lib/audioEngine';
import { handleSingleOrderStatusCleanup, clearActiveOrderForUser } from '../../lib/orderStorage';

export const OrderStatusPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [dynamicQrUrl, setDynamicQrUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(true);
  const [detailsOpen, setDetailsOpen] = useState<boolean>(false);
  const prevPaymentStatusRef = useRef<string | undefined>(undefined);

  const [currentUid, setCurrentUid] = useState<string | null>(auth.currentUser?.uid || null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  // 1. Ensure anonymous session and track active UID
  useEffect(() => {
    const unsub = authService.onAuthStateChanged((user) => {
      setCurrentUid(user?.uid || null);
    });
    authService.signInCustomerAnon().catch((err) => {
      console.warn('Login anonim warning:', err);
    });
    return () => unsub();
  }, []);

  // 2. Load settings
  useEffect(() => {
    settingsService
      .getSettings()
      .then(setSettings)
      .catch((err) => console.warn('Gagal memuat pengaturan:', err));
  }, []);

  // 3. Subscribe to real-time order status (onSnapshot)
  useEffect(() => {
    if (!orderId) {
      setError('ID pesanan tidak valid.');
      setLoading(false);
      return;
    }

    setIsRealtimeConnected(true);
    const unsubscribe = orderService.subscribeSingleOrder(
      orderId,
      (fetchedOrder) => {
        setIsRealtimeConnected(true);
        if (
          prevPaymentStatusRef.current === 'BELUM_BAYAR' &&
          fetchedOrder?.paymentStatus === 'LUNAS'
        ) {
          // Putar chime merdu + getar singkat bila pembayaran dikonfirmasi LUNAS oleh admin
          audioEngine.playPaymentSuccessChime();
        }

        if (fetchedOrder) {
          const activeUid = auth.currentUser?.uid || currentUid;
          // Verifikasi di klien bahwa customerUid pesanan sama dengan uid saat ini; bila tidak, jangan ditampilkan dan bersihkan referensinya
          if (activeUid && fetchedOrder.customerUid !== activeUid) {
            console.warn('[OrderStatusPage] Pesanan ini bukan milik akun aktif. Membersihkan referensi lokal.');
            clearActiveOrderForUser(activeUid);
            setOrder(null);
            setError('Anda tidak memiliki akses ke pesanan ini.');
            setLoading(false);
            return;
          }

          prevPaymentStatusRef.current = fetchedOrder.paymentStatus;
          handleSingleOrderStatusCleanup(fetchedOrder, activeUid || undefined);
        }

        setOrder(fetchedOrder);
        setLoading(false);
        if (!fetchedOrder) {
          setError('Pesanan tidak ditemukan.');
        }
      },
      (err) => {
        console.error('Error fetching order:', err);
        setIsRealtimeConnected(false);
        setError('Gagal memuat status pesanan. Pastikan koneksi internet aktif.');
        setLoading(false);
      }
    );

    const handleOnline = () => setIsRealtimeConnected(true);
    const handleOffline = () => setIsRealtimeConnected(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [orderId, currentUid]);

  // Reactive verification: jika order sudah termuat dan UID baru saja terselesaikan
  useEffect(() => {
    if (order && currentUid && order.customerUid !== currentUid) {
      console.warn('[OrderStatusPage] Mismatch UID terdeteksi setelah otentikasi. Membersihkan referensi lokal.');
      clearActiveOrderForUser(currentUid);
      setOrder(null);
      setError('Anda tidak memiliki akses ke pesanan ini.');
    }
  }, [order, currentUid]);

  // 4. Generate dynamic QRIS if payment method is QRIS and order is unpaid
  useEffect(() => {
    if (!order || order.paymentMethod !== 'QRIS' || order.paymentStatus === 'LUNAS') {
      setDynamicQrUrl(null);
      return;
    }

    const qrisPayload = settings?.qrisPayload;
    if (!qrisPayload) {
      setQrError('Payload QRIS restoran belum dikonfigurasi.');
      return;
    }

    try {
      const payable = order.payableAmount || order.totalPrice;
      const dynamicPayload = generateDynamicQris(qrisPayload, payable);
      QRCode.toDataURL(dynamicPayload, {
        width: 320,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
        .then((url) => {
          setDynamicQrUrl(url);
          setQrError(null);
        })
        .catch((err) => {
          console.error('QR code generation error:', err);
          setQrError('Gagal merender kode QR');
        });
    } catch (err: any) {
      console.error('Dynamic QRIS error:', err);
      setQrError(err?.message || 'Gagal membuat QRIS dinamis');
    }
  }, [order, settings]);

  // 5. Payment timeout countdown
  useEffect(() => {
    if (!order || order.paymentStatus === 'LUNAS' || order.status === 'DIBATALKAN') {
      setTimeLeftSeconds(null);
      return;
    }

    const timeoutMinutes = settings?.paymentTimeoutMinutes ?? 10;
    const createdAtMs = order.createdAt?.toMillis
      ? order.createdAt.toMillis()
      : order.createdAt?.seconds
      ? order.createdAt.seconds * 1000
      : Date.now();

    const deadlineMs = createdAtMs + timeoutMinutes * 60 * 1000;

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((deadlineMs - now) / 1000));
      setTimeLeftSeconds(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [order, settings]);

  const handleClaimPaid = async () => {
    if (!order) return;
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;

    setClaiming(true);
    try {
      await orderService.claimPaid(order.id, currentUid);
    } catch (err: any) {
      alert(err?.message || 'Gagal konfirmasi pembayaran.');
    } finally {
      setClaiming(false);
    }
  };

  const handleCopy = (text: string, type: 'BANK' | 'AMOUNT') => {
    navigator.clipboard?.writeText(text);
    if (type === 'BANK') {
      setCopiedBank(true);
      setTimeout(() => setCopiedBank(false), 2000);
    } else {
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2000);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const activeTableNumber =
    localStorage.getItem('smart_resto_table_number') || '';
  const backToMenuUrl = activeTableNumber
    ? `/menu?table=${encodeURIComponent(activeTableNumber)}`
    : '/menu';

  // 5. Hitung mundur otomatis kembali ke menu jika pesanan SELESAI atau DIBATALKAN
  useEffect(() => {
    if (!order) return;
    if (order.status === 'SELESAI' || order.status === 'DIBATALKAN') {
      const activeUid = auth.currentUser?.uid || currentUid || order.customerUid;
      clearActiveOrderForUser(activeUid);

      if (redirectCountdown === null) {
        setRedirectCountdown(20);
      }
    } else {
      setRedirectCountdown(null);
    }
  }, [order?.status, currentUid]);

  useEffect(() => {
    if (redirectCountdown === null) return;
    if (redirectCountdown <= 0) {
      navigate(backToMenuUrl);
      return;
    }

    const timer = setInterval(() => {
      setRedirectCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [redirectCountdown, backToMenuUrl, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#FF6B1A] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-stone-600 dark:text-stone-300">
            Memuat status pesanan...
          </p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
          Pesanan Tidak Ditemukan
        </h2>
        <p className="text-xs text-stone-500 max-w-xs mt-1 mb-6">
          {error || 'Data pesanan tidak dapat diakses atau telah dihapus.'}
        </p>
        <Button variant="primary" onClick={() => navigate(backToMenuUrl)}>
          Kembali ke Daftar Menu
        </Button>
      </div>
    );
  }

  const activeUid = auth.currentUser?.uid || currentUid;

  // Verifikasi di klien bahwa customerUid pesanan sama dengan uid saat ini; bila tidak, jangan ditampilkan dan bersihkan referensinya
  if (activeUid && order.customerUid !== activeUid) {
    clearActiveOrderForUser(activeUid);
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
          Akses Ditolak
        </h2>
        <p className="text-xs text-stone-500 max-w-xs mt-1 mb-6">
          Pesanan ini bukan milik akun atau perangkat Anda.
        </p>
        <Button variant="primary" onClick={() => navigate(backToMenuUrl)}>
          Kembali ke Daftar Menu
        </Button>
      </div>
    );
  }

  // Begitu pesanan SELESAI atau DIBATALKAN, pastikan referensi penyimpanan lokal langsung dibersihkan seketika
  if (order.status === 'SELESAI' || order.status === 'DIBATALKAN') {
    clearActiveOrderForUser(auth.currentUser?.uid || currentUid || order.customerUid);
  }

  // Tahap status (Hanya 3 tahap customer):
  // 1. Terkirim ke admin (status: BARU)
  // 2. Diterima admin - pesanan sedang disiapkan (status: DITERIMA)
  // 3. Selesai (status: SELESAI)
  const isCancelled = order.status === 'DIBATALKAN';
  const stageStep = order.status === 'BARU' ? 1 : order.status === 'DITERIMA' ? 2 : 3;

  const payable = order.payableAmount || order.totalPrice;
  const totalItemCount = order.items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-[#121212] text-stone-900 dark:text-stone-100 flex flex-col antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 px-4 py-2.5 shadow-xs">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link
            to={backToMenuUrl}
            className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Menu</span>
          </Link>

          {/* Penanda Realtime Connection */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              isRealtimeConnected
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
            }`}
            title={
              isRealtimeConnected
                ? 'Terhubung langsung ke database pesanan secara realtime'
                : 'Koneksi terputus, mencoba memperbarui...'
            }
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isRealtimeConnected
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-amber-500 animate-ping'
              }`}
            />
            <span>{isRealtimeConnected ? 'Terhubung' : 'Memperbarui...'}</span>
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-xl w-full mx-auto p-3 sm:p-4 space-y-3">
        {/* Banner Layar Akhir: Pesanan Selesai */}
        {order.status === 'SELESAI' && (
          <Card className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-center space-y-2.5">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-emerald-950 dark:text-emerald-100">
                Pesanan Selesai. Terima kasih!
              </h3>
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                Selamat menikmati hidangan Anda di Meja {order.tableNumber}. Seluruh pesanan telah disajikan.
              </p>
            </div>
            {redirectCountdown !== null && (
              <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 flex flex-col sm:flex-row items-center justify-center gap-2">
                <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                  Kembali ke Menu (<span className="font-mono font-bold">{redirectCountdown} detik</span>)
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(backToMenuUrl)}
                >
                  Kembali ke Menu Sekarang
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Banner Layar Akhir: Pesanan Dibatalkan */}
        {order.status === 'DIBATALKAN' && (
          <Card className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-500/30 rounded-2xl text-center space-y-2.5">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-red-950 dark:text-red-100">
                Pesanan Dibatalkan
              </h3>
              <p className="text-xs text-red-800 dark:text-red-300">
                Alasan: {order.cancelReason || 'Dibatalkan oleh pihak restoran.'}
              </p>
            </div>
            {redirectCountdown !== null && (
              <div className="pt-2 border-t border-red-200/60 dark:border-red-800/60 flex flex-col sm:flex-row items-center justify-center gap-2">
                <span className="text-xs font-medium text-red-800 dark:text-red-300">
                  Kembali ke Menu (<span className="font-mono font-bold">{redirectCountdown} detik</span>)
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(backToMenuUrl)}
                >
                  Kembali ke Menu Sekarang
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Main Status Header Card */}
        <Card className="p-3.5 sm:p-4 bg-white dark:bg-[#1e1e1e] border border-stone-200 dark:border-stone-800 shadow-sm rounded-2xl space-y-3">
          {/* Baris 1: Label Nomor Antrean, Nomor Order (clamp), dan Lencana Meja & Nama */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[11px] font-bold tracking-wider text-stone-500 dark:text-stone-400 uppercase block leading-none">
                Nomor Antrean
              </span>
              <span
                className="font-black font-mono tracking-tight text-stone-900 dark:text-white leading-none mt-1 inline-block"
                style={{ fontSize: 'clamp(32px, 9vw, 44px)' }}
              >
                #{order.orderCode}
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-800 dark:text-stone-200 shrink-0">
              <MapPin className="w-3.5 h-3.5 text-[#FF6B1A]" />
              <span>Meja {order.tableNumber}</span>
              <span className="text-stone-300 dark:text-stone-600">•</span>
              <span className="truncate max-w-[100px] xs:max-w-[140px]">{order.customerName}</span>
            </div>
          </div>

          {/* Stepper 3 Tahap (Terkirim, Diterima, Selesai) */}
          {isCancelled ? (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-red-700 dark:text-red-300 text-center space-y-0.5">
              <div className="flex items-center justify-center gap-1.5 font-bold text-sm">
                <XCircle className="w-4 h-4 text-red-500" />
                <span>Pesanan Dibatalkan</span>
              </div>
              <p className="text-xs text-red-600 dark:text-red-400">
                Alasan: {order.cancelReason || 'Dibatalkan oleh pihak restoran'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              <div className="relative pt-1">
                {/* Garis penghubung tepat di dalam batas kartu */}
                <div className="absolute top-[18px] left-[16.666%] right-[16.666%] h-0.5 bg-stone-200 dark:bg-stone-700 overflow-hidden pointer-events-none">
                  <div
                    className="h-full bg-[#FF6B1A] transition-all duration-500"
                    style={{
                      width: stageStep === 1 ? '0%' : stageStep === 2 ? '50%' : '100%',
                    }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-1 relative z-10">
                  {/* Step 1: Terkirim */}
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`w-[28px] h-[28px] rounded-full flex items-center justify-center text-xs font-black transition-all shrink-0 ${
                        stageStep >= 1
                          ? 'bg-[#FF6B1A] text-white ring-2 ring-orange-500/20'
                          : 'bg-stone-200 dark:bg-stone-700 text-stone-500'
                      }`}
                    >
                      {stageStep > 1 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '1'}
                    </div>
                    <span
                      className={`text-[12px] sm:text-[13px] font-bold leading-tight mt-1 line-clamp-2 ${
                        stageStep >= 1 ? 'text-stone-900 dark:text-white' : 'text-stone-400'
                      }`}
                    >
                      Terkirim
                    </span>
                  </div>

                  {/* Step 2: Diterima */}
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`w-[28px] h-[28px] rounded-full flex items-center justify-center text-xs font-black transition-all shrink-0 ${
                        stageStep >= 2
                          ? 'bg-blue-600 text-white ring-2 ring-blue-500/20'
                          : 'bg-stone-200 dark:bg-stone-700 text-stone-500'
                      }`}
                    >
                      {stageStep > 2 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '2'}
                    </div>
                    <span
                      className={`text-[12px] sm:text-[13px] font-bold leading-tight mt-1 line-clamp-2 ${
                        stageStep >= 2 ? 'text-stone-900 dark:text-white' : 'text-stone-400'
                      }`}
                    >
                      Diterima
                    </span>
                  </div>

                  {/* Step 3: Selesai */}
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`w-[28px] h-[28px] rounded-full flex items-center justify-center text-xs font-black transition-all shrink-0 ${
                        stageStep >= 3
                          ? 'bg-emerald-600 text-white ring-2 ring-emerald-500/20'
                          : 'bg-stone-200 dark:bg-stone-700 text-stone-500'
                      }`}
                    >
                      {stageStep >= 3 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '3'}
                    </div>
                    <span
                      className={`text-[12px] sm:text-[13px] font-bold leading-tight mt-1 line-clamp-2 ${
                        stageStep >= 3 ? 'text-stone-900 dark:text-white' : 'text-stone-400'
                      }`}
                    >
                      Selesai
                    </span>
                  </div>
                </div>
              </div>

              {/* Satu kalimat status singkat 14px */}
              <p className="text-[14px] text-center font-medium text-stone-700 dark:text-stone-300 leading-normal pt-1">
                {stageStep === 1 && 'Pesanan telah terkirim dan menunggu konfirmasi admin.'}
                {stageStep === 2 && 'Pesanan telah diterima admin dan sedang disiapkan.'}
                {stageStep === 3 && 'Pesanan selesai dan siap disajikan / telah diantar ke meja.'}
              </p>
            </div>
          )}
        </Card>

        {/* Kartu Pembayaran Ringkas */}
        {!isCancelled && (
          order.paymentStatus === 'LUNAS' ? (
            <Card className="p-3.5 sm:p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 rounded-2xl">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[13px] sm:text-[14px] font-bold text-emerald-900 dark:text-emerald-100 block leading-tight">
                      Pembayaran Diterima
                    </span>
                    <span className="text-[11px] sm:text-[12px] text-emerald-700 dark:text-emerald-300 font-medium block truncate">
                      Metode: {order.paidMethodFinal || order.paymentMethod}
                    </span>
                  </div>
                </div>
                <span className="text-[15px] sm:text-[16px] font-black font-mono text-emerald-800 dark:text-emerald-200 shrink-0">
                  {formatRupiah(payable)}
                </span>
              </div>
            </Card>
          ) : (
            <Card className="p-3.5 sm:p-4 bg-white dark:bg-[#1e1e1e] border border-stone-200 dark:border-stone-800 rounded-2xl space-y-3">
              {/* Baris tunggal lencana status dan nominal */}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                  <span>MENUNGGU PEMBAYARAN</span>
                </span>
                <span className="text-[15px] sm:text-[16px] font-black font-mono text-[#FF6B1A] shrink-0">
                  {formatRupiah(payable)}
                </span>
              </div>

              {/* Hitung mundur batas waktu pembayaran jika ada */}
              {timeLeftSeconds !== null && timeLeftSeconds > 0 && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Batas Waktu Bayar:</span>
                  </div>
                  <span className="font-mono text-xs font-black text-amber-700 dark:text-amber-300">
                    {formatCountdown(timeLeftSeconds)}
                  </span>
                </div>
              )}

              {/* QRIS Method */}
              {order.paymentMethod === 'QRIS' && (
                <div className="space-y-3 text-center">
                  <div className="p-3.5 bg-stone-50 dark:bg-stone-900/60 rounded-xl border border-stone-200 dark:border-stone-800 flex flex-col items-center">
                    <p className="text-xs font-bold text-stone-600 dark:text-stone-300 mb-2.5">
                      Pindai QRIS Dinamis melalui M-Banking atau E-Wallet:
                    </p>

                    {dynamicQrUrl ? (
                      <div className="p-2.5 bg-white rounded-xl shadow-xs border border-stone-200 max-w-[200px]">
                        <img
                          src={dynamicQrUrl}
                          alt="QRIS Dinamis Pembayaran"
                          className="w-full h-auto aspect-square"
                        />
                      </div>
                    ) : qrError ? (
                      <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold">
                        {qrError}
                      </div>
                    ) : (
                      <div className="w-40 h-40 rounded-xl bg-stone-200 dark:bg-stone-800 animate-pulse flex items-center justify-center">
                        <QrCode className="w-8 h-8 text-stone-400" />
                      </div>
                    )}

                    <div className="mt-3 space-y-0.5">
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        Total yang Harus Dibayar:
                      </p>
                      <p className="text-2xl font-black font-mono text-[#FF6B1A]">
                        {formatRupiah(payable)}
                      </p>
                      {order.uniqueCode > 0 && (
                        <p className="text-[11px] text-stone-500 dark:text-stone-400">
                          (Termasuk kode unik #{order.uniqueCode})
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* BANK TRANSFER Method */}
              {order.paymentMethod === 'TRANSFER' && (
                <div className="p-3.5 bg-stone-50 dark:bg-stone-900/60 rounded-xl border border-stone-200 dark:border-stone-800 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300 text-xs font-bold">
                    <Building className="w-3.5 h-3.5 text-[#FF6B1A]" />
                    <span>Rekening Tujuan Transfer:</span>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-stone-900 dark:text-white uppercase">
                        {settings?.bankName || 'BANK'}
                      </p>
                      <p className="text-base font-black font-mono text-stone-900 dark:text-white">
                        {settings?.bankAccountNumber || '-'}
                      </p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400">
                        a.n. {settings?.bankAccountName || 'Restoran'}
                      </p>
                    </div>

                    {settings?.bankAccountNumber && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(settings.bankAccountNumber || '', 'BANK')}
                        icon={copiedBank ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      >
                        {copiedBank ? 'Disalin' : 'Salin'}
                      </Button>
                    )}
                  </div>

                  <div className="p-2.5 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-900/50 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-orange-800 dark:text-orange-300">
                        Nominal Transfer Persis:
                      </p>
                      <p className="text-xl font-black font-mono text-[#FF6B1A]">
                        {formatRupiah(payable)}
                      </p>
                      {order.uniqueCode > 0 && (
                        <p className="text-[10px] text-stone-500 dark:text-stone-400">
                          Kode unik Rp {order.uniqueCode} untuk verifikasi
                        </p>
                      )}
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleCopy(String(payable), 'AMOUNT')}
                      icon={copiedAmount ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                    >
                      {copiedAmount ? 'Disalin' : 'Salin Nominal'}
                    </Button>
                  </div>
                </div>
              )}

              {/* DI_MEJA Method */}
              {order.paymentMethod === 'DI_MEJA' && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl text-center space-y-1">
                  <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
                    Pembayaran Tunai / QRIS di Meja
                  </p>
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    Silakan siapkan pembayaran:
                  </p>
                  <p className="text-2xl font-black font-mono text-blue-950 dark:text-blue-100">
                    {formatRupiah(payable)}
                  </p>
                  <p className="text-[11px] text-blue-700 dark:text-blue-400">
                    Petugas kami akan melayani pembayaran saat mengantar hidangan ke Meja {order.tableNumber}.
                  </p>
                </div>
              )}

              {/* Tombol Saya Sudah Bayar & Klaim */}
              {order.customerClaimedPaid ? (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-center text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Sudah konfirmasi bayar. Sedang diverifikasi kasir.</span>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  loading={claiming}
                  onClick={handleClaimPaid}
                  icon={<Check className="w-4 h-4 stroke-[3]" />}
                >
                  Saya Sudah Bayar
                </Button>
              )}
            </Card>
          )
        )}

        {/* Bagian Lipat (Collapsible) Rincian Pesanan */}
        <Card className="p-3.5 sm:p-4 bg-white dark:bg-[#1e1e1e] border border-stone-200 dark:border-stone-800 rounded-2xl">
          <button
            type="button"
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="w-full flex items-center justify-between text-left cursor-pointer group"
            aria-expanded={detailsOpen}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Utensils className="w-4 h-4 text-[#FF6B1A] shrink-0" />
              <span className="text-[13px] sm:text-[14px] font-bold text-stone-900 dark:text-white truncate">
                Rincian Pesanan ({totalItemCount} item) - {formatRupiah(payable)}
              </span>
            </div>
            <div className="text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-200 shrink-0 ml-2">
              {detailsOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </button>

          {detailsOpen && (
            <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800 space-y-2.5 text-sm">
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {order.items.map((item, idx) => (
                  <div key={idx} className="py-2 first:pt-0">
                    <div className="flex justify-between items-start text-xs sm:text-sm">
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-[#FF6B1A] mr-1.5">{item.qty}×</span>
                        <span className="font-semibold text-stone-900 dark:text-white">
                          {item.name}
                        </span>
                        {item.note && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 italic pl-5 mt-0.5">
                            "{item.note}"
                          </p>
                        )}
                      </div>
                      <span className="font-mono text-xs font-bold text-stone-700 dark:text-stone-300 shrink-0">
                        {formatRupiah(item.price * item.qty)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex justify-between items-center text-xs text-stone-500 dark:text-stone-400">
                <span>Total Harga Menu:</span>
                <span className="font-bold font-mono text-stone-900 dark:text-white">
                  {formatRupiah(order.totalPrice)}
                </span>
              </div>

              {order.uniqueCode > 0 && (
                <div className="flex justify-between items-center text-xs text-stone-500 dark:text-stone-400">
                  <span>Kode Unik Verifikasi:</span>
                  <span className="font-mono font-bold text-stone-700 dark:text-stone-300">
                    +{formatRupiah(order.uniqueCode)}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex justify-between items-center text-sm font-bold">
                <span className="text-stone-900 dark:text-white">Total Tagihan:</span>
                <span className="font-black font-mono text-[#FF6B1A]">
                  {formatRupiah(payable)}
                </span>
              </div>
            </div>
          )}
        </Card>
      </main>

      {/* Sticky Bottom Bar: Tombol Kembali ke Menu selebar penuh */}
      <div className="sticky bottom-0 z-20 bg-stone-50/95 dark:bg-[#121212]/95 backdrop-blur-md px-3 sm:px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-stone-200/80 dark:border-stone-800/80">
        <div className="max-w-xl mx-auto">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate(backToMenuUrl)}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Kembali ke Menu
          </Button>
        </div>
      </div>
    </div>
  );
};
