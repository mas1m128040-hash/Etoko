import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Trash2,
  Download,
  CheckCircle2,
  AlertOctagon,
  ArrowRight,
  ArrowLeft,
  FileSpreadsheet,
  FileJson,
  ShieldAlert,
  Loader2,
  Calendar,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  dataResetService,
  ResetScope,
  ResetCollectionsSelection,
  ResetCounts,
  ResetProgress,
} from '../../services/dataResetService';

interface DataResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminNameOrEmail: string;
  onSuccess: () => void;
}

export const DataResetModal: React.FC<DataResetModalProps> = ({
  isOpen,
  onClose,
  adminNameOrEmail,
  onSuccess,
}) => {
  // Steps: 1 (Cakupan), 2 (Pratinjau), 3 (Cadangan), 4 (Konfirmasi), 5 (Eksekusi), 6 (Selesai)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Step 1: Cakupan & Pilihan Koleksi
  const [scope, setScope] = useState<ResetScope>('ALL');
  const [cutoffDate, setCutoffDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [selection, setSelection] = useState<ResetCollectionsSelection>({
    orders: true,
    dailyStats: true,
    paymentLogs: true,
    counters: true,
  });

  // Step 2: Pratinjau & Hitung Dokumen
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [counts, setCounts] = useState<ResetCounts | null>(null);
  const [countsError, setCountsError] = useState<string | null>(null);
  const [understandActiveOrders, setUnderstandActiveOrders] = useState(false);

  // Step 3: Cadangan
  const [downloadingJson, setDownloadingJson] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadedJson, setDownloadedJson] = useState(false);
  const [downloadedCsv, setDownloadedCsv] = useState(false);
  const [skipBackup, setSkipBackup] = useState(false);

  // Step 4: Konfirmasi Kata Kunci
  const [confirmText, setConfirmText] = useState('');

  // Step 5: Eksekusi Progres
  const [progress, setProgress] = useState<ResetProgress | null>(null);
  const [cancelRequested, setCancelRequested] = useState(false);
  const cancelRequestedRef = useRef(false);
  const [errorDetails, setErrorDetails] = useState<{
    code?: string;
    message: string;
    failedCollection?: string;
  } | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Step 6: Hasil Akhir
  const [finalTotalDeleted, setFinalTotalDeleted] = useState(0);
  const [finalBreakdown, setFinalBreakdown] = useState<{
    orders: number;
    dailyStats: number;
    paymentLogs: number;
    counters: number;
  }>({ orders: 0, dailyStats: 0, paymentLogs: 0, counters: 0 });

  // Reset internal state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setScope('ALL');
      setSelection({
        orders: true,
        dailyStats: true,
        paymentLogs: true,
        counters: true,
      });
      setCounts(null);
      setCountsError(null);
      setUnderstandActiveOrders(false);
      setDownloadedJson(false);
      setDownloadedCsv(false);
      setSkipBackup(false);
      setConfirmText('');
      setProgress(null);
      setCancelRequested(false);
      cancelRequestedRef.current = false;
      setErrorDetails(null);
      setIsRetrying(false);
      setFinalTotalDeleted(0);
    }
  }, [isOpen]);

  // Adjust counters checkbox based on scope
  const handleScopeChange = (newScope: ResetScope) => {
    setScope(newScope);
    if (newScope === 'BEFORE_DATE') {
      setSelection((prev) => ({ ...prev, counters: false }));
    } else {
      setSelection((prev) => ({ ...prev, counters: true }));
    }
  };

  // Navigasi ke Langkah 2: Hitung Pratinjau
  const handleGoToStep2 = async () => {
    setStep(2);
    setLoadingCounts(true);
    setCountsError(null);
    try {
      const c = await dataResetService.getResetCounts(scope, cutoffDate, selection);
      setCounts(c);
    } catch (err: any) {
      console.error('Gagal menghitung dokumen:', err);
      setCountsError(err?.message || 'Gagal memuat pratinjau dokumen.');
    } finally {
      setLoadingCounts(false);
    }
  };

  // Unduh Cadangan JSON
  const handleDownloadJson = async () => {
    setDownloadingJson(true);
    try {
      await dataResetService.downloadBackupJson(scope, cutoffDate, selection);
      setDownloadedJson(true);
    } catch (err) {
      console.error('Gagal mengunduh JSON:', err);
    } finally {
      setDownloadingJson(false);
    }
  };

  // Unduh Cadangan CSV
  const handleDownloadCsv = async () => {
    setDownloadingCsv(true);
    try {
      await dataResetService.downloadOrdersCsv(scope, cutoffDate);
      setDownloadedCsv(true);
    } catch (err) {
      console.error('Gagal mengunduh CSV:', err);
    } finally {
      setDownloadingCsv(false);
    }
  };

  // Eksekusi Penghapusan
  const startExecution = async (isResume = false) => {
    setStep(5);
    setErrorDetails(null);
    cancelRequestedRef.current = false;
    setCancelRequested(false);

    const resumeState = isResume && errorDetails?.failedCollection
      ? {
          startCollection: errorDetails.failedCollection as any,
          alreadyDeleted: {
            orders: progress?.deletedOrders || 0,
            paymentLogs: progress?.deletedPaymentLogs || 0,
            dailyStats: progress?.deletedDailyStats || 0,
            counters: progress?.deletedCounters || 0,
          },
        }
      : undefined;

    const res = await dataResetService.executeReset(
      scope,
      cutoffDate,
      selection,
      adminNameOrEmail,
      (p) => {
        setProgress(p);
      },
      () => cancelRequestedRef.current,
      resumeState
    );

    if (res.success) {
      setFinalTotalDeleted(res.deletedCounts.total);
      setFinalBreakdown({
        orders: res.deletedCounts.orders,
        dailyStats: res.deletedCounts.dailyStats,
        paymentLogs: res.deletedCounts.paymentLogs,
        counters: res.deletedCounts.counters,
      });
      setStep(6);
      onSuccess();
    } else if (res.stoppedByAdmin) {
      setFinalTotalDeleted(res.deletedCounts.total);
      setFinalBreakdown({
        orders: res.deletedCounts.orders,
        dailyStats: res.deletedCounts.dailyStats,
        paymentLogs: res.deletedCounts.paymentLogs,
        counters: res.deletedCounts.counters,
      });
      setStep(6);
      onSuccess();
    } else {
      // Error pada salah satu batch
      setErrorDetails({
        code: res.errorCode,
        message: res.error || 'Terjadi kesalahan saat menghapus batch dokumen.',
        failedCollection: res.failedCollection,
      });
    }
  };

  const handleCancelExecution = () => {
    cancelRequestedRef.current = true;
    setCancelRequested(true);
  };

  const canProceedStep1 =
    selection.orders ||
    selection.dailyStats ||
    selection.paymentLogs ||
    (selection.counters && scope === 'ALL');

  const canProceedStep2 =
    !loadingCounts &&
    counts !== null &&
    (!counts.activeOrders || understandActiveOrders);

  const canProceedStep3 = downloadedJson || downloadedCsv || skipBackup;

  const canProceedStep4 = confirmText.trim() === 'HAPUS';

  const modalTitle =
    step === 6
      ? 'Penghapusan Data Berhasil'
      : step === 5
      ? 'Memproses Penghapusan Data Transaksi...'
      : `Hapus Data Uji Coba (Langkah ${step} dari 4)`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (step === 5 && !errorDetails) return; // Lindungi jika sedang berjalan
        onClose();
      }}
      title={modalTitle}
      maxWidth="lg"
      showCloseButton={step !== 5 || !!errorDetails}
    >
      <div className="space-y-4 text-xs">
        {/* ========================================================
            LANGKAH 1: PILIH CAKUPAN & KOLEKSI
            ======================================================== */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl flex items-start gap-2.5 text-red-900 dark:text-red-200">
              <ShieldAlert className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Perlindungan Data Restoran Terjamin:</p>
                <p className="text-[11px] leading-relaxed text-red-800 dark:text-red-300">
                  Fitur ini dirancang khusus untuk membersihkan data transaksi dummy atau riwayat uji coba.
                  Daftar menu hidangan, kategori, pengaturan restoran, dan akun pengguna <strong>TIDAK AKAN PERNAH</strong> terhapus.
                </p>
              </div>
            </div>

            {/* Pilihan Cakupan */}
            <div className="space-y-2">
              <label className="font-bold text-stone-900 dark:text-stone-100 block">
                1. Pilih Cakupan Waktu Data:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleScopeChange('ALL')}
                  className={`p-3 text-left rounded-xl border transition-all ${
                    scope === 'ALL'
                      ? 'border-red-500 bg-red-50/50 dark:bg-red-950/30 text-red-900 dark:text-red-100 ring-2 ring-red-500/20'
                      : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:border-stone-300'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>Semua Data Transaksi</span>
                    {scope === 'ALL' && <CheckCircle2 className="w-4 h-4 text-red-600" />}
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                    Bersihkan seluruh transaksi uji coba dari awal hingga saat ini.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleScopeChange('BEFORE_DATE')}
                  className={`p-3 text-left rounded-xl border transition-all ${
                    scope === 'BEFORE_DATE'
                      ? 'border-red-500 bg-red-50/50 dark:bg-red-950/30 text-red-900 dark:text-red-100 ring-2 ring-red-500/20'
                      : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:border-stone-300'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>Sebelum Tanggal Tertentu</span>
                    {scope === 'BEFORE_DATE' && <CheckCircle2 className="w-4 h-4 text-red-600" />}
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                    Hanya data lama sebelum tanggal yang Anda tentukan.
                  </p>
                </button>
              </div>

              {scope === 'BEFORE_DATE' && (
                <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-stone-400 shrink-0" />
                  <label className="text-xs font-medium text-stone-700 dark:text-stone-300 whitespace-nowrap">
                    Hapus data sebelum:
                  </label>
                  <input
                    type="date"
                    value={cutoffDate}
                    onChange={(e) => setCutoffDate(e.target.value)}
                    className="px-2.5 py-1 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white"
                  />
                </div>
              )}
            </div>

            {/* Pilihan Koleksi Yang Dihapus */}
            <div className="space-y-2">
              <label className="font-bold text-stone-900 dark:text-stone-100 block">
                2. Pilih Komponen Yang Dihapus:
              </label>

              <div className="space-y-2 bg-stone-50 dark:bg-stone-900/40 p-3 rounded-2xl border border-stone-200 dark:border-stone-800">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selection.orders}
                    onChange={(e) =>
                      setSelection((prev) => ({ ...prev, orders: e.target.checked }))
                    }
                    className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-stone-900 dark:text-white block">
                      Riwayat Pesanan (orders)
                    </span>
                    <span className="text-[11px] text-stone-500">
                      Seluruh dokumen order pelanggan dan detail hidangan yang dipesan.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selection.dailyStats}
                    onChange={(e) =>
                      setSelection((prev) => ({ ...prev, dailyStats: e.target.checked }))
                    }
                    className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-stone-900 dark:text-white block">
                      Ringkasan Laporan Harian (dailyStats)
                    </span>
                    <span className="text-[11px] text-stone-500">
                      Rekap penjualan harian, statistik omset, dan ranking menu terlaris.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selection.paymentLogs}
                    onChange={(e) =>
                      setSelection((prev) => ({ ...prev, paymentLogs: e.target.checked }))
                    }
                    className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-stone-900 dark:text-white block">
                      Log Pembayaran (paymentLogs)
                    </span>
                    <span className="text-[11px] text-stone-500">
                      Catatan mutasi verifikasi bayar dan notifikasi kasir.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 ${
                    scope === 'ALL' ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={scope !== 'ALL'}
                    checked={selection.counters && scope === 'ALL'}
                    onChange={(e) =>
                      setSelection((prev) => ({ ...prev, counters: e.target.checked }))
                    }
                    className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-stone-900 dark:text-white block">
                      Nomor Urut Antrean (counters)
                    </span>
                    <span className="text-[11px] text-stone-500">
                      Reset nomor antrean harian sehingga <strong>nomor pesanan kembali ke #001</strong>. (Hanya aktif bila cakupan Semua).
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
              <Button variant="outline" onClick={onClose}>
                Batal
              </Button>
              <Button
                variant="primary"
                disabled={!canProceedStep1}
                onClick={handleGoToStep2}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Lanjut ke Pratinjau
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================
            LANGKAH 2: PRATINJAU JUMLAH DOKUMEN & CEK ORDER AKTIF
            ======================================================== */}
        {step === 2 && (
          <div className="space-y-4">
            {loadingCounts ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-7 h-7 text-red-600 animate-spin" />
                <p className="text-stone-500 text-xs font-medium">
                  Menghitung dokumen yang akan dihapus dari Firestore...
                </p>
              </div>
            ) : countsError ? (
              <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-2xl text-red-800 dark:text-red-200 space-y-2">
                <p className="font-bold">Gagal Menghitung Dokumen:</p>
                <p className="text-xs">{countsError}</p>
                <Button variant="outline" size="sm" onClick={handleGoToStep2}>
                  Coba Lagi
                </Button>
              </div>
            ) : counts ? (
              <>
                <div className="space-y-2.5">
                  <h4 className="font-bold text-stone-900 dark:text-white">
                    Ringkasan Dokumen Yang Akan Dihapus:
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 text-center">
                      <span className="text-[10px] uppercase font-bold text-stone-400 block">
                        Pesanan
                      </span>
                      <span className="text-base font-extrabold text-stone-900 dark:text-white">
                        {counts.orders}
                      </span>
                    </div>

                    <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 text-center">
                      <span className="text-[10px] uppercase font-bold text-stone-400 block">
                        Lap. Harian
                      </span>
                      <span className="text-base font-extrabold text-stone-900 dark:text-white">
                        {counts.dailyStats}
                      </span>
                    </div>

                    <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 text-center">
                      <span className="text-[10px] uppercase font-bold text-stone-400 block">
                        Log Bayar
                      </span>
                      <span className="text-base font-extrabold text-stone-900 dark:text-white">
                        {counts.paymentLogs}
                      </span>
                    </div>

                    <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 text-center">
                      <span className="text-[10px] uppercase font-bold text-stone-400 block">
                        Nomor Urut
                      </span>
                      <span className="text-base font-extrabold text-stone-900 dark:text-white">
                        {counts.counters}
                      </span>
                    </div>
                  </div>

                  <p className="text-stone-600 dark:text-stone-300 font-medium">
                    Total keseluruhan: <strong>{counts.total} dokumen</strong> akan dihapus permanen.
                  </p>
                </div>

                {/* Peringatan Pesanan Aktif jika Ada */}
                {counts.activeOrders > 0 && (
                  <div className="p-3.5 bg-red-100 dark:bg-red-950/60 border-2 border-red-500 rounded-2xl text-red-900 dark:text-red-200 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-sm text-red-700 dark:text-red-400">
                      <AlertOctagon className="w-5 h-5 shrink-0 text-red-600" />
                      <span>PERINGATAN: Ada {counts.activeOrders} Pesanan Aktif Berjalan!</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Ditemukan <strong>{counts.activeOrders} pesanan berstatus BARU, DITERIMA, atau BELUM LUNAS</strong>.
                      Jika dilanjutkan, pesanan aktif ini akan dihapus dan pelanggan di meja tidak lagi dapat melanjutkan pembayarannya.
                    </p>

                    <label className="flex items-start gap-2 pt-1 cursor-pointer font-bold text-xs text-red-950 dark:text-red-100">
                      <input
                        type="checkbox"
                        checked={understandActiveOrders}
                        onChange={(e) => setUnderstandActiveOrders(e.target.checked)}
                        className="mt-0.5 rounded text-red-600 focus:ring-red-500 w-4 h-4"
                      />
                      <span>Saya paham pesanan yang sedang berjalan juga akan terhapus</span>
                    </label>
                  </div>
                )}

                <div className="flex justify-between gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    icon={<ArrowLeft className="w-4 h-4" />}
                  >
                    Kembali
                  </Button>
                  <Button
                    variant="primary"
                    disabled={!canProceedStep2}
                    onClick={() => setStep(3)}
                    icon={<ArrowRight className="w-4 h-4" />}
                  >
                    Lanjut ke Cadangan
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ========================================================
            LANGKAH 3: CADANGAN DATA (DOWNLOAD JSON & CSV)
            ======================================================== */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
              Disarankan untuk mengunduh salinan cadangan sebelum data dihapus. File cadangan ini dapat Anda simpan sebagai arsip pembukuan:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleDownloadJson}
                disabled={downloadingJson}
                className="p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-red-300 dark:hover:border-red-900 text-left transition-all flex items-start gap-3 group"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  {downloadingJson ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileJson className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                    <span>Unduh Cadangan (JSON)</span>
                    {downloadedJson && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  </div>
                  <span className="text-[11px] text-stone-500 block mt-0.5">
                    Format JSON lengkap seluruh dokumen yang akan dihapus.
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={downloadingCsv}
                className="p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-red-300 dark:hover:border-red-900 text-left transition-all flex items-start gap-3 group"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  {downloadingCsv ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                    <span>Unduh CSV Pesanan</span>
                    {downloadedCsv && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  </div>
                  <span className="text-[11px] text-stone-500 block mt-0.5">
                    Tabel spreadsheet Excel untuk daftar pesanan dan omset.
                  </span>
                </div>
              </button>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-stone-700 dark:text-stone-300">
                <input
                  type="checkbox"
                  checked={skipBackup}
                  onChange={(e) => setSkipBackup(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                />
                <span>Saya tidak membutuhkan cadangan (lewati tahap ini)</span>
              </label>
            </div>

            <div className="flex justify-between gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                icon={<ArrowLeft className="w-4 h-4" />}
              >
                Kembali
              </Button>
              <Button
                variant="primary"
                disabled={!canProceedStep3}
                onClick={() => setStep(4)}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Lanjut ke Konfirmasi
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================
            LANGKAH 4: KONFIRMASI KATA KUNCI "HAPUS"
            ======================================================== */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-2xl space-y-2 text-red-900 dark:text-red-200">
              <div className="flex items-center gap-2 font-bold text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Tindakan Terakhir: Konfirmasi Penghapusan Permanen</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Data yang terhapus <strong>tidak dapat dikembalikan</strong>. Dashboard dan laporan akan langsung kosong dan konsisten.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block font-bold text-stone-800 dark:text-stone-200">
                Ketik kata <span className="font-mono text-red-600 bg-red-100 dark:bg-red-950 px-1 py-0.5 rounded">HAPUS</span> untuk mengonfirmasi:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Ketik HAPUS"
                className="w-full px-3 py-2 text-sm font-bold tracking-wider rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 uppercase placeholder:normal-case placeholder:font-normal placeholder:tracking-normal"
              />
            </div>

            <div className="flex justify-between gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
              <Button
                variant="outline"
                onClick={() => setStep(3)}
                icon={<ArrowLeft className="w-4 h-4" />}
              >
                Kembali
              </Button>
              <Button
                variant="danger"
                disabled={!canProceedStep4}
                onClick={() => startExecution(false)}
                icon={<Trash2 className="w-4 h-4" />}
              >
                Hapus Permanen
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================
            LANGKAH 5: EKSEKUSI PROGRES (BATCH DELETE)
            ======================================================== */}
        {step === 5 && (
          <div className="space-y-4 py-2">
            {!errorDetails ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-stone-800 dark:text-stone-200">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-red-600 animate-spin" />
                    <span>
                      {progress?.currentCollection === 'orders'
                        ? 'Menghapus data pesanan (orders)...'
                        : progress?.currentCollection === 'paymentLogs'
                        ? 'Menghapus log pembayaran (paymentLogs)...'
                        : progress?.currentCollection === 'dailyStats'
                        ? 'Menghapus ringkasan laporan (dailyStats)...'
                        : progress?.currentCollection === 'counters'
                        ? 'Mereset nomor antrean (counters)...'
                        : 'Menyelesaikan proses...'}
                    </span>
                  </span>
                  <span className="font-mono text-red-600">
                    {progress?.percentage || 0}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-stone-200 dark:bg-stone-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-red-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, progress?.percentage || 0)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-stone-500">
                  <span>
                    Terhapus: <strong>{progress?.totalDeleted || 0}</strong> dari ~
                    {progress?.totalEstimated || 0} dokumen
                  </span>
                  <span>Maks. 400 dokumen per batch</span>
                </div>

                {cancelRequested ? (
                  <p className="text-[11px] text-amber-600 font-bold text-center pt-2">
                    Membatalkan... Menunggu batch saat ini selesai diproses.
                  </p>
                ) : (
                  <div className="pt-2 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelExecution}
                    >
                      Batal (Hentikan Sebelum Batch Berikutnya)
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold">
                  <XCircle className="w-5 h-5 shrink-0" />
                  <span>Penghapusan Batch Terhenti Karena Kesalahan</span>
                </div>

                <div className="p-2.5 bg-white dark:bg-stone-900 rounded-xl border border-red-200 dark:border-red-900 font-mono text-[11px] text-red-900 dark:text-red-300 space-y-1">
                  <div>
                    <strong>Kode Error:</strong> {errorDetails.code || 'UNKNOWN_ERROR'}
                  </div>
                  <div>
                    <strong>Pesan:</strong> {errorDetails.message}
                  </div>
                  {errorDetails.failedCollection && (
                    <div>
                      <strong>Koleksi Terhenti:</strong> {errorDetails.failedCollection}
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-stone-600 dark:text-stone-300">
                  Dokumen sebelum batch ini telah berhasil dihapus. Anda dapat melanjutkan proses untuk batch berikutnya.
                </p>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStep(6);
                      onSuccess();
                    }}
                  >
                    Tutup Sementara
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={isRetrying}
                    onClick={() => {
                      setIsRetrying(true);
                      startExecution(true).finally(() => setIsRetrying(false));
                    }}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    Lanjutkan
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            LANGKAH 6: HASIL AKHIR (SELESAI)
            ======================================================== */}
        {step === 6 && (
          <div className="space-y-4 py-2 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-stone-900 dark:text-white">
                Selesai: {finalTotalDeleted} Dokumen Terhapus
              </h3>
              <p className="text-stone-500 text-xs">
                Data transaksi uji coba telah berhasil dibersihkan dengan aman dari database.
              </p>
            </div>

            <div className="p-3 bg-stone-50 dark:bg-stone-900/60 rounded-2xl border border-stone-200 dark:border-stone-800 text-left text-xs space-y-1.5">
              <div className="flex justify-between py-0.5 border-b border-stone-100 dark:border-stone-800">
                <span className="text-stone-500">Pesanan (orders):</span>
                <span className="font-bold font-mono">{finalBreakdown.orders} dokumen</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-stone-100 dark:border-stone-800">
                <span className="text-stone-500">Ringkasan harian (dailyStats):</span>
                <span className="font-bold font-mono">{finalBreakdown.dailyStats} dokumen</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-stone-100 dark:border-stone-800">
                <span className="text-stone-500">Log pembayaran (paymentLogs):</span>
                <span className="font-bold font-mono">{finalBreakdown.paymentLogs} dokumen</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-stone-500">Nomor urut (counters):</span>
                <span className="font-bold font-mono">
                  {finalBreakdown.counters > 0
                    ? `${finalBreakdown.counters} reset (kembali ke #001)`
                    : 'Tidak direset'}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                fullWidth
                onClick={() => {
                  onClose();
                  // Muat ulang atau perbarui tampilan
                  window.location.reload();
                }}
              >
                Tutup dan Perbarui Halaman
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
