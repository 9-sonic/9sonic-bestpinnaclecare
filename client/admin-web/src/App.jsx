import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import RequireAdmin from './routes/RequireAdmin.jsx';
import AdminLayout from './components/layout/AdminLayout.jsx';
import Spinner from './components/common/Spinner.jsx';

const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const SetPasswordPage = lazy(() => import('./pages/SetPasswordPage.jsx'));
const LiveBoardPage = lazy(() => import('./pages/LiveBoardPage.jsx'));
const RotaPage = lazy(() => import('./pages/RotaPage.jsx'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage.jsx'));
const ServiceUsersPage = lazy(() => import('./pages/ServiceUsersPage.jsx'));
const ExceptionsPage = lazy(() => import('./pages/ExceptionsPage.jsx'));
const TimesheetsPage = lazy(() => import('./pages/TimesheetsPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const LifecyclePage = lazy(() => import('./pages/LifecyclePage.jsx'));
const AlertsPage = lazy(() => import('./pages/AlertsPage.jsx'));
const MessagesPage = lazy(() => import('./pages/MessagesPage.jsx'));
const CoverPage = lazy(() => import('./pages/CoverPage.jsx'));
const RequestsPage = lazy(() => import('./pages/RequestsPage.jsx'));
const AuditPage = lazy(() => import('./pages/AuditPage.jsx'));
const ReportsPage = lazy(() => import('./pages/ReportsPage.jsx'));
const TeamPage = lazy(() => import('./pages/TeamPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));

export default function App() {
  return (
    <Suspense fallback={<Spinner fullscreen />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Onboarding + recovery — public; reached from the emailed invite / reset link. */}
        <Route path="/accept-invite" element={<SetPasswordPage mode="invite" />} />
        <Route path="/reset-password" element={<SetPasswordPage mode="reset" />} />

        <Route
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<LiveBoardPage />} />
          {/* Live board is now the landing page; keep the old path as a redirect. */}
          <Route path="/board" element={<Navigate to="/" replace />} />
          <Route path="/rota" element={<RotaPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/clients" element={<ServiceUsersPage />} />
          <Route path="/service-users" element={<ServiceUsersPage />} />
          <Route path="/exceptions" element={<ExceptionsPage />} />
          <Route path="/timesheets" element={<TimesheetsPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* New IA — real where the backend exists, placeholder where it doesn't */}
          <Route path="/lifecycle" element={<LifecyclePage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/cover" element={<CoverPage />} />
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
