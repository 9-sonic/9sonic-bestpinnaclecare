import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Icon from '../components/common/Icon.jsx';

// Lightweight toast system, ported from the carer PWA so the office and the
// phone give feedback the same way. Any screen can call toast.success('Saved')
// for immediate, non-blocking feedback.
//
// Public API is unchanged from the previous admin toast (success/error/warn/info
// take a message), so no page needs updating; `show(message, tone, duration)` is
// added to match the PWA.

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

  const value = useMemo(
    () => ({
      show: push,
      success: (m, d) => push(m, 'success', d),
      error: (m, d) => push(m, 'error', d ?? 6000),
      info: (m, d) => push(m, 'info', d),
      warn: (m, d) => push(m, 'warn', d ?? 5000),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
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
              <Icon name="close" size={14} />
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
