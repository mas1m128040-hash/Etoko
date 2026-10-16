import React from 'react';
import { OrderStatus } from '../../types';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../config/constants';

interface StatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const config = ORDER_STATUS_COLORS[status] || {
    bg: 'bg-stone-500/10',
    text: 'text-stone-500',
    border: 'border-stone-500',
    badge: 'bg-stone-500 text-white',
  };

  const isBaru = status === 'BARU';

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 rounded-md font-bold tracking-wide',
    md: 'text-xs px-2.5 py-1 rounded-lg font-bold tracking-wide',
    lg: 'text-sm px-3.5 py-1.5 rounded-xl font-bold tracking-wider',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-semibold whitespace-nowrap shrink-0 ${
        config.bg
      } ${config.text} ${config.border} ${sizeClasses[size]} ${
        isBaru ? 'animate-pulse ring-2 ring-orange-500/30' : ''
      } ${className}`}
    >
      {isBaru && (
        <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B1A] animate-ping shrink-0" />
      )}
      <span className="whitespace-nowrap">{ORDER_STATUS_LABELS[status] || status}</span>
    </span>
  );
};
