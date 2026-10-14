import { useCartStore } from '../store/cartStore';

export function useCart() {
  const store = useCartStore();

  return {
    ...store,
    totalQty: store.getTotalQty(),
    totalPrice: store.getTotalPrice(),
  };
}
