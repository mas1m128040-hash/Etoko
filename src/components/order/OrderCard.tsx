import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Clock,
  User,
  MapPin,
  FileText,
  AlertCircle,
  History,
  Check,
  CheckCircle2,
  X,
  CreditCard,
  QrCode,
  DollarSign,
  AlertTriangle,
  Ban,
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

  // Cek apakah pesanan belum lunas sudah melewati batas paymentTimeoutMinutes
  const timeoutMinutes = settings?.paymentTimeoutMinutes ?? 10;
  const createdAtMs = order.createdAt?.toMillis
    ? order.createdAt.toMillis()
    : order.createdAt?.seconds
    ? order.createdAt.seconds * 1000
    : Date.now();
  const minutesElapsed = Math.floor((Date.now() - createdAtMs) / (60 * 1000));
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

  const handleCancelUnpaid = async () => {
    if (
      !confirm(
        `Batalkan pesanan #${order.orderCode} dengan alasan "Tidak membayar"?`
      )
    )
      return;
    if (!profile) return;
    setActionLoading(true);
    try {
      await orderService.cancelUnpaidOrder(order.id, {
        uid: profile.id,
        name: profile.name,
      });
      addToast('success', `Pesanan #${order.orderCode} dibatalkan (Tidak membayar).`);
    } catch (err: any) {
      addToast('error', err?.message || 'Gagal membatalkan pesanan.');
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

  return (
    <>
      <Card
        className={`overflow-hidden transition-all duration-200 ${
          isOverdueUnpaid
            ? 'ring-2 ring-red-500 bg-red-50/15 dark:bg-red-950/20 shadow-md'
            : isBaru
            ? 'ring-2 ring-[#FF6B1A] bg-orange-50/20 dark:bg-orange-950/10 shadow-lg'
            : isDiterima
            ? 'border-blue-300 dark:border-blue-900 shadow-sm'
            : ''
        }`}
      >
        {/* Card Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 dark:border-stone-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-stone-900 dark:text-white">
              #{order.orderCode}
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-bold">
              <MapPin className="w-3.5 h-3.5 text-[#FF6B1A]" />
              <span>Meja {order.tableNumber}</span>
            </div>
          </div>

          <StatusBadge status={order.status} size="sm" />
        </div>

        {/* Card Body */}
        <div className="p-4 sm:p-5 flex flex-col gap-3.5">
          {/* Customer & Timestamp row */}
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <div className="flex items-center gap-1.5 font-medium truncate max-w-[60%]">
              <User className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{order.customerName}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{formatTimeJakarta(order.createdAt)} WIB</span>
            </div>
          </div>

          {/* Payment Status Badge Bar */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              {isLunas ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-black">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    LUNAS • {order.paidMethodFinal || order.paymentMethod} • {formatRupiah(payable)}
                  </span>
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-black text-xs ${
                    isOverdueUnpaid
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    BELUM BAYAR • {order.paymentMethod} • {formatRupiah(payable)}
                  </span>
                </span>
              )}

              {/* Overdue alert indicator */}
              {isOverdueUnpaid && (
                <span className="text-[10px] font-black text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>&gt;{timeoutMinutes} mnt</span>
                </span>
              )}
            </div>

            {/* Customer claimed paid notice */}
            {order.customerClaimedPaid && !isLunas && (
              <div className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-black flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  <span>Customer klaim sudah bayar - cek mutasi</span>
                </div>
              </div>
            )}
          </div>

          {/* Items breakdown list */}
          <div className="space-y-1.5 bg-stone-50 dark:bg-stone-900/60 p-3 rounded-xl border border-stone-100 dark:border-stone-800/60">
            {order.items.map((item, idx) => (
              <div key={idx} className="text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <span className="text-[#FF6B1A] font-bold min-w-[24px]">
                      {item.qty}x
                    </span>
                    <span>{item.name}</span>
                  </div>
                  <span className="text-stone-500 dark:text-stone-400 text-xs font-mono shrink-0">
                    {formatRupiah(item.price * item.qty)}
                  </span>
                </div>
                {item.note && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 pl-7 italic mt-0.5">
                    "{item.note}"
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* General Order Notes */}
          {order.notes && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
              <FileText className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <span className="font-bold">Catatan: </span>
                {order.notes}
              </div>
            </div>
          )}

          {/* Total Price & Payment Summary */}
          <div className="flex items-center justify-between pt-1 border-t border-stone-100 dark:border-stone-800 text-xs">
            <div>
              <p className="text-stone-400">Total Tagihan</p>
              <p className="text-base sm:text-lg font-black font-mono text-[#FF6B1A]">
                {formatRupiah(payable)}
              </p>
              {order.uniqueCode > 0 && (
                <p className="text-[10px] text-stone-400 font-mono">
                  (Kode unik: Rp {order.uniqueCode})
                </p>
              )}
            </div>

            {/* Quick Action: Tandai Lunas or Tampilkan QRIS */}
            {!isLunas && !isDibatalkan && (
              <div className="flex items-center gap-1.5">
                {settings?.qrisPayload && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenQrisModal}
                    icon={<QrCode className="w-3.5 h-3.5 text-[#FF6B1A]" />}
                    className="py-1 px-2 text-xs"
                  >
                    QRIS Meja
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowMarkPaidModal(true)}
                  icon={<CreditCard className="w-3.5 h-3.5" />}
                  className="py-1 px-2.5 text-xs font-bold"
                >
                  Tandai Lunas
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Card Actions Footer */}
        <div className="p-3 sm:p-4 bg-stone-50/80 dark:bg-stone-900/80 border-t border-stone-100 dark:border-stone-800 flex items-center gap-2">
          {/* History Details Button */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="p-2.5 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
            title="Lihat riwayat waktu status"
            aria-label="Lihat riwayat waktu status"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Primary Action Button */}
          {isBaru ? (
            <Button
              variant="primary"
              size="md"
              fullWidth
              loading={actionLoading || isProcessing}
              onClick={handleTerimaPesanan}
              icon={<Check className="w-4 h-4 stroke-[3]" />}
              className="animate-pulse"
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
              title={
                !isLunas
                  ? 'Pesanan harus ditandai lunas terlebih dahulu'
                  : 'Selesaikan pesanan'
              }
            >
              {isLunas ? 'Selesai (1 Ketuk)' : 'Selesai (Wajib Lunas)'}
            </Button>
          ) : (
            <div className="flex-1 text-center text-xs font-semibold text-stone-400">
              Pesanan {isSelesai ? 'Telah Selesai' : 'Dibatalkan'}
            </div>
          )}

          {/* Quick "Batalkan - Tidak Bayar" if unpaid */}
          {!isLunas && !isDibatalkan && (
            <Button
              variant="danger"
              size="md"
              onClick={handleCancelUnpaid}
              className="shrink-0 px-2.5 text-xs"
              title="Batalkan - Tidak Bayar"
            >
              <Ban className="w-4 h-4" />
            </Button>
          )}

          {/* Cancel button if allowed */}
          {canCancel && (
            <Button
              variant="danger"
              size="md"
              onClick={() => setShowCancelModal(true)}
              className="shrink-0 px-2.5"
              aria-label="Batalkan pesanan"
              title="Batalkan Pesanan"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>

      {/* Modal Tandai Lunas (Pilihan: Tunai, QRIS, Transfer) */}
      <Modal
        isOpen={showMarkPaidModal}
        onClose={() => setShowMarkPaidModal(false)}
        title={`Tandai Lunas Pesanan #${order.orderCode}`}
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
              <span className="text-stone-500">Total yang Harus Dibayar:</span>
              <span className="font-black font-mono text-[#FF6B1A] text-sm">
                {formatRupiah(payable)}
              </span>
            </div>
            {order.customerClaimedPaid && (
              <p className="text-[11px] font-bold text-amber-600 pt-1">
                Customer telah mengklaim pembayaran dari perangkatnya.
              </p>
            )}
          </div>

          <p className="text-xs font-bold text-stone-700 dark:text-stone-300">
            Pilih Metode Pelunasan:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              variant="success"
              onClick={() => handleMarkPaid('TUNAI')}
              loading={actionLoading}
              fullWidth
            >
              Tunai / Kasir
            </Button>
            <Button
              variant="primary"
              onClick={() => handleMarkPaid('QRIS')}
              loading={actionLoading}
              fullWidth
            >
              QRIS
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleMarkPaid('TRANSFER')}
              loading={actionLoading}
              fullWidth
            >
              Transfer Bank
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Tampilkan QRIS Dinamis ke Customer di Meja */}
      <Modal
        isOpen={showQrisModal}
        onClose={() => setShowQrisModal(false)}
        title={`QRIS Pesanan #${order.orderCode}`}
      >
        <div className="space-y-4 text-center">
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Tunjukkan kode QRIS ini kepada pelanggan di Meja {order.tableNumber}:
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
              onClick={() => setShowQrisModal(false)}
            >
              Tutup
            </Button>
          </div>
        </div>
      </Modal>

      {/* History Modal */}
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
                Waktu Masuk (BARU):
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
                Selesai (SELESAI):
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

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Konfirmasi Pembatalan Pesanan"
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <p>
              Apakah Anda yakin ingin membatalkan pesanan #{order.orderCode} untuk
              Meja {order.tableNumber}? Tindakan ini tidak dapat diurungkan.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
              Alasan Pembatalan:
            </label>
            <input
              type="text"
              value={cancelReasonInput}
              onChange={(e) => setCancelReasonInput(e.target.value)}
              placeholder="Contoh: Bahan habis, pelanggan membatalkan, dsb."
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowCancelModal(false)}
            >
              Kembali
            </Button>
            <Button
              variant="danger"
              fullWidth
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
