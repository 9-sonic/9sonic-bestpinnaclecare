import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';

import '@fontsource-variable/sora';
import '@fontsource-variable/manrope';
import './styles/variables.css';
import './styles/admin.css';
import './styles/design-shell.css';

// Recover from a stale-chunk error after a deploy. Pages are lazy-loaded, so if
// a tab is open across a deploy (its fingerprinted chunk was just deleted from
// the server) the next navigation's dynamic import 404s. Vite fires
// `vite:preloadError`; reload ONCE to fetch the fresh index + chunks. A session
// flag stops a reload loop if the failure is something other than a stale chunk.
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('bpc.chunkReloaded')) return;
  sessionStorage.setItem('bpc.chunkReloaded', '1');
  window.location.reload();
});
window.addEventListener('load', () => sessionStorage.removeItem('bpc.chunkReloaded'));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
