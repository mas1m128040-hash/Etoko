import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
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
    const payload: any = {
      name: data.name.trim(),
      description: data.description ? data.description.trim() : '',
      price: Math.max(1, Math.round(Number(data.price))),
      categoryId: data.categoryId,
      sortOrder: Number(data.sortOrder) || 1,
      available: data.available ?? true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (data.imageData) {
      payload.imageData = data.imageData;
    }
    if (data.imageUrl && data.imageUrl.trim()) {
      payload.imageUrl = data.imageUrl.trim();
    }
    const ref = await addDoc(collection(db, COLLECTION), payload);
    return ref.id;
  },

  async updateMenu(id: string, data: Partial<Menu>): Promise<void> {
    const ref = doc(db, COLLECTION, id);
    const payload: any = {
      updatedAt: serverTimestamp(),
    };
    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.description !== undefined) payload.description = data.description.trim();
    if (data.categoryId !== undefined) payload.categoryId = data.categoryId;
    if (data.sortOrder !== undefined) payload.sortOrder = Number(data.sortOrder) || 1;
    if (data.available !== undefined) payload.available = Boolean(data.available);
    if (data.price !== undefined) {
      payload.price = Math.max(1, Math.round(Number(data.price)));
    }
    if ('imageData' in data) {
      payload.imageData = data.imageData ? data.imageData : deleteField();
    }
    if ('imageUrl' in data) {
      payload.imageUrl = data.imageUrl && data.imageUrl.trim() ? data.imageUrl.trim() : deleteField();
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
