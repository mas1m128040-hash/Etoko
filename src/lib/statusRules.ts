import { OrderStatus, UserRole } from '../types';

export interface NextStatusOption {
  status: OrderStatus;
  label: string;
}

export function getNextStatusTransitions(
  currentStatus: OrderStatus
): NextStatusOption[] {
  const transitions: Record<OrderStatus, NextStatusOption[]> = {
    BARU: [
      {
        status: 'DITERIMA',
        label: 'Terima Pesanan',
      },
      {
        status: 'DIBATALKAN',
        label: 'Batalkan Pesanan',
      },
    ],
    DITERIMA: [
      {
        status: 'SELESAI',
        label: 'Selesaikan Pesanan',
      },
      {
        status: 'DIBATALKAN',
        label: 'Batalkan Pesanan',
      },
    ],
    SELESAI: [],
    DIBATALKAN: [],
  };

  return transitions[currentStatus] || [];
}

export function isValidStatusTransition(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  const options = getNextStatusTransitions(from);
  return options.some((opt) => opt.status === to);
}
