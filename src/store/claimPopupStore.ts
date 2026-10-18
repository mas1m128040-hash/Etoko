import { create } from 'zustand';

export interface PaymentClaimItem {
  orderId: string;
  orderCode: string;
  tableNumber: string;
  customerName: string;
  amount: number;
}

interface ClaimPopupState {
  claims: PaymentClaimItem[];
  addClaim: (claim: PaymentClaimItem) => void;
  removeClaim: (orderId: string) => void;
  clearClaims: () => void;
}

export const useClaimPopupStore = create<ClaimPopupState>((set) => ({
  claims: [],
  addClaim: (claim) =>
    set((state) => {
      if (state.claims.some((c) => c.orderId === claim.orderId)) {
        return state;
      }
      return { claims: [...state.claims, claim] };
    }),
  removeClaim: (orderId) =>
    set((state) => {
      const filtered = state.claims.filter((c) => c.orderId !== orderId);
      if (filtered.length === state.claims.length) {
        return state;
      }
      return { claims: filtered };
    }),
  clearClaims: () => set({ claims: [] }),
}));
