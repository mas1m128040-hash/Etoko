# Smart Restaurant POS & Self-Ordering System

Aplikasi Kasir (POS) dan Pemesanan Mandiri Meja Restoran (QR Menu) berbasis React, Tailwind CSS, dan Firebase Firestore realtime.

## 🚀 Panduan Deploy ke Vercel

### 1. Hubungkan Repository ke Vercel
1. Masuk ke [Vercel Dashboard](https://vercel.com).
2. Buat project baru dan import repositori ini.
3. Framework Preset: **Vite** (Otomatis terdeteksi).
4. Build Command: `npm run build`
5. Output Directory: `dist`

### 2. Environment Variables di Vercel
Tambahkan variabel berikut pada menu **Settings > Environment Variables** di Vercel:

| Nama Variabel | Keterangan / Sumber | Contoh Nilai |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Console > Project Settings > General | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth Domain Firebase | `project-id.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Project ID Firebase | `project-id` |
| `VITE_FIREBASE_STORAGE_BUCKET`| Storage Bucket Firebase | `project-id.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID Firebase | `123456789012` |
| `VITE_FIREBASE_APP_ID` | Web App ID Firebase | `1:123456789012:web:abcdef...` |
| `VITE_FIREBASE_DATABASE_ID` | ID Database Firestore *(Gunakan `(default)` atau ID khusus)* | `(default)` |

*(Semua konfigurasi dibaca murni melalui environment variable `VITE_FIREBASE_*`, tanpa ketergantungan pada berkas konfigurasi lokal atau kunci AI).*

### 3. Pengaturan Firebase Console
Pastikan fitur-fitur berikut aktif di Firebase Console proyek Anda:
1. **Authentication**:
   - Tab **Sign-in method** > Aktifkan **Anonymous** (untuk pelanggan).
   - Aktifkan **Email/Password** (untuk akun Admin).
2. **Authorized Domains**:
   - Di tab **Settings** pada Authentication, tambahkan domain Vercel Anda (misal `nama-aplikasi.vercel.app`).
3. **Firestore Database**:
   - Database mode Production atau Test.
   - Aturan keamanan terpasang sesuai `firestore.rules`.
