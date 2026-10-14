import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Menu } from '../types';

const COLLECTION = 'menus';

export const menuService = {
  async getMenus(): Promise<Menu[]> {
    const q = query(collection(db, COLLECTION), orderBy('sortOrder', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Menu));
  },

  subscribeMenus(
    callback: (menus: Menu[]) => void,
    onError?: (error: Error) => void
  ) {
    const q = query(collection(db, COLLECTION), orderBy('sortOrder', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Menu));
        callback(list);
      },
      (error) => {
        console.error('[Firestore Error] Gagal memuat koleksi menus:', error);
        if (onError) onError(error as Error);
      }
    );
  },

  async createMenu(data: Omit<Menu, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const payload = {
      ...data,
      price: Math.max(1, Math.round(data.price)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, COLLECTION), payload);
    return ref.id;
  },

  async updateMenu(id: string, data: Partial<Menu>): Promise<void> {
    const ref = doc(db, COLLECTION, id);
    const payload: any = {
      ...data,
      updatedAt: serverTimestamp(),
    };
    if (data.price !== undefined) {
      payload.price = Math.max(1, Math.round(data.price));
    }
    await updateDoc(ref, payload);
  },

  async toggleMenuAvailability(id: string, available: boolean): Promise<void> {
    const ref = doc(db, COLLECTION, id);
    await updateDoc(ref, {
      available,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteMenu(id: string): Promise<void> {
    const ref = doc(db, COLLECTION, id);
    await deleteDoc(ref);
  },
};
