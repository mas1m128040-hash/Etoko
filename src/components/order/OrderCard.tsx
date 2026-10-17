import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Clock,
  User,
  MapPin,
  Check,
  CheckCircle2,
  X,
  CreditCard,
  QrCode,
  AlertTriangle,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Order, PaidMethodFinal, Settings } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusBadge } from './StatusBadge';
import { Modal } from '../ui/Modal';
import {
  formatRupiah,
  formatTimeJakarta,
  formatDateTimeJakarta,
} from '../../lib/formatters';
import { orderService } from '../../services/orderService';
import { settingsService } from '../../services/settingsService';
import { generateDynamicQris } from '../../lib/qris';
import { useAuth } from '../../hooks/useAuth';
import { useUiStore } from '../../store/uiStore';

interface OrderCardProps {
  order: Order;
  onUpdateStatus: (
    orderId: string,
    currentStatus: Order['status'],
    nextStatus: Order['status'],
    cancelReason?: string
  ) => Promise<void>;
  isProcessing?: boolean;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onUpdateStatus,
  isProcessing = false,
}) => {
  const { profile } = useAuth();
  const { addToast } = useUiStore();

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [showQrisModal, setShowQrisModal] = useState(false);
  const [qrisDataUrl, setQrisDataUrl] = useState<string | null>(null);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Toggle expand item list (max 3 by default)
  const [itemsExpanded, setItemsExpanded] = useState(false);
  // Toggle expand single row for SELESAI & DIBATALKAN
  const [rowExpanded, setRowExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    settingsService
      .getSettings()
      .then(setSettings)
      .catch((err) => console.warn('Gagal memuat settings:', err));
  }, []);

  const isBaru = order.status === 'BARU';
  const isDiterima = order.status === 'DITERIMA';
  const isSelesai = order.status === 'SELESAI';
  const isDibatalkan = order.status === 'DIBATALKAN';
  const isLunas = order.paymentStatus === 'LUNAS';
  const canCancel = isBaru || isDiterima;

  const timeoutMinutes = settings?.paymentTimeoutMinutes ?? 10;
  const createdAtMs = order.createdAt?.toMillis
    ? order.createdAt.toMillis()
    : order.createdAt?.seconds
    ? order.createdAt.seconds * 1000
    : Date.now();
  const minutesElapsed = Math.max(0, Math.floor((currentTime - createdAtMs) / (60 * 1000)));
  const isOverdueUnpaid = !isLunas && !isDibatalkan && minutesElapsed >= timeoutMinutes;

  const payable = order.payableAmount || order.totalPrice;

  const handleTerimaPesanan = async () => {
    setActionLoading(true);
    try {
      await onUpdateStatus(order.id, 'BARU', 'DITERIMA');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelesaikanPesanan = async () => {
    if (!isLunas) {
      addToast('error', 'Pesanan belum lunas! Tandai lunas terlebih dahulu.');
      return;
    }
    setActionLoading(true);
    try {
      await onUpdateStatus(order.id, 'DITERIMA', 'SELESAI');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    setActionLoading(true);
    try {
      await onUpdateStatus(
        order.id,
        order.status,
        'DIBATALKAN',
        cancelReasonInput.trim() || 'Dibatalkan oleh admin'
      );
      setShowCancelModal(false);
      setCancelReasonInput('');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPaid = async (method: PaidMethodFinal) => {
    if (!profile) return;
    setActionLoading(true);
    try {
      await orderService.markOrderPaid(order.id, method, {
        uid: profile.id,
        name: profile.name,
      });
      setShowMarkPaidModal(false);
      addToast(
        'success',
        `Pesanan #${order.orderCode} ditandai Lunas (${method}).`
      );
    } catch (err: any) {
      addToast('error', err?.message || 'Gagal menandai lunas.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenQrisModal = async () => {
    setShowQrisModal(true);
    if (!settings?.qrisPayload) return;
    try {
      const dynamicPayload = generateDynamicQris(settings.qrisPayload, payable);
      const url = await QRCode.toDataURL(dynamicPayload, {
        width: 300,
        margin: 2,
      });
      setQrisDataUrl(url);
    } catch (err) {
      console.error('Error generating dynamic QRIS:', err);
    }
  };

  // =========================================================================
  // KARTU SELESAI & DIBATALKAN: Dirender sebagai satu baris ringkas yang bisa diketuk
  // =========================================================================
  if (isSelesai || isDibatalkan) {
    return (
      <>
        <div
          onClick={() => setRowExpanded(!rowExpanded)}
          className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer ${
            isSelesai
              ? 'bg-white dark:bg-[#141414] border-stone-200 dark:border-stone-800/80 hover:border-emerald-500/40 shadow-2xs'
              : 'bg-white dark:bg-[#141414] border-stone-200 dark:border-stone-800/80 opacity-75 hover:opacity-100 hover:border-red-500/40 shadow-2xs'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Kiri: Nomor Order, Meja, Nama */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono font-black text-stone-900 dark:text-white text-sm sm:text-base shrink-0">
                #{order.orderCode}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold shrink-0">
                Meja {order.tableNumber}
              </span>
              <span className="text-xs text-stone-500 dark:text-stone-400 truncate max-w-[100px] sm:max-w-[140px]">
                {order.customerName}
              </span>
            </div>

            {/* Kanan: Total, Jam, Status Badge & Chevron */}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <span className="font-mono font-bold text-xs sm:text-sm text-stone-900 dark:text-white">
                {formatRupiah(payable)}
              </span>
              <span className="text-[11px] text-stone-400 font-mono">
                {formatTimeJakarta(order.completedAt || order.cancelledAt || order.createdAt)}
              </span>
              <StatusBadge status={order.status} size="sm" />
              {rowExpanded ? (
                <ChevronUp className="w-4 h-4 text-stone-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-stone-400" />
              )}
            </div>
          </div>

          {/* Rincian saat baris diperluas */}
          {rowExpanded && (
            <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-stone-500">
                <span>Metode Pembayaran:</span>
                <span className="font-bold text-stone-800 dark:text-stone-200">
                  {order.paidMethodFinal || order.paymentMethod} • {order.paymentStatus}
                </span>
              </div>

              {/* Daftar item */}
              <div className="bg-stone-50 dark:bg-stone-900/60 p-2.5 rounded-xl space-y-1">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-stone-700 dark:text-stone-300">
                    <span>
                      <strong className="text-[#FF6B1A]">{item.qty}×</strong> {item.name}
                    </span>
                    <span className="font-mono">{formatRupiah(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>

              {order.notes && (
                <p className="text-stone-500 italic">Catatan: "{order.notes}"</p>
              )}

              {order.cancelReason && (
                <p className="text-red-500 font-bold">Alasan Batal: {order.cancelReason}</p>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowHistoryModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-[#FF6B1A] font-bold hover:underline p-1"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Lihat Riwayat Lengkap</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Riwayat Pesanan */}
        <Modal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          title={`Riwayat Pesanan #${order.orderCode}`}
        >
          <div className="space-y-4">
            <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-500">Pelanggan:</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">
                  {order.customerName} (Meja {order.tableNumber})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Metode Bayar:</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">
                  {order.paymentMethod} • {order.paymentStatus}
                </span>
              </div>
              {order.paidAt && (
                <div className="flex justify-between">
                  <span className="text-stone-500">Waktu Bayar:</span>
                  <span className="font-mono text-emerald-600 font-bold">
                    {formatDateTimeJakarta(order.paidAt)} ({order.paidMethodFinal})
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-stone-100 dark:border-stone-800">
                <span className="font-medium text-stone-600 dark:text-stone-300">
                  Waktu Masuk:
                </span>
                <span className="font-mono font-bold text-stone-800 dark:text-stone-200">
                  {formatDateTimeJakarta(order.createdAt)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-stone-100 dark:border-stone-800">
                <div>
                  <span className="font-medium text-stone-600 dark:text-stone-300">
                    Diterima Admin:
                  </span>
                  {order.acceptedBy && (
                    <p className="text-[10px] text-stone-400">
                      Oleh: {order.acceptedBy.name}
                    </p>
                  )}
                </div>
                <span className="font-mono font-bold text-stone-800 dark:text-stone-200">
                  {formatDateTimeJakarta(order.acceptedAt)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-stone-100 dark:border-stone-800">
                <span className="font-medium text-stone-600 dark:text-stone-300">
                  Selesai:
                </span>
                <span className="font-mono font-bold text-stone-800 dark:text-stone-200">
                  {formatDateTimeJakarta(order.completedAt)}
                </span>
              </div>

              {order.cancelledAt && (
                <div className="flex justify-between items-center py-1.5 text-red-600 dark:text-red-400">
                  <div>
                    <span className="font-medium">Dibatalkan:</span>
                    {order.cancelReason && (
                      <p className="text-[10px]">{order.cancelReason}</p>
                    )}
                  </div>
                  <span className="font-mono font-bold">
                    {formatDateTimeJakarta(order.cancelledAt)}
                  </span>
                </div>
              )}
            </div>

            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowHistoryModal(false)}
            >
              Tutup
            </Button>
          </div>
        </Modal>
      </>
    );
  }

  // =========================================================================
  // KARTU PESANAN AKTIF (BARU & DITERIMA): Ringkas 5 Baris + Footer
  // =========================================================================
  const itemsToShow = itemsExpanded ? order.items : order.items.slice(0, 3);
  const hiddenItemsCount = Math.max(0, order.items.length - 3);

  return (
    <>
      <Card
        className={`overflow-hidden transition-all duration-200 flex flex-col justify-between ${
          isOverdueUnpaid
            ? 'ring-2 ring-red-500 bg-red-50/15 dark:bg-red-950/20 shadow-md'
            : isBaru
            ? 'ring-2 ring-[#FF6B1A] bg-orange-50/20 dark:bg-orange-950/10 shadow-md'
            : isDiterima
            ? 'border-blue-300 dark:border-blue-900 shadow-xs'
            : ''
        }`}
      >
        {/* Banner Kuning Menetap Klaim Bayar (hilang setelah Tandai Lunas) */}
        {order.customerClaimedPaid && !isLunas && (
          <div className="p-2.5 sm:p-3 bg-amber-500/20 border-b border-amber-500/40 text-amber-950 dark:text-amber-200 text-xs sm:text-sm font-bold flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
              <span className="truncate">
                CUSTOMER MENGKLAIM SUDAH BAYAR - cek dana masuk {formatRupiah(payable)}
              </span>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowMarkPaidModal(true)}
              className="py-1 px-2.5 text-xs font-bold min-h-[32px] shrink-0"
            >
              Tandai Lunas
            </Button>
          </div>
        )}

        <div className="p-3.5 sm:p-4 space-y-2.5">
          {/* BARIS 1: Nomor order, lencana meja, durasi tunggu (jika BARU), dan lencana status */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[clamp(1.1rem,2.8vw,1.3rem)] font-black font-mono tracking-tight text-stone-900 dark:text-white leading-none">
                #{order.orderCode}
              </span>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-bold">
                <MapPin className="w-3.5 h-3.5 text-[#FF6B1A] shrink-0" />
                <span>Meja {order.tableNumber}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {isBaru && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold border ${
                    minutesElapsed >= 5
                      ? 'bg-red-500/15 border-red-500/40 text-red-600 dark:text-red-400 animate-pulse'
                      : minutesElapsed >= 2
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400'
                      : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                  }`}
                >
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>Menunggu {minutesElapsed} menit</span>
                </span>
              )}
              <StatusBadge status={order.status} size="sm" className="shrink-0" />
            </div>
          </div>

          {/* BARIS 2: Nama dan jam dengan teks kecil redup */}
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <div className="flex items-center gap-1.5 font-medium truncate max-w-[65%]">
              <User className="w-3.5 h-3.5 shrink-0 opacity-70" />
              <span className="truncate">{order.customerName}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Clock className="w-3.5 h-3.5 shrink-0 opacity-70" />
              <span>{formatTimeJakarta(order.createdAt)} WIB</span>
            </div>
          </div>

          {/* BARIS 3: Satu lencana pembayaran (contoh "LUNAS · QRIS" atau "BELUM BAYAR · QRIS") tanpa nominal */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
            {isLunas ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>LUNAS · {order.paidMethodFinal || order.paymentMethod}</span>
              </span>
            ) : (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                  isOverdueUnpaid
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>BELUM BAYAR · {order.paymentMethod}</span>
              </span>
            )}

            {/* Sub-status: Klaim bayar & overdue */}
            {order.customerClaimedPaid && !isLunas && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                <span>Klaim Bayar</span>
              </span>
            )}

            {isOverdueUnpaid && (
              <span className="text-[10px] font-bold text-red-600 dark:text-red-400 flex items-center gap-0.5">
                <AlertTriangle className="w-3 h-3" />
                <span>&gt;{timeoutMinutes}m</span>
              </span>
            )}
          </div>

          {/* BARIS 4: Daftar item "1× Nama Menu" dengan harga di kanan, maks 3 item lalu "+N lainnya" */}
          <div className="space-y-1 bg-stone-50 dark:bg-stone-900/60 p-2.5 rounded-xl border border-stone-100 dark:border-stone-800/60">
            {itemsToShow.map((item, idx) => (
              <div key={idx} className="flex items-start justify-between gap-2 text-xs">
                <div className="font-semibold text-stone-800 dark:text-stone-200 truncate">
                  <span className="text-[#FF6B1A] font-bold mr-1.5">{item.qty}×</span>
                  <span>{item.name}</span>
                </div>
                <span className="text-stone-500 dark:text-stone-400 font-mono shrink-0">
                  {formatRupiah(item.price * item.qty)}
                </span>
              </div>
            ))}

            {hiddenItemsCount > 0 && !itemsExpanded && (
              <button
                type="button"
                onClick={() => setItemsExpanded(true)}
                className="text-xs font-bold text-[#FF6B1A] hover:underline pt-0.5 block cursor-pointer"
              >
                +{hiddenItemsCount} lainnya...
              </button>
            )}

            {itemsExpanded && order.items.length > 3 && (
              <button
                type="button"
                onClick={() => setItemsExpanded(false)}
                className="text-xs font-bold text-stone-400 hover:underline pt-0.5 block cursor-pointer"
              >
                Sembunyikan
              </button>
            )}
          </div>

          {/* Catatan pesanan satu baris ringkas bila ada */}
          {order.notes && (
            <p
              className="text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 truncate italic"
              title={order.notes}
            >
              Catatan: "{order.notes}"
            </p>
          )}

          {/* BARIS 5: Total satu angka, dengan teks kecil "termasuk kode unik Rp X" hanya jika > 0 */}
          <div className="flex items-center justify-between pt-1 border-t border-stone-100 dark:border-stone-800">
            <div>
              <p className="text-base sm:text-lg font-black font-mono text-[#FF6B1A] leading-tight">
                {formatRupiah(payable)}
              </p>
              {order.uniqueCode > 0 && (
                <p className="text-[10px] text-stone-400 font-mono">
                  termasuk kode unik Rp {order.uniqueCode}
                </p>
              )}
            </div>

            {/* Tombol QRIS Meja & Tandai Lunas jika belum bayar */}
            {!isLunas && (
              <div className="flex items-center gap-1.5">
                {settings?.qrisPayload && (
                  <button
                    type="button"
                    onClick={handleOpenQrisModal}
                    className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center cursor-pointer"
                    title="Tampilkan QRIS"
                    aria-label="Tampilkan QRIS"
                  >
                    <QrCode className="w-4 h-4 text-[#FF6B1A]" />
                  </button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowMarkPaidModal(true)}
                  className="py-1 px-2.5 text-xs font-bold min-h-[36px]"
                >
                  Tandai Lunas
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER: Satu tombol aksi utama selebar kartu ditambah satu tombol ikon kecil untuk batalkan */}
        <div className="p-2.5 sm:p-3 bg-stone-50/80 dark:bg-stone-900/80 border-t border-stone-100 dark:border-stone-800 flex items-center gap-2">
          {/* History Icon Button */}
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-xl hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            title="Riwayat Pesanan"
            aria-label="Riwayat Pesanan"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Tombol Aksi Utama Selebar Kartu */}
          {isBaru ? (
            <Button
              variant="primary"
              size="md"
              fullWidth
              loading={actionLoading || isProcessing}
              onClick={handleTerimaPesanan}
              icon={<Check className="w-4 h-4 stroke-[3]" />}
              className="min-h-[44px] flex-1 font-bold animate-pulse text-xs sm:text-sm"
            >
              Terima Pesanan
            </Button>
          ) : isDiterima ? (
            <Button
              variant="success"
              size="md"
              fullWidth
              disabled={!isLunas}
              loading={actionLoading || isProcessing}
              onClick={handleSelesaikanPesanan}
              icon={<CheckCircle2 className="w-4 h-4" />}
              className="min-h-[44px] flex-1 font-bold text-xs sm:text-sm"
            >
              {isLunas ? 'Selesai' : 'Selesai (Wajib Lunas)'}
            </Button>
          ) : null}

          {/* Tombol Ikon Kecil untuk Batalkan */}
          {canCancel && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 dark:hover:border-red-900/50 transition-colors cursor-pointer shrink-0"
              title="Batalkan Pesanan"
              aria-label="Batalkan Pesanan"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </Card>

      {/* Modal Tandai Lunas (Pilihan: Tunai, QRIS, Transfer) */}
      <Modal
        isOpen={showMarkPaidModal}
        onClose={() => setShowMarkPaidModal(false)}
        title={`Tandai Lunas #${order.orderCode}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-xl space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-stone-500">Meja:</span>
              <span className="font-bold text-stone-900 dark:text-stone-100">
                Meja {order.tableNumber} ({order.customerName})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Total Tagihan:</span>
              <span className="font-black font-mono text-[#FF6B1A] text-sm">
                {formatRupiah(payable)}
              </span>
            </div>
            {order.customerClaimedPaid && (
              <p className="text-[11px] font-bold text-amber-600 pt-1">
                Pelanggan telah menyatakan sudah bayar dari handphonenya.
              </p>
            )}
          </div>

          <p className="text-xs font-bold text-stone-700 dark:text-stone-300">
            Pilih Metode Pembayaran:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              variant="success"
              onClick={() => handleMarkPaid('TUNAI')}
              loading={actionLoading}
              fullWidth
              className="min-h-[44px]"
            >
              Tunai / Kasir
            </Button>
            <Button
              variant="primary"
              onClick={() => handleMarkPaid('QRIS')}
              loading={actionLoading}
              fullWidth
              className="min-h-[44px]"
            >
              QRIS
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleMarkPaid('TRANSFER')}
              loading={actionLoading}
              fullWidth
              className="min-h-[44px]"
            >
              Transfer Bank
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal QRIS Dinamis */}
      <Modal
        isOpen={showQrisModal}
        onClose={() => setShowQrisModal(false)}
        title={`QRIS Pesanan #${order.orderCode}`}
      >
        <div className="space-y-4 text-center">
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Tunjukkan kode QRIS ini ke pelanggan di Meja {order.tableNumber}:
          </p>

          {qrisDataUrl ? (
            <div className="p-3 bg-white rounded-2xl shadow-sm border border-stone-200 max-w-[240px] mx-auto">
              <img
                src={qrisDataUrl}
                alt="QRIS Dinamis"
                className="w-full h-auto aspect-square"
              />
            </div>
          ) : (
            <div className="p-6 text-xs text-stone-400 font-bold">
              Membuat kode QRIS dinamis...
            </div>
          )}

          <div>
            <p className="text-xs text-stone-400">Nominal yang Harus Dibayar:</p>
            <p className="text-2xl font-black font-mono text-[#FF6B1A]">
              {formatRupiah(payable)}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="primary"
              fullWidth
              className="min-h-[44px]"
              onClick={() => {
                setShowQrisModal(false);
                setShowMarkPaidModal(true);
              }}
            >
              Tandai Lunas
            </Button>
            <Button
              variant="outline"
              fullWidth
              className="min-h-[44px]"
              onClick={() => setShowQrisModal(false)}
            >
              Tutup
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Riwayat Pesanan */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title={`Riwayat Pesanan #${order.orderCode}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-xl space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-stone-500">Pelanggan:</span>
              <span className="font-bold text-stone-900 dark:text-stone-100">
                {order.customerName} (Meja {order.tableNumber})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Metode Bayar:</span>
              <span className="font-bold text-stone-900 dark:text-stone-100">
                {order.paymentMethod} • {order.paymentStatus}
              </span>
            </div>
            {order.paidAt && (
              <div className="flex justify-between">
                <span className="text-stone-500">Waktu Bayar:</span>
                <span className="font-mono text-emerald-600 font-bold">
                  {formatDateTimeJakarta(order.paidAt)} ({order.paidMethodFinal})
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-2 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-stone-100 dark:border-stone-800">
              <span className="font-medium text-stone-600 dark:text-stone-300">
                Waktu Masuk:
              </span>
              <span className="font-mono font-bold text-stone-800 dark:text-stone-200">
                {formatDateTimeJakarta(order.createdAt)}
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-stone-100 dark:border-stone-800">
              <div>
                <span className="font-medium text-stone-600 dark:text-stone-300">
                  Diterima Admin:
                </span>
                {order.acceptedBy && (
                  <p className="text-[10px] text-stone-400">
                    Oleh: {order.acceptedBy.name}
                  </p>
                )}
              </div>
              <span className="font-mono font-bold text-stone-800 dark:text-stone-200">
                {formatDateTimeJakarta(order.acceptedAt)}
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-stone-100 dark:border-stone-800">
              <span className="font-medium text-stone-600 dark:text-stone-300">
                Selesai:
              </span>
              <span className="font-mono font-bold text-stone-800 dark:text-stone-200">
                {formatDateTimeJakarta(order.completedAt)}
              </span>
            </div>

            {order.cancelledAt && (
              <div className="flex justify-between items-center py-1.5 text-red-600 dark:text-red-400">
                <div>
                  <span className="font-medium">Dibatalkan:</span>
                  {order.cancelReason && (
                    <p className="text-[10px]">{order.cancelReason}</p>
                  )}
                </div>
                <span className="font-mono font-bold">
                  {formatDateTimeJakarta(order.cancelledAt)}
                </span>
              </div>
            )}
          </div>

          <Button
            variant="secondary"
            fullWidth
            className="min-h-[44px]"
            onClick={() => setShowHistoryModal(false)}
          >
            Tutup
          </Button>
        </div>
      </Modal>

      {/* Modal Konfirmasi Pembatalan */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Batalkan Pesanan"
      >
        <div className="space-y-4">
          <p className="text-xs text-stone-600 dark:text-stone-300">
            Apakah Anda yakin ingin membatalkan pesanan #{order.orderCode} untuk Meja {order.tableNumber}?
          </p>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
              Alasan Pembatalan:
            </label>
            <input
              type="text"
              value={cancelReasonInput}
              onChange={(e) => setCancelReasonInput(e.target.value)}
              placeholder="Contoh: Bahan habis, pelanggan membatalkan, dll."
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[44px]"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              fullWidth
              className="min-h-[44px]"
              onClick={() => setShowCancelModal(false)}
            >
              Kembali
            </Button>
            <Button
              variant="danger"
              fullWidth
              className="min-h-[44px]"
              loading={actionLoading}
              onClick={handleConfirmCancel}
            >
              Ya, Batalkan
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
