import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Utensils, QrCode, Settings } from 'lucide-react';
import { useNewOrderAlarm } from '../../hooks/useNewOrderAlarm';

export const BottomNav: React.FC = () => {
  const { newOrdersCount } = useNewOrderAlarm();

  const links = [
    {
      to: '/admin',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      badge: newOrdersCount,
    },
    {
      to: '/admin/menus',
      label: 'Menu',
      icon: <Utensils className="w-5 h-5" />,
    },
    {
      to: '/admin/qr',
      label: 'QR Meja',
      icon: <QrCode className="w-5 h-5" />,
    },
    {
      to: '/admin/settings',
      label: 'Setelan',
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#141414]/95 backdrop-blur-md border-t border-stone-200 dark:border-stone-800 pb-safe">
      <div className="flex items-center justify-around px-2 py-1.5">
        {links.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all relative ${
                isActive
                  ? 'text-[#FF6B1A] font-bold'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800'
              }`
            }
          >
            <div className="relative">
              {item.icon}
              {item.badge && item.badge > 0 ? (
                <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 text-[10px] font-black rounded-full bg-[#FF6B1A] text-white animate-pulse">
                  {item.badge}
                </span>
              ) : null}
            </div>
            <span className="text-[10px] mt-1">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
