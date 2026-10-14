import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Printer, ExternalLink, RefreshCw } from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { Settings } from '../../types';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';

export const TableQrPage: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedTable, setSelectedTable] = useState<number | 'ALL'>('ALL');
  const [qrDataUrls, setQrDataUrls] = useState<Record<number, string>>({});
  const [loadingQr, setLoadingQr] = useState<boolean>(true);

  useEffect(() => {
    settingsService
      .getSettings()
      .then(setSettings)
      .catch((err) => console.warn('Pengaturan settings error:', err));
  }, []);

  const totalTables = settings?.totalTables || 10;

  // Use the active browser window.location origin and HashRouter format (#/menu?table=X)
  const currentOrigin =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}${window.location.pathname}`.replace(
          /\/$/,
          ''
        )
      : '';

  const tablesToRender =
    selectedTable === 'ALL'
      ? Array.from({ length: totalTables }, (_, i) => i + 1)
      : [selectedTable];

  // Generate pure client-side QR Codes inside the browser using 'qrcode' package
  useEffect(() => {
    let isMounted = true;
    setLoadingQr(true);

    const generateAllQrs = async () => {
      const generated: Record<number, string> = {};
      for (let i = 1; i <= totalTables; i++) {
        const orderUrl = `${currentOrigin}/#/menu?table=${i}`;
        try {
          const dataUrl = await QRCode.toDataURL(orderUrl, {
            width: 260,
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
  }, [totalTables, currentOrigin]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppShell title="CETAK QR MEJA">
      <div className="space-y-6">
        {/* Print & Filter Toolbar (hidden during print) */}
        <div className="print:hidden flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-stone-900 dark:text-white">
              Cetak QR Meja Makan
            </h2>
            <p className="text-xs text-stone-500">
              QR digenerate langsung di browser tanpa ketergantungan API pihak ketiga. Menggunakan URL aktif saat ini: <code className="text-[#FF6B1A] font-mono">{currentOrigin}/#/menu?table=X</code>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedTable}
              onChange={(e) =>
                setSelectedTable(
                  e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)
                )
              }
              className="px-3 py-2 text-xs font-bold rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white"
            >
              <option value="ALL">Cetak Semua Meja (1 - {totalTables})</option>
              {Array.from({ length: totalTables }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  Hanya Meja {i + 1}
                </option>
              ))}
            </select>

            <Button
              variant="primary"
              onClick={handlePrint}
              icon={<Printer className="w-4 h-4" />}
            >
              Cetak / Print Kartu
            </Button>
          </div>
        </div>

        {/* Printable Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 print:grid-cols-2 print:gap-4">
          {tablesToRender.map((tableNum) => {
            const orderUrl = `${currentOrigin}/#/menu?table=${tableNum}`;
            const qrImageSrc = qrDataUrls[tableNum];

            return (
              <div
                key={tableNum}
                className="bg-white text-stone-900 rounded-3xl p-6 border-2 border-stone-200 shadow-md flex flex-col items-center text-center page-break-inside-avoid print:shadow-none print:border-stone-400"
              >
                {/* Header */}
                <span className="text-[10px] font-black tracking-widest text-[#FF6B1A] uppercase">
                  {settings?.name || 'SMART RESTAURANT'}
                </span>

                <h3 className="text-2xl font-black text-stone-900 tracking-tight mt-1">
                  MEJA {tableNum}
                </h3>

                {/* QR Code Container generated purely in browser */}
                <div className="w-48 h-48 bg-white p-2 rounded-2xl border border-stone-100 my-4 flex items-center justify-center shadow-inner">
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

                {/* Instruction */}
                <p className="text-xs font-bold text-stone-800">
                  SCAN UNTUK PESAN
                </p>
                <p className="text-[10px] text-stone-500 mt-0.5">
                  Arahkan kamera HP ke QR Code di atas
                </p>

                {/* Direct Link Preview */}
                <div className="print:hidden mt-4 pt-3 border-t border-stone-100 w-full flex justify-center">
                  <a
                    href={orderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[#FF6B1A] font-bold underline flex items-center gap-1"
                  >
                    <span>Buka URL Meja {tableNum}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
};
