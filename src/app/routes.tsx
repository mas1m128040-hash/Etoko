import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RouteGuard } from './RouteGuard';

// Lazy loading per route
const MenuPage = lazy(() =>
  import('../pages/customer/MenuPage').then((m) => ({ default: m.MenuPage }))
);
const CheckoutPage = lazy(() =>
  import('../pages/customer/CheckoutPage').then((m) => ({ default: m.CheckoutPage }))
);
const OrderStatusPage = lazy(() =>
  import('../pages/customer/OrderStatusPage').then((m) => ({ default: m.OrderStatusPage }))
);

const LoginPage = lazy(() =>
  import('../pages/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);

const DashboardPage = lazy(() =>
  import('../pages/admin/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const MenuManagePage = lazy(() =>
  import('../pages/admin/MenuManagePage').then((m) => ({ default: m.MenuManagePage }))
);
const SettingsPage = lazy(() =>
  import('../pages/admin/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const TableQrPage = lazy(() =>
  import('../pages/admin/TableQrPage').then((m) => ({ default: m.TableQrPage }))
);

const RouteLoading: React.FC = () => (
  <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex items-center justify-center">
    <div className="w-8 h-8 border-3 border-[#FF6B1A] border-t-transparent rounded-full animate-spin" />
  </div>
);

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        {/* Customer Self-Ordering Routes */}
        <Route path="/" element={<Navigate to="/menu" replace />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order/:orderId" element={<OrderStatusPage />} />

        {/* Staff Authentication */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Staff: Admin Only */}
        <Route
          path="/admin"
          element={
            <RouteGuard allowedRoles={['ADMIN']}>
              <DashboardPage />
            </RouteGuard>
          }
        />
        <Route
          path="/admin/menus"
          element={
            <RouteGuard allowedRoles={['ADMIN']}>
              <MenuManagePage />
            </RouteGuard>
          }
        />
        <Route
          path="/admin/qr"
          element={
            <RouteGuard allowedRoles={['ADMIN']}>
              <TableQrPage />
            </RouteGuard>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <RouteGuard allowedRoles={['ADMIN']}>
              <SettingsPage />
            </RouteGuard>
          }
        />

        {/* Catch all fallback */}
        <Route path="*" element={<Navigate to="/menu" replace />} />
      </Routes>
    </Suspense>
  );
};
