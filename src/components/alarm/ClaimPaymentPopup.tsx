import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, X } from 'lucide-react';
import { useClaimPopupStore } from '../../store/claimPopupStore';
import { formatRupiah } from '../../lib/formatters';

export const ClaimPaymentPopup: React.FC = () => {
  const { claims, removeClaim } = useClaimPopupStore();
  const navigate = useNavigate();

  if (claims.length === 0) return null;

  const visibleClaims = claims.slice(0, 3);
  const remainingCount = claims.length - 3;

  const handleViewOrder = (orderId: string) => {
    const isDashboard =
      window.location.hash === '#/admin' ||
      window.location.hash === '#/admin/' ||
      window.location.pathname === '/admin' ||
      window.location.pathname === '/admin/';

    if (!isDashboard) {
      navigate('/admin');
    }

    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('smart_resto_focus_order', { detail: { orderId } })
      );
      const el = document.getElementById(`order-card-${orderId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-[#FF6B1A]', 'ring-offset-2');
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-[#FF6B1A]', 'ring-offset-2');
        }, 2000);
      }
    }, 200);
  };

  return (
    <div
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] w-full max-w-[420px] px-3 pointer-events-none flex flex-col gap-2"
      role="region"
      aria-label="Pemberitahuan Klaim Pembayaran"
    >
      {visibleClaims.map((claim) => (
        <div
          key={claim.orderId}
          className="pointer-events-auto bg-amber-50 dark:bg-[#201a0e] border-2 border-amber-500/70 dark:border-amber-500/60 rounded-2xl p-3 sm:p-3.5 shadow-xl text-amber-950 dark:text-amber-100 flex items-start gap-2.5 transition-all duration-200 animate-in fade-in slide-in-from-top-2"
        >
          <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
            <AlertCircle className="w-4 h-4 animate-bounce" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-black tracking-tight leading-snug truncate">
              MEJA {claim.tableNumber} - {claim.customerName} MENGKLAIM SUDAH BAYAR
            </p>
            <p className="text-[11px] sm:text-xs text-amber-800 dark:text-amber-300 font-medium leading-tight mt-0.5">
              Cek dana masuk <strong className="font-mono">{formatRupiah(claim.amount)}</strong> - Order #{claim.orderCode}
            </p>

            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleViewOrder(claim.orderId)}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Lihat Pesanan</span>
              </button>
              <button
                type="button"
                onClick={() => removeClaim(claim.orderId)}
                className="px-2 py-1 rounded-lg bg-stone-200/80 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => removeClaim(claim.orderId)}
            className="p-1 rounded-lg text-amber-800/60 dark:text-amber-300/60 hover:text-amber-900 dark:hover:text-amber-100 hover:bg-amber-500/10 transition-colors cursor-pointer shrink-0"
            aria-label="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      {remainingCount > 0 && (
        <div className="pointer-events-auto self-center px-3 py-1 rounded-full bg-amber-500 text-white text-[10px] font-black shadow-md uppercase tracking-wider">
          +{remainingCount} klaim bayar lainnya
        </div>
      )}
    </div>
  );
};
