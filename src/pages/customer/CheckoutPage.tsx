import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  MapPin,
  User,
  AlertCircle,
  Clock,
  ShieldCheck,
  Send,
  Lock,
  CheckCircle2,
  Utensils,
  PlusCircle,
  QrCode,
  Building,
  CreditCard,
  Copy,
  Check,
  Receipt,
  FileText,
  XCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { orderService } from '../../services/orderService';
import { settingsService } from '../../services/settingsService';
import { menuService } from '../../services/menuService';
import { authService } from '../../services/authService';
import { auth } from '../../config/firebase';
import { Settings, Order, PaymentMethod } from '../../types';
import { formatRupiah } from '../../lib/formatters';
import { isValidQrisPayload, generateDynamicQris } from '../../lib/qris';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ThemeToggle } from '../../components/layout/ThemeToggle';
import { audioEngine } from '../../lib/audioEngine';
import { useNow } from '../../hooks/useNow';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    items,
    totalQty,
    totalPrice,
    tableNumber,
    customerName,
    setCustomerName,
    orderNotes,
    setOrderNotes,
    clearCart,
    setLastOrderTime,
    getCooldownRemainingSeconds,
  } = useCart();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null);
  const [existingUnpaidOrder, setExistingUnpaidOrder] = useState<Order | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);

  // Payment Selection State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('DI_MEJA');

  // Dynamic QRIS State for submitted screen
  const [dynamicQrUrl, setDynamicQrUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [claimingPaid, setClaimingPaid] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(true);
  const prevPaymentStatusRef = useRef<string | undefined>(undefined);

  const now = useNow(1000);

  // Realtime subscription ke dokumen pesanan milik customer (onSnapshot)
  useEffect(() => {
    if (!submittedOrder?.id) return;
    prevPaymentStatusRef.current = submittedOrder.paymentStatus;
    setIsRealtimeConnected(true);

    const unsubscribe = orderService.subscribeSingleOrder(
      submittedOrder.id,
      (updatedOrder) => {
        if (!updatedOrder) return;
        setIsRealtimeConnected(true);

        // Saat paymentStatus berubah menjadi LUNAS: Beri getar singkat & chime pendek
        if (
          prevPaymentStatusRef.current === 'BELUM_BAYAR' &&
          updatedOrder.paymentStatus === 'LUNAS'
        ) {
          audioEngine.playPaymentSuccessChime();
        }

        prevPaymentStatusRef.current = updatedOrder.paymentStatus;
        setSubmittedOrder(updatedOrder);
      },
      (err) => {
        console.warn('[Checkout Realtime] Listener error:', err);
        setIsRealtimeConnected(false);
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
  }, [submittedOrder?.id]);

  // 1. Ensure anonymous authentication & load settings & check active unpaid order
  useEffect(() => {
    const init = async () => {
      try {
        let user = auth.currentUser;
        if (!user) {
          user = await authService.signInCustomerAnon();
        }

        const s = await settingsService.getSettings();
        setSettings(s);

        if (user) {
          const unpaid = await orderService.checkActiveUnpaidOrder(user.uid);
          setExistingUnpaidOrder(unpaid);
        }
      } catch (err) {
        console.warn('Init checkout error:', err);
      } finally {
        setCheckingExisting(false);
      }
    };

    init();
  }, []);

  // 2. Determine default payment method once settings load
  useEffect(() => {
    if (!settings) return;

    const qrisValid = isValidQrisPayload(settings.qrisPayload);
    const bankValid = !!(settings.bankName && settings.bankAccountNumber);
    const diMejaAllowed =
      !settings.requirePrepayAll &&
      totalPrice <= (settings.payLaterMaxAmount ?? 100000);

    if (qrisValid) {
      setPaymentMethod('QRIS');
    } else if (bankValid) {
      setPaymentMethod('TRANSFER');
    } else if (diMejaAllowed) {
      setPaymentMethod('DI_MEJA');
    }
  }, [settings, totalPrice]);

  // 3. Countdown timer for submitted QRIS order
  useEffect(() => {
    if (!submittedOrder || submittedOrder.paymentStatus === 'LUNAS') {
      setTimeLeftSeconds(null);
      return;
    }

    const timeoutMinutes = settings?.paymentTimeoutMinutes ?? 10;
    const createdAtMs = Date.now();
    const deadlineMs = createdAtMs + timeoutMinutes * 60 * 1000;

    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));
      setTimeLeftSeconds(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [submittedOrder, settings]);

  // 4. Generate dynamic QRIS for submitted order screen
  useEffect(() => {
    if (
      !submittedOrder ||
      submittedOrder.paymentMethod !== 'QRIS' ||
      submittedOrder.paymentStatus === 'LUNAS'
    ) {
      setDynamicQrUrl(null);
      return;
    }

    const payload = settings?.qrisPayload;
    if (!payload) return;

    try {
      const payable = submittedOrder.payableAmount || submittedOrder.totalPrice;
      const dynamicPayload = generateDynamicQris(payload, payable);
      QRCode.toDataURL(dynamicPayload, {
        width: 300,
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
          console.error('Failed to render QR:', err);
          setQrError('Gagal merender QRIS.');
        });
    } catch (err: any) {
      console.error('Generate dynamic QRIS error:', err);
      setQrError(err?.message || 'Gagal memproses QRIS');
    }
  }, [submittedOrder, settings]);

  const handleClaimPaid = async () => {
    if (!submittedOrder) return;
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;

    setClaimingPaid(true);
    try {
      await orderService.claimPaid(submittedOrder.id, currentUid);
      setSubmittedOrder({
        ...submittedOrder,
        customerClaimedPaid: true,
      });
    } catch (err: any) {
      alert(err?.message || 'Gagal menandai pembayaran.');
    } finally {
      setClaimingPaid(false);
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

  const cooldownSeconds = settings?.orderCooldownSeconds ?? 30;
  const cooldownRemaining = getCooldownRemainingSeconds(cooldownSeconds);

  // If order was submitted successfully, display "Pesanan Terkirim" screen with realtime subscription
  if (submittedOrder) {
    const payable = submittedOrder.payableAmount || submittedOrder.totalPrice;
    const isCancelled = submittedOrder.status === 'DIBATALKAN';
    const isLunas = submittedOrder.paymentStatus === 'LUNAS';

    return (
      <div className="min-h-screen bg-stone-50 dark:bg-[#121212] text-stone-900 dark:text-stone-100 pb-16 antialiased flex flex-col justify-between">
        {/* Top Header with Realtime Indicator & Theme Toggle */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 px-4 py-2.5 shadow-xs">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wider text-stone-900 dark:text-white uppercase">
                {settings?.name || 'Smart Resto'}
              </span>
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
            </div>

            <ThemeToggle />
          </div>
        </header>

        <div className="max-w-xl mx-auto p-4 w-full pt-4 space-y-4">
          <Card className="p-6 sm:p-8 text-center bg-white dark:bg-[#1e1e1e] border border-stone-200 dark:border-stone-800 shadow-xl rounded-3xl space-y-5">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ring-8 animate-in zoom-in-50 duration-300 ${
                isCancelled
                  ? 'bg-red-500/15 text-red-600 dark:text-red-400 ring-red-500/10'
                  : isLunas
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/10'
                  : 'bg-orange-500/15 text-[#FF6B1A] ring-orange-500/10'
              }`}
            >
              {isCancelled ? (
                <XCircle className="w-12 h-12 stroke-[2.5]" />
              ) : (
                <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
              )}
            </div>

            <div className="space-y-1">
              <span className="text-xs font-black tracking-widest text-[#FF6B1A] uppercase">
                {isCancelled ? 'PESANAN DIBATALKAN' : 'PESANAN TERKIRIM!'}
              </span>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-semibold">
                Nomor Antrean Anda
              </p>
              {/* High contrast big order code */}
              <h1 className="text-6xl sm:text-7xl font-black font-mono tracking-tight text-stone-900 dark:text-white pt-1">
                #{submittedOrder.orderCode}
              </h1>
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm font-bold text-stone-800 dark:text-stone-200">
              <MapPin className="w-4 h-4 text-[#FF6B1A]" />
              <span>Meja {submittedOrder.tableNumber}</span>
              <span className="text-stone-300 dark:text-stone-600">•</span>
              <span>{submittedOrder.customerName}</span>
            </div>

            {/* Status Pesanan Realtime (Terkirim -> Diterima -> Selesai / Dibatalkan) */}
            {isCancelled ? (
              <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl text-red-700 dark:text-red-300 space-y-1 text-left">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <span>Pesanan Dibatalkan</span>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400 pl-7">
                  Alasan: {submittedOrder.cancelReason || 'Dibatalkan oleh pihak restoran.'}
                </p>
              </div>
            ) : submittedOrder.status === 'SELESAI' ? (
              <div className="p-4 bg-emerald-500/15 border-2 border-emerald-500/30 rounded-2xl text-emerald-950 dark:text-emerald-100 text-sm font-black leading-relaxed flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Selesai! Pesanan Anda siap / telah diantar ke meja.</span>
              </div>
            ) : submittedOrder.status === 'DITERIMA' ? (
              <div className="p-4 bg-blue-500/15 border-2 border-blue-500/30 rounded-2xl text-blue-950 dark:text-blue-100 text-sm font-black leading-relaxed flex items-center justify-center gap-2">
                <Utensils className="w-5 h-5 text-blue-600" />
                <span>Diterima! Pesanan sedang disiapkan di dapur.</span>
              </div>
            ) : (
              <div className="p-4 bg-orange-500/15 border-2 border-orange-500/30 rounded-2xl text-orange-950 dark:text-orange-100 text-sm font-black leading-relaxed flex items-center justify-center gap-2">
                <Clock className="w-5 h-5 text-[#FF6B1A]" />
                <span>Terkirim ke admin. Menunggu konfirmasi...</span>
              </div>
            )}

            {/* Kartu Status Pembayaran Realtime */}
            {isLunas ? (
              /* Kartu Hijau: Pembayaran Diterima ✓ (QRIS, petunjuk transfer, dan tombol klaim otomatis hilang) */
              <div className="p-5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border-2 border-emerald-500/40 text-center space-y-2 animate-in zoom-in-95 duration-300">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500 text-white shadow-md mx-auto">
                  <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-emerald-900 dark:text-emerald-100">
                    Pembayaran Diterima ✓
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold mt-0.5">
                    Metode: {submittedOrder.paidMethodFinal || submittedOrder.paymentMethod}
                  </p>
                </div>
                <p className="text-2xl sm:text-3xl font-black font-mono text-emerald-800 dark:text-emerald-200 pt-1">
                  {formatRupiah(payable)}
                </p>
              </div>
            ) : !isCancelled ? (
              /* Petunjuk Pembayaran Belum Lunas */
              <div className="p-5 bg-stone-50 dark:bg-stone-900/60 rounded-2xl border border-stone-200 dark:border-stone-800 text-left space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800">
                  <span className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-[#FF6B1A]" />
                    <span>Petunjuk Pembayaran</span>
                  </span>
                  <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-orange-500/10 text-[#FF6B1A]">
                    {submittedOrder.paymentMethod === 'QRIS'
                      ? 'QRIS'
                      : submittedOrder.paymentMethod === 'TRANSFER'
                      ? 'Transfer Bank'
                      : 'Di Meja'}
                  </span>
                </div>

                {/* QRIS details */}
                {submittedOrder.paymentMethod === 'QRIS' && (
                  <div className="text-center space-y-3">
                    {timeLeftSeconds !== null && timeLeftSeconds > 0 && (
                      <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                        <Clock className="w-4 h-4" />
                        <span>Sisa waktu pembayaran: </span>
                        <span className="font-mono font-black">{formatCountdown(timeLeftSeconds)}</span>
                      </div>
                    )}

                    {dynamicQrUrl ? (
                      <div className="p-3 bg-white rounded-2xl shadow-sm border border-stone-200 max-w-[220px] mx-auto">
                        <img
                          src={dynamicQrUrl}
                          alt="QRIS Dinamis"
                          className="w-full h-auto aspect-square"
                        />
                      </div>
                    ) : qrError ? (
                      <p className="text-xs font-bold text-red-500">{qrError}</p>
                    ) : (
                      <div className="w-44 h-44 rounded-xl bg-stone-200 dark:bg-stone-800 animate-pulse mx-auto flex items-center justify-center">
                        <QrCode className="w-10 h-10 text-stone-400" />
                      </div>
                    )}

                    <div>
                      <p className="text-xs text-stone-500 dark:text-stone-400">Total Pembayaran:</p>
                      <p className="text-3xl font-black font-mono text-[#FF6B1A]">
                        {formatRupiah(payable)}
                      </p>
                      {submittedOrder.uniqueCode > 0 && (
                        <p className="text-[11px] text-stone-500 dark:text-stone-400">
                          (Termasuk kode unik Rp {submittedOrder.uniqueCode})
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* TRANSFER details */}
                {submittedOrder.paymentMethod === 'TRANSFER' && (
                  <div className="space-y-3">
                    <div className="p-3 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-stone-900 dark:text-white uppercase">
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

                    <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-900/50 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold text-orange-800 dark:text-orange-300">
                          Nominal Transfer Persis:
                        </p>
                        <p className="text-2xl font-black font-mono text-[#FF6B1A]">
                          {formatRupiah(payable)}
                        </p>
                        {submittedOrder.uniqueCode > 0 && (
                          <p className="text-[10px] text-stone-500 dark:text-stone-400">
                            Termasuk kode unik Rp {submittedOrder.uniqueCode}
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

                {/* DI_MEJA details */}
                {submittedOrder.paymentMethod === 'DI_MEJA' && (
                  <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900 text-center space-y-1">
                    <p className="text-xs text-blue-900 dark:text-blue-200 font-bold">
                      Siapkan pembayaran sebesar:
                    </p>
                    <p className="text-2xl font-black font-mono text-blue-950 dark:text-blue-100">
                      {formatRupiah(payable)}
                    </p>
                    <p className="text-[11px] text-blue-700 dark:text-blue-300">
                      saat pesanan diantar oleh pelayan ke Meja {submittedOrder.tableNumber}.
                    </p>
                  </div>
                )}

                {/* Tombol "Saya Sudah Bayar" */}
                {submittedOrder.customerClaimedPaid ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-center text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Klaim pembayaran terkirim. Staf akan segera memverifikasi.</span>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    fullWidth
                    loading={claimingPaid}
                    onClick={handleClaimPaid}
                    icon={<Check className="w-4 h-4 stroke-[3]" />}
                  >
                    Saya Sudah Bayar
                  </Button>
                )}
              </div>
            ) : null}

            {/* Navigation Buttons */}
            <div className="pt-2 space-y-2">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => navigate(`/order/${submittedOrder.id}`)}
                icon={<Receipt className="w-5 h-5" />}
              >
                Lihat Status Pesanan
              </Button>

              <Button
                variant="outline"
                size="md"
                fullWidth
                onClick={() => navigate(`/menu?table=${submittedOrder.tableNumber}`)}
              >
                Kembali ke Menu
              </Button>
            </div>
          </Card>
        </div>

        {/* Persistent Customer Footer with Staff Login Link */}
        <footer className="max-w-xl mx-auto w-full px-4 pt-4 pb-8 text-center">
          <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-400">
            <span>{settings?.name || 'Smart Restaurant Order System'}</span>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 font-bold text-stone-600 dark:text-stone-300 hover:text-[#FF6B1A] bg-stone-100 dark:bg-stone-800 hover:bg-orange-50 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Login Staf Restoran</span>
            </Link>
          </div>
        </footer>
      </div>
    );
  }

  // If cart is empty
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-[#121212] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-full bg-orange-500/10 text-[#FF6B1A] flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-stone-900 dark:text-white">Keranjang Masih Kosong</h2>
        <p className="text-sm text-stone-500 dark:text-stone-400 max-w-xs mt-1 mb-6">
          Silakan pilih menu makanan dan minuman terlebih dahulu sebelum checkout.
        </p>
        <Link to="/menu">
          <Button variant="primary">Kembali ke Daftar Menu</Button>
        </Link>
      </div>
    );
  }

  // If user has an existing unpaid active order, block checkout!
  if (existingUnpaidOrder) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-[#121212] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-stone-900 dark:text-white">
          Selesaikan Pembayaran Pesanan #{existingUnpaidOrder.orderCode} Dulu
        </h2>
        <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm mt-2 mb-6">
          Satu perangkat hanya dapat memiliki satu pesanan aktif yang belum lunas. Mohon selesaikan pembayaran pesanan sebelumnya sebelum membuat pesanan baru.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="primary"
            onClick={() => navigate(`/order/${existingUnpaidOrder.id}`)}
          >
            Lihat & Bayar Pesanan #{existingUnpaidOrder.orderCode}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/menu?table=${tableNumber}`)}
          >
            Kembali ke Menu
          </Button>
        </div>
      </div>
    );
  }

  const handleSendOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!customerName.trim()) {
      setErrorMessage('Nama pemesan wajib diisi.');
      return;
    }
    if (!tableNumber.trim()) {
      setErrorMessage('Nomor meja wajib dipilih.');
      return;
    }
    if (cooldownRemaining > 0) {
      setErrorMessage(
        `Mohon tunggu ${cooldownRemaining} detik lagi sebelum mengirim pesanan berikutnya.`
      );
      return;
    }

    setLoading(true);

    try {
      // 1. Verify anonymous auth session
      let currentUid = auth.currentUser?.uid;
      if (!currentUid) {
        const anonUser = await authService.signInCustomerAnon();
        currentUid = anonUser.uid;
      }

      // 2. Double check existing unpaid orders
      const unpaidCheck = await orderService.checkActiveUnpaidOrder(currentUid);
      if (unpaidCheck) {
        setExistingUnpaidOrder(unpaidCheck);
        throw new Error(
          `Selesaikan pembayaran pesanan #${unpaidCheck.orderCode} dulu sebelum membuat pesanan baru.`
        );
      }

      // 3. Verify item availability from server
      const currentMenus = await menuService.getMenus();
      const unavailableInCart = items.filter((cartItem) => {
        const found = currentMenus.find((m) => m.id === cartItem.menuId);
        return !found || !found.available;
      });

      if (unavailableInCart.length > 0) {
        const names = unavailableInCart.map((i) => i.name).join(', ');
        throw new Error(
          `Maaf, menu berikut baru saja habis: ${names}. Silakan hapus menu tersebut dari keranjang.`
        );
      }

      // 4. Atomic create order in Firestore
      const newOrder = await orderService.createOrder({
        customerName: customerName.trim(),
        tableNumber: tableNumber.trim(),
        customerUid: currentUid,
        paymentMethod,
        items,
        notes: orderNotes.trim(),
        useUniqueCode: settings?.useUniqueCode ?? true,
      });

      // 5. Update cooldown and clear cart
      setLastOrderTime(Date.now());
      clearCart();

      // 6. Show success screen "Pesanan Terkirim"
      setSubmittedOrder(newOrder);
    } catch (err: any) {
      console.error('[Create Order Error]', err);
      setErrorMessage(
        err?.message ||
          'Terjadi kendala saat mengirim pesanan. Keranjang Anda tetap aman, silakan coba kirim lagi.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Payment Options Availability
  const qrisAvailable = isValidQrisPayload(settings?.qrisPayload);
  const transferAvailable = !!(settings?.bankName && settings?.bankAccountNumber);
  const diMejaAvailable =
    !settings?.requirePrepayAll &&
    totalPrice <= (settings?.payLaterMaxAmount ?? 100000);

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-[#121212] text-stone-900 dark:text-stone-100 pb-16 antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 px-4 py-3 shadow-xs">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link
            to="/menu"
            className="flex items-center gap-2 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white text-sm font-bold"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Kembali ke Menu</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-stone-900 dark:text-white">Konfirmasi Pesanan</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-4">
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Gagal Mengirim Pesanan</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSendOrder} className="space-y-4">
          {/* Table & Customer Information (HIGH CONTRAST HEADINGS) */}
          <Card className="p-4 sm:p-5 space-y-4 bg-white dark:bg-[#1e1e1e] border border-stone-200 dark:border-stone-800 shadow-sm">
            <h3 className="text-sm font-black text-stone-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-[#FF6B1A]" />
              <span>DATA PEMESAN</span>
            </h3>

            <div>
              <label className="block text-xs font-bold text-stone-800 dark:text-stone-200 mb-1">
                Nama Pemesan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={50}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 dark:text-stone-200 mb-1">
                Nomor Meja <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 font-bold text-stone-900 dark:text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#FF6B1A]" />
                  <span>Meja {tableNumber || '-'}</span>
                </div>
                <Link
                  to="/menu"
                  className="text-xs font-bold text-[#FF6B1A] underline px-2"
                >
                  Ubah
                </Link>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 dark:text-stone-200 mb-1">
                Catatan Pesanan Keseluruhan (Maks 300 karakter)
              </label>
              <textarea
                rows={2}
                maxLength={300}
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Contoh: Makanan tolong disajikan bersamaan..."
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]"
              />
            </div>
          </Card>

          {/* Payment Method Selector */}
          <Card className="p-4 sm:p-5 space-y-3 bg-white dark:bg-[#1e1e1e] border border-stone-200 dark:border-stone-800 shadow-sm">
            <h3 className="text-sm font-black text-stone-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#FF6B1A]" />
              <span>METODE PEMBAYARAN</span>
            </h3>

            <div className="space-y-2">
              {/* Option 1: QRIS */}
              {qrisAvailable && (
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                    paymentMethod === 'QRIS'
                      ? 'border-[#FF6B1A] bg-orange-50/50 dark:bg-orange-950/20'
                      : 'border-stone-200 dark:border-stone-800 hover:border-stone-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="QRIS"
                    checked={paymentMethod === 'QRIS'}
                    onChange={() => setPaymentMethod('QRIS')}
                    className="mt-1 accent-[#FF6B1A]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-[#FF6B1A]" />
                      <span className="font-bold text-sm text-stone-900 dark:text-white">
                        Bayar Sekarang - QRIS
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      Pindai QR otomatis dari GoPay, OVO, Dana, BCA, Livin, ShopeePay, dll.
                    </p>
                  </div>
                </label>
              )}

              {/* Option 2: Bank Transfer */}
              {transferAvailable && (
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                    paymentMethod === 'TRANSFER'
                      ? 'border-[#FF6B1A] bg-orange-50/50 dark:bg-orange-950/20'
                      : 'border-stone-200 dark:border-stone-800 hover:border-stone-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="TRANSFER"
                    checked={paymentMethod === 'TRANSFER'}
                    onChange={() => setPaymentMethod('TRANSFER')}
                    className="mt-1 accent-[#FF6B1A]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-[#FF6B1A]" />
                      <span className="font-bold text-sm text-stone-900 dark:text-white">
                        Bayar Sekarang - Transfer Bank
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      Transfer ke rekening {settings?.bankName} ({settings?.bankAccountNumber})
                    </p>
                  </div>
                </label>
              )}

              {/* Option 3: Di Meja */}
              {diMejaAvailable && (
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                    paymentMethod === 'DI_MEJA'
                      ? 'border-[#FF6B1A] bg-orange-50/50 dark:bg-orange-950/20'
                      : 'border-stone-200 dark:border-stone-800 hover:border-stone-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="DI_MEJA"
                    checked={paymentMethod === 'DI_MEJA'}
                    onChange={() => setPaymentMethod('DI_MEJA')}
                    className="mt-1 accent-[#FF6B1A]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#FF6B1A]" />
                      <span className="font-bold text-sm text-stone-900 dark:text-white">
                        Bayar di Meja saat Diantar
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      Bayar tunai atau minta QRIS ke pelayan saat pesanan diantar (Maks {formatRupiah(settings?.payLaterMaxAmount ?? 100000)})
                    </p>
                  </div>
                </label>
              )}

              {!qrisAvailable && !transferAvailable && !diMejaAvailable && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 font-bold">
                  Belum ada metode pembayaran yang dikonfigurasi oleh restoran. Silakan hubungi kasir.
                </div>
              )}
            </div>
          </Card>

          {/* Items Summary (HIGH CONTRAST) */}
          <Card className="p-4 sm:p-5 space-y-3 bg-white dark:bg-[#1e1e1e] border border-stone-200 dark:border-stone-800 shadow-sm">
            <h3 className="text-sm font-black text-stone-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
              <span>RINGKASAN MENU ({totalQty} ITEM)</span>
              <Link to="/menu" className="text-xs text-[#FF6B1A] font-bold">
                Tambah Menu
              </Link>
            </h3>

            <div className="divide-y divide-stone-100 dark:divide-stone-800 max-h-64 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.menuId} className="py-2.5 first:pt-0">
                  <div className="flex justify-between items-start text-sm">
                    <div>
                      <div className="font-semibold text-stone-900 dark:text-white">
                        <span className="text-[#FF6B1A] font-bold mr-2">
                          {item.qty}x
                        </span>
                        {item.name}
                      </div>
                      {item.note && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 pl-6 italic mt-0.5">
                          "{item.note}"
                        </p>
                      )}
                    </div>
                    <span className="font-mono text-xs font-bold text-stone-700 dark:text-stone-300">
                      {formatRupiah(item.price * item.qty)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex justify-between items-center">
              <div>
                <p className="text-xs text-stone-500 dark:text-stone-400">Total Harga</p>
                <p className="text-2xl font-black font-mono text-[#FF6B1A]">
                  {formatRupiah(totalPrice)}
                </p>
              </div>
            </div>
          </Card>

          {/* Submit Action */}
          <div className="pt-2">
            {cooldownRemaining > 0 ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 text-center justify-center font-bold">
                <Clock className="w-4 h-4 animate-spin" />
                <span>
                  Jeda pemesanan: silakan tunggu {cooldownRemaining} detik lagi
                </span>
              </div>
            ) : (
              <Button
                type="submit"
                variant="primary"
                size="xl"
                fullWidth
                loading={loading}
                icon={<Send className="w-5 h-5" />}
              >
                Kirim Pesanan Sekarang
              </Button>
            )}

            <p className="text-[11px] text-stone-400 text-center mt-3 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pesanan langsung terhubung ke sistem restoran secara realtime</span>
            </p>
          </div>
        </form>
      </main>

      {/* Persistent Customer Footer with Staff Login Link */}
      <footer className="max-w-xl mx-auto w-full px-4 pt-4 pb-8 text-center">
        <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-400">
          <span>{settings?.name || 'Smart Restaurant Order System'}</span>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 font-bold text-stone-600 dark:text-stone-300 hover:text-[#FF6B1A] bg-stone-100 dark:bg-stone-800 hover:bg-orange-50 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Login Staf Restoran</span>
          </Link>
        </div>
      </footer>
    </div>
  );
};
