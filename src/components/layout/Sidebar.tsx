import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Utensils,
  Settings as SettingsIcon,
  QrCode,
  ExternalLink,
  X,
} from 'lucide-react';
import { useNewOrderAlarm } from '../../hooks/useNewOrderAlarm';
import { useSettings } from '../../hooks/useSettings';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { newOrdersCount } = useNewOrderAlarm();
  const { restaurantName } = useSettings();

  // 4 admin menus only: Dashboard POS, Kelola Menu, Pengaturan, Cetak QR Meja
  const links = [
    {
      to: '/admin',
      label: 'Dashboard POS',
      icon: <LayoutDashboard className="w-5 h-5" />,
      badgeCount: newOrdersCount,
    },
    {
      to: '/admin/menus',
      label: 'Kelola Menu',
      icon: <Utensils className="w-5 h-5" />,
    },
    {
      to: '/admin/qr',
      label: 'Cetak QR Meja',
      icon: <QrCode className="w-5 h-5" />,
    },
    {
      to: '/admin/settings',
      label: 'Pengaturan',
      icon: <SettingsIcon className="w-5 h-5" />,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer / Column */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white dark:bg-[#121212] border-r border-stone-200 dark:border-stone-800 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-stone-100 dark:border-stone-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FF6B1A] flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-stone-900 dark:text-white tracking-tight truncate max-w-[140px]" title={restaurantName}>
                {restaurantName}
              </h2>
              <span className="text-[10px] font-bold text-[#FF6B1A] uppercase tracking-wider">
                Admin Portal
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg"
            aria-label="Tutup navigasi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links (Admin Only) */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-[#FF6B1A] text-white shadow-md shadow-orange-500/20'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800/80'
                }`
              }
            >
              <div className="flex items-center gap-3">
                {item.icon}
                <span>{item.label}</span>
              </div>

              {item.badgeCount && item.badgeCount > 0 ? (
                <span className="px-2 py-0.5 text-xs font-black rounded-full bg-white text-[#FF6B1A] shadow-sm animate-pulse">
                  {item.badgeCount}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        {/* Customer View Link Button */}
        <div className="p-4 border-t border-stone-100 dark:border-stone-800">
          <a
            href="#/menu?table=1"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold bg-stone-100 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 hover:bg-orange-50 hover:text-[#FF6B1A] dark:hover:bg-orange-950/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              <span>Buka Menu Meja (QR)</span>
            </div>
            <span className="text-[10px] bg-stone-200 dark:bg-stone-700 px-1.5 py-0.5 rounded">
              Tab Baru
            </span>
          </a>
        </div>
      </aside>
    </>
  );
};
