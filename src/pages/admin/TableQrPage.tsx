import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Printer,
  ExternalLink,
  RefreshCw,
  Download,
  AlertTriangle,
  Plus,
  Minus,
  Save,
  CheckCircle2,
  Settings as SettingsIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { settingsService } from '../../services/settingsService';
import { orderService } from '../../services/orderService';
import { Settings, Order } from '../../types';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Card } from '../../components/ui/Card';
import { useUiStore } from '../../store/uiStore';

export const TableQrPage: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedTable, setSelectedTable] = useState<number | 'ALL'>('ALL');
  const [qrDataUrls, setQrDataUrls] = useState<Record<number, string>>({});
  const [loadingQr, setLoadingQr] = useState<boolean>(true);
  const [tableCountInput, setTableCountInput] = useState<number>(20);
  const [savingTableCount, setSavingTableCount] = useState<boolean>(false);
  const [printSingleTable, setPrintSingleTable] = useState<number | null>(null);

  // Modal konfirmasi jika mengurangi meja yang memiliki pesanan aktif
  const [showConfirmReduceModal, setShowConfirmReduceModal] = useState<boolean>(false);
  const [pendingReduceCount, setPendingReduceCount] = useState<number | null>(null);
  const [activeOrdersOnRemovedTables, setActiveOrdersOnRemovedTables] = useState<Order[]>([]);

  const { addToast } = useUiStore();

  const loadSettingsData = async () => {
    try {
      const s = await settingsService.getSettings();
      setSettings(s);
      setTableCountInput(s.totalTables || 20);
    } catch (err) {
      console.warn('Pengaturan settings error:', err);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  const totalTables = settings?.totalTables || tableCountInput || 20;

  // Alamat URL aplikasi aktif: gunakan settings.appUrl jika diset, atau window.location
  const currentOrigin =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}${window.location.pathname}`
          .replace(/\/$/, '')
          .replace(/#.*$/, '')
      : '';

  const effectiveBaseUrl = (settings?.appUrl?.trim() || currentOrigin)
    .replace(/\/$/, '')
    .replace(/#.*$/, '');

  const isLocalOrDevUrl = /aistudio|localhost|127\.0\.0\.1|ai\.studio/i.test(effectiveBaseUrl);

  const tablesToRender =
    printSingleTable !== null
      ? [printSingleTable]
      : selectedTable === 'ALL'
      ? Array.from({ length: totalTables }, (_, i) => i + 1)
      : [selectedTable];

  // Generate pure client-side QR Codes inside the browser using 'qrcode' package
  useEffect(() => {
    let isMounted = true;
    setLoadingQr(true);

    const generateAllQrs = async () => {
      const generated: Record<number, string> = {};
      for (let i = 1; i <= totalTables; i++) {
        const orderUrl = `${effectiveBaseUrl}/#/menu?table=${i}`;
        try {
          const dataUrl = await QRCode.toDataURL(orderUrl, {
            width: 400,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF',
            },
          });
          generated[i] = dataUrl;
        } catch (err) {
          console.error(`Failed to generate QR for table ${i}`, err);
        }
      }

      if (isMounted) {
        setQrDataUrls(generated);
        setLoadingQr(false);
      }
    };

    generateAllQrs();

    return () => {
      isMounted = false;
    };
  }, [totalTables, effectiveBaseUrl]);

  // Handler simpan jumlah meja dengan pengecekan pesanan aktif jika dikurangi
  const handleApplyTableCount = async (newCount: number) => {
    if (newCount < 1 || newCount > 200) {
      addToast('error', 'Jumlah meja harus antara 1 sampai 200.');
      return;
    }

    const currentTotal = settings?.totalTables || 20;

    // Jika jumlah meja dikurangi, cek apakah ada pesanan aktif pada meja yang akan dihapus
    if (newCount < currentTotal) {
      const removedTables: string[] = [];
      for (let i = newCount + 1; i <= currentTotal; i++) {
        removedTables.push(String(i));
      }

      try {
        const activeOrders = await orderService.getActiveOrdersForTables(removedTables);
        if (activeOrders.length > 0) {
          setActiveOrdersOnRemovedTables(activeOrders);
          setPendingReduceCount(newCount);
          setShowConfirmReduceModal(true);
          return;
        }
      } catch (err) {
        console.warn('Gagal memeriksa pesanan aktif pada meja yang dikurangi:', err);
      }
    }

    // Jika tidak ada pesanan aktif atau jumlah meja bertambah, langsung simpan
    await executeSaveTableCount(newCount);
  };

  const executeSaveTableCount = async (count: number) => {
    setSavingTableCount(true);
    try {
      await settingsService.updateSettings({ totalTables: count });
      setSettings((prev) => (prev ? { ...prev, totalTables: count } : null));
      setTableCountInput(count);
      setShowConfirmReduceModal(false);
      setPendingReduceCount(null);
      setActiveOrdersOnRemovedTables([]);
      addToast('success', `Jumlah meja berhasil diperbarui menjadi ${count} meja.`);
    } catch (err: any) {
      addToast('error', err?.message || 'Gagal menyimpan jumlah meja.');
    } finally {
      setSavingTableCount(false);
    }
  };

  const handlePrintAll = () => {
    setPrintSingleTable(null);
    setSelectedTable('ALL');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintSingle = (tableNum: number) => {
    setPrintSingleTable(tableNum);
    setTimeout(() => {
      window.print();
      setPrintSingleTable(null);
    }, 150);
  };

  // Unduh kartu QR Meja sebagai berkas PNG beresolusi tinggi langsung dari browser
  const handleDownloadPng = (tableNum: number) => {
    const dataUrl = qrDataUrls[tableNum];
    if (!dataUrl) return;

    const canvas = document.createElement('canvas');
    canvas.width = 650;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Latar Putih
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Bingkai Luar Halus
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 6;
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

    // Nama Restoran
    ctx.fillStyle = '#FF6B1A';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((settings?.name || 'SMART RESTAURANT').toUpperCase(), canvas.width / 2, 75);

    // Tulisan MEJA N
    ctx.fillStyle = '#1C1917';
    ctx.font = '900 52px system-ui, sans-serif';
    ctx.fillText(`MEJA ${tableNum}`, canvas.width / 2, 140);

    // Gambar QR
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 115, 175, 420, 420);

      // Petunjuk Scan
      ctx.fillStyle = '#1C1917';
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.fillText('SCAN UNTUK PESAN', canvas.width / 2, 650);

      ctx.fillStyle = '#78716C';
      ctx.font = '500 18px system-ui, sans-serif';
      ctx.fillText('Arahkan kamera HP ke QR Code di atas', canvas.width / 2, 690);

      // URL teks kecil
      ctx.fillStyle = '#A8A29E';
      ctx.font = '14px monospace';
      ctx.fillText(`${effectiveBaseUrl}/#/menu?table=${tableNum}`, canvas.width / 2, 735);

      // Download
      const link = document.createElement('a');
      const cleanName = (settings?.name || 'Resto').replace(/[^a-zA-Z0-9]/g, '-');
      link.download = `QR-Meja-${tableNum}-${cleanName}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = dataUrl;
  };

  return (
    <AppShell title="CETAK QR MEJA">
      <div className="space-y-6">
        {/* Peringatan jika URL aplikasi masih domain dev / internal AI Studio */}
        {isLocalOrDevUrl && (
          <div className="print:hidden p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs sm:text-sm font-black text-amber-900 dark:text-amber-200">
                  Perhatian: Alamat URL Aplikasi Menggunakan Domain Pengembangan
                </h4>
                <p className="text-xs text-amber-800/90 dark:text-amber-300 mt-0.5 leading-relaxed">
                  URL saat ini (<code className="font-mono font-bold text-amber-950 dark:text-amber-100">{effectiveBaseUrl}</code>) mengandung <em>aistudio/localhost</em>. Kode QR yang dicetak dengan URL ini tidak dapat dibuka oleh pelanggan di HP mereka.
                </p>
              </div>
            </div>
            <Link to="/admin/settings" className="shrink-0">
              <Button
                variant="primary"
                size="sm"
                icon={<SettingsIcon className="w-4 h-4" />}
              >
                Atur URL Publik di Pengaturan
              </Button>
            </Link>
          </div>
        )}

        {/* Toolbar Pengelolaan Jumlah Meja & Cetak (Sembunyi saat dicetak) */}
        <div className="print:hidden space-y-4">
          <Card className="p-4 sm:p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Quick Table Count Stepper */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div>
                <span className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                  Jumlah Meja Restoran
                </span>
                <span className="text-xs text-stone-700 dark:text-stone-300">
                  Total saat ini: <strong className="text-stone-900 dark:text-white font-mono text-sm">{totalTables} Meja</strong>
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 p-1 rounded-2xl border border-stone-200 dark:border-stone-700">
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.max(1, tableCountInput - 1);
                    setTableCountInput(next);
                  }}
                  disabled={tableCountInput <= 1 || savingTableCount}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 hover:text-[#FF6B1A] border border-stone-200 dark:border-stone-600 disabled:opacity-40 transition-colors cursor-pointer"
                  title="Kurangi 1 Meja"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <input
                  type="number"
                  min={1}
                  max={200}
                  value={tableCountInput}
                  onChange={(e) => setTableCountInput(Number(e.target.value))}
                  className="w-16 text-center font-black font-mono text-base bg-transparent border-none text-stone-900 dark:text-white focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => {
                    const next = Math.min(200, tableCountInput + 1);
                    setTableCountInput(next);
                  }}
                  disabled={tableCountInput >= 200 || savingTableCount}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 hover:text-[#FF6B1A] border border-stone-200 dark:border-stone-600 disabled:opacity-40 transition-colors cursor-pointer"
                  title="Tambah 1 Meja"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {tableCountInput !== totalTables && (
                  <Button
                    variant="primary"
                    size="sm"
                    loading={savingTableCount}
                    onClick={() => handleApplyTableCount(tableCountInput)}
                    icon={<Save className="w-3.5 h-3.5" />}
                    className="ml-1"
                  >
                    Simpan
                  </Button>
                )}
              </div>
            </div>

            {/* Filter & Tombol Cetak Semua */}
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={selectedTable}
                onChange={(e) =>
                  setSelectedTable(
                    e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)
                  )
                }
                className="min-h-[44px] px-3.5 py-2 text-xs font-bold rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]"
              >
                <option value="ALL">Tampilkan Semua (1 - {totalTables})</option>
                {Array.from({ length: totalTables }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Hanya Meja {i + 1}
                  </option>
                ))}
              </select>

              <Button
                variant="primary"
                size="md"
                onClick={handlePrintAll}
                icon={<Printer className="w-4 h-4" />}
                className="min-h-[44px]"
              >
                Cetak Semua (6 Kartu per A4)
              </Button>
            </div>
          </Card>

          <p className="text-xs text-stone-500 dark:text-stone-400">
            Format cetak otomatis menyusun <strong>6 kartu per halaman kertas A4</strong> (2 kolom x 3 baris) dengan potongan rapi dan resolusi tajam.
          </p>
        </div>

        {/* Printable Grid of Table QR Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4 print-grid-6-a4">
          {tablesToRender.map((tableNum) => {
            const orderUrl = `${effectiveBaseUrl}/#/menu?table=${tableNum}`;
            const qrImageSrc = qrDataUrls[tableNum];

            return (
              <div
                key={tableNum}
                className="bg-white text-stone-900 rounded-3xl p-5 border-2 border-stone-200 dark:border-stone-800 shadow-md flex flex-col items-center text-center page-break-inside-avoid print:shadow-none print:border-stone-400 print:p-4 print:rounded-2xl"
              >
                {/* Header Kartu */}
                <span className="text-[10px] font-black tracking-widest text-[#FF6B1A] uppercase">
                  {settings?.name || 'SMART RESTAURANT'}
                </span>

                <h3 className="text-3xl font-black text-stone-900 tracking-tight mt-1">
                  MEJA {tableNum}
                </h3>

                {/* Wadah QR Code: Selalu latar putih murni agar scanner HP tidak bermasalah */}
                <div className="w-48 h-48 bg-white p-2.5 rounded-2xl border border-stone-200 my-3 flex items-center justify-center shadow-inner">
                  {qrImageSrc ? (
                    <img
                      src={qrImageSrc}
                      alt={`QR Meja ${tableNum}`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-stone-400 text-xs gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-[#FF6B1A]" />
                      <span>Membuat QR...</span>
                    </div>
                  )}
                </div>

                {/* Teks Instruksi */}
                <p className="text-sm font-black text-stone-900 tracking-wide">
                  SCAN UNTUK PESAN
                </p>
                <p className="text-[11px] font-medium text-stone-500 mt-0.5">
                  Arahkan kamera HP ke QR Code di atas
                </p>
                <p className="text-[10px] font-mono text-stone-400 truncate max-w-[200px] mt-1">
                  {effectiveBaseUrl}/#/menu?table={tableNum}
                </p>

                {/* Aksi Per Meja (Sembunyi saat cetak) */}
                <div className="print:hidden mt-4 pt-3 border-t border-stone-100 w-full flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrintSingle(tableNum)}
                    icon={<Printer className="w-3.5 h-3.5 text-[#FF6B1A]" />}
                  >
                    Cetak
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDownloadPng(tableNum)}
                    icon={<Download className="w-3.5 h-3.5 text-stone-600" />}
                  >
                    Unduh PNG
                  </Button>

                  <a
                    href={orderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-stone-400 hover:text-[#FF6B1A] transition-colors rounded-lg hover:bg-stone-50"
                    title={`Uji buka URL Meja ${tableNum}`}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Konfirmasi Saat Mengurangi Meja dengan Pesanan Aktif */}
        <Modal
          isOpen={showConfirmReduceModal}
          onClose={() => {
            setShowConfirmReduceModal(false);
            setPendingReduceCount(null);
          }}
          title="Konfirmasi Pengurangan Jumlah Meja"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Peringatan: Terdapat Pesanan Aktif Pada Meja Yang Akan Dikurangi</span>
              </div>
              <p className="leading-relaxed">
                Anda hendak mengurangi jumlah meja menjadi <strong>{pendingReduceCount} meja</strong>. Masih ada <strong>{activeOrdersOnRemovedTables.length} pesanan aktif</strong> (status BARU / DITERIMA) pada meja berikut:
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
              <strong>Catatan Keamanan:</strong> Pesanan lama <em>tidak akan terhapus ataupun berubah</em>, dan seluruh riwayat transaksi tetap tersimpan utuh di sistem. Namun, pelanggan tidak akan bisa lagi memilih meja tersebut untuk pesanan baru.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setShowConfirmReduceModal(false);
                  setPendingReduceCount(null);
                }}
              >
                Batal
              </Button>
              <Button
                variant="danger"
                size="md"
                loading={savingTableCount}
                onClick={() => {
                  if (pendingReduceCount !== null) {
                    executeSaveTableCount(pendingReduceCount);
                  }
                }}
              >
                Tetap Kurangi Meja & Simpan
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
};
