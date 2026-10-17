import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  query,
  where,
  getDocs,
  getDocsFromServer,
  getDoc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaidMethodFinal,
} from '../types';
import { getDateKeyJakarta, formatOrderCode } from '../lib/formatters';
import { isValidStatusTransition } from '../lib/statusRules';

const ORDERS_COL = 'orders';
const COUNTERS_COL = 'counters';

export interface CreateOrderParams {
  customerName: string;
  tableNumber: string;
  customerUid: string;
  paymentMethod: PaymentMethod;
  items: OrderItem[];
  notes?: string;
  useUniqueCode?: boolean;
}

export const orderService = {
  /**
   * Cek apakah customer memiliki pesanan aktif yang belum lunas dan belum dibatalkan
   * Mengutamakan data langsung dari server agar tidak membaca cache basi
   */
  async checkActiveUnpaidOrder(customerUid: string): Promise<Order | null> {
    if (!customerUid) return null;
    const q = query(
      collection(db, ORDERS_COL),
      where('customerUid', '==', customerUid),
      where('paymentStatus', '==', 'BELUM_BAYAR')
    );
    try {
      const snap = await getDocsFromServer(q);
      const unpaid = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Order))
        .filter((o) => o.status !== 'DIBATALKAN');

      return unpaid.length > 0 ? unpaid[0] : null;
    } catch {
      const snap = await getDocs(q);
      const unpaid = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Order))
        .filter((o) => o.status !== 'DIBATALKAN');

      return unpaid.length > 0 ? unpaid[0] : null;
    }
  },

  /**
   * Cek apakah ada pesanan aktif (BARU / DITERIMA) pada meja-meja tertentu
   */
  async getActiveOrdersForTables(tableNumbers: string[]): Promise<Order[]> {
    if (!tableNumbers || tableNumbers.length === 0) return [];
    const dateKey = getDateKeyJakarta(new Date());
    const q = query(
      collection(db, ORDERS_COL),
      where('dateKey', '==', dateKey)
    );
    const snap = await getDocs(q);
    const targetSet = new Set(tableNumbers);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Order))
      .filter(
        (o) =>
          targetSet.has(String(o.tableNumber)) &&
          (o.status === 'BARU' || o.status === 'DITERIMA')
      );
  },

  /**
   * Atomic checkout transaction on real Firestore:
   * 1. Cek pencegahan 1 pesanan belum lunas per customer
   * 2. Reads counters/{dateKey}
   * 3. Increments lastNumber by 1
   * 4. Menghitung uniqueCode dan payableAmount
   * 5. Creates new order document
   */
  async createOrder(params: CreateOrderParams, clientOrderId?: string): Promise<Order> {
    const dateKey = getDateKeyJakarta(new Date());
    const counterRef = doc(db, COUNTERS_COL, dateKey);

    // Buat id dokumen pesanan di klien SEBELUM transaksi dimulai (mencegah duplikasi saat retry)
    const orderId = clientOrderId || doc(collection(db, ORDERS_COL)).id;
    const orderRef = doc(db, ORDERS_COL, orderId);

    // Validate params
    if (!params.customerName.trim()) {
      throw new Error('Nama pelanggan wajib diisi.');
    }
    if (!params.tableNumber.trim()) {
      throw new Error('Nomor meja wajib dipilih.');
    }
    if (!params.customerUid) {
      throw new Error('Sesi pelanggan tidak valid. Mohon muat ulang halaman.');
    }
    if (!params.items || params.items.length === 0) {
      throw new Error('Keranjang belanja kosong.');
    }
    if (params.items.length > 30) {
      throw new Error('Maksimal 30 jenis menu per pesanan.');
    }

    // Pencegahan: Cek apakah ada pesanan belum lunas yang masih aktif
    const existingUnpaid = await this.checkActiveUnpaidOrder(params.customerUid);
    if (existingUnpaid) {
      throw new Error(
        `Selesaikan pembayaran pesanan #${existingUnpaid.orderCode} dulu sebelum membuat pesanan baru.`
      );
    }

    const calculatedTotal = params.items.reduce(
      (sum, item) => sum + item.price * item.qty,
      0
    );

    let lastError: any = null;
    const maxRetries = 5;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const createdOrder = await runTransaction(db, async (tx) => {
          // Cek idempotensi: jika orderId sudah dibuat pada percobaan sebelumnya
          const existingSnap = await tx.get(orderRef);
          if (existingSnap.exists()) {
            return {
              id: orderRef.id,
              ...existingSnap.data(),
            } as Order;
          }

          const counterSnap = await tx.get(counterRef);
          let nextNumber = 1;
          if (counterSnap.exists()) {
            const currentLast = counterSnap.data().lastNumber;
            if (typeof currentLast === 'number') {
              nextNumber = currentLast + 1;
            }
          }

          const orderCode = formatOrderCode(nextNumber);

          // Hitung kode unik jika QRIS / TRANSFER dan opsi aktif
          let uniqueCode = 0;
          let payableAmount = calculatedTotal;

          if (params.paymentMethod === 'QRIS' || params.paymentMethod === 'TRANSFER') {
            if (params.useUniqueCode !== false) {
              uniqueCode = (nextNumber % 99) + 1;
              payableAmount = calculatedTotal + uniqueCode;
            }
          }

          const newOrderPayload: Omit<Order, 'id'> = {
            orderNumber: nextNumber,
            orderCode,
            dateKey,
            customerName: params.customerName.trim().slice(0, 50),
            tableNumber: params.tableNumber.trim(),
            customerUid: params.customerUid,
            items: params.items.map((i) => ({
              menuId: i.menuId,
              name: i.name,
              price: i.price,
              qty: Math.min(20, Math.max(1, i.qty)),
              note: (i.note || '').slice(0, 100),
            })),
            totalPrice: calculatedTotal,
            notes: (params.notes || '').slice(0, 300),
            status: 'BARU',
            paymentMethod: params.paymentMethod,
            uniqueCode,
            payableAmount,
            paymentStatus: 'BELUM_BAYAR',
            customerClaimedPaid: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          tx.set(counterRef, { lastNumber: nextNumber }, { merge: true });
          tx.set(orderRef, newOrderPayload);

          return {
            id: orderRef.id,
            ...newOrderPayload,
          } as Order;
        });

        return createdOrder;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Order Transaction Attempt ${attempt} failed]:`, err?.code || err?.message);

        // Jika gagal karena benturan, coba ulang otomatis sampai 5 kali dengan jeda acak 200 sampai 800 ms
        if (attempt < maxRetries) {
          const jitterMs = Math.floor(Math.random() * (800 - 200 + 1)) + 200;
          await new Promise((resolve) => setTimeout(resolve, jitterMs));
        }
      }
    }

    throw new Error(
      'Terjadi kendala saat mengirim pesanan. Keranjang Anda tetap aman, silakan coba lagi.'
    );
  },

  /**
   * Pelanggan mengeklik tombol "Saya Sudah Bayar"
   */
  async claimPaid(orderId: string, customerUid: string): Promise<void> {
    const orderRef = doc(db, ORDERS_COL, orderId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists()) throw new Error('Pesanan tidak ditemukan.');
      const data = snap.data() as Order;
      if (data.customerUid !== customerUid) {
        throw new Error('Anda tidak memiliki akses ke pesanan ini.');
      }
      tx.update(orderRef, {
        customerClaimedPaid: true,
        updatedAt: serverTimestamp(),
      });
    });
  },

  /**
   * Admin menandai pesanan lunas
   */
  async markOrderPaid(
    orderId: string,
    paidMethodFinal: PaidMethodFinal,
    staffUser: { uid: string; name: string }
  ): Promise<void> {
    const orderRef = doc(db, ORDERS_COL, orderId);
    await updateDoc(orderRef, {
      paymentStatus: 'LUNAS',
      paidAt: serverTimestamp(),
      paidMethodFinal,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Admin membatalkan pesanan karena tidak membayar
   */
  async cancelUnpaidOrder(
    orderId: string,
    staffUser: { uid: string; name: string }
  ): Promise<void> {
    const orderRef = doc(db, ORDERS_COL, orderId);
    await updateDoc(orderRef, {
      status: 'DIBATALKAN',
      cancelReason: 'Tidak membayar',
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Status transition with validation
   */
  async updateStatusInTransaction(
    orderId: string,
    expectedCurrentStatus: OrderStatus,
    targetStatus: OrderStatus,
    staffUser: { uid: string; name: string },
    cancelReason?: string
  ): Promise<void> {
    if (!isValidStatusTransition(expectedCurrentStatus, targetStatus)) {
      throw new Error(
        `Tidak memiliki izin untuk mengubah status dari ${expectedCurrentStatus} ke ${targetStatus}.`
      );
    }

    const orderRef = doc(db, ORDERS_COL, orderId);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists()) {
        throw new Error('Pesanan tidak ditemukan.');
      }

      const current = snap.data() as Order;
      if (current.status !== expectedCurrentStatus) {
        const who = current.acceptedBy?.name || 'admin lain';
        if (current.status === 'DITERIMA') {
          throw new Error(`Pesanan sudah diterima oleh ${who}`);
        }
        throw new Error(
          `Pesanan sudah diubah menjadi "${current.status}" oleh ${who}.`
        );
      }

      // Validasi: Status SELESAI hanya diizinkan jika pesanan sudah LUNAS
      if (targetStatus === 'SELESAI' && current.paymentStatus !== 'LUNAS') {
        throw new Error(
          'Pesanan belum lunas! Tandai lunas terlebih dahulu sebelum menyelesaikan pesanan.'
        );
      }

      const updateData: any = {
        status: targetStatus,
        updatedAt: serverTimestamp(),
      };

      if (targetStatus === 'DITERIMA') {
        updateData.acceptedAt = serverTimestamp();
        updateData.acceptedBy = { uid: staffUser.uid, name: staffUser.name };
      } else if (targetStatus === 'SELESAI') {
        updateData.completedAt = serverTimestamp();
      } else if (targetStatus === 'DIBATALKAN') {
        updateData.cancelledAt = serverTimestamp();
        if (cancelReason) {
          updateData.cancelReason = cancelReason.slice(0, 200);
        }
      }

      tx.update(orderRef, updateData);
    });
  },

  async acceptAllNewOrders(
    orders: Order[],
    staffUser: { uid: string; name: string }
  ): Promise<void> {
    for (const order of orders) {
      if (order.status === 'BARU') {
        try {
          await this.updateStatusInTransaction(
            order.id,
            'BARU',
            'DITERIMA',
            staffUser
          );
        } catch (err) {
          console.error('[Firestore Error] Gagal menerima order:', order.id, err);
        }
      }
    }
  },

  async completeAllAcceptedOrders(
    orders: Order[],
    staffUser: { uid: string; name: string }
  ): Promise<void> {
    for (const order of orders) {
      if (order.status === 'DITERIMA' && order.paymentStatus === 'LUNAS') {
        try {
          await this.updateStatusInTransaction(
            order.id,
            'DITERIMA',
            'SELESAI',
            staffUser
          );
        } catch (err) {
          console.error('[Firestore Error] Gagal menyelesaikan order:', order.id, err);
        }
      }
    }
  },

  /**
   * Realtime listener untuk single order (digunakan customer di layar status)
   * Mengabaikan data cache lokal lama dan menunggu data terbaru dari server
   */
  subscribeSingleOrder(
    orderId: string,
    callback: (order: Order | null) => void,
    onError?: (error: Error) => void
  ) {
    const orderRef = doc(db, ORDERS_COL, orderId);
    let hasReceivedServerData = false;

    // Timeout fallback agar jika benar-benar offline tetap dapat memunculkan status
    const fallbackTimer = setTimeout(() => {
      hasReceivedServerData = true;
    }, 8000);

    const unsubscribe = onSnapshot(
      orderRef,
      { includeMetadataChanges: true },
      (snap) => {
        const isFromCache = snap.metadata.fromCache;
        const hasPendingWrites = snap.metadata.hasPendingWrites;

        // Jika data dari cache lokal dan belum ada data server yang tiba,
        // tahan dahulu agar riwayat status basi tidak berkedip sesaat sebelum data server masuk
        if (isFromCache && !hasPendingWrites && !hasReceivedServerData) {
          return;
        }

        hasReceivedServerData = true;
        clearTimeout(fallbackTimer);

        if (!snap.exists()) {
          callback(null);
        } else {
          callback({ id: snap.id, ...snap.data() } as Order);
        }
      },
      (error) => {
        clearTimeout(fallbackTimer);
        console.error('[Firestore Error] Gagal memuat pesanan:', error);
        if (onError) onError(error as Error);
      }
    );

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  },

  /**
   * Realtime listener untuk pesanan customer berdasarkan customerUid hari ini
   * Mengabaikan data dari cache lokal dan menunggu server data sebelum menampilkan Pesanan Saya
   */
  subscribeCustomerOrders(
    customerUid: string,
    callback: (orders: Order[]) => void,
    onError?: (error: Error) => void
  ) {
    const dateKey = getDateKeyJakarta(new Date());
    const q = query(
      collection(db, ORDERS_COL),
      where('customerUid', '==', customerUid),
      where('dateKey', '==', dateKey)
    );

    let hasReceivedServerData = false;

    // Timeout fallback jika benar-benar offline
    const fallbackTimer = setTimeout(() => {
      hasReceivedServerData = true;
    }, 8000);

    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const isFromCache = snapshot.metadata.fromCache;
        const hasPendingWrites = snapshot.metadata.hasPendingWrites;

        // Abaikan snapshot dari cache lokal jika server belum merespons
        if (isFromCache && !hasPendingWrites && !hasReceivedServerData) {
          return;
        }

        hasReceivedServerData = true;
        clearTimeout(fallbackTimer);

        const orders = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Order[];

        orders.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return timeB - timeA;
        });

        callback(orders);
      },
      (error) => {
        clearTimeout(fallbackTimer);
        console.error('[Firestore Error] Gagal memuat pesanan pelanggan:', error);
        if (onError) onError(error as Error);
      }
    );

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  },

  /**
   * Realtime listener for today's orders from Firestore (admin)
   */
  subscribeTodayOrders(
    dateKey: string,
    callback: (orders: Order[]) => void,
    onError?: (error: Error) => void
  ) {
    const q = query(
      collection(db, ORDERS_COL),
      where('dateKey', '==', dateKey)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const orders = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Order[];

        orders.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return timeB - timeA;
        });

        callback(orders);
      },
      (error) => {
        console.error('[Firestore Error] Gagal memuat orders hari ini:', error.code, error.message);
        if (onError) onError(error);
      }
    );
  },

  /**
   * Realtime listener for BARU orders for audio alarm & popup
   */
  subscribeNewOrders(
    callback: (orders: Order[]) => void,
    onError?: (error: Error) => void
  ) {
    const q = query(
      collection(db, ORDERS_COL),
      where('status', '==', 'BARU')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const orders = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Order[];

        orders.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return timeA - timeB; // oldest first
        });

        callback(orders);
      },
      (error) => {
        console.error('[Firestore Error] Gagal memuat pesanan baru:', error.code, error.message);
        if (onError) onError(error);
      }
    );
  },
};
