import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Search,
  Utensils,
  Plus,
  Sparkles,
  CheckCheck,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import { formatRupiah } from '../../lib/formatters';
import { useTodayOrders } from '../../hooks/useOrders';
import { useAuth } from '../../hooks/useAuth';
import { orderService } from '../../services/orderService';
import { AppShell } from '../../components/layout/AppShell';
import { OrderCard } from '../../components/order/OrderCard';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FirebaseNoticeCard as FirebaseErrorCard } from '../../components/ui/FirebaseNoticeCard';
import { Button } from '../../components/ui/Button';
import { OrderStatus } from '../../types';
import { useUiStore } from '../../store/uiStore';
import { useMenus } from '../../hooks/useMenus';
import { seedService } from '../../services/seedService';

export const DashboardPage: React.FC = () => {
  const {
    orders,
    filteredOrders,
    loading: ordersLoading,
    error: ordersError,
    retry: retryOrders,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    stats,
  } = useTodayOrders();
  const { profile } = useAuth();
  const { addToast } = useUiStore();
  const {
    menus,
    categories,
    loading: menusLoading,
    retry: retryMenus,
  } = useMenus(profile?.role === 'ADMIN');
  const [seeding, setSeeding] = useState(false);
  const [completingAll, setCompletingAll] = useState(false);

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const res = await seedService.seedInitialRestaurantData();
      addToast(
        'success',
        `Berhasil mengisi ${res.menus} menu dan ${res.categories} kategori contoh!`
      );
      retryMenus();
    } catch (err: any) {
      console.error('[Seed Error]', err);
      addToast('error', err?.message || 'Gagal mengisi data contoh.');
    } finally {
      setSeeding(false);
    }
  };

  const handleUpdateStatus = async (
    orderId: string,
    currentStatus: OrderStatus,
    nextStatus: OrderStatus,
    cancelReason?: string
  ) => {
    if (!profile) return;
    try {
      await orderService.updateStatusInTransaction(
        orderId,
        currentStatus,
        nextStatus,
        {
          uid: profile.id,
          name: profile.name,
        },
        cancelReason
      );
      addToast('success', `Status pesanan berhasil diperbarui ke ${nextStatus}.`);
    } catch (err: any) {
      addToast('error', err?.message || 'Gagal mengubah status');
    }
  };

  const readyToCompleteCount = orders.filter(
    (o) => o.status === 'DITERIMA' && o.paymentStatus === 'LUNAS'
  ).length;

  const handleSelesaikanSemua = async () => {
    if (!profile) return;
    const acceptedOrders = orders.filter((o) => o.status === 'DITERIMA');
    const lunasOrders = acceptedOrders.filter((o) => o.paymentStatus === 'LUNAS');
    const unpaidCount = acceptedOrders.length - lunasOrders.length;

    if (lunasOrders.length === 0) {
      if (unpaidCount > 0) {
        addToast(
          'error',
          `${unpaidCount} pesanan belum lunas! Tandai lunas terlebih dahulu sebelum menyelesaikan pesanan.`
        );
      }
      return;
    }

    setCompletingAll(true);
    try {
      await orderService.completeAllAcceptedOrders(lunasOrders, {
        uid: profile.id,
        name: profile.name,
      });
      addToast(
        'success',
        `Berhasil menyelesaikan ${lunasOrders.length} pesanan yang sudah lunas.${
          unpaidCount > 0 ? ` (${unpaidCount} pesanan belum lunas dilewati)` : ''
        }`
      );
    } catch (err: any) {
      addToast('error', err?.message || 'Gagal menyelesaikan pesanan.');
    } finally {
      setCompletingAll(false);
    }
  };

  // Sort: BARU orders strictly on top, then DITERIMA, then others
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const priority = (s: OrderStatus) => {
      if (s === 'BARU') return 1;
      if (s === 'DITERIMA') return 2;
      return 3;
    };
    return priority(a.status) - priority(b.status);
  });

  // Filter chips: Aktif, Belum Bayar, Selesai, Dibatalkan, Semua
  const filterOptions: { key: string; label: string; count: number }[] = [
    { key: 'AKTIF', label: 'Aktif', count: stats.aktif },
    { key: 'BELUM_BAYAR', label: 'Belum Bayar', count: stats.belumLunasCount },
    { key: 'SELESAI', label: 'Selesai', count: stats.selesai },
    { key: 'DIBATALKAN', label: 'Dibatalkan', count: stats.dibatalkan },
    { key: 'ALL', label: 'Semua', count: stats.total },
  ];

  return (
    <AppShell title="DASHBOARD RESTORAN (POS)">
      <div className="space-y-3 sm:space-y-5">
        {/* Seed Database Banner for Admin if categories/menus are empty */}
        {profile?.role === 'ADMIN' &&
          !menusLoading &&
          (menus.length === 0 || categories.length === 0) && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-500 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-amber-700 dark:text-amber-400">
                    Database masih kosong
                  </h3>
                  <p className="text-xs text-amber-900/80 dark:text-stone-300 mt-0.5">
                    Menu atau kategori belum tersedia di Firestore. Klik tombol di samping untuk mengisi data hidangan dan pengaturan restoran contoh langsung ke database.
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                loading={seeding}
                onClick={handleSeedData}
                icon={<Plus className="w-4 h-4" />}
                className="shrink-0 min-h-[44px]"
              >
                Isi Data Contoh
              </Button>
            </div>
          )}

        {/* Global Firestore Error Notice if any */}
        {ordersError && (
          <FirebaseErrorCard
            title="Gagal Memuat Transaksi Hari Ini"
            error={ordersError}
            onRetry={retryOrders}
          />
        )}

        {/* 6 Metric Cards Row: Total Hari Ini, Belum Lunas, Tidak Bayar, Baru, Diterima, Selesai */}
        <div className="grid grid-cols-2 min-[360px]:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <Card className="h-[68px] sm:h-auto p-2 sm:p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] sm:text-xs font-bold text-stone-600 dark:text-stone-400 leading-none truncate">
                TOTAL ORDER
              </span>
              <Utensils className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[20px] sm:text-2xl font-black font-mono leading-none text-stone-900 dark:text-white">
                {stats.total}
              </span>
              <span className="text-[10px] text-stone-400 truncate leading-none">Semua</span>
            </div>
          </Card>

          <Card className="h-[68px] sm:h-auto p-2 sm:p-3.5 flex flex-col justify-between bg-red-500/10 border-red-500/20">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] sm:text-xs font-bold text-red-600 dark:text-red-400 leading-none truncate">
                BELUM LUNAS
              </span>
              <CreditCard className="w-3.5 h-3.5 text-red-500 shrink-0" />
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[20px] sm:text-2xl font-black font-mono leading-none text-red-600 dark:text-red-400">
                {stats.belumLunasCount}
              </span>
              <span className="text-[10px] font-mono text-red-700 dark:text-red-300 truncate leading-none">
                {formatRupiah(stats.belumLunasAmount)}
              </span>
            </div>
          </Card>

          <Card className="h-[68px] sm:h-auto p-2 sm:p-3.5 flex flex-col justify-between bg-stone-500/10 border-stone-500/20">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] sm:text-xs font-bold text-stone-600 dark:text-stone-400 leading-none truncate">
                TIDAK BAYAR
              </span>
              <AlertTriangle className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[20px] sm:text-2xl font-black font-mono leading-none text-stone-700 dark:text-stone-300">
                {stats.tidakBayarHariIni}
              </span>
              <span className="text-[10px] text-stone-400 truncate leading-none">Dibatalkan</span>
            </div>
          </Card>

          <Card className="h-[68px] sm:h-auto p-2 sm:p-3.5 flex flex-col justify-between bg-orange-500/10 border-orange-500/20">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] sm:text-xs font-bold text-[#FF6B1A] leading-none truncate">BARU</span>
              <Bell className="w-3.5 h-3.5 text-[#FF6B1A] animate-bounce shrink-0" />
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[20px] sm:text-2xl font-black font-mono leading-none text-[#FF6B1A]">
                {stats.baru}
              </span>
              <span className="text-[10px] text-stone-500 dark:text-stone-400 truncate leading-none">
                Konfirmasi
              </span>
            </div>
          </Card>

          <Card className="h-[68px] sm:h-auto p-2 sm:p-3.5 flex flex-col justify-between bg-blue-500/10 border-blue-500/20">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 leading-none truncate">
                DITERIMA
              </span>
              <Utensils className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[20px] sm:text-2xl font-black font-mono leading-none text-blue-600 dark:text-blue-400">
                {stats.diterima}
              </span>
              <span className="text-[10px] text-stone-400 truncate leading-none">Disiapkan</span>
            </div>
          </Card>

          <Card className="h-[68px] sm:h-auto p-2 sm:p-3.5 flex flex-col justify-between bg-emerald-500/10 border-emerald-500/20">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 leading-none truncate">
                SELESAI
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[20px] sm:text-2xl font-black font-mono leading-none text-emerald-600 dark:text-emerald-400">
                {stats.selesai}
              </span>
              <span className="text-[10px] text-stone-400 truncate leading-none">Tuntas</span>
            </div>
          </Card>
        </div>

        {/* Filter Chips & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Status Filter Chips yang bisa digeser + Tombol Selesaikan Lunas */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            {filterOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setStatusFilter(opt.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap min-h-[44px] transition-all cursor-pointer flex items-center shrink-0 ${
                  statusFilter === opt.key
                    ? 'bg-[#FF6B1A] text-white shadow-sm shadow-orange-500/20'
                    : 'bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-700'
                }`}
              >
                <span>{opt.label}</span>
                <span className="ml-1.5 opacity-80 font-mono">({opt.count})</span>
              </button>
            ))}

            {/* Tombol Selesaikan Lunas inline dengan ukuran yang sama */}
            {readyToCompleteCount > 0 && (
              <button
                type="button"
                disabled={completingAll}
                onClick={handleSelesaikanSemua}
                className="px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                title="Selesaikan semua pesanan berstatus DITERIMA yang sudah LUNAS"
              >
                <CheckCheck className="w-4 h-4 shrink-0" />
                <span>Selesaikan Lunas ({readyToCompleteCount})</span>
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 sm:flex-none">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari order, meja, atau nama..."
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-stone-900 rounded-xl text-xs border border-stone-200 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-[#FF6B1A] text-stone-900 dark:text-white min-h-[44px]"
            />
          </div>
        </div>

        {/* Order Cards Grid: Kolom otomatis dengan lebar minimum sekitar 280px */}
        {ordersLoading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 sm:gap-4">
            <div className="h-56 bg-stone-200 dark:bg-stone-800 rounded-2xl animate-pulse" />
            <div className="h-56 bg-stone-200 dark:bg-stone-800 rounded-2xl animate-pulse" />
            <div className="h-56 bg-stone-200 dark:bg-stone-800 rounded-2xl animate-pulse" />
          </div>
        ) : ordersError ? (
          <FirebaseErrorCard
            title="Gagal Memuat Daftar Pesanan"
            error={ordersError}
            onRetry={retryOrders}
          />
        ) : sortedOrders.length === 0 ? (
          <EmptyState
            icon={<Utensils className="w-10 h-10" />}
            title="Tidak Ada Pesanan"
            description="Belum ada pesanan yang sesuai dengan filter atau pencarian saat ini."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {sortedOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdateStatus={handleUpdateStatus}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};
