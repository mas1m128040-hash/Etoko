export type UserRole = 'ADMIN';

export interface UserProfile {
  id: string; // Auth UID
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt?: any;
  createdBy: string;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
}

export interface Menu {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  imageUrl?: string;
  imageData?: string; // Base64 data URL JPEG (lebar maks 480px, <80KB target)
  available: boolean;
  sortOrder: number;
  createdAt?: any;
  updatedAt?: any;
}

export type OrderStatus = 'BARU' | 'DITERIMA' | 'SELESAI' | 'DIBATALKAN';

export type PaymentMethod = 'QRIS' | 'TRANSFER' | 'DI_MEJA';
export type PaymentStatus = 'BELUM_BAYAR' | 'LUNAS';
export type PaidMethodFinal = 'TUNAI' | 'QRIS' | 'TRANSFER';

export interface OrderItem {
  menuId: string;
  name: string;
  price: number;
  qty: number;
  note?: string;
}

export interface OrderAcceptedBy {
  uid: string;
  name: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  orderCode: string; // "001"
  dateKey: string; // "YYYY-MM-DD"
  customerName: string;
  tableNumber: string;
  customerUid: string; // UID pelanggan anonim pembuat
  items: OrderItem[];
  totalPrice: number;
  notes?: string;
  status: OrderStatus;
  // Detail Pembayaran
  paymentMethod: PaymentMethod;
  uniqueCode: number;
  payableAmount: number;
  paymentStatus: PaymentStatus;
  paidAt?: any;
  paidMethodFinal?: PaidMethodFinal;
  customerClaimedPaid: boolean;
  cancelReason?: string;
  createdAt: any;
  acceptedAt?: any;
  completedAt?: any;
  cancelledAt?: any;
  acceptedBy?: OrderAcceptedBy;
  updatedAt?: any;
}

export interface Counter {
  lastNumber: number;
}

export type AlarmTone =
  | 'DEFAULT'
  | 'SIRENE_CEPAT'
  | 'BEL_PANIK'
  | 'TELEPON'
  | 'TIGA_BIP'
  | 'PESANAN_DATANG'
  | 'KLAKSON_PENDEK';

export type AlarmMode = 'NADA' | 'SUARA' | 'NADA_LALU_SUARA';

export interface Settings {
  name: string;
  totalTables: number;
  timezone: string;
  orderCooldownSeconds: number;
  appUrl?: string; // Alamat URL aplikasi aktif untuk QR Meja
  // Pengaturan Pembayaran
  qrisPayload?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  payLaterMaxAmount: number;
  requirePrepayAll: boolean;
  paymentTimeoutMinutes: number;
  useUniqueCode: boolean;
  // Pengaturan Alarm & Suara
  alarmTone: AlarmTone;
  alarmMode: AlarmMode;
  alarmVoiceText: string;
  paymentVoiceText?: string;
  readyVoiceText?: string;
}

export interface CartItem extends OrderItem {
  maxQty?: number;
}

export interface DailyStats {
  id?: string;
  dateKey: string; // "YYYY-MM-DD"
  orderCount: number;
  paidCount: number;
  revenue: number; // total totalPrice pesanan LUNAS (tanpa kode unik)
  cashIn: number; // total payableAmount pesanan LUNAS
  byMethod: {
    TUNAI: number;
    QRIS: number;
    TRANSFER: number;
  };
  cancelledCount: number;
  unpaidCount: number;
  unpaidAmount: number;
  topItems: Record<string, number>; // nama menu -> qty terjual
  updatedAt?: any;
}
