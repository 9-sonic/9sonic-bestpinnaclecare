import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import Spinner from './components/common/Spinner.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { lazyWithRetry } from './utils/lazyWithRetry.js';

// Screens are code-split so the first paint only loads what it needs.
const HomePage = lazyWithRetry(() => import('./pages/HomePage.jsx'));
const ClockPage = lazyWithRetry(() => import('./pages/ClockPage.jsx'));
const ClockHistoryPage = lazyWithRetry(() => import('./pages/ClockHistoryPage.jsx'));
const ShiftsPage = lazyWithRetry(() => import('./pages/ShiftsPage.jsx'));
const ShiftDetailPage = lazyWithRetry(() => import('./pages/ShiftDetailPage.jsx'));
const OverviewPage = lazyWithRetry(() => import('./pages/OverviewPage.jsx'));
const TimesheetPage = lazyWithRetry(() => import('./pages/TimesheetPage.jsx'));
const NotificationsPage = lazyWithRetry(() => import('./pages/NotificationsPage.jsx'));
const MessagesPage = lazyWithRetry(() => import('./pages/MessagesPage.jsx'));
const ChatPage = lazyWithRetry(() => import('./pages/ChatPage.jsx'));
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage.jsx'));
const NavigationPage = lazyWithRetry(() => import('./pages/NavigationPage.jsx'));
const PersonalDetailsPage = lazyWithRetry(() => import('./pages/PersonalDetailsPage.jsx'));
const AvailabilityPage = lazyWithRetry(() => import('./pages/AvailabilityPage.jsx'));
const PreferencesPage = lazyWithRetry(() => import('./pages/PreferencesPage.jsx'));
const HelpPage = lazyWithRetry(() => import('./pages/HelpPage.jsx'));
const LegalPage = lazyWithRetry(() => import('./pages/LegalPage.jsx'));
const ForgotPasswordPage = lazyWithRetry(() => import('./pages/ForgotPasswordPage.jsx'));
const SetPasswordPage = lazyWithRetry(() => import('./pages/SetPasswordPage.jsx'));
const NotFoundPage = lazyWithRetry(() => import('./pages/NotFoundPage.jsx'));

export default function App() {
  return (
    <Suspense fallback={<Spinner fullscreen />}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        {/* Onboarding + recovery — reached from the emailed invite / reset link. */}
        <Route path="/accept-invite" element={<SetPasswordPage mode="invite" />} />
        <Route path="/reset-password" element={<SetPasswordPage mode="reset" />} />

        {/* Full-screen authenticated screen (chat has its own composer layout) */}
        <Route
          path="/messages/:threadId"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />

        {/* Tabbed authenticated screens */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/clock" element={<ClockPage />} />
          <Route path="/shifts" element={<ShiftsPage />} />
          <Route path="/shifts/:shiftId" element={<ShiftDetailPage />} />
          <Route path="/clock/history" element={<ClockHistoryPage />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/timesheet" element={<TimesheetPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/details" element={<PersonalDetailsPage />} />
          <Route path="/profile/availability" element={<AvailabilityPage />} />
          <Route path="/profile/preferences" element={<PreferencesPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/legal/:doc" element={<LegalPage />} />
          <Route path="/navigate/:shiftId" element={<NavigationPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
