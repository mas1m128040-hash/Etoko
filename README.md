# Smart Restaurant POS & Self-Ordering System

Aplikasi Kasir (POS) dan Pemesanan Mandiri Meja Restoran (QR Menu) berbasis React, Tailwind CSS, dan Firebase Firestore realtime.

---

## 🏪 Cara Memasang untuk Toko Baru (Toko Kedua / Multi-Outlet)

Untuk memasang sistem ini di toko atau cabang baru dengan database terpisah:

### Langkah 1: Buat Proyek Firebase Baru
1. Kunjungi [Firebase Console](https://console.firebase.google.com) dan klik **Add project** (Tambah proyek).
2. Beri nama proyek sesuai nama toko baru (misal: `resto-cabang-bandung`).
3. Matikan Google Analytics jika tidak diperlukan, lalu klik **Create project**.

### Langkah 2: Daftarkan Web App & Ambil Kunci Konfigurasi
1. Pada halaman ikhtisar proyek, klik ikon **Web (`</>`)** untuk mendaftarkan aplikasi web.
2. Beri nama aplikasi (misal: `Web POS Cabang Bandung`).
3. Salin nilai konfigurasi Firebase yang muncul:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

### Langkah 3: Aktifkan Firebase Authentication
1. Di bilah menu kiri Firebase Console, buka **Build > Authentication**, lalu klik **Get started**.
2. Di tab **Sign-in method**, aktifkan 2 penyedia:
   - **Email/Password**: Aktifkan (digunakan untuk login Staf & Admin).
   - **Anonymous**: Aktifkan (digunakan untuk pelanggan meja memesan tanpa akun).
3. Di tab **Settings > Authorized domains**, tambahkan domain hosting Anda (misal: `toko-baru.vercel.app` atau `localhost`).

### Langkah 4: Aktifkan Cloud Firestore Database
1. Buka **Build > Firestore Database**, lalu klik **Create database**.
2. Pilih lokasi region terdekat (misal: `asia-southeast2` Jakarta).
3. Biarkan database ID sebagai `(default)`.
4. Buka tab **Rules**, salin seluruh isi berkas `firestore.rules` dari repositori ini, tempelkan, lalu klik **Publish**.

### Langkah 5: Cara Membuat Akun Admin Pertama
1. Buka Firebase Console > **Authentication** > tab **Users**.
2. Klik **Add user**, masukkan Email dan Password admin baru (misal: `admin@tokobaru.com` dan kata sandi aman).
3. Salin nilai **User UID** pengguna yang baru saja dibuat tersebut.
4. Buka **Firestore Database** > tab **Data** > klik **Start collection**:
   - Collection ID: `users`
   - Document ID: Masukkan **User UID** yang tadi disalin.
   - Tambahkan field:
     - `role`: string = `ADMIN`
     - `name`: string = `Nama Admin Toko`
     - `email`: string = `admin@tokobaru.com`
     - `active`: boolean = `true`
     - `createdAt`: timestamp (pilih waktu saat ini)
     - `updatedAt`: timestamp (pilih waktu saat ini)
5. Simpan dokumen. Sekarang akun tersebut resmi menjadi Admin aktif dengan hak akses penuh ke portal `/login` dan `/admin`.

### Langkah 6: Atur Variabel Lingkungan (.env atau Vercel)
Isi environment variable berikut pada hosting baru Anda (atau berkas `.env` lokal):

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=resto-cabang-bandung.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=resto-cabang-bandung
VITE_FIREBASE_STORAGE_BUCKET=resto-cabang-bandung.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef...
VITE_FIREBASE_DATABASE_ID=(default)
```

> **Catatan**: Jika `VITE_FIREBASE_DATABASE_ID` dikosongkan atau tidak diisi, sistem otomatis menggunakan database `(default)`.
> Nama restoran di halaman pelanggan dan bilah admin akan otomatis terbaca dari dokumen `settings/restaurant` di Firestore yang dapat diubah kapan saja di menu **Admin > Pengaturan**.

---

## 🚀 Panduan Deploy ke Vercel

### 1. Hubungkan Repository ke Vercel
1. Masuk ke [Vercel Dashboard](https://vercel.com).
2. Buat project baru dan import repositori ini.
3. Framework Preset: **Vite** (Otomatis terdeteksi).
4. Build Command: `npm run build`
5. Output Directory: `dist`

### 2. Environment Variables di Vercel
Tambahkan variabel `VITE_FIREBASE_*` pada menu **Settings > Environment Variables** di Vercel sesuai tabel di atas.

---

## 📋 Fitur Utama
1. **Pemesanan Mandiri Meja (QR Menu)**: Tanpa registrasi (login anonim otomatis), filter kategori otomatis, pencegahan pesanan ganda.
2. **Katalog & Gambar Menu**: Kompresi gambar canvas di browser (<80 KB) disimpan langsung di Firestore, bebas batasan harga kelipatan, lazy load & placeholder icon.
3. **Pembayaran Fleksibel**:
   - Dynamic QRIS dibuat langsung di browser (CRC16-CCITT) dengan batas waktu.
   - Transfer Bank dengan tombol salin rekening & nominal unik.
   - Bayar di Meja saat diantar.
4. **Alarm Pesanan Baru**: Web Audio API tanpa file eksternal (6 variasi nada) & Web Speech API Bahasa Indonesia (terbilang rupiah & angka biasa). Alarm berbunyi berulang hingga staf menekan "Terima Pesanan".
5. **Mode Gelap & Terang**: 1-ketuk bergantian untuk portal admin dengan penyimpanan preferensi di localStorage.
