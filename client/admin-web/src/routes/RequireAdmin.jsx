import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import SplashScreen from '../components/common/SplashScreen.jsx';

export default function RequireAdmin({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Branded boot splash while auth restores — mirrors the carer app's launch.
  if (loading) return <SplashScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
