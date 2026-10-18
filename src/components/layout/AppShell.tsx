import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { SoundGate } from '../alarm/SoundGate';
import { AlarmBanner } from '../alarm/AlarmBanner';
import { NewOrderPopup } from '../alarm/NewOrderPopup';
import { ClaimPaymentPopup } from '../alarm/ClaimPaymentPopup';
import { ToastContainer } from '../ui/Toast';
import { useNewOrderAlarm } from '../../hooks/useNewOrderAlarm';
import { usePaymentClaimNotification } from '../../hooks/usePaymentClaimNotification';
import { useAudioUnlock } from '../../hooks/useAudioUnlock';
import { useWakeLock } from '../../hooks/useWakeLock';
import { useUiStore } from '../../store/uiStore';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  enableWakeLock?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  title = 'SMART RESTAURANT POS',
  enableWakeLock = true,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useAudioUnlock();
  const { newOrders, acceptSingleOrder, acceptAllNewOrders } = useNewOrderAlarm();
  usePaymentClaimNotification();
  const { isActive: wakeLockActive } = useWakeLock(enableWakeLock);
  const { theme } = useUiStore();

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="min-h-screen bg-stone-100 dark:bg-[#0A0A0A] text-stone-900 dark:text-stone-100 flex flex-col antialiased">
        {/* Sound Gate (Handles Browser Autoplay & AudioContext state) */}
        <SoundGate />

        {/* Global Alarm Banner */}
        <AlarmBanner
          newOrdersCount={newOrders.length}
          onViewNewOrders={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        <div className="flex-1 flex">
          {/* Sidebar */}
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
            <TopBar
              onToggleSidebar={() => setSidebarOpen(true)}
              title={title}
              wakeLockActive={wakeLockActive}
            />

            <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
              {children}
            </main>
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <BottomNav />

        {/* Floating Realtime Claim Payment Popup */}
        <ClaimPaymentPopup />

        {/* Fullscreen Realtime New Order Popup */}
        <NewOrderPopup
          orders={newOrders}
          onAcceptSingle={acceptSingleOrder}
          onAcceptAll={acceptAllNewOrders}
        />

        {/* Toast Notifications */}
        <ToastContainer />
      </div>
    </div>
  );
};
