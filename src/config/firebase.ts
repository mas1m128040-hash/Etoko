import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Fallback config from local JSON if available (development preview in AI Studio)
let localConfig: any = {};
try {
  // @ts-ignore
  localConfig = (await import('../../firebase-applet-config.json')).default;
} catch {
  localConfig = {};
}

// 1. Read configuration with strict preference for VITE_FIREBASE_* environment variables (for Vercel deployment)
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || localConfig.apiKey || '';
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || localConfig.authDomain || '';
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || localConfig.projectId || '';
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || localConfig.storageBucket || '';
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || localConfig.messagingSenderId || '';
const appId = import.meta.env.VITE_FIREBASE_APP_ID || localConfig.appId || '';

export const firestoreDatabaseId: string =
  import.meta.env.VITE_FIREBASE_DATABASE_ID ||
  localConfig.firestoreDatabaseId ||
  '(default)';

export const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

// Inisialisasi Firebase App
export const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Inisialisasi Firebase Auth
export const auth: Auth = getAuth(app);

// Inisialisasi Cloud Firestore dengan Database ID yang aktif
export const db: Firestore =
  firestoreDatabaseId && firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firestoreDatabaseId)
    : getFirestore(app);

// Tampilkan Database ID ke console saat start aplikasi
if (typeof window !== 'undefined') {
  console.log(
    `%c[Firebase] Firestore terhubung menggunakan Database ID: ${firestoreDatabaseId || '(default)'} (Project: ${projectId || 'unknown'})`,
    'color: #FF6B1A; font-weight: bold; font-size: 12px;'
  );
}
