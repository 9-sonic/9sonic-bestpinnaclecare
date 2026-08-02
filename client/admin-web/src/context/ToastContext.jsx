import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Icon from '../components/common/Icon.jsx';

const ToastContext = createContext(null);
let seq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone, message, ms = 4000) => {
      seq += 1;
      const id = seq;
      setToasts((list) => [...list, { id, tone, message }]);
      setTimeout(() => dismiss(id), ms);
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m, 6000),
      warn: (m) => push('warn', m, 5000),
      info: (m) => push('info', m),
    }),
    [push]
  );

  const ICONS = { success: 'check', error: 'alert', warn: 'alert', info: 'info' };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <Icon name={ICONS[t.tone]} size={16} />
            <span>{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss">
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
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
