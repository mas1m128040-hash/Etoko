import {
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { UserProfile } from '../types';

export const userService = {
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as UserProfile;
  },
};
