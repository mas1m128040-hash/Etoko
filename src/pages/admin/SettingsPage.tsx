import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { seedService } from '../../services/seedService';
import { audioEngine } from '../../lib/audioEngine';
import { isValidQrisPayload } from '../../lib/qris';
import { useSoundStore } from '../../store/soundStore';
import { useUiStore } from '../../store/uiStore';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FirebaseErrorCard } from '../../components/ui/FirebaseErrorCard';
import { Settings, AlarmTone, AlarmMode } from '../../types';
import { DEFAULT_SETTINGS, ALARM_TONE_LABELS, ALARM_MODE_LABELS } from '../../config/constants';
import { formatRupiah } from '../../lib/formatters';

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

  // Check speech synthesis support & Indonesian voice
  const hasSpeech = audioEngine.isSpeechSupported();
  const hasIndoVoice = audioEngine.hasIndonesianVoice();

  const loadSettings = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const s = await settingsService.getSettings();
      setSettings(s);
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
    setSaving(true);
    try {
      await settingsService.updateSettings(settings);
      addToast('success', 'Pengaturan restoran & sistem suara berhasil disimpan.');
    } catch (err: any) {
      addToast('error', err?.message || 'Gagal menyimpan pengaturan.');
    } finally {
      setSaving(false);
    }
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
      const sampleText = template
        .replace(/{nomor}/g, '001')
        .replace(/{meja}/g, '5')
        .replace(/{nama}/g, 'Budi')
        .replace(/{total}/g, 'Rp 75.000')
        .replace(/{jumlah}/g, '3');

      await audioEngine.speakText(sampleText, volume);
      addToast('info', 'Uji suara selesai diputar.');
    } finally {
      setTestingVoice(false);
    }
  };

  const handleSeedDatabase = async () => {
    if (
      !confirm(
        'Isi basis data dengan 8 menu favorit, 3 kategori, dan setelan awal?'
      )
    )
      return;
    setSeeding(true);
    try {
      const res = await seedService.seedInitialRestaurantData();
      addToast(
        'success',
        `Data awal berhasil dimuat (${res.menus} menu & ${res.categories} kategori).`
      );
    } catch (err: any) {
      addToast('error', err?.message || 'Gagal mengisi data.');
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
                  Jumlah Meja Pelanggan
                </label>
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white"
                />
                <span className="text-[10px] text-stone-400">
                  Untuk menu Cetak QR Meja
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
                <span className="text-[10px] text-stone-400">
                  Mencegah spam order dari meja yang sama
                </span>
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
              <div className="pt-2 border-t border-stone-100 dark:border-stone-800 space-y-2">
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

                <textarea
                  rows={2}
                  value={settings.alarmVoiceText}
                  onChange={(e) =>
                    setSettings({ ...settings, alarmVoiceText: e.target.value })
                  }
                  placeholder="Pesanan baru! Pesanan baru dari meja {meja}. Segera cek dan terima."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]"
                />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <p className="text-[11px] text-stone-400">
                    Placeholder yang tersedia: <code className="text-[#FF6B1A]">{'{nomor}'}</code>,{' '}
                    <code className="text-[#FF6B1A]">{'{meja}'}</code>,{' '}
                    <code className="text-[#FF6B1A]">{'{nama}'}</code>,{' '}
                    <code className="text-[#FF6B1A]">{'{total}'}</code>,{' '}
                    <code className="text-[#FF6B1A]">{'{jumlah}'}</code>
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

        {/* Database Seeder Section */}
        <Card className="p-5 sm:p-6 space-y-4 border-dashed border-stone-300 dark:border-stone-800">
          <div className="flex items-center gap-2.5 pb-2 border-b border-stone-100 dark:border-stone-800">
            <Database className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              Inisialisasi Data Awal (Seed)
            </h3>
          </div>

          <p className="text-xs text-stone-500 leading-relaxed">
            Gunakan tombol ini jika basis data Firestore Anda masih kosong atau baru
            pertama kali dibuat. Fitur ini akan otomatis mengisi 8 menu siap saji,
            3 kategori (Makanan, Minuman, Snack), dan data pengaturan awal.
          </p>

          <Button
            type="button"
            variant="secondary"
            loading={seeding}
            onClick={handleSeedDatabase}
            icon={<Sparkles className="w-4 h-4 text-amber-400" />}
          >
            Muat Data Seed Contoh ke Firestore
          </Button>
        </Card>
      </div>
    </AppShell>
  );
};
