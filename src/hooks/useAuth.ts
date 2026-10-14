import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { UserProfile, UserRole } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(authService.getCurrentUser());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser && !currentUser.isAnonymous) {
        try {
          const prof = await userService.getUserProfile(currentUser.uid);
          if (!prof) {
            // Profile not found in users collection
            setError('Profil admin belum terdaftar di sistem.');
            await authService.signOutUser();
            setProfile(null);
          } else if (!prof.active) {
            // Deactivated
            setError('Akun admin Anda dinonaktifkan.');
            await authService.signOutUser();
            setProfile(null);
          } else {
            setProfile(prof);
            setError(null);
          }
        } catch (err: any) {
          console.warn('Gagal memuat profil pengguna dari Firestore:', err?.message);
          setProfile(null);
        }
      } else {
        setProfile(null);
        setError(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, pass: string) => {
    setError(null);
    setLoading(true);
    try {
      const u = await authService.signInStaff(email, pass);
      const prof = await userService.getUserProfile(u.uid);
      if (!prof) {
        await authService.signOutUser();
        throw new Error('Akun admin tidak ditemukan dalam basis data pengguna Firestore.');
      }
      if (!prof.active) {
        await authService.signOutUser();
        throw new Error('Akun admin ini telah dinonaktifkan.');
      }
      setProfile(prof);
      return prof;
    } catch (err: any) {
      const msg =
        err?.code === 'auth/invalid-credential' ||
        err?.code === 'auth/user-not-found' ||
        err?.code === 'auth/wrong-password'
          ? 'Email atau kata sandi tidak valid.'
          : err?.message || 'Gagal masuk.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const registerAdmin = async (name: string, email: string, pass: string) => {
    setError(null);
    setLoading(true);
    try {
      const prof = await authService.registerInitialAdmin(name, email, pass);
      setProfile(prof);
      return prof;
    } catch (err: any) {
      console.error('[Register Admin Error]', err);
      const msg = err?.message || 'Gagal mendaftarkan akun admin.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await authService.signOutUser();
    setUser(null);
    setProfile(null);
  };

  return {
    user,
    profile,
    role: profile?.role as UserRole | undefined,
    isAdmin: profile?.role === 'ADMIN',
    loading,
    error,
    signIn,
    registerAdmin,
    signOut,
  };
}
