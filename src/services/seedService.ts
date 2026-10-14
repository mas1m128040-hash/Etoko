import { collection, doc, writeBatch, serverTimestamp, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { DEFAULT_SETTINGS } from '../config/constants';

export const seedService = {
  async seedInitialRestaurantData(): Promise<{ categories: number; menus: number }> {
    // 0. Safety check: Pastikan seed tidak pernah menimpa menu yang sudah ada
    const existingMenusSnap = await getDocs(collection(db, 'menus'));
    if (!existingMenusSnap.empty) {
      throw new Error(
        'Koleksi menus sudah memiliki data. Seed dibatalkan untuk mencegah penimpaan atau duplikasi menu.'
      );
    }

    const batch = writeBatch(db);

    // 1. Initial Categories
    const catData = [
      { name: 'Makanan', sortOrder: 1, active: true },
      { name: 'Minuman', sortOrder: 2, active: true },
      { name: 'Snack', sortOrder: 3, active: true },
    ];

    const categoryRefs: Record<string, string> = {};

    for (const cat of catData) {
      const ref = doc(collection(db, 'categories'));
      categoryRefs[cat.name] = ref.id;
      batch.set(ref, cat);
    }

    // 2. Initial Menus with image/food visual tags
    const menuData = [
      {
        name: 'Ayam Geprek',
        description: 'Ayam krispi gurih dengan sambal bawang pedas khas nusantara dan lalapan segar.',
        price: 25000,
        category: 'Makanan',
        sortOrder: 1,
        imageUrl: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&auto=format&fit=crop&q=80',
      },
      {
        name: 'Nasi Goreng Spesial',
        description: 'Nasi goreng harum dengan suwiran ayam, bakso, telur ceplok, dan acar kerupuk.',
        price: 28000,
        category: 'Makanan',
        sortOrder: 2,
        imageUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&auto=format&fit=crop&q=80',
      },
      {
        name: 'Ayam Bakar',
        description: 'Ayam bakar bumbu kecap manis legit meresap hingga ke serat tulang.',
        price: 30000,
        category: 'Makanan',
        sortOrder: 3,
        imageUrl: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&auto=format&fit=crop&q=80',
      },
      {
        name: 'Mie Goreng',
        description: 'Mie telur kenyal dimasak dengan sawi, telur orak-arik, dan bumbu rempah spesial.',
        price: 24000,
        category: 'Makanan',
        sortOrder: 4,
        imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&auto=format&fit=crop&q=80',
      },
      {
        name: 'Es Teh Manis',
        description: 'Teh melati seduh segar dengan gula pasir asli dan es batu dingin melegakan.',
        price: 6000,
        category: 'Minuman',
        sortOrder: 1,
        imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80',
      },
      {
        name: 'Es Jeruk',
        description: 'Perasan jeruk peras manis asli kaya vitamin C yang segar alami.',
        price: 8000,
        category: 'Minuman',
        sortOrder: 2,
        imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600&auto=format&fit=crop&q=80',
      },
      {
        name: 'Kopi Susu',
        description: 'Espresso robusta mantap berpadu susu kental manis dan gula aren gurih.',
        price: 15000,
        category: 'Minuman',
        sortOrder: 3,
        imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600&auto=format&fit=crop&q=80',
      },
      {
        name: 'Kentang Goreng',
        description: 'French fries renyah keemasan dibumbui garam laut gurih dan saus sambal.',
        price: 15000,
        category: 'Snack',
        sortOrder: 1,
        imageUrl: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&auto=format&fit=crop&q=80',
      },
    ];

    for (const menu of menuData) {
      const ref = doc(collection(db, 'menus'));
      const catId = categoryRefs[menu.category] || '';
      batch.set(ref, {
        name: menu.name,
        description: menu.description,
        price: menu.price,
        categoryId: catId,
        imageUrl: menu.imageUrl,
        available: true,
        sortOrder: menu.sortOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 3. Initial Settings (hanya jika dokumen settings/restaurant belum ada)
    const settingsRef = doc(db, 'settings', 'restaurant');
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      batch.set(settingsRef, {
        ...DEFAULT_SETTINGS,
        name: 'Resto Contoh',
        totalTables: 10,
        kitchenWarnMinutes: 10,
        kitchenLateMinutes: 20,
      });
    }

    await batch.commit();

    return {
      categories: catData.length,
      menus: menuData.length,
    };
  },

  async isDatabaseSeeded(): Promise<boolean> {
    const snap = await getDocs(collection(db, 'menus'));
    return !snap.empty;
  },
};
