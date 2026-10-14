import { create } from 'zustand';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  duration?: number;
}

interface UiState {
  toasts: ToastMessage[];
  isCartOpen: boolean;
  isSidebarOpen: boolean;
  theme: 'light' | 'dark';

  addToast: (type: ToastMessage['type'], message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  setIsCartOpen: (open: boolean) => void;
  setIsSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem('admin_theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {
    // ignore
  }
  return 'dark'; // Tampilan gelap tetap default
};

const applyThemeToDom = (theme: 'light' | 'dark') => {
  if (typeof document === 'undefined') return;
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  try {
    localStorage.setItem('admin_theme', theme);
  } catch {
    // ignore
  }
};

const initialTheme = getInitialTheme();
applyThemeToDom(initialTheme);

export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],
  isCartOpen: false,
  isSidebarOpen: false,
  theme: initialTheme,

  addToast: (type, message, duration = 3500) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, duration }],
    }));

    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  setIsCartOpen: (open) => set({ isCartOpen: open }),
  setIsSidebarOpen: (open) => set({ isSidebarOpen: open }),

  setTheme: (theme) => {
    applyThemeToDom(theme);
    set({ theme });
  },

  toggleTheme: () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light';
    applyThemeToDom(newTheme);
    set({ theme: newTheme });
  },
}));
