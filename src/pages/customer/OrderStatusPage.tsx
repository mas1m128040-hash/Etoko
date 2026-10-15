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
  const prevPaymentStatusRef = useRef<string | undefined>(undefined);

  // 1. Ensure anonymous session
  useEffect(() => {
    authService.signInCustomerAnon().catch((err) => {
      console.warn('Login anonim warning:', err);
    });
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
          prevPaymentStatusRef.current = fetchedOrder.paymentStatus;
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
  }, [orderId]);

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
        <Button variant="primary" onClick={() => navigate('/menu')}>
          Kembali ke Daftar Menu
        </Button>
      </div>
    );
  }

  // Tahap status (Hanya 3 tahap customer):
  // 1. Terkirim ke admin (status: BARU)
  // 2. Diterima admin - pesanan sedang disiapkan (status: DITERIMA)
  // 3. Selesai (status: SELESAI)
  const isCancelled = order.status === 'DIBATALKAN';
  const stageStep = order.status === 'BARU' ? 1 : order.status === 'DITERIMA' ? 2 : 3;

  const payable = order.payableAmount || order.totalPrice;

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-[#121212] text-stone-900 dark:text-stone-100 pb-20 antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 px-4 py-2.5 shadow-xs">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link
            to={`/menu?table=${order.tableNumber}`}
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
            <span>{isRealtimeConnected ? 'Terhubung langsung' : 'Memperbarui...'}</span>
          </div>

          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-4">
        {/* Main Status Header Card */}
        <Card className="p-6 text-center bg-white dark:bg-[#1e1e1e] border border-stone-200 dark:border-stone-800 shadow-md rounded-3xl space-y-4">
          <div>
            <span className="text-xs font-black tracking-widest text-[#FF6B1A] uppercase">
              NOMOR ANTREAN ANDA
            </span>
            <h1 className="text-6xl font-black font-mono tracking-tight text-stone-900 dark:text-white pt-1">
              #{order.orderCode}
            </h1>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm font-bold text-stone-800 dark:text-stone-200">
            <MapPin className="w-4 h-4 text-[#FF6B1A]" />
            <span>Meja {order.tableNumber}</span>
            <span className="text-stone-300 dark:text-stone-600">•</span>
            <span>{order.customerName}</span>
          </div>

          {/* 3-Stage Progress Indicator (Terkirim -> Diterima -> Selesai) */}
          {isCancelled ? (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl text-red-700 dark:text-red-300 space-y-1">
              <div className="flex items-center justify-center gap-2 font-bold text-sm">
                <XCircle className="w-5 h-5 text-red-500" />
                <span>Pesanan Dibatalkan</span>
              </div>
              <p className="text-xs text-red-600 dark:text-red-400">
                Alasan: {order.cancelReason || 'Dibatalkan oleh pihak restoran'}
              </p>
            </div>
          ) : (
            <div className="pt-2 pb-1 space-y-4">
              <div className="grid grid-cols-3 gap-2 relative">
                {/* Connector line */}
                <div className="absolute top-4 left-1/6 right-1/6 h-1 bg-stone-200 dark:bg-stone-700 -z-0" />
                <div
                  className="absolute top-4 left-1/6 h-1 bg-[#FF6B1A] transition-all duration-500 -z-0"
                  style={{
                    width: stageStep === 1 ? '0%' : stageStep === 2 ? '50%' : '100%',
                  }}
                />

                {/* Step 1 */}
                <div className="flex flex-col items-center gap-2 z-10">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      stageStep >= 1
                        ? 'bg-[#FF6B1A] text-white ring-4 ring-orange-500/20'
                        : 'bg-stone-200 dark:bg-stone-700 text-stone-500'
                    }`}
                  >
                    1
                  </div>
                  <span
                    className={`text-[11px] font-bold leading-tight ${
                      stageStep >= 1
                        ? 'text-stone-900 dark:text-white'
                        : 'text-stone-400'
                    }`}
                  >
                    Terkirim ke Admin
                  </span>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center gap-2 z-10">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      stageStep >= 2
                        ? 'bg-blue-600 text-white ring-4 ring-blue-500/20'
                        : 'bg-stone-200 dark:bg-stone-700 text-stone-500'
                    }`}
                  >
                    2
                  </div>
                  <span
                    className={`text-[11px] font-bold leading-tight ${
                      stageStep >= 2
                        ? 'text-stone-900 dark:text-white'
                        : 'text-stone-400'
                    }`}
                  >
                    Diterima Admin
                  </span>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col items-center gap-2 z-10">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      stageStep >= 3
                        ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/20'
                        : 'bg-stone-200 dark:bg-stone-700 text-stone-500'
                    }`}
                  >
                    3
                  </div>
                  <span
                    className={`text-[11px] font-bold leading-tight ${
                      stageStep >= 3
                        ? 'text-stone-900 dark:text-white'
                        : 'text-stone-400'
                    }`}
                  >
                    Selesai
                  </span>
                </div>
              </div>

              {/* Status Message */}
              <div
                className={`p-3.5 rounded-2xl border text-xs font-bold leading-relaxed ${
                  stageStep === 1
                    ? 'bg-orange-500/10 border-orange-500/20 text-orange-950 dark:text-orange-200'
                    : stageStep === 2
                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-950 dark:text-blue-200'
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-950 dark:text-emerald-200'
                }`}
              >
                {stageStep === 1 &&
                  'Pesanan Anda telah diterima oleh sistem dan sedang menunggu konfirmasi admin.'}
                {stageStep === 2 &&
                  'Pesanan telah diterima oleh admin! Hidangan Anda sedang disiapkan.'}
                {stageStep === 3 &&
                  'Pesanan Anda telah selesai dan siap dihidangkan / telah diantar ke meja.'}
              </div>
            </div>
          )}
        </Card>

        {/* Payment Information Card (Hanya jika pesanan tidak dibatalkan) */}
        {!isCancelled && (
          <Card className="p-5 bg-white dark:bg-[#1e1e1e] border border-stone-200 dark:border-stone-800 shadow-md rounded-3xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#FF6B1A]" />
                <h3 className="text-sm font-bold text-stone-900 dark:text-white uppercase tracking-wider">
                  Status Pembayaran
                </h3>
              </div>

              {order.paymentStatus === 'LUNAS' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-black">
                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>LUNAS</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-black">
                  <Clock className="w-3.5 h-3.5" />
                  <span>MENUNGGU PEMBAYARAN</span>
                </span>
              )}
            </div>

            {/* Jika LUNAS: Tampilkan kartu hijau "Pembayaran Diterima ✓" */}
            {order.paymentStatus === 'LUNAS' ? (
              <div className="p-5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border-2 border-emerald-500/40 text-center space-y-2 animate-in zoom-in-95 duration-300">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500 text-white shadow-md mx-auto">
                  <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-emerald-900 dark:text-emerald-100">
                    Pembayaran Diterima ✓
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold mt-0.5">
                    Metode: {order.paidMethodFinal || order.paymentMethod}
                  </p>
                </div>
                <p className="text-2xl sm:text-3xl font-black font-mono text-emerald-800 dark:text-emerald-200 pt-1">
                  {formatRupiah(payable)}
                </p>
              </div>
            ) : (
              /* Jika BELUM BAYAR: Tampilkan QRIS / Petunjuk Transfer / Di Meja + Tombol Saya Sudah Bayar */
              <div className="space-y-4">
                {/* Timeout countdown if exists */}
                {timeLeftSeconds !== null && timeLeftSeconds > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>Batas Waktu Pembayaran:</span>
                    </div>
                    <span className="font-mono text-sm font-black text-amber-700 dark:text-amber-300">
                      {formatCountdown(timeLeftSeconds)}
                    </span>
                  </div>
                )}

                {/* QRIS Method */}
                {order.paymentMethod === 'QRIS' && (
                  <div className="space-y-3 text-center">
                    <div className="p-4 bg-stone-50 dark:bg-stone-900/60 rounded-2xl border border-stone-200 dark:border-stone-800 flex flex-col items-center">
                      <p className="text-xs font-bold text-stone-600 dark:text-stone-300 mb-3">
                        Pindai QRIS Dinamis Berikut Melalui Aplikasi M-Banking / E-Wallet Anda:
                      </p>

                      {dynamicQrUrl ? (
                        <div className="p-3 bg-white rounded-2xl shadow-sm border border-stone-200 max-w-[240px]">
                          <img
                            src={dynamicQrUrl}
                            alt="QRIS Dinamis Pembayaran"
                            className="w-full h-auto aspect-square"
                          />
                        </div>
                      ) : qrError ? (
                        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs font-bold">
                          {qrError}
                        </div>
                      ) : (
                        <div className="w-48 h-48 rounded-xl bg-stone-200 dark:bg-stone-800 animate-pulse flex items-center justify-center">
                          <QrCode className="w-10 h-10 text-stone-400" />
                        </div>
                      )}

                      <div className="mt-4 space-y-1">
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          Total yang Harus Dibayar:
                        </p>
                        <p className="text-3xl font-black font-mono text-[#FF6B1A]">
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
                  <div className="p-4 bg-stone-50 dark:bg-stone-900/60 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3">
                    <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300 text-xs font-bold">
                      <Building className="w-4 h-4 text-[#FF6B1A]" />
                      <span>Rekening Tujuan Transfer:</span>
                    </div>

                    <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black text-stone-900 dark:text-white uppercase">
                          {settings?.bankName || 'BANK'}
                        </p>
                        <p className="text-lg font-black font-mono text-stone-900 dark:text-white">
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
                          icon={copiedBank ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        >
                          {copiedBank ? 'Disalin' : 'Salin'}
                        </Button>
                      )}
                    </div>

                    {/* Nominal persis transfer */}
                    <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-900/50 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold text-orange-800 dark:text-orange-300">
                          Nominal Transfer Persis (Termasuk Kode Unik):
                        </p>
                        <p className="text-2xl font-black font-mono text-[#FF6B1A]">
                          {formatRupiah(payable)}
                        </p>
                        {order.uniqueCode > 0 && (
                          <p className="text-[10px] text-stone-500 dark:text-stone-400">
                            Kode unik Rp {order.uniqueCode} untuk verifikasi otomatis
                          </p>
                        )}
                      </div>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleCopy(String(payable), 'AMOUNT')}
                        icon={copiedAmount ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                      >
                        {copiedAmount ? 'Disalin' : 'Salin Nominal'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* DI_MEJA Method */}
                {order.paymentMethod === 'DI_MEJA' && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-2xl text-center space-y-2">
                    <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
                      Pembayaran Tunai / QRIS di Meja
                    </p>
                    <p className="text-xs text-blue-800 dark:text-blue-300">
                      Silakan siapkan pembayaran sebesar:
                    </p>
                    <p className="text-3xl font-black font-mono text-blue-950 dark:text-blue-100">
                      {formatRupiah(payable)}
                    </p>
                    <p className="text-[11px] text-blue-700 dark:text-blue-400">
                      Petugas kami akan menagih pembayaran saat pesanan diantarkan ke Meja {order.tableNumber}.
                    </p>
                  </div>
                )}

                {/* Tombol "Saya Sudah Bayar" & Status Klaim */}
                {order.customerClaimedPaid ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-center text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Anda sudah menandai pembayaran. Sedang diverifikasi oleh staf restoran.</span>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={claiming}
                    onClick={handleClaimPaid}
                    icon={<Check className="w-4 h-4 stroke-[3]" />}
                  >
                    Saya Sudah Bayar
                  </Button>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Order Items Breakdown */}
        <Card className="p-5 bg-white dark:bg-[#1e1e1e] border border-stone-200 dark:border-stone-800 shadow-md rounded-3xl space-y-3">
          <h3 className="text-sm font-bold text-stone-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Utensils className="w-4 h-4 text-[#FF6B1A]" />
            <span>Rincian Menu Pesanan</span>
          </h3>

          <div className="divide-y divide-stone-100 dark:divide-stone-800 max-h-56 overflow-y-auto">
            {order.items.map((item, idx) => (
              <div key={idx} className="py-2.5 first:pt-0">
                <div className="flex justify-between items-start text-sm">
                  <div>
                    <span className="font-bold text-[#FF6B1A] mr-2">{item.qty}x</span>
                    <span className="font-semibold text-stone-900 dark:text-white">
                      {item.name}
                    </span>
                    {item.note && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 italic pl-6 mt-0.5">
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

          <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex justify-between items-center text-sm">
            <span className="text-stone-500 dark:text-stone-400">Total Harga Menu:</span>
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

          <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex justify-between items-center font-bold">
            <span className="text-stone-900 dark:text-white">Total Tagihan:</span>
            <span className="text-lg font-black font-mono text-[#FF6B1A]">
              {formatRupiah(payable)}
            </span>
          </div>
        </Card>

        {/* Bottom Actions */}
        <div className="pt-2 space-y-2">
          <Button
            variant="outline"
            size="lg"
            fullWidth
            onClick={() => navigate(`/menu?table=${order.tableNumber}`)}
          >
            Kembali ke Daftar Menu
          </Button>

          {/* Pesan Lagi jika sudah lunas atau dibatalkan */}
          {(order.paymentStatus === 'LUNAS' || isCancelled) && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate(`/menu?table=${order.tableNumber}`)}
              icon={<PlusCircle className="w-5 h-5" />}
            >
              Pesan Menu Lainnya
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};
