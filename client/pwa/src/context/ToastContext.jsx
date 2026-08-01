import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Icon from '../components/common/Icon.jsx';

// Lightweight toast system. Any screen can call toast.success('Clocked in')
// to give immediate feedback without blocking the UI.

const ToastContext = createContext(null);

const ICONS = { success: 'check', error: 'alert', info: 'info', warn: 'alert' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, tone = 'info', duration = 3000) => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, message, tone }]);
      setTimeout(() => remove(id), duration);
      return id;
    },
    [remove]
  );

  const api = useMemo(
    () => ({
      show: push,
      success: (m, d) => push(m, 'success', d),
      error: (m, d) => push(m, 'error', d ?? 4000),
      info: (m, d) => push(m, 'info', d),
      warn: (m, d) => push(m, 'warn', d),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <Icon name={ICONS[t.tone] ?? 'info'} size={16} />
            <span>{t.message}</span>
            <button
              type="button"
              className="toast__close"
              onClick={() => remove(t.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
