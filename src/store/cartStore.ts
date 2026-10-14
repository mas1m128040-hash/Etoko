import { create } from 'zustand';
import { CartItem } from '../types';
import { STORAGE_KEYS } from '../config/constants';

interface CartState {
  items: CartItem[];
  tableNumber: string;
  customerName: string;
  orderNotes: string;
  lastOrderTime: number;

  setTableNumber: (table: string) => void;
  setCustomerName: (name: string) => void;
  setOrderNotes: (notes: string) => void;
  addItem: (item: Omit<CartItem, 'qty'>, qty?: number, note?: string) => void;
  updateQty: (menuId: string, delta: number) => void;
  setItemQty: (menuId: string, qty: number) => void;
  setItemNote: (menuId: string, note: string) => void;
  removeItem: (menuId: string) => void;
  clearCart: () => void;
  setLastOrderTime: (timestamp: number) => void;

  getTotalQty: () => number;
  getTotalPrice: () => number;
  getCooldownRemainingSeconds: (cooldownSeconds: number) => number;
}

function loadInitialCart(): {
  items: CartItem[];
  tableNumber: string;
  customerName: string;
  lastOrderTime: number;
} {
  try {
    const rawItems = localStorage.getItem(STORAGE_KEYS.CART);
    const rawTable = localStorage.getItem(STORAGE_KEYS.SAVED_TABLE) || '';
    const rawName = localStorage.getItem(STORAGE_KEYS.SAVED_NAME) || '';
    const rawLastTime = localStorage.getItem(STORAGE_KEYS.LAST_ORDER_TIMESTAMP);

    return {
      items: rawItems ? JSON.parse(rawItems) : [],
      tableNumber: rawTable,
      customerName: rawName,
      lastOrderTime: rawLastTime ? parseInt(rawLastTime, 10) : 0,
    };
  } catch {
    return { items: [], tableNumber: '', customerName: '', lastOrderTime: 0 };
  }
}

const initial = loadInitialCart();

export const useCartStore = create<CartState>((set, get) => ({
  items: initial.items,
  tableNumber: initial.tableNumber,
  customerName: initial.customerName,
  orderNotes: '',
  lastOrderTime: initial.lastOrderTime,

  setTableNumber: (table) => {
    localStorage.setItem(STORAGE_KEYS.SAVED_TABLE, table);
    set({ tableNumber: table });
  },

  setCustomerName: (name) => {
    localStorage.setItem(STORAGE_KEYS.SAVED_NAME, name);
    set({ customerName: name });
  },

  setOrderNotes: (notes) => set({ orderNotes: notes }),

  addItem: (menu, qty = 1, note = '') => {
    const current = get().items;
    const existingIndex = current.findIndex((item) => item.menuId === menu.menuId);

    let updated: CartItem[];
    if (existingIndex > -1) {
      updated = [...current];
      const newQty = Math.min(20, updated[existingIndex].qty + qty);
      updated[existingIndex] = {
        ...updated[existingIndex],
        qty: newQty,
        note: note || updated[existingIndex].note,
      };
    } else {
      // Maximum 30 unique items in cart
      if (current.length >= 30) {
        return;
      }
      updated = [
        ...current,
        {
          menuId: menu.menuId,
          name: menu.name,
          price: menu.price,
          qty: Math.min(20, Math.max(1, qty)),
          note: note.slice(0, 100),
        },
      ];
    }

    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(updated));
    set({ items: updated });
  },

  updateQty: (menuId, delta) => {
    const current = get().items;
    const updated = current
      .map((item) => {
        if (item.menuId === menuId) {
          const nextQty = item.qty + delta;
          return nextQty > 0 ? { ...item, qty: Math.min(20, nextQty) } : null;
        }
        return item;
      })
      .filter((item): item is CartItem => item !== null);

    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(updated));
    set({ items: updated });
  },

  setItemQty: (menuId, qty) => {
    const current = get().items;
    if (qty <= 0) {
      get().removeItem(menuId);
      return;
    }
    const updated = current.map((item) =>
      item.menuId === menuId ? { ...item, qty: Math.min(20, qty) } : item
    );
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(updated));
    set({ items: updated });
  },

  setItemNote: (menuId, note) => {
    const current = get().items;
    const updated = current.map((item) =>
      item.menuId === menuId ? { ...item, note: note.slice(0, 100) } : item
    );
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(updated));
    set({ items: updated });
  },

  removeItem: (menuId) => {
    const current = get().items;
    const updated = current.filter((item) => item.menuId !== menuId);
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(updated));
    set({ items: updated });
  },

  clearCart: () => {
    localStorage.removeItem(STORAGE_KEYS.CART);
    set({ items: [], orderNotes: '' });
  },

  setLastOrderTime: (timestamp) => {
    localStorage.setItem(STORAGE_KEYS.LAST_ORDER_TIMESTAMP, String(timestamp));
    set({ lastOrderTime: timestamp });
  },

  getTotalQty: () => {
    return get().items.reduce((sum, item) => sum + item.qty, 0);
  },

  getTotalPrice: () => {
    return get().items.reduce((sum, item) => sum + item.price * item.qty, 0);
  },

  getCooldownRemainingSeconds: (cooldownSeconds) => {
    const last = get().lastOrderTime;
    if (!last) return 0;
    const now = Date.now();
    const elapsed = Math.floor((now - last) / 1000);
    const rem = cooldownSeconds - elapsed;
    return rem > 0 ? rem : 0;
  },
}));
