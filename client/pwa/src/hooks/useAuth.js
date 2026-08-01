import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

// Convenience hook so components do: const { user, login } = useAuth();
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export default useAuth;
