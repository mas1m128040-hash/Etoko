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
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Category } from '../types';

const COLLECTION = 'categories';

export const categoryService = {
  async getCategories(): Promise<Category[]> {
    const q = query(collection(db, COLLECTION), orderBy('sortOrder', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
  },

  subscribeCategories(
    callback: (categories: Category[]) => void,
    onError?: (error: Error) => void
  ) {
    const q = query(collection(db, COLLECTION), orderBy('sortOrder', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
        callback(list);
      },
      (error) => {
        console.error('[Firestore Error] Gagal memuat koleksi categories:', error);
        if (onError) onError(error as Error);
      }
    );
  },

  async createCategory(data: Omit<Category, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, COLLECTION), data);
    return ref.id;
  },

  async updateCategory(id: string, data: Partial<Category>): Promise<void> {
    const ref = doc(db, COLLECTION, id);
    await updateDoc(ref, data);
  },

  async deleteCategory(id: string): Promise<void> {
    const ref = doc(db, COLLECTION, id);
    await deleteDoc(ref);
  },
};
