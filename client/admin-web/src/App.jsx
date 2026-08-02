import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import RequireAdmin from './routes/RequireAdmin.jsx';
import AdminLayout from './components/layout/AdminLayout.jsx';
import Spinner from './components/common/Spinner.jsx';

const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const LiveBoardPage = lazy(() => import('./pages/LiveBoardPage.jsx'));
const RotaPage = lazy(() => import('./pages/RotaPage.jsx'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage.jsx'));
const ServiceUsersPage = lazy(() => import('./pages/ServiceUsersPage.jsx'));
const ExceptionsPage = lazy(() => import('./pages/ExceptionsPage.jsx'));
const TimesheetsPage = lazy(() => import('./pages/TimesheetsPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));

export default function App() {
  return (
    <Suspense fallback={<Spinner fullscreen />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="/board" element={<LiveBoardPage />} />
          <Route path="/rota" element={<RotaPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/service-users" element={<ServiceUsersPage />} />
          <Route path="/exceptions" element={<ExceptionsPage />} />
          <Route path="/timesheets" element={<TimesheetsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
