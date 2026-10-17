import React, { useState, useEffect, useMemo } from 'react';
import {
  Volume2,
  Save,
  Sparkles,
  Database,
  Store,
  Play,
  CreditCard,
  QrCode,
  Building,
  CheckCircle2,
  AlertTriangle,
  Mic,
  Music,
  Plus,
  Minus,
  FileText,
  Globe,
} from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { orderService } from '../../services/orderService';
import { seedService } from '../../services/seedService';
import { audioEngine } from '../../lib/audioEngine';
import { isValidQrisPayload } from '../../lib/qris';
import { useSoundStore } from '../../store/soundStore';
import { useUiStore } from '../../store/uiStore';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { FirebaseNoticeCard as FirebaseErrorCard } from '../../components/ui/FirebaseNoticeCard';
import { Settings, AlarmTone, AlarmMode, Order } from '../../types';
import { DEFAULT_SETTINGS, ALARM_TONE_LABELS, ALARM_MODE_LABELS } from '../../config/constants';
import { formatRupiah, formatVoiceOrderText } from '../../lib/formatters';
import { isForbiddenUrl, sanitizeBaseUrl, FORBIDDEN_URL_ERROR_MESSAGE } from '../../lib/urlUtils';

export const SettingsPage: React.FC = () => {
  const { soundEnabled, setSoundEnabled, volume, setVolume, activateAudio } =
    useSoundStore();
  const { addToast } = useUiStore();

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [testingVoice, setTestingVoice] = useState(false);
  const [testingPaymentVoice, setTestingPaymentVoice] = useState(false);
  const [isSeeded, setIsSeeded] = useState<boolean>(true); // default true (sembunyikan bila koleksi menus berisi data)
  const [showSeedModal, setShowSeedModal] = useState<boolean>(false);

  // State untuk pengelolaan meja dan proteksi pesanan aktif saat mengurangi meja
  const originalTotalTablesRef = React.useRef<number>(20);
  const [showReduceTableModal, setShowReduceTableModal] = useState<boolean>(false);
  const [activeOrdersOnRemovedTables, setActiveOrdersOnRemovedTables] = useState<Order[]>([]);

  // Check speech synthesis support & Indonesian voice
  const hasSpeech = audioEngine.isSpeechSupported();
  const hasIndoVoice = audioEngine.hasIndonesianVoice();

  // Data contoh pesanan nyata untuk pratinjau & uji suara
  const sampleOrder = useMemo(
    () => ({
      orderCode: '003',
      tableNumber: '5',
      customerName: 'Budi',
      payableAmount: 75000,
      totalPrice: 75000,
      items: [{ qty: 2 }, { qty: 1 }],
    }),
    []
  );

  const samplePreviewText = useMemo(() => {
    return formatVoiceOrderText(
      settings.alarmVoiceText || 'Pesanan baru! Pesanan baru dari meja {meja}. Segera cek dan terima.',
      sampleOrder
    );
  }, [settings.alarmVoiceText, sampleOrder]);

  const paymentVoicePreviewText = useMemo(() => {
    return formatVoiceOrderText(
      settings.paymentVoiceText ||
        'Pelanggan meja {meja} atas nama {nama} menyatakan sudah membayar {total}. Silakan cek mutasi.',
      sampleOrder
    );
  }, [settings.paymentVoiceText, sampleOrder]);

  const loadSettings = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [s, seeded] = await Promise.all([
        settingsService.getSettings(),
        seedService.isDatabaseSeeded().catch(() => true),
      ]);
      originalTotalTablesRef.current = s.totalTables || 20;
      // Nilai URL TIDAK BOLEH tersimpan otomatis dari window.location.
      // Biarkan kosong jika belum pernah diisi manual oleh admin.
      s.appUrl = s.appUrl || '';
      setSettings(s);
      setIsSeeded(seeded);
    } catch (err: any) {
      console.error('[Firestore Error] Gagal memuat settings restoran:', err);
      setFetchError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settings.totalTables < 1 || settings.totalTables > 200) {
      addToast('error', 'Jumlah meja harus antara 1 sampai 200.');
      return;
    }

    // Validasi Alamat Aplikasi (URL): Tolak penyimpanan URL terlarang
    if (settings.appUrl && settings.appUrl.trim()) {
      const cleanUrl = sanitizeBaseUrl(settings.appUrl);
      if (isForbiddenUrl(cleanUrl)) {
        addToast('error', FORBIDDEN_URL_ERROR_MESSAGE);
        return;
      }
    }

    // Jika jumlah meja dikurangi dari sebelumnya, periksa pesanan aktif
    if (settings.totalTables < originalTotalTablesRef.current) {
      const removedTables: string[] = [];
      for (let i = settings.totalTables + 1; i <= originalTotalTablesRef.current; i++) {
        removedTables.push(String(i));
      }

      try {
        const activeOrders = await orderService.getActiveOrdersForTables(removedTables);
        if (activeOrders.length > 0) {
          setActiveOrdersOnRemovedTables(activeOrders);
          setShowReduceTableModal(true);
          return;
        }
      } catch (err) {
        console.warn('Gagal memeriksa pesanan aktif pada meja yang dikurangi:', err);
      }
    }

    await executeSave();
  };

  const executeSave = async () => {
    setSaving(true);
    try {
      const sanitizedPayload = {
        ...settings,
        appUrl: settings.appUrl?.trim() ? sanitizeBaseUrl(settings.appUrl) : '',
      };
      await settingsService.updateSettings(sanitizedPayload);
      setSettings(sanitizedPayload);
      originalTotalTablesRef.current = settings.totalTables;
      setShowReduceTableModal(false);
      setActiveOrdersOnRemovedTables([]);
      addToast('success', 'Pengaturan restoran & sistem suara berhasil disimpan.');
    } catch (err: any) {
      addToast('error', err?.message || 'Gagal menyimpan pengaturan.');
    } finally {
      setSaving(false);
    }
  };

  const handleInsertTag = (tag: string) => {
    setSettings((prev) => ({
      ...prev,
      alarmVoiceText: (prev.alarmVoiceText || '') + tag,
    }));
  };

  const handleApplyFullTemplate = () => {
    setSettings((prev) => ({
      ...prev,
      alarmVoiceText:
        'Pesanan baru nomor {nomor} dari meja {meja} atas nama {nama}, {jumlah} item, total {total}. Segera cek dan terima.',
    }));
    addToast('info', 'Template lengkap berhasil dipasang.');
  };

  const handleTestTone = async (tone: AlarmTone) => {
    await activateAudio();
    audioEngine.playToneOnce(tone, volume);
    addToast('info', `Memutar nada: ${ALARM_TONE_LABELS[tone]}`);
  };

  const handleTestVoice = async () => {
    await activateAudio();
    setTestingVoice(true);
    try {
      const template =
        settings.alarmVoiceText ||
        'Pesanan baru! Pesanan baru dari meja {meja}. Segera cek dan terima.';
      const spokenText = formatVoiceOrderText(template, sampleOrder);

      await audioEngine.speakText(spokenText, volume);
      addToast('info', 'Uji suara selesai diputar.');
    } finally {
      setTestingVoice(false);
    }
  };

  const handleInsertPaymentTag = (tag: string) => {
    setSettings((prev) => ({
      ...prev,
      paymentVoiceText: (prev.paymentVoiceText || '') + tag,
    }));
  };

  const handleApplyPaymentFullTemplate = () => {
    setSettings((prev) => ({
      ...prev,
      paymentVoiceText:
        'Pelanggan meja {meja} atas nama {nama} menyatakan sudah membayar {total}. Silakan cek mutasi.',
    }));
    addToast('info', 'Template suara pembayaran berhasil dipasang.');
  };

  const handleTestPaymentVoice = async () => {
    await activateAudio();
    setTestingPaymentVoice(true);
    try {
      const template =
        settings.paymentVoiceText ||
        'Pelanggan meja {meja} atas nama {nama} menyatakan sudah membayar {total}. Silakan cek mutasi.';
      const spokenText = formatVoiceOrderText(template, sampleOrder);

      await audioEngine.playPaymentClaimNotification({
        voiceText: spokenText,
        volume,
      });
      addToast('info', 'Uji suara pembayaran selesai diputar.');
    } finally {
      setTestingPaymentVoice(false);
    }
  };

  const handleSeedDatabase = async () => {
    setShowSeedModal(false);
    setSeeding(true);
    try {
      const res = await seedService.seedInitialRestaurantData();
      setIsSeeded(true);
      addToast(
        'success',
        `Data awal berhasil dimuat (${res.menus} menu & ${res.categories} kategori).`
      );
    } catch (err: any) {
      addToast('error', err?.message || 'Gagal mengisi data seed.');
    } finally {
      setSeeding(false);
    }
  };

  const isQrisValid = isValidQrisPayload(settings.qrisPayload);

  return (
    <AppShell title="PENGATURAN RESTORAN & SUARA">
      <div className="space-y-6 max-w-4xl">
        {fetchError && (
          <FirebaseErrorCard
            title="Gagal Memuat Pengaturan Restoran"
            error={fetchError}
            onRetry={loadSettings}
          />
        )}

        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Card 1: Restaurant Profile */}
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-stone-100 dark:border-stone-800">
              <Store className="w-5 h-5 text-[#FF6B1A]" />
              <h3 className="text-base font-bold text-stone-900 dark:text-white">
                Profil Meja & Restoran
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Nama Restoran
                </label>
                <input
                  type="text"
                  required
                  value={settings.name}
                  onChange={(e) =>
                    setSettings({ ...settings, name: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Jumlah Meja Pelanggan (1 - 200)
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        totalTables: Math.max(1, settings.totalTables - 1),
                      })
                    }
                    disabled={settings.totalTables <= 1}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:text-[#FF6B1A] border border-stone-200 dark:border-stone-700 disabled:opacity-40 transition-colors cursor-pointer"
                    title="Kurangi 1 Meja"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="number"
                    required
                    min={1}
                    max={200}
                    value={settings.totalTables}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        totalTables: Number(e.target.value),
                      })
                    }
                    className="w-full text-center font-black font-mono text-base py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        totalTables: Math.min(200, settings.totalTables + 1),
                      })
                    }
                    disabled={settings.totalTables >= 200}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:text-[#FF6B1A] border border-stone-200 dark:border-stone-700 disabled:opacity-40 transition-colors cursor-pointer"
                    title="Tambah 1 Meja"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-[10px] text-stone-500 dark:text-stone-400 mt-1 block">
                  Pilihan nomor meja di customer & menu Cetak QR
                </span>
              </div>

              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Jeda Antar Pesanan (Detik Cooldown)
                </label>
                <input
                  type="number"
                  required
                  min={5}
                  max={300}
                  value={settings.orderCooldownSeconds}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      orderCooldownSeconds: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white"
                />
                <span className="text-[10px] text-stone-500 dark:text-stone-400 mt-1 block">
                  Mencegah spam order dari meja yang sama
                </span>
              </div>

              {/* Alamat Aplikasi (URL) untuk QR Meja */}
              <div className="sm:col-span-3 pt-3 border-t border-stone-100 dark:border-stone-800">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 mb-1.5">
                  <div>
                    <label className="block font-bold text-stone-800 dark:text-stone-200">
                      Alamat Aplikasi (URL) untuk Kode QR Meja
                    </label>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Alamat domain web tempat aplikasi ini dihosting untuk dicetak pada stiker QR meja.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const current = typeof window !== 'undefined' ? window.location.origin : '';
                      if (isForbiddenUrl(current)) {
                        addToast('error', FORBIDDEN_URL_ERROR_MESSAGE);
                        return;
                      }
                      setSettings({ ...settings, appUrl: current });
                      addToast('info', 'Alamat URL berhasil diisi dengan alamat saat ini.');
                    }}
                    className="text-xs font-bold text-[#FF6B1A] hover:underline cursor-pointer"
                  >
                    Gunakan Alamat Saat Ini
                  </button>
                </div>

                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={settings.appUrl ?? ''}
                    onChange={(e) => setSettings({ ...settings, appUrl: e.target.value })}
                    placeholder="https://restoran-anda.vercel.app"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]"
                  />
                </div>

                {/* Peringatan jika domain terlarang */}
                {settings.appUrl && isForbiddenUrl(settings.appUrl) ? (
                  <div className="mt-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border-2 border-red-400 dark:border-red-700 text-red-900 dark:text-red-200 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong>Alamat Ditolak:</strong> {FORBIDDEN_URL_ERROR_MESSAGE}. Masukkan alamat domain publik resmi restoran Anda (contoh: <code>https://nama-resto.vercel.app</code>) atau kosongkan field ini agar menggunakan alamat web saat ini.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1.5">
                    QR Meja akan mengarahkan pelanggan ke:{' '}
                    <code className="font-mono text-[#FF6B1A]">
                      {settings.appUrl?.trim()
                        ? `${sanitizeBaseUrl(settings.appUrl)}/#/menu?table=N`
                        : `${typeof window !== 'undefined' ? window.location.origin : ''}/#/menu?table=N (otomatis dari alamat saat ini)`}
                    </code>
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Card 2: Pengaturan Pembayaran (QRIS, Bank, Batas Bayar) */}
          <Card className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-2 border-b border-stone-100 dark:border-stone-800">
              <CreditCard className="w-5 h-5 text-[#FF6B1A]" />
              <h3 className="text-base font-bold text-stone-900 dark:text-white">
                Pengaturan Pembayaran Toko
              </h3>
            </div>

            {/* Sub-section: QRIS Statis Toko */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-xs text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-[#FF6B1A]" />
                  <span>Payload QRIS Statis Toko (EMVCo String)</span>
                </label>
                {settings.qrisPayload ? (
                  isQrisValid ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Format QRIS Valid</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-red-600 bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Format QRIS Tidak Valid</span>
                    </span>
                  )
                ) : (
                  <span className="text-[11px] text-stone-400">Belum diisi (opsi QRIS tidak aktif)</span>
                )}
              </div>

              <textarea
                rows={3}
                value={settings.qrisPayload || ''}
                onChange={(e) =>
                  setSettings({ ...settings, qrisPayload: e.target.value.trim() })
                }
                placeholder="Contoh: 00020101021126600016ID.CO.QRIS.WWW0118936009990000000001...6304ABCD"
                className="w-full px-3.5 py-2 font-mono text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]"
              />
              <p className="text-[11px] text-stone-400">
                Tempel string teks QRIS statis dari aplikasi kasir / merchant Anda (diawali 000201 dan berakhiran tag 63). Sistem akan otomatis mengubah tag 01 dan tag 54 menjadi QRIS dinamis dengan nominal tagihan persis pelanggan.
              </p>
            </div>

            {/* Sub-section: Rekening Bank */}
            <div className="pt-2 border-t border-stone-100 dark:border-stone-800 space-y-3">
              <label className="block font-bold text-xs text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-[#FF6B1A]" />
                <span>Rekening Bank untuk Transfer</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-stone-600 dark:text-stone-400 mb-1">
                    Nama Bank
                  </label>
                  <input
                    type="text"
                    value={settings.bankName || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, bankName: e.target.value })
                    }
                    placeholder="Contoh: BCA / Mandiri / BRI"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-600 dark:text-stone-400 mb-1">
                    Nomor Rekening
                  </label>
                  <input
                    type="text"
                    value={settings.bankAccountNumber || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        bankAccountNumber: e.target.value,
                      })
                    }
                    placeholder="Contoh: 1234567890"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-600 dark:text-stone-400 mb-1">
                    Atas Nama Pemilik
                  </label>
                  <input
                    type="text"
                    value={settings.bankAccountName || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        bankAccountName: e.target.value,
                      })
                    }
                    placeholder="Contoh: Resto Rasa Nusantara"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Sub-section: Kebijakan & Batas Bayar */}
            <div className="pt-2 border-t border-stone-100 dark:border-stone-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Maksimal Nominal "Bayar di Meja saat Diantar"
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-stone-400">
                    Rp
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={settings.payLaterMaxAmount}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        payLaterMaxAmount: Number(e.target.value),
                      })
                    }
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white font-mono"
                  />
                </div>
                <span className="text-[10px] text-stone-400">
                  Pesanan di atas nominal ini wajib bayar di muka lewat QRIS / Transfer
                </span>
              </div>

              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Batas Waktu Pembayaran (Menit Timeout)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={settings.paymentTimeoutMinutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      paymentTimeoutMinutes: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white"
                />
                <span className="text-[10px] text-stone-400">
                  Pesanan belum bayar lewat menit ini diberi penanda merah di dashboard
                </span>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800">
                <input
                  type="checkbox"
                  id="requirePrepayAll"
                  checked={settings.requirePrepayAll}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      requirePrepayAll: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-[#FF6B1A] rounded"
                />
                <label
                  htmlFor="requirePrepayAll"
                  className="font-bold text-stone-800 dark:text-stone-200 cursor-pointer"
                >
                  Wajibkan Bayar di Muka untuk Semua Pesanan
                  <p className="font-normal text-[10px] text-stone-500">
                    Jika dicentang, opsi bayar di meja dinonaktifkan
                  </p>
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800">
                <input
                  type="checkbox"
                  id="useUniqueCode"
                  checked={settings.useUniqueCode}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      useUniqueCode: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-[#FF6B1A] rounded"
                />
                <label
                  htmlFor="useUniqueCode"
                  className="font-bold text-stone-800 dark:text-stone-200 cursor-pointer"
                >
                  Gunakan Kode Unik (Rp 1 - Rp 99)
                  <p className="font-normal text-[10px] text-stone-500">
                    Menambahkan kode unik sesuai nomor urut order untuk cek mutasi otomatis
                  </p>
                </label>
              </div>
            </div>
          </Card>

          {/* Card 3: Nada Dering & Suara Panggilan */}
          <Card className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-2 border-b border-stone-100 dark:border-stone-800">
              <Volume2 className="w-5 h-5 text-[#FF6B1A]" />
              <h3 className="text-base font-bold text-stone-900 dark:text-white">
                Sistem Alarm & Suara Panggilan
              </h3>
            </div>

            {/* General Volume & Toggle */}
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-stone-800 dark:text-stone-200">
                    Status Alarm Suara
                  </p>
                  <p className="text-stone-400 text-[11px]">
                    Berbunyi otomatis selama ada pesanan baru berstatus BARU
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    soundEnabled
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-600 border border-red-500/20'
                  }`}
                >
                  {soundEnabled ? 'Aktif' : 'Nonaktif'}
                </button>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-stone-700 dark:text-stone-300">
                    Tingkat Volume: {volume}%
                  </label>
                  <span className="text-[11px] text-stone-400">
                    Tersimpan di perangkat lokal
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-full accent-[#FF6B1A] cursor-pointer"
                />
              </div>

              {/* Mode Alarm Selector */}
              <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
                <label className="block font-bold text-stone-800 dark:text-stone-200 mb-2">
                  Mode Alarm Pesanan Baru
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(['NADA', 'SUARA', 'NADA_LALU_SUARA'] as AlarmMode[]).map(
                    (m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSettings({ ...settings, alarmMode: m })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          settings.alarmMode === m
                            ? 'border-[#FF6B1A] bg-orange-50/50 dark:bg-orange-950/20 text-[#FF6B1A] font-bold shadow-xs'
                            : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          {m === 'NADA' ? (
                            <Music className="w-3.5 h-3.5" />
                          ) : (
                            <Mic className="w-3.5 h-3.5" />
                          )}
                          <span>{ALARM_MODE_LABELS[m]}</span>
                        </div>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Pilihan Nada Alarm (7 Pilihan Web Audio API) */}
              <div className="pt-2 border-t border-stone-100 dark:border-stone-800 space-y-2">
                <label className="block font-bold text-stone-800 dark:text-stone-200">
                  Pilihan Jenis Nada Alarm (Web Audio API)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    [
                      'DEFAULT',
                      'SIRENE_CEPAT',
                      'BEL_PANIK',
                      'TELEPON',
                      'TIGA_BIP',
                      'PESANAN_DATANG',
                      'KLAKSON_PENDEK',
                    ] as AlarmTone[]
                  ).map((tone) => (
                    <div
                      key={tone}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        settings.alarmTone === tone
                          ? 'border-[#FF6B1A] bg-orange-50/50 dark:bg-orange-950/20'
                          : 'border-stone-200 dark:border-stone-800'
                      }`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input
                          type="radio"
                          name="alarmTone"
                          checked={settings.alarmTone === tone}
                          onChange={() =>
                            setSettings({ ...settings, alarmTone: tone })
                          }
                          className="accent-[#FF6B1A]"
                        />
                        <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                          {ALARM_TONE_LABELS[tone]}
                        </span>
                      </label>

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleTestTone(tone)}
                        icon={<Play className="w-3 h-3 text-[#FF6B1A]" />}
                        className="py-1 px-2.5 text-xs"
                      >
                        Tes
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Teks Suara Web Speech API */}
              <div className="pt-2 border-t border-stone-100 dark:border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-stone-800 dark:text-stone-200">
                    Template Teks Panggilan Suara Orang (Web Speech API)
                  </label>
                  {!hasIndoVoice && (
                    <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Suara id-ID tidak terdeteksi (fallback ke suara default)</span>
                    </span>
                  )}
                </div>

                {/* Quick Insert Tag Chips & Full Template Button */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-stone-500 mr-1">Sisipkan Tag:</span>
                  {[
                    { tag: '{nomor}', label: '{nomor}' },
                    { tag: '{meja}', label: '{meja}' },
                    { tag: '{nama}', label: '{nama}' },
                    { tag: '{total}', label: '{total}' },
                    { tag: '{jumlah}', label: '{jumlah}' },
                  ].map((item) => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => handleInsertTag(item.tag)}
                      className="px-2 py-0.5 rounded-lg bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-900/40 text-[#FF6B1A] font-mono text-[11px] font-bold border border-orange-200 dark:border-orange-800 transition-colors"
                      title={`Sisipkan tag ${item.tag}`}
                    >
                      + {item.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleApplyFullTemplate}
                    className="ml-auto px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-[11px] font-bold border border-stone-200 dark:border-stone-700 flex items-center gap-1 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#FF6B1A]" />
                    <span>Pakai Template Lengkap</span>
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={settings.alarmVoiceText}
                  onChange={(e) =>
                    setSettings({ ...settings, alarmVoiceText: e.target.value })
                  }
                  placeholder="Pesanan baru nomor {nomor} dari meja {meja} atas nama {nama}, {jumlah} item, total {total}. Segera cek dan terima."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]"
                />

                {/* Pratinjau Kalimat Hasil Akhir Memakai Data Contoh */}
                <div className="p-3 bg-stone-100 dark:bg-stone-900/60 rounded-xl border border-stone-200 dark:border-stone-800 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 dark:text-stone-400">
                    <span>Pratinjau Hasil Pembacaan (Data Contoh):</span>
                    <span className="text-[10px] text-stone-400">
                      Meja 5 • Budi • 3 Item • Rp 75.000
                    </span>
                  </div>
                  <p className="text-stone-800 dark:text-stone-200 italic font-medium leading-relaxed">
                    "{samplePreviewText}"
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
                  <p className="text-[11px] text-stone-400">
                    Alarm asli membaca teks ini saat ada pesanan baru berstatus BARU.
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={testingVoice}
                    onClick={handleTestVoice}
                    icon={<Mic className="w-3.5 h-3.5 text-[#FF6B1A]" />}
                  >
                    Tes Suara Orang
                  </Button>
                </div>
              </div>

              {/* Teks Suara Pembayaran Masuk (Web Speech API) */}
              <div className="pt-4 border-t border-stone-100 dark:border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-bold text-stone-800 dark:text-stone-200">
                      Template Teks Suara Pembayaran Masuk (Web Speech API)
                    </label>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Dibacakan SEKALI di portal admin saat pelanggan menekan tombol "Saya Sudah Bayar"
                    </p>
                  </div>
                </div>

                {/* Quick Insert Tag Chips & Full Template Button */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-stone-500 mr-1">Sisipkan Tag:</span>
                  {[
                    { tag: '{nomor}', label: '{nomor}' },
                    { tag: '{meja}', label: '{meja}' },
                    { tag: '{nama}', label: '{nama}' },
                    { tag: '{total}', label: '{total}' },
                    { tag: '{jumlah}', label: '{jumlah}' },
                  ].map((item) => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => handleInsertPaymentTag(item.tag)}
                      className="px-2 py-0.5 rounded-lg bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-900/40 text-[#FF6B1A] font-mono text-[11px] font-bold border border-orange-200 dark:border-orange-800 transition-colors"
                      title={`Sisipkan tag ${item.tag}`}
                    >
                      + {item.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleApplyPaymentFullTemplate}
                    className="ml-auto px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-[11px] font-bold border border-stone-200 dark:border-stone-700 flex items-center gap-1 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#FF6B1A]" />
                    <span>Pakai Template Lengkap</span>
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={settings.paymentVoiceText ?? ''}
                  onChange={(e) =>
                    setSettings({ ...settings, paymentVoiceText: e.target.value })
                  }
                  placeholder="Pelanggan meja {meja} atas nama {nama} menyatakan sudah membayar {total}. Silakan cek mutasi."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]"
                />

                {/* Pratinjau Kalimat Hasil Akhir Memakai Data Contoh */}
                <div className="p-3 bg-stone-100 dark:bg-stone-900/60 rounded-xl border border-stone-200 dark:border-stone-800 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 dark:text-stone-400">
                    <span>Pratinjau Hasil Pembacaan (Data Contoh):</span>
                    <span className="text-[10px] text-stone-400">
                      Meja 5 • Budi • 3 Item • Rp 75.000
                    </span>
                  </div>
                  <p className="text-stone-800 dark:text-stone-200 italic font-medium leading-relaxed">
                    "{paymentVoicePreviewText}"
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
                  <p className="text-[11px] text-stone-400">
                    Diputar sekali bersama nada notifikasi pembayaran saat pelanggan konfirmasi.
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={testingPaymentVoice}
                    onClick={handleTestPaymentVoice}
                    icon={<Play className="w-3.5 h-3.5 text-[#FF6B1A]" />}
                  >
                    Tes Suara Pembayaran
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Submit Settings Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={saving}
              icon={<Save className="w-4 h-4" />}
            >
              Simpan Perubahan Pengaturan
            </Button>
          </div>
        </form>

        {/* Database Seeder Section: Disembunyikan bila koleksi menus sudah berisi data */}
        {!isSeeded && (
          <Card className="p-5 sm:p-6 space-y-4 border-dashed border-stone-300 dark:border-stone-800">
            <div className="flex items-center gap-2.5 pb-2 border-b border-stone-100 dark:border-stone-800">
              <Database className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-stone-900 dark:text-white">
                Inisialisasi Data Awal (Seed)
              </h3>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed">
              Basis data menus saat ini masih kosong. Klik tombol di bawah untuk mengisi 8 menu siap saji, 3 kategori (Makanan, Minuman, Snack), dan data pengaturan awal.
            </p>

            <Button
              type="button"
              variant="secondary"
              loading={seeding}
              onClick={() => setShowSeedModal(true)}
              icon={<Sparkles className="w-4 h-4 text-amber-400" />}
            >
              Muat Data Seed Contoh ke Firestore
            </Button>
          </Card>
        )}
      </div>

      {/* Seed Confirmation Modal */}
      <Modal
        isOpen={showSeedModal}
        onClose={() => setShowSeedModal(false)}
        title="Konfirmasi Inisialisasi Data Awal (Seed Data)"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl flex items-start gap-2.5 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Penjelasan Tindakan Seed Data:</p>
              <p>
                Fitur ini akan memuat 8 hidangan menu siap saji dan 3 kategori rekomendasi (Makanan, Minuman, Snack) ke dalam Firestore.
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                Data yang sudah ada tidak akan ditimpa atau dihapus. Pastikan koneksi internet stabil saat proses seed berjalan.
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => setShowSeedModal(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              fullWidth
              loading={seeding}
              onClick={handleSeedDatabase}
            >
              Ya, Muat Data Awal
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Peringatan Pengurangan Jumlah Meja Saat Masih Ada Pesanan Aktif */}
      <Modal
        isOpen={showReduceTableModal}
        onClose={() => {
          setShowReduceTableModal(false);
          setActiveOrdersOnRemovedTables([]);
        }}
        title="Peringatan: Pesanan Aktif Pada Meja Yang Akan Dikurangi"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>Ditemukan Pesanan Aktif Pada Meja Tersebut</span>
            </div>
            <p className="leading-relaxed">
              Anda berencana mengurangi jumlah meja dari {originalTotalTablesRef.current} menjadi {settings.totalTables} meja. Terdapat <strong>{activeOrdersOnRemovedTables.length} pesanan aktif</strong> (status BARU / DITERIMA) pada meja yang akan dikurangi:
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {activeOrdersOnRemovedTables.map((order) => (
                <span
                  key={order.id}
                  className="px-2.5 py-1 rounded-lg bg-amber-200 dark:bg-amber-900 font-bold text-amber-950 dark:text-amber-100 text-[11px]"
                >
                  Meja {order.tableNumber} (Order #{order.orderCode} - {order.customerName})
                </span>
              ))}
            </div>
          </div>

          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
            <strong>Catatan Keamanan:</strong> Pesanan lama <em>tidak akan terhapus atau berubah</em>, dan riwayat transaksi tetap tersimpan utuh. Namun pelanggan tidak dapat lagi memilih meja tersebut untuk membuat pesanan baru.
          </p>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setShowReduceTableModal(false);
                setActiveOrdersOnRemovedTables([]);
              }}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              size="md"
              loading={saving}
              onClick={executeSave}
            >
              Tetap Kurangi Meja & Simpan
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
};
