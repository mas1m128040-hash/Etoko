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

  const filterOptions: { key: string; label: string; count: number }[] = [
    { key: 'ALL', label: 'Semua', count: stats.total },
    { key: 'BELUM_BAYAR', label: 'Belum Bayar', count: stats.belumLunasCount },
    { key: 'BARU', label: 'Baru', count: stats.baru },
    { key: 'DITERIMA', label: 'Diterima', count: stats.diterima },
    { key: 'SELESAI', label: 'Selesai', count: stats.selesai },
    { key: 'DIBATALKAN', label: 'Dibatalkan', count: stats.dibatalkan },
  ];

  return (
    <AppShell title="DASHBOARD RESTORAN (POS)">
      <div className="space-y-6">
        {/* Seed Database Banner for Admin if categories/menus are empty */}
        {profile?.role === 'ADMIN' &&
          !menusLoading &&
          (menus.length === 0 || categories.length === 0) && (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
                className="shrink-0"
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-600 dark:text-stone-400">
                TOTAL ORDER
              </span>
              <Utensils className="w-4 h-4 text-stone-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-stone-900 dark:text-white mt-1.5">
              {stats.total}
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5">Semua status</p>
          </Card>

          <Card className="p-4 bg-red-500/10 border-red-500/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-red-600 dark:text-red-400">
                BELUM LUNAS
              </span>
              <CreditCard className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-red-600 dark:text-red-400 mt-1.5">
              {stats.belumLunasCount}
            </p>
            <p className="text-[10px] font-mono text-red-700 dark:text-red-300 truncate mt-0.5">
              {formatRupiah(stats.belumLunasAmount)}
            </p>
          </Card>

          <Card className="p-4 bg-stone-500/10 border-stone-500/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-600 dark:text-stone-400">
                TIDAK BAYAR
              </span>
              <AlertTriangle className="w-4 h-4 text-stone-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-stone-700 dark:text-stone-300 mt-1.5">
              {stats.tidakBayarHariIni}
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5">Dibatalkan</p>
          </Card>

          <Card className="p-4 bg-orange-500/10 border-orange-500/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#FF6B1A]">BARU</span>
              <Bell className="w-4 h-4 text-[#FF6B1A] animate-bounce" />
            </div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-[#FF6B1A] mt-1.5">
              {stats.baru}
            </p>
            <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
              Konfirmasi
            </p>
          </Card>

          <Card className="p-4 bg-blue-500/10 border-blue-500/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                DITERIMA
              </span>
              <Utensils className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-blue-600 dark:text-blue-400 mt-1.5">
              {stats.diterima}
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5">
              Disiapkan
            </p>
          </Card>

          <Card className="p-4 bg-emerald-500/10 border-emerald-500/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                SELESAI
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1.5">
              {stats.selesai}
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5">Tuntas</p>
          </Card>
        </div>

        {/* Filter Chips, Action Selesaikan Semua, & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Status Filter Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            {filterOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setStatusFilter(opt.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  statusFilter === opt.key
                    ? 'bg-[#FF6B1A] text-white shadow-sm shadow-orange-500/20'
                    : 'bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-700'
                }`}
              >
                <span>{opt.label}</span>
                <span className="ml-1.5 opacity-80 font-mono">({opt.count})</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Tombol Selesaikan Semua untuk pesanan DITERIMA yang sudah lunas */}
            {readyToCompleteCount > 0 && (
              <Button
                variant="success"
                size="sm"
                loading={completingAll}
                onClick={handleSelesaikanSemua}
                icon={<CheckCheck className="w-4 h-4" />}
                className="whitespace-nowrap"
              >
                Selesaikan Lunas ({readyToCompleteCount})
              </Button>
            )}

            {/* Search Box */}
            <div className="relative min-w-[200px] flex-1 sm:flex-none">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari order, meja, atau nama..."
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-stone-900 rounded-xl text-xs border border-stone-200 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-[#FF6B1A] text-stone-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Order Cards Grid */}
        {ordersLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div className="h-64 bg-stone-200 dark:bg-stone-800 rounded-2xl animate-pulse" />
            <div className="h-64 bg-stone-200 dark:bg-stone-800 rounded-2xl animate-pulse" />
            <div className="h-64 bg-stone-200 dark:bg-stone-800 rounded-2xl animate-pulse" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
