import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import Root from './Root.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
// Self-hosted so the app keeps its typography offline (no CDN round-trip).
import '@fontsource-variable/sora';
import '@fontsource-variable/manrope';
import './styles/variables.css';
import './styles/global.css';
import { initServiceWorker } from './utils/swUpdate.js';
import { initInstallCapture } from './utils/installStore.js';

// Chrome fires beforeinstallprompt before React mounts, so start listening
// before anything renders or the event is lost.
initInstallCapture();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <Root />
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

// Register the service worker after the first render so it never blocks paint.
initServiceWorker();
