import React, { useState, useEffect } from 'react';
import { Bell, MapPin, User, Check, Layers, AlertCircle } from 'lucide-react';
import { Order } from '../../types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { formatRupiah, formatTimeJakarta } from '../../lib/formatters';

interface NewOrderPopupProps {
  orders: Order[];
  onAcceptSingle: (orderId: string) => Promise<void>;
  onAcceptAll: () => Promise<void>;
}

export const NewOrderPopup: React.FC<NewOrderPopupProps> = ({
  orders,
  onAcceptSingle,
  onAcceptAll,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfirmAllModal, setShowConfirmAllModal] = useState(false);

  // Pesanan tertua ditampilkan pertama (diurutkan berdasarkan createdAt naik)
  const currentOrder = orders[0];
  const totalCount = orders.length;
  const otherCount = totalCount - 1;

  useEffect(() => {
    setErrorMessage(null);
  }, [currentOrder?.id]);

  if (orders.length === 0) return null;

  const handleAccept = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await onAcceptSingle(currentOrder.id);
    } catch (err: any) {
      const msg = err?.message || 'Gagal menerima pesanan';
      setErrorMessage(msg);
      // Bila sudah diterima admin lain, tampilkan "Pesanan sudah diterima oleh [nama]"
      // dan setelah 2 detik bersihkan error agar popup menampilkan antrean berikutnya
      if (msg.includes('diterima oleh') || msg.includes('sudah diubah')) {
        setTimeout(() => {
          setErrorMessage(null);
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAcceptAll = async () => {
    setShowConfirmAllModal(false);
    setLoading(true);
    setErrorMessage(null);
    try {
      await onAcceptAll();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menerima semua pesanan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative w-full max-w-lg bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-2xl border-4 border-[#FF6B1A] overflow-hidden flex flex-col max-h-[92vh]">
          {/* Urgent Header Banner */}
          <div className="bg-[#FF6B1A] text-white p-4 sm:p-5 text-center flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 opacity-15">
              <Bell className="w-32 h-32" />
            </div>

            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-2 animate-bounce">
              <Bell className="w-9 h-9 text-white stroke-[2.5]" />
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-wider uppercase">
              PESANAN BARU MASUK!
            </h2>

            {/* Keterangan Antrean 1 dari N */}
            <div className="mt-1.5 inline-flex items-center gap-1.5 bg-black/25 backdrop-blur-sm px-3.5 py-1 rounded-full text-xs sm:text-sm font-black">
              <Layers className="w-4 h-4" />
              <span>Antrean 1 dari {totalCount}</span>
            </div>
          </div>

          {/* Scrollable Order Details */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
            {errorMessage && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Number & Table Highlight Card */}
            <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-950/30 rounded-2xl border border-orange-200 dark:border-orange-900/50">
              <div>
                <p className="text-xs font-bold text-[#FF6B1A] uppercase tracking-wider">
                  NOMOR ORDER
                </p>
                <p className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-stone-900 dark:text-white">
                  #{currentOrder.orderCode}
                </p>
              </div>

              <div className="text-right">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF6B1A] text-white font-black text-base shadow-sm">
                  <MapPin className="w-4 h-4" />
                  <span>MEJA {currentOrder.tableNumber}</span>
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  {formatTimeJakarta(currentOrder.createdAt)} WIB
                </p>
              </div>
            </div>

            {/* Payment Status Badge & Klaim Bayar Banner */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                {currentOrder.paymentStatus === 'LUNAS' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-black">
                    <span>LUNAS • {currentOrder.paidMethodFinal || currentOrder.paymentMethod}</span>
                    <span>• {formatRupiah(currentOrder.payableAmount || currentOrder.totalPrice)}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400 font-black">
                    <span>BELUM BAYAR • {currentOrder.paymentMethod}</span>
                    <span>• {formatRupiah(currentOrder.payableAmount || currentOrder.totalPrice)}</span>
                  </span>
                )}
              </div>

              {/* Banner Klaim Sudah Bayar pada Popup */}
              {currentOrder.customerClaimedPaid && currentOrder.paymentStatus !== 'LUNAS' && (
                <div className="p-2.5 sm:p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-950 dark:text-amber-200 text-xs font-bold flex items-center gap-2 shadow-2xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                  <span>
                    CUSTOMER MENGKLAIM SUDAH BAYAR - cek dana masuk {formatRupiah(currentOrder.payableAmount || currentOrder.totalPrice)}
                  </span>
                </div>
              )}
            </div>

            {/* Customer Name */}
            <div className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300 px-1">
              <User className="w-4 h-4 text-[#FF6B1A]" />
              <span className="font-bold">{currentOrder.customerName}</span>
            </div>

            {/* Order Items List */}
            <div className="space-y-2 border border-stone-100 dark:border-stone-800 rounded-2xl p-3 bg-stone-50 dark:bg-stone-900/60 max-h-48 overflow-y-auto">
              {currentOrder.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start text-sm">
                  <div>
                    <span className="font-black text-[#FF6B1A] mr-2">
                      {item.qty}x
                    </span>
                    <span className="font-semibold text-stone-900 dark:text-stone-100">
                      {item.name}
                    </span>
                    {item.note && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 pl-6 italic">
                        "{item.note}"
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-xs text-stone-500 font-semibold shrink-0">
                    {formatRupiah(item.price * item.qty)}
                  </span>
                </div>
              ))}
            </div>

            {/* Special Order Notes */}
            {currentOrder.notes && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                <span className="font-bold">Catatan Pelanggan: </span>
                {currentOrder.notes}
              </div>
            )}

            {/* Total Price */}
            <div className="flex justify-between items-center pt-2 px-1 border-t border-stone-100 dark:border-stone-800">
              <span className="text-sm font-medium text-stone-500">Total Pembayaran:</span>
              <span className="text-xl sm:text-2xl font-black font-mono text-[#FF6B1A]">
                {formatRupiah(currentOrder.payableAmount || currentOrder.totalPrice)}
              </span>
            </div>
          </div>

          {/* Action Button Footer */}
          <div className="p-4 sm:p-6 bg-stone-50 dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800 flex flex-col gap-2 shrink-0">
            {/* Giant Accept Order Button (min-h 64px) */}
            <button
              onClick={handleAccept}
              disabled={loading}
              className="w-full min-h-[64px] bg-[#FF6B1A] hover:bg-[#E5530A] active:scale-[0.98] text-white font-black text-lg sm:text-xl rounded-2xl shadow-xl shadow-orange-500/30 flex items-center justify-center gap-3 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-7 h-7 stroke-[3]" />
                  <span>TERIMA PESANAN #{currentOrder.orderCode}</span>
                </>
              )}
            </button>

            {/* Accept All button if multiple */}
            {otherCount > 0 && (
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                loading={loading}
                onClick={() => setShowConfirmAllModal(true)}
                icon={<Layers className="w-5 h-5" />}
              >
                Terima Semua ({totalCount} Pesanan)
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Konfirmasi Terima Semua Modal */}
      <Modal
        isOpen={showConfirmAllModal}
        onClose={() => setShowConfirmAllModal(false)}
        title="Konfirmasi Terima Semua"
      >
        <div className="space-y-4">
          <p className="text-sm text-stone-700 dark:text-stone-300">
            Apakah Anda yakin ingin menerima seluruh <strong>{totalCount} pesanan baru</strong> sekaligus?
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setShowConfirmAllModal(false)}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={loading}
              onClick={handleConfirmAcceptAll}
              icon={<Check className="w-4 h-4 stroke-[3]" />}
            >
              Ya, Terima Semua ({totalCount})
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
