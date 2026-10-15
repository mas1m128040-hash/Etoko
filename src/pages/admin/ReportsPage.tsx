import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Utensils,
  AlertTriangle,
  Download,
  Calendar,
  RefreshCw,
  Award,
  Wallet,
  ArrowUpRight,
  Receipt,
  XCircle,
} from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { reportService, ReportSummary } from '../../services/reportService';
import { DailyStats, Order } from '../../types';
import { formatRupiah, getDateKeyJakarta } from '../../lib/formatters';
import { useTodayOrders } from '../../hooks/useOrders';
import { useUiStore } from '../../store/uiStore';

type PeriodType = 'HARI_INI' | '7_HARI' | '30_HARI' | 'BULAN_INI' | 'CUSTOM';

export const ReportsPage: React.FC = () => {
  const { addToast } = useUiStore();
  const { orders: todayOrders } = useTodayOrders();

  const [period, setPeriod] = useState<PeriodType>('7_HARI');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [dailyStatsList, setDailyStatsList] = useState<DailyStats[]>([]);
  const [summary, setSummary] = useState<ReportSummary>({
    revenue: 0,
    cashIn: 0,
    paidCount: 0,
    averagePerOrder: 0,
    unpaidCount: 0,
    unpaidAmount: 0,
    cancelledCount: 0,
    totalOrders: 0,
    byMethod: { TUNAI: 0, QRIS: 0, TRANSFER: 0 },
    topItems: [],
  });

  const todayDateKey = useMemo(() => getDateKeyJakarta(new Date()), []);

  // Set default custom date range
  useEffect(() => {
    if (!customStart || !customEnd) {
      setCustomEnd(todayDateKey);
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setCustomStart(getDateKeyJakarta(d));
    }
  }, [todayDateKey, customStart, customEnd]);

  // Generate list of dateKeys for chosen period
  const dateKeysForPeriod = useMemo(() => {
    const keys: string[] = [];
    const now = new Date();

    if (period === 'HARI_INI') {
      keys.push(todayDateKey);
    } else if (period === '7_HARI') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        keys.push(getDateKeyJakarta(d));
      }
    } else if (period === '30_HARI') {
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        keys.push(getDateKeyJakarta(d));
      }
    } else if (period === 'BULAN_INI') {
      // Dari tanggal 1 bulan ini sampai hari ini
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const current = new Date(startOfMonth);
      while (current <= now) {
        keys.push(getDateKeyJakarta(current));
        current.setDate(current.getDate() + 1);
      }
    } else if (period === 'CUSTOM') {
      if (customStart && customEnd) {
        const start = new Date(customStart);
        const end = new Date(customEnd);
        if (start <= end) {
          const cur = new Date(start);
          // Batasi maksimal 90 hari agar performa tetap cepat
          let count = 0;
          while (cur <= end && count < 90) {
            keys.push(getDateKeyJakarta(cur));
            cur.setDate(cur.getDate() + 1);
            count++;
          }
        }
      }
    }

    return keys;
  }, [period, todayDateKey, customStart, customEnd]);

  const periodLabel = useMemo(() => {
    switch (period) {
      case 'HARI_INI':
        return 'Hari Ini';
      case '7_HARI':
        return '7 Hari Terakhir';
      case '30_HARI':
        return '30 Hari Terakhir';
      case 'BULAN_INI':
        return 'Bulan Ini';
      case 'CUSTOM':
        return `${customStart} s/d ${customEnd}`;
    }
  }, [period, customStart, customEnd]);

  // Fetch report data
  const loadReportData = async () => {
    if (dateKeysForPeriod.length === 0) return;
    setLoading(true);
    try {
      const res = await reportService.getReportForRange(
        dateKeysForPeriod,
        todayOrders
      );
      setDailyStatsList(res.daily);
      setSummary(res.summary);
    } catch (err: any) {
      console.error('[Laporan Error] Gagal memuat data laporan:', err);
      addToast('error', 'Gagal memuat rekapitulasi laporan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [dateKeysForPeriod, todayOrders]);

  const handleDownloadCsv = () => {
    if (dailyStatsList.length === 0) {
      addToast('error', 'Tidak ada data laporan untuk diunduh.');
      return;
    }
    reportService.exportToCsv(dailyStatsList, periodLabel);
    addToast('success', `Laporan (${periodLabel}) berhasil diunduh dalam format CSV.`);
  };

  // Hitung persentase pembayaran
  const totalMethodAmount =
    summary.byMethod.TUNAI + summary.byMethod.QRIS + summary.byMethod.TRANSFER;
  const tunaiPct =
    totalMethodAmount > 0
      ? Math.round((summary.byMethod.TUNAI / totalMethodAmount) * 100)
      : 0;
  const qrisPct =
    totalMethodAmount > 0
      ? Math.round((summary.byMethod.QRIS / totalMethodAmount) * 100)
      : 0;
  const transferPct =
    totalMethodAmount > 0
      ? Math.round((summary.byMethod.TRANSFER / totalMethodAmount) * 100)
      : 0;

  // Nilai maksimum omset per hari untuk skala grafik batang
  const maxDailyRevenue = useMemo(() => {
    const max = Math.max(...dailyStatsList.map((d) => d.revenue), 0);
    return max > 0 ? max : 100000;
  }, [dailyStatsList]);

  return (
    <AppShell title="LAPORAN PENJUALAN">
      <div className="space-y-6">
        {/* Header Bar: Filter Periode & Unduh CSV */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Chip Pilihan Periode */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            {(
              [
                { key: 'HARI_INI', label: 'Hari Ini' },
                { key: '7_HARI', label: '7 Hari Terakhir' },
                { key: '30_HARI', label: '30 Hari Terakhir' },
                { key: 'BULAN_INI', label: 'Bulan Ini' },
                { key: 'CUSTOM', label: 'Rentang Tanggal' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPeriod(opt.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap min-h-[44px] transition-all cursor-pointer ${
                  period === opt.key
                    ? 'bg-[#FF6B1A] text-white shadow-sm shadow-orange-500/20'
                    : 'bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Tombol Unduh CSV & Refresh */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={loadReportData}
              loading={loading}
              icon={<RefreshCw className="w-4 h-4" />}
              className="min-h-[44px]"
            >
              Segarkan
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownloadCsv}
              disabled={loading || dailyStatsList.length === 0}
              icon={<Download className="w-4 h-4" />}
              className="min-h-[44px]"
            >
              Unduh CSV
            </Button>
          </div>
        </div>

        {/* Input Rentang Tanggal jika mode CUSTOM dipilih */}
        {period === 'CUSTOM' && (
          <Card className="p-3.5 sm:p-4 bg-orange-50/20 dark:bg-orange-950/10 border-orange-200 dark:border-orange-900/40">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#FF6B1A]" />
                <span className="font-bold text-stone-800 dark:text-stone-200">
                  Pilih Rentang Tanggal:
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={customStart}
                  max={customEnd || todayDateKey}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white text-xs min-h-[44px]"
                />
                <span className="text-stone-400">s/d</span>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart}
                  max={todayDateKey}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white text-xs min-h-[44px]"
                />
              </div>
            </div>
          </Card>
        )}

        {/* 6 Metric Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* 1. Omset & Uang Masuk */}
          <Card className="p-4 bg-orange-500/10 border-orange-500/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#FF6B1A]">OMSET</span>
              <DollarSign className="w-4 h-4 text-[#FF6B1A]" />
            </div>
            <p className="text-xl sm:text-2xl font-black font-mono text-[#FF6B1A] mt-1.5 leading-tight">
              {formatRupiah(summary.revenue)}
            </p>
            <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-1">
              Uang Masuk: <span className="font-mono font-bold text-stone-700 dark:text-stone-300">{formatRupiah(summary.cashIn)}</span>
            </p>
          </Card>

          {/* 2. Jumlah Pesanan Lunas */}
          <Card className="p-4 bg-emerald-500/10 border-emerald-500/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                PESANAN LUNAS
              </span>
              <Receipt className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1.5">
              {summary.paidCount}
            </p>
            <p className="text-[10px] text-stone-400 mt-1">
              dari {summary.totalOrders} total pesanan
            </p>
          </Card>

          {/* 3. Rata-rata per Pesanan */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-600 dark:text-stone-400">
                RATA-RATA / ORDER
              </span>
              <TrendingUp className="w-4 h-4 text-stone-400" />
            </div>
            <p className="text-xl sm:text-2xl font-black font-mono text-stone-900 dark:text-white mt-1.5">
              {formatRupiah(summary.averagePerOrder)}
            </p>
            <p className="text-[10px] text-stone-400 mt-1">Per pesanan lunas</p>
          </Card>

          {/* 4. Belum Lunas */}
          <Card className="p-4 bg-red-500/10 border-red-500/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-red-600 dark:text-red-400">
                BELUM LUNAS
              </span>
              <CreditCard className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-xl sm:text-2xl font-black font-mono text-red-600 dark:text-red-400 mt-1.5">
              {summary.unpaidCount}
            </p>
            <p className="text-[10px] font-mono text-red-700 dark:text-red-300 truncate mt-1">
              {formatRupiah(summary.unpaidAmount)}
            </p>
          </Card>

          {/* 5. Dibatalkan */}
          <Card className="p-4 bg-stone-500/10 border-stone-500/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-600 dark:text-stone-400">
                DIBATALKAN
              </span>
              <XCircle className="w-4 h-4 text-stone-400" />
            </div>
            <p className="text-xl sm:text-2xl font-black font-mono text-stone-700 dark:text-stone-300 mt-1.5">
              {summary.cancelledCount}
            </p>
            <p className="text-[10px] text-stone-400 mt-1">Pesanan gugur</p>
          </Card>

          {/* 6. Uang Masuk Bersih */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-600 dark:text-stone-400">
                TOTAL UANG MASUK
              </span>
              <Wallet className="w-4 h-4 text-stone-400" />
            </div>
            <p className="text-xl sm:text-2xl font-black font-mono text-stone-900 dark:text-white mt-1.5">
              {formatRupiah(summary.cashIn)}
            </p>
            <p className="text-[10px] text-stone-400 mt-1 truncate">
              Termasuk kode unik
            </p>
          </Card>
        </div>

        {/* Bagian Grafik Batang Omset Harian */}
        <Card className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-black text-stone-900 dark:text-white">
                Grafik Penjualan Harian
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Omset pesanan lunas per tanggal dalam periode {periodLabel}
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-stone-500">
              Maks: {formatRupiah(maxDailyRevenue)}
            </span>
          </div>

          {/* Bar Chart Container (Pure CSS / Flex) */}
          <div className="pt-6 pb-2">
            <div className="flex items-end gap-2 sm:gap-3 h-48 sm:h-56 overflow-x-auto no-scrollbar border-b border-stone-200 dark:border-stone-800 px-2">
              {dailyStatsList.map((day) => {
                const heightPercent = Math.max(
                  4,
                  Math.round((day.revenue / maxDailyRevenue) * 100)
                );
                const isToday = day.dateKey === todayDateKey;

                return (
                  <div
                    key={day.dateKey}
                    className="flex-1 min-w-[36px] max-w-[64px] flex flex-col items-center justify-end h-full group relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-stone-900 text-white text-[10px] font-mono py-1 px-2 rounded-lg pointer-events-none whitespace-nowrap z-10 shadow-md">
                      {formatRupiah(day.revenue)} ({day.paidCount} lunas)
                    </div>

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-lg transition-all duration-300 relative ${
                        isToday
                          ? 'bg-[#FF6B1A] shadow-sm shadow-orange-500/30'
                          : day.revenue > 0
                          ? 'bg-orange-500/75 dark:bg-orange-500/60 hover:bg-[#FF6B1A]'
                          : 'bg-stone-200 dark:bg-stone-800'
                      }`}
                    />

                    {/* Date label */}
                    <span className="text-[10px] font-mono font-semibold text-stone-500 dark:text-stone-400 mt-2 truncate w-full text-center">
                      {day.dateKey.slice(8, 10)}/{day.dateKey.slice(5, 7)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* 2 Kolom Rincian: Metode Pembayaran & 5 Menu Terlaris */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Kolom 1: Rincian Metode Pembayaran */}
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800/80 pb-3">
              <h3 className="text-sm font-black text-stone-900 dark:text-white uppercase tracking-wider">
                RINCIAN METODE PEMBAYARAN
              </h3>
              <CreditCard className="w-4 h-4 text-stone-400" />
            </div>

            <div className="space-y-3.5">
              {/* Tunai */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-stone-800 dark:text-stone-200">
                    Tunai / Kasir
                  </span>
                  <span className="font-mono font-bold text-stone-900 dark:text-white">
                    {formatRupiah(summary.byMethod.TUNAI)} ({tunaiPct}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                  <div
                    style={{ width: `${tunaiPct}%` }}
                    className="h-full bg-emerald-500 rounded-full"
                  />
                </div>
              </div>

              {/* QRIS */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-stone-800 dark:text-stone-200">
                    QRIS
                  </span>
                  <span className="font-mono font-bold text-[#FF6B1A]">
                    {formatRupiah(summary.byMethod.QRIS)} ({qrisPct}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                  <div
                    style={{ width: `${qrisPct}%` }}
                    className="h-full bg-[#FF6B1A] rounded-full"
                  />
                </div>
              </div>

              {/* Transfer */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-stone-800 dark:text-stone-200">
                    Transfer Bank
                  </span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {formatRupiah(summary.byMethod.TRANSFER)} ({transferPct}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                  <div
                    style={{ width: `${transferPct}%` }}
                    className="h-full bg-blue-500 rounded-full"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Kolom 2: 5 Menu Terlaris */}
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800/80 pb-3">
              <h3 className="text-sm font-black text-stone-900 dark:text-white uppercase tracking-wider">
                5 MENU TERLARIS
              </h3>
              <Award className="w-4 h-4 text-amber-500" />
            </div>

            {summary.topItems.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-6">
                Belum ada hidangan terjual pada periode ini.
              </p>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-800/80">
                {summary.topItems.map((item, idx) => (
                  <div
                    key={item.name}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] shrink-0 ${
                          idx === 0
                            ? 'bg-amber-500 text-white'
                            : idx === 1
                            ? 'bg-stone-300 dark:bg-stone-700 text-stone-900 dark:text-white'
                            : idx === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="font-bold text-stone-900 dark:text-white truncate">
                        {item.name}
                      </span>
                    </div>

                    <span className="font-mono font-bold text-[#FF6B1A] shrink-0 ml-2">
                      {item.qty} terjual
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
};
