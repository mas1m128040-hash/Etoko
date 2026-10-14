import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Utensils,
  MapPin,
  X,
  Lock,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import { useMenus } from '../../hooks/useMenus';
import { useCart } from '../../hooks/useCart';
import { useCustomerOrders } from '../../hooks/useOrders';
import { useSettings } from '../../hooks/useSettings';
import { settingsService } from '../../services/settingsService';
import { Settings, Menu } from '../../types';
import { formatRupiah } from '../../lib/formatters';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { MenuCardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { FirebaseErrorCard } from '../../components/ui/FirebaseErrorCard';
import { authService } from '../../services/authService';
import { auth } from '../../config/firebase';

export const MenuPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Anonymous Authentication State
  const [anonLoading, setAnonLoading] = useState(true);
  const [anonError, setAnonError] = useState<Error | null>(null);

  const {
    items: cartItems,
    addItem,
    updateQty,
    totalQty,
    totalPrice,
    tableNumber,
    setTableNumber,
  } = useCart();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<Menu | null>(null);
  const [itemNoteInput, setItemNoteInput] = useState('');
  const [itemQtyInput, setItemQtyInput] = useState(1);
  const [showTableModal, setShowTableModal] = useState(false);

  // Customer orders hook (untuk chip Pesanan Saya)
  const currentUid = auth.currentUser?.uid;
  const { orders: customerOrders } = useCustomerOrders(currentUid);
  const activeUnpaidOrder = customerOrders.find(
    (o) => o.paymentStatus === 'BELUM_BAYAR' && o.status !== 'DIBATALKAN'
  );

  // 1. Authenticate anonymously first before reading menus
  const initAnonymousAuth = async () => {
    setAnonLoading(true);
    setAnonError(null);
    try {
      await authService.signInCustomerAnon();
      setAnonLoading(false);
    } catch (err: any) {
      console.error('[Firebase Auth Error] Gagal login anonim:', err);
      setAnonError(err instanceof Error ? err : new Error(String(err)));
      setAnonLoading(false);
    }
  };

  useEffect(() => {
    initAnonymousAuth();
  }, []);

  // 2. Realtime menus hook
  const {
    categories,
    menus,
    filteredMenus,
    loading: menusLoading,
    error: menusError,
    retry: retryMenus,
    selectedCategoryId,
    setSelectedCategoryId,
    searchQuery,
    setSearchQuery,
  } = useMenus(!anonLoading && !anonError);

  // 3. Load restaurant settings via hook
  const { restaurantName, settings: liveSettings } = useSettings();
  useEffect(() => {
    if (liveSettings) setSettings(liveSettings);
  }, [liveSettings]);

  // Broken image tracker to always show placeholder icon
  const [brokenImageIds, setBrokenImageIds] = useState<Record<string, boolean>>({});

  // Kategori Customer: hanya tampilkan kategori yang aktif DAN memiliki minimal satu menu tersedia
  const visibleCategories = useMemo(() => {
    return categories.filter(
      (c) => c.active && menus.some((m) => m.categoryId === c.id && m.available)
    );
  }, [categories, menus]);

  useEffect(() => {
    if (
      selectedCategoryId !== 'ALL' &&
      !visibleCategories.some((c) => c.id === selectedCategoryId)
    ) {
      setSelectedCategoryId('ALL');
    }
  }, [visibleCategories, selectedCategoryId, setSelectedCategoryId]);

  // 4. Table parameter extraction from URL (?table=X)
  useEffect(() => {
    const tableParam = searchParams.get('table');
    if (tableParam) {
      setTableNumber(tableParam);
    } else if (!tableNumber) {
      setShowTableModal(true);
    }
  }, [searchParams, tableNumber, setTableNumber]);

  const handleOpenItemDetail = (menu: Menu) => {
    if (!menu.available) return;
    const existing = cartItems.find((i) => i.menuId === menu.id);
    setSelectedMenuItem(menu);
    setItemQtyInput(existing ? existing.qty : 1);
    setItemNoteInput(existing?.note || '');
  };

  const handleAddToCartConfirm = () => {
    if (!selectedMenuItem) return;
    addItem(
      {
        menuId: selectedMenuItem.id,
        name: selectedMenuItem.name,
        price: selectedMenuItem.price,
      },
      itemQtyInput,
      itemNoteInput
    );
    setSelectedMenuItem(null);
  };

  const handleSelectTable = (num: number) => {
    const tableStr = String(num);
    setTableNumber(tableStr);
    setSearchParams({ table: tableStr });
    setShowTableModal(false);
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-[#121212] text-stone-900 dark:text-stone-100 pb-36 antialiased selection:bg-orange-500 selection:text-white flex flex-col justify-between">
      <div>
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FF6B1A] flex items-center justify-center text-white shadow-sm shadow-orange-500/20">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-black text-stone-900 dark:text-white tracking-tight leading-none">
                  {restaurantName}
                </h1>
                <p className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 mt-0.5">
                  Pesan Mandiri Dari Meja
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Chip "Pesanan Saya" jika ada pesanan hari ini */}
              {customerOrders.length > 0 && (
                <Link
                  to={`/order/${customerOrders[0].id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold shadow-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Pesanan Saya ({customerOrders.length})</span>
                </Link>
              )}

              {/* Table Number Pill */}
              <button
                onClick={() => setShowTableModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 border border-orange-500/20 text-[#FF6B1A] text-xs font-black cursor-pointer hover:bg-orange-500/20 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{tableNumber ? `Meja ${tableNumber}` : 'Pilih Meja'}</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto px-4 pb-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari makanan, minuman, cemilan..."
                className="w-full pl-10 pr-4 py-2.5 bg-stone-100 dark:bg-stone-900 rounded-xl text-sm border-none focus:outline-none focus:ring-2 focus:ring-[#FF6B1A] text-stone-900 dark:text-white placeholder:text-stone-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Horizontal Category Tabs */}
          <div className="max-w-xl mx-auto px-4 pb-2.5 overflow-x-auto flex gap-2 no-scrollbar">
            <button
              onClick={() => setSelectedCategoryId('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategoryId === 'ALL'
                  ? 'bg-[#FF6B1A] text-white shadow-sm shadow-orange-500/20'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
            >
              Semua Menu
            </button>
            {visibleCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategoryId === cat.id
                    ? 'bg-[#FF6B1A] text-white shadow-sm shadow-orange-500/20'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-xl mx-auto px-4 pt-4 space-y-3">
          {/* Notifikasi jika ada pesanan belum lunas yang aktif */}
          {activeUnpaidOrder && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  Anda memiliki pesanan <strong>#{activeUnpaidOrder.orderCode}</strong> yang belum lunas.
                </span>
              </div>
              <Link
                to={`/order/${activeUnpaidOrder.id}`}
                className="font-bold underline text-[#FF6B1A] shrink-0"
              >
                Bayar Sekarang
              </Link>
            </div>
          )}

          {/* State 1: Anonymous Auth Error */}
          {anonError ? (
            <FirebaseErrorCard
              title="Gagal Masuk Sebagai Pelanggan"
              error={anonError}
              onRetry={initAnonymousAuth}
            />
          ) : anonLoading || menusLoading ? (
            /* State 2: Loading State */
            <div className="space-y-3">
              <MenuCardSkeleton />
              <MenuCardSkeleton />
              <MenuCardSkeleton />
            </div>
          ) : menusError ? (
            /* State 3: Firestore Query Error */
            <FirebaseErrorCard
              title="Gagal Memuat Menu Restoran"
              error={menusError}
              onRetry={retryMenus}
            />
          ) : menus.length === 0 ? (
            /* State 4: Firestore Menu Collection is Empty */
            <EmptyState
              icon={<Utensils className="w-10 h-10" />}
              title="Menu Belum Tersedia"
              description="Menu belum tersedia, hubungi staff untuk memesan atau menambahkan hidangan."
            />
          ) : filteredMenus.length === 0 ? (
            /* State 5: Search Query has no matches */
            <EmptyState
              icon={<Search className="w-8 h-8" />}
              title="Menu Tidak Ditemukan"
              description={`Tidak ada hidangan yang cocok dengan kata kunci "${searchQuery}". Silakan coba kata kunci lain.`}
            />
          ) : (
            /* State 6: Render Valid Menus dengan Lazy Loaded Image / Thumbnail */
            filteredMenus.map((menu) => {
              const inCart = cartItems.find((i) => i.menuId === menu.id);
              const imgSrc = menu.imageData || menu.imageUrl;

              return (
                <div
                  key={menu.id}
                  onClick={() => menu.available && handleOpenItemDetail(menu)}
                  className={`bg-white dark:bg-[#1a1a1a] rounded-2xl border border-stone-200/80 dark:border-stone-800 p-3.5 sm:p-4 flex gap-3.5 shadow-xs transition-all ${
                    menu.available
                      ? 'cursor-pointer hover:border-orange-300 active:scale-[0.99]'
                      : 'opacity-55 cursor-not-allowed bg-stone-100/60 dark:bg-stone-900/40'
                  }`}
                >
                  {/* Menu Image or Placeholder */}
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-stone-100 dark:bg-stone-800 overflow-hidden shrink-0 relative flex items-center justify-center border border-stone-200 dark:border-stone-700">
                    {imgSrc && !brokenImageIds[menu.id] ? (
                      <img
                        src={imgSrc}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={() =>
                          setBrokenImageIds((prev) => ({ ...prev, [menu.id]: true }))
                        }
                      />
                    ) : (
                      <Utensils className="w-8 h-8 text-stone-300 dark:text-stone-600" />
                    )}

                    {!menu.available && (
                      <div className="absolute inset-0 bg-stone-900/60 flex items-center justify-center p-1 text-center">
                        <span className="text-[11px] font-black text-white uppercase tracking-wider">
                          Habis
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white leading-snug truncate">
                        {menu.name}
                      </h3>
                      <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mt-1 leading-relaxed">
                        {menu.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-1">
                      <span className="text-sm sm:text-base font-black font-mono text-[#FF6B1A]">
                        {formatRupiah(menu.price)}
                      </span>

                      {menu.available ? (
                        inCart ? (
                          <div
                            className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800 rounded-xl px-2 py-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => updateQty(menu.id, -1)}
                              className="w-6 h-6 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-700 dark:text-stone-200 active:bg-stone-100 cursor-pointer"
                              aria-label="Kurangi"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-black text-[#FF6B1A] min-w-[16px] text-center">
                              {inCart.qty}
                            </span>
                            <button
                              onClick={() => updateQty(menu.id, 1)}
                              className="w-6 h-6 rounded-lg bg-[#FF6B1A] text-white flex items-center justify-center active:bg-orange-600 cursor-pointer"
                              aria-label="Tambah"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addItem({
                                menuId: menu.id,
                                name: menu.name,
                                price: menu.price,
                              });
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-[#FF6B1A] hover:bg-[#E5530A] active:scale-95 text-white text-xs font-bold shadow-xs shadow-orange-500/20 flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Pesan</span>
                          </button>
                        )
                      ) : (
                        <span className="text-xs font-semibold text-stone-400">
                          Tidak Tersedia
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </main>
      </div>

      {/* Persistent Customer Footer with Staff Login Link */}
      <footer className="max-w-xl mx-auto w-full px-4 pt-8 pb-10 text-center">
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

      {/* Floating Bottom Cart Bar */}
      {totalQty > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-gradient-to-t from-stone-50 dark:from-[#121212] via-stone-50/90 dark:via-[#121212]/90 to-transparent pointer-events-none">
          <div className="max-w-xl mx-auto pointer-events-auto">
            <button
              onClick={() => setIsCartSheetOpen(true)}
              className="w-full py-4 px-5 bg-[#FF6B1A] hover:bg-[#E5530A] active:scale-[0.99] text-white rounded-2xl shadow-xl shadow-orange-500/30 flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-black text-sm">
                  {totalQty}
                </div>
                <div className="text-left">
                  <p className="text-xs font-medium text-white/80">Keranjang Pesanan</p>
                  <p className="text-sm font-black font-mono">
                    {formatRupiah(totalPrice)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 font-bold text-sm bg-white/20 px-3.5 py-2 rounded-xl">
                <span>Lihat Pesanan</span>
                <ShoppingCart className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Item Detail & Note Bottom Sheet */}
      <BottomSheet
        isOpen={!!selectedMenuItem}
        onClose={() => setSelectedMenuItem(null)}
        title={selectedMenuItem?.name || 'Detail Menu'}
      >
        {selectedMenuItem && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 rounded-2xl bg-stone-100 dark:bg-stone-800 overflow-hidden shrink-0 flex items-center justify-center border border-stone-200 dark:border-stone-700">
                {(selectedMenuItem.imageData || selectedMenuItem.imageUrl) &&
                !brokenImageIds[selectedMenuItem.id] ? (
                  <img
                    src={selectedMenuItem.imageData || selectedMenuItem.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() =>
                      setBrokenImageIds((prev) => ({
                        ...prev,
                        [selectedMenuItem.id]: true,
                      }))
                    }
                  />
                ) : (
                  <Utensils className="w-8 h-8 text-stone-300 dark:text-stone-600" />
                )}
              </div>
              <div>
                <p className="text-sm text-stone-600 dark:text-stone-300">
                  {selectedMenuItem.description}
                </p>
                <p className="text-lg font-black font-mono text-[#FF6B1A] mt-1">
                  {formatRupiah(selectedMenuItem.price)}
                </p>
              </div>
            </div>

            {/* Note input */}
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                Catatan Khusus (Maks 100 karakter):
              </label>
              <input
                type="text"
                value={itemNoteInput}
                onChange={(e) => setItemNoteInput(e.target.value.slice(0, 100))}
                placeholder="Contoh: Jangan terlalu pedas, kuah dipisah, dsb."
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]"
              />
            </div>

            {/* Qty controller */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-bold text-stone-700 dark:text-stone-300">
                Jumlah Pesan:
              </span>
              <div className="flex items-center gap-3 bg-stone-100 dark:bg-stone-800 p-1.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setItemQtyInput((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 flex items-center justify-center font-bold text-stone-700 dark:text-stone-200 cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-base font-black font-mono min-w-[24px] text-center text-stone-900 dark:text-white">
                  {itemQtyInput}
                </span>
                <button
                  type="button"
                  onClick={() => setItemQtyInput((q) => Math.min(20, q + 1))}
                  className="w-8 h-8 rounded-lg bg-[#FF6B1A] text-white flex items-center justify-center font-bold cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleAddToCartConfirm}
            >
              Simpan ke Keranjang • {formatRupiah(selectedMenuItem.price * itemQtyInput)}
            </Button>
          </div>
        )}
      </BottomSheet>

      {/* Cart Bottom Sheet */}
      <BottomSheet
        isOpen={isCartSheetOpen}
        onClose={() => setIsCartSheetOpen(false)}
        title="Keranjang Pesanan"
      >
        <div className="space-y-4">
          <div className="p-3 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded-2xl flex items-center justify-between text-xs">
            <span className="font-bold text-stone-700 dark:text-stone-300">Meja Pesanan:</span>
            <button
              onClick={() => {
                setIsCartSheetOpen(false);
                setShowTableModal(true);
              }}
              className="font-black text-[#FF6B1A] underline cursor-pointer"
            >
              {tableNumber ? `Meja ${tableNumber}` : 'Pilih Meja'}
            </button>
          </div>

          {/* Cart item rows */}
          <div className="space-y-3 max-h-60 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800">
            {cartItems.map((item) => (
              <div key={item.menuId} className="pt-2 first:pt-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-stone-900 dark:text-white">{item.name}</p>
                    <p className="text-xs text-[#FF6B1A] font-semibold">
                      {formatRupiah(item.price)}
                    </p>
                    {item.note && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 italic mt-0.5">
                        "{item.note}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(item.menuId, -1)}
                      className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-700 dark:text-stone-300 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-bold text-stone-900 dark:text-white min-w-[16px] text-center">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQty(item.menuId, 1)}
                      className="w-7 h-7 rounded-lg bg-[#FF6B1A] text-white flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex justify-between items-center">
            <div>
              <p className="text-xs text-stone-500 dark:text-stone-400">Total Harga</p>
              <p className="text-xl font-black font-mono text-[#FF6B1A]">
                {formatRupiah(totalPrice)}
              </p>
            </div>

            {activeUnpaidOrder ? (
              <Button
                variant="primary"
                onClick={() => {
                  setIsCartSheetOpen(false);
                  navigate(`/order/${activeUnpaidOrder.id}`);
                }}
              >
                Bayar Pesanan #{activeUnpaidOrder.orderCode}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => {
                  setIsCartSheetOpen(false);
                  navigate('/checkout');
                }}
              >
                Lanjut ke Pembayaran
              </Button>
            )}
          </div>
        </div>
      </BottomSheet>

      {/* Table Selector Modal */}
      <Modal
        isOpen={showTableModal}
        onClose={() => setShowTableModal(false)}
        title="Pilih Nomor Meja Anda"
      >
        <div className="space-y-4">
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Silakan pilih nomor meja tempat Anda duduk sesuai stiker di meja:
          </p>

          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-60 overflow-y-auto p-1">
            {Array.from({ length: settings?.totalTables || 20 }, (_, i) => i + 1).map(
              (num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleSelectTable(num)}
                  className={`py-3 rounded-xl font-mono text-sm font-bold border transition-all cursor-pointer ${
                    tableNumber === String(num)
                      ? 'bg-[#FF6B1A] text-white border-[#FF6B1A] shadow-md shadow-orange-500/20'
                      : 'bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700'
                  }`}
                >
                  {num}
                </button>
              )
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
