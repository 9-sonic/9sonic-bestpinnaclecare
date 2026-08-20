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
const CarerDetailPage = lazy(() => import('./pages/CarerDetailPage.jsx'));
const ServiceUsersPage = lazy(() => import('./pages/ServiceUsersPage.jsx'));
const ClientDetailPage = lazy(() => import('./pages/ClientDetailPage.jsx'));
const VisitDetailPage = lazy(() => import('./pages/VisitDetailPage.jsx'));
const ExceptionsPage = lazy(() => import('./pages/ExceptionsPage.jsx'));
const TimesheetsPage = lazy(() => import('./pages/TimesheetsPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const LifecyclePage = lazy(() => import('./pages/LifecyclePage.jsx'));
const AlertsPage = lazy(() => import('./pages/AlertsPage.jsx'));
const MessagesPage = lazy(() => import('./pages/MessagesPage.jsx'));
const StaffingPage = lazy(() => import('./pages/StaffingPage.jsx'));
const ReportsHub = lazy(() => import('./pages/ReportsHub.jsx'));
const GuidePage = lazy(() => import('./pages/GuidePage.jsx'));
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
          <Route path="/employees/:id" element={<CarerDetailPage />} />
          <Route path="/clients" element={<ServiceUsersPage />} />
          <Route path="/clients/:id" element={<ClientDetailPage />} />
          <Route path="/visits/:id" element={<VisitDetailPage />} />
          <Route path="/service-users" element={<ServiceUsersPage />} />
          <Route path="/exceptions" element={<ExceptionsPage />} />
          <Route path="/timesheets" element={<TimesheetsPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* New IA — real where the backend exists, placeholder where it doesn't */}
          <Route path="/lifecycle" element={<LifecyclePage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/staffing" element={<StaffingPage />} />
          {/* Cover + Requests merged into Staffing; keep old paths as deep-links. */}
          <Route path="/cover" element={<Navigate to="/staffing" replace />} />
          <Route path="/requests" element={<Navigate to="/staffing?tab=requests" replace />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/reports" element={<ReportsHub />} />
          {/* Audit merged into the reporting hub; keep the path as a deep-link. */}
          <Route path="/audit" element={<ReportsHub />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
