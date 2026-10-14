import React from 'react';
import { VolumeX, BellRing, ArrowRight } from 'lucide-react';
import { useSoundStore } from '../../store/soundStore';
import { formatTimeJakarta } from '../../lib/formatters';

interface AlarmBannerProps {
  newOrdersCount: number;
  onViewNewOrders?: () => void;
}

export const AlarmBanner: React.FC<AlarmBannerProps> = ({
  newOrdersCount,
  onViewNewOrders,
}) => {
  const { isCurrentlyMuted, mutedUntil, unmuteNow } = useSoundStore();
  const muted = isCurrentlyMuted();

  return (
    <div className="flex flex-col">
      {/* Temporary Mute Notice */}
      {muted && mutedUntil && (
        <div className="bg-amber-500 text-stone-900 px-4 py-2 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <VolumeX className="w-4 h-4" />
            <span>
              Suara alarm sedang dimute sementara hingga{' '}
              {formatTimeJakarta(mutedUntil)} WIB.
            </span>
          </div>
          <button
            onClick={unmuteNow}
            className="underline hover:text-stone-950 font-black cursor-pointer"
          >
            Nyalakan Lagi
          </button>
        </div>
      )}

      {/* Pulsing New Orders Counter Banner */}
      {newOrdersCount > 0 && (
        <div
          onClick={onViewNewOrders}
          className="bg-[#FF6B1A] text-white px-4 py-2.5 text-xs sm:text-sm font-black flex items-center justify-between cursor-pointer animate-pulse select-none shadow-md"
        >
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 shrink-0 animate-bounce" />
            <span>
              ADA {newOrdersCount} PESANAN BARU MENUNGGU KONFIRMASI!
            </span>
          </div>
          <span className="flex items-center gap-1 text-xs underline font-bold">
            Lihat Pesanan <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      )}
    </div>
  );
};
