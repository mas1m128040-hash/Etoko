import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged as onFirebaseAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { UserProfile } from '../types';

export const authService = {
  async signInStaff(email: string, pass: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), pass);
    return cred.user;
  },

  async registerInitialAdmin(name: string, email: string, pass: string): Promise<UserProfile> {
    const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), pass);
    const profileData: Omit<UserProfile, 'id'> = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: 'ADMIN',
      active: true,
      createdBy: 'self_init',
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', cred.user.uid), profileData);
    return {
      id: cred.user.uid,
      ...profileData,
    };
  },

  async signInCustomerAnon(): Promise<User> {
    if (auth.currentUser) {
      return auth.currentUser;
    }
    // Check if auth is already resolving a stored session, or create anonymous session
    return new Promise((resolve, reject) => {
      let settled = false;
      const unsubscribe = onFirebaseAuthStateChanged(auth, async (user) => {
        if (settled) return;
        if (user) {
          settled = true;
          unsubscribe();
          resolve(user);
        } else {
          try {
            const cred = await signInAnonymously(auth);
            settled = true;
            unsubscribe();
            resolve(cred.user);
          } catch (err) {
            settled = true;
            unsubscribe();
            reject(err);
          }
        }
      });
    });
  },

  async signOutUser(): Promise<void> {
    await signOut(auth);
  },

  getCurrentUser(): User | null {
    return auth.currentUser;
  },

  onAuthStateChanged(callback: (user: User | null) => void) {
    return onFirebaseAuthStateChanged(auth, callback);
  },
};
