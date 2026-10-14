import React, { useState, useRef } from 'react';
import {
  Utensils,
  Plus,
  Edit2,
  Trash2,
  Power,
  FolderPlus,
  Search,
  Sparkles,
  Camera,
  Upload,
  Link as LinkIcon,
  X,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { useMenus } from '../../hooks/useMenus';
import { menuService } from '../../services/menuService';
import { categoryService } from '../../services/categoryService';
import { seedService } from '../../services/seedService';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { FirebaseErrorCard } from '../../components/ui/FirebaseErrorCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatRupiah } from '../../lib/formatters';
import { Menu } from '../../types';
import { useUiStore } from '../../store/uiStore';
import { compressImageToDataUrl } from '../../lib/imageUtils';

export const MenuManagePage: React.FC = () => {
  const { categories, menus, loading, error: menusError, retry: retryMenus } = useMenus();
  const { addToast } = useUiStore();

  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('ALL');

  // Menu Modal State
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(20000);
  const [categoryId, setCategoryId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageData, setImageData] = useState<string | undefined>(undefined);
  const [imageTab, setImageTab] = useState<'UPLOAD' | 'URL'>('UPLOAD');
  const [compressing, setCompressing] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [available, setAvailable] = useState(true);
  const [savingMenu, setSavingMenu] = useState(false);

  // Delete Confirmation State
  const [menuToDelete, setMenuToDelete] = useState<Menu | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Category Modal State
  const [showCatModal, setShowCatModal] = useState(false);
  const [catName, setCatName] = useState('');
  const [catSortOrder, setCatSortOrder] = useState(1);
  const [savingCat, setSavingCat] = useState(false);

  // Seeding State
  const [seeding, setSeeding] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenMenuModal = (menu?: Menu) => {
    setImageError(null);
    if (menu) {
      setEditingMenu(menu);
      setName(menu.name);
      setDescription(menu.description);
      setPrice(menu.price);
      setCategoryId(menu.categoryId);
      setImageUrl(menu.imageUrl || '');
      setImageData(menu.imageData || undefined);
      setImageTab(menu.imageData ? 'UPLOAD' : 'URL');
      setSortOrder(menu.sortOrder);
      setAvailable(menu.available);
    } else {
      setEditingMenu(null);
      setName('');
      setDescription('');
      setPrice(20000);
      setCategoryId(categories[0]?.id || '');
      setImageUrl('');
      setImageData(undefined);
      setImageTab('UPLOAD');
      setSortOrder(menus.length + 1);
      setAvailable(true);
    }
    setShowMenuModal(true);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageError(null);
    setCompressing(true);

    try {
      const compressedDataUrl = await compressImageToDataUrl(file);
      setImageData(compressedDataUrl);
      setImageUrl(''); // Clear URL if photo upload is chosen
    } catch (err: any) {
      setImageError(err?.message || 'Gagal mengompres gambar.');
    } finally {
      setCompressing(false);
      // Reset input value to allow selecting same file again if desired
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    setImageData(undefined);
    setImageUrl('');
    setImageError(null);
  };

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSavingMenu(true);
    try {
      const menuPayload: Partial<Menu> = {
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        categoryId: categoryId || categories[0]?.id || '',
        imageUrl: imageUrl.trim() || undefined,
        imageData: imageData || undefined,
        sortOrder: Number(sortOrder),
        available,
      };

      if (editingMenu) {
        await menuService.updateMenu(editingMenu.id, menuPayload);
        addToast('success', `Menu "${name}" berhasil diperbarui.`);
      } else {
        await menuService.createMenu(menuPayload as any);
        addToast('success', `Menu "${name}" berhasil ditambahkan.`);
      }
      setShowMenuModal(false);
    } catch (err: any) {
      addToast('error', err?.message || 'Gagal menyimpan menu.');
    } finally {
      setSavingMenu(false);
    }
  };

  const handleToggleAvailability = async (menu: Menu) => {
    try {
      await menuService.toggleMenuAvailability(menu.id, !menu.available);
      addToast(
        'info',
        `Menu "${menu.name}" sekarang ${!menu.available ? 'TERSEDIA' : 'HABIS'}.`
      );
    } catch (err: any) {
      addToast('error', err?.message || 'Gagal mengubah ketersediaan.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!menuToDelete) return;
    setDeleting(true);
    try {
      await menuService.deleteMenu(menuToDelete.id);
      addToast('success', `Menu "${menuToDelete.name}" berhasil dihapus.`);
      setMenuToDelete(null);
    } catch (err: any) {
      addToast('error', err?.message || 'Gagal menghapus menu.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setSavingCat(true);
    try {
      await categoryService.createCategory({
        name: catName.trim(),
        sortOrder: Number(catSortOrder),
        active: true,
      });
      addToast('success', `Kategori "${catName}" ditambahkan.`);
      setShowCatModal(false);
      setCatName('');
    } catch (err: any) {
      addToast('error', err?.message || 'Gagal membuat kategori.');
    } finally {
      setSavingCat(false);
    }
  };

  const handleSeedData = async () => {
    if (!confirm('Isi basis data dengan 8 menu dan 3 kategori rekomendasi?')) return;
    setSeeding(true);
    try {
      const res = await seedService.seedInitialRestaurantData();
      addToast(
        'success',
        `Berhasil mengisi ${res.menus} menu dan ${res.categories} kategori!`
      );
    } catch (err: any) {
      addToast('error', err?.message || 'Gagal mengisi data seed.');
    } finally {
      setSeeding(false);
    }
  };

  const filteredMenus = menus.filter((m) => {
    const matchesCat = selectedCat === 'ALL' || m.categoryId === selectedCat;
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q || m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const activeImagePreview = imageData || imageUrl;

  return (
    <AppShell title="KELOLA MENU & KATEGORI">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={() => handleOpenMenuModal()}
              icon={<Plus className="w-4 h-4" />}
            >
              Tambah Menu Baru
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowCatModal(true)}
              icon={<FolderPlus className="w-4 h-4" />}
            >
              Tambah Kategori
            </Button>
          </div>

          {menus.length === 0 && (
            <Button
              variant="success"
              loading={seeding}
              onClick={handleSeedData}
              icon={<Sparkles className="w-4 h-4" />}
            >
              Isi Data Awal (Seed 8 Menu)
            </Button>
          )}
        </div>

        {/* Filter and Search */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedCat('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedCat === 'ALL'
                  ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900'
                  : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
              }`}
            >
              Semua ({menus.length})
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCat(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedCat === c.id
                    ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900'
                    : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                }`}
              >
                {c.name} ({menus.filter((m) => m.categoryId === c.id).length})
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari menu hidangan..."
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-stone-900 rounded-xl text-xs border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]"
            />
          </div>
        </div>

        {/* Menus Grid / Error / Empty States */}
        {menusError ? (
          <FirebaseErrorCard
            title="Gagal Memuat Menu Restoran"
            error={menusError}
            onRetry={retryMenus}
          />
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div className="h-44 bg-stone-200 dark:bg-stone-800 rounded-2xl animate-pulse" />
            <div className="h-44 bg-stone-200 dark:bg-stone-800 rounded-2xl animate-pulse" />
            <div className="h-44 bg-stone-200 dark:bg-stone-800 rounded-2xl animate-pulse" />
          </div>
        ) : filteredMenus.length === 0 ? (
          <EmptyState
            icon={<Utensils className="w-10 h-10" />}
            title="Tidak Ada Menu"
            description={
              menus.length === 0
                ? 'Belum ada menu di database. Silakan klik "Isi Data Contoh" atau tombol "Tambah Menu".'
                : 'Tidak ada hidangan yang cocok dengan filter atau pencarian saat ini.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredMenus.map((menu) => {
              const cat = categories.find((c) => c.id === menu.categoryId);
              const imgSrc = menu.imageData || menu.imageUrl;

              return (
                <Card
                  key={menu.id}
                  className={`p-4 flex flex-col justify-between transition-all ${
                    !menu.available ? 'opacity-60 bg-stone-100/50 dark:bg-stone-900/40' : ''
                  }`}
                >
                  <div>
                    <div className="flex gap-3">
                      <div className="w-18 h-18 rounded-2xl bg-stone-100 dark:bg-stone-800 overflow-hidden shrink-0 flex items-center justify-center border border-stone-200 dark:border-stone-700">
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={menu.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Utensils className="w-7 h-7 text-stone-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="text-sm font-bold text-stone-900 dark:text-white truncate">
                            {menu.name}
                          </h4>
                          <span className="text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 px-1.5 py-0.5 rounded font-bold">
                            #{menu.sortOrder}
                          </span>
                        </div>
                        <p className="text-xs text-stone-400 mt-0.5">{cat?.name || '-'}</p>
                        <p className="text-sm font-black font-mono text-[#FF6B1A] mt-1">
                          {formatRupiah(menu.price)}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mt-3 leading-relaxed">
                      {menu.description}
                    </p>
                  </div>

                  {/* Footer Controls: Toggle availability 1-tap, Edit, Delete */}
                  <div className="pt-3 border-t border-stone-100 dark:border-stone-800 mt-3 flex items-center justify-between">
                    {/* Availability 1-tap toggle */}
                    <button
                      onClick={() => handleToggleAvailability(menu)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        menu.available
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{menu.available ? 'Tersedia' : 'Habis'}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenMenuModal(menu)}
                        className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
                        title="Edit menu"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setMenuToDelete(menu)}
                        className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40"
                        title="Hapus menu"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Menu Form Modal */}
      <Modal
        isOpen={showMenuModal}
        onClose={() => setShowMenuModal(false)}
        title={editingMenu ? 'Edit Menu Hidangan' : 'Tambah Menu Baru'}
      >
        <form onSubmit={handleSaveMenu} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
              Nama Menu <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Ayam Bakar Madu"
              className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
              Deskripsi Menu
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan porsi, rasa, dan pelengkap..."
              className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                Harga (Rupiah) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min={100}
                step={500}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                Kategori <span className="text-red-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bagian Gambar: Upload Foto / Kamera atau Tempel URL */}
          <div className="p-3.5 bg-stone-100 dark:bg-stone-900/70 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-[#FF6B1A]" />
                <span>Gambar Menu Hidangan</span>
              </label>

              {/* Tab Selector */}
              <div className="flex gap-1 bg-stone-200 dark:bg-stone-800 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setImageTab('UPLOAD')}
                  className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition-all ${
                    imageTab === 'UPLOAD'
                      ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-500 dark:text-stone-400'
                  }`}
                >
                  Foto / Galeri
                </button>
                <button
                  type="button"
                  onClick={() => setImageTab('URL')}
                  className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition-all ${
                    imageTab === 'URL'
                      ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-500 dark:text-stone-400'
                  }`}
                >
                  URL Gambar
                </button>
              </div>
            </div>

            {imageError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-red-700 dark:text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                <span className="text-[11px]">{imageError}</span>
              </div>
            )}

            {imageTab === 'UPLOAD' ? (
              <div className="space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={compressing}
                    onClick={() => fileInputRef.current?.click()}
                    icon={<Camera className="w-4 h-4 text-[#FF6B1A]" />}
                  >
                    {imageData ? 'Ganti Foto' : 'Ambil Foto / Pilih dari Galeri'}
                  </Button>

                  {imageData && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="px-2.5 py-1.5 text-[11px] font-bold text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Gambar</span>
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-stone-400">
                  Otomatis diperkecil di browser (maks 480px JPEG, target di bawah 80 KB).
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <LinkIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                      setImageData(undefined); // Clear uploaded file if URL is typed
                    }}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]"
                  />
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Pratinjau Gambar */}
            {activeImagePreview && (
              <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-stone-300 dark:border-stone-700 bg-stone-200 dark:bg-stone-800 shrink-0">
                  <img
                    src={activeImagePreview}
                    alt="Pratinjau"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400">
                  <p className="font-bold text-stone-800 dark:text-stone-200">
                    Pratinjau Gambar Aktif
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {imageData ? '✓ Foto terkompresi siap disimpan' : '✓ Menggunakan tautan URL'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                Urutan Tampil (Sort Order)
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                  className="rounded text-[#FF6B1A] w-4 h-4"
                />
                <span className="font-bold text-stone-800 dark:text-stone-200">
                  Tersedia untuk Dipesan
                </span>
              </label>
            </div>
          </div>

          <div className="pt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => setShowMenuModal(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" fullWidth loading={savingMenu}>
              Simpan Menu
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!menuToDelete}
        onClose={() => setMenuToDelete(null)}
        title="Konfirmasi Hapus Menu"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl flex items-start gap-2.5 text-red-700 dark:text-red-300">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
            <p>
              Apakah Anda yakin ingin menghapus menu{' '}
              <strong className="font-black text-stone-900 dark:text-white">
                "{menuToDelete?.name}"
              </strong>
              ? Data menu akan dihapus permanen dari Firestore.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setMenuToDelete(null)}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              fullWidth
              loading={deleting}
              onClick={handleConfirmDelete}
            >
              Ya, Hapus Menu
            </Button>
          </div>
        </div>
      </Modal>

      {/* Category Modal */}
      <Modal
        isOpen={showCatModal}
        onClose={() => setShowCatModal(false)}
        title="Tambah Kategori Menu"
      >
        <form onSubmit={handleSaveCategory} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
              Nama Kategori <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Contoh: Paket Hemat, Dimsum, Kopi..."
              className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
              Nomor Urut Tampil
            </label>
            <input
              type="number"
              value={catSortOrder}
              onChange={(e) => setCatSortOrder(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-white"
            />
          </div>

          <div className="pt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => setShowCatModal(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" fullWidth loading={savingCat}>
              Simpan Kategori
            </Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
};
