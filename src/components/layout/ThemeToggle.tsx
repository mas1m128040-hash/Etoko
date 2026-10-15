import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, toggleTheme } = useUiStore();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl transition-all cursor-pointer ${
        theme === 'dark'
          ? 'text-amber-400 hover:bg-stone-800'
          : 'text-stone-700 hover:bg-stone-100'
      } ${className}`}
      title={theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
      aria-label={theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5 text-amber-400 transition-transform active:rotate-45" />
      ) : (
        <Moon className="w-5 h-5 text-stone-700 transition-transform active:-rotate-12" />
      )}
    </button>
  );
};
