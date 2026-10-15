import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RouteGuard } from './RouteGuard';

// Direct imports: eliminates "Failed to fetch dynamically imported module" entirely,
// prevents white screens on new deployments, and gives instant page transitions.
import { MenuPage } from '../pages/customer/MenuPage';
import { CheckoutPage } from '../pages/customer/CheckoutPage';
import { OrderStatusPage } from '../pages/customer/OrderStatusPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { DashboardPage } from '../pages/admin/DashboardPage';
import { MenuManagePage } from '../pages/admin/MenuManagePage';
import { SettingsPage } from '../pages/admin/SettingsPage';
import { TableQrPage } from '../pages/admin/TableQrPage';

export const AppRoutes: React.FC = () => {
  return (
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
  );
};
