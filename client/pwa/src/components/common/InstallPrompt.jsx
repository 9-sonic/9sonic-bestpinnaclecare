import { useState } from 'react';
import { useInstallPrompt } from '../../hooks/useInstallPrompt.js';
import Icon from './Icon.jsx';
import Button from './Button.jsx';

// Install invitation. Appears as a card above the tab bar the first time the
// app is usable and not yet installed. Dismissal is remembered; the Profile
// screen keeps a permanent entry point either way.
export default function InstallPrompt() {
  const { canInstall, isIos, promptInstall, dismiss } = useInstallPrompt();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (!canInstall) return null;

  async function handleInstall() {
    if (isIos) {
      setShowIosHelp(true);
      return;
    }
    await promptInstall();
  }

  return (
    <>
      <div className="install-banner" role="dialog" aria-label="Install app">
        <span className="install-banner__icon">
          <Icon name="download" size={17} />
        </span>
        <span className="install-banner__body">
          <span className="install-banner__title">Install Pinnacle Care</span>
          <span className="install-banner__text">Works offline · faster clock-in</span>
        </span>
        <Button size="sm" onClick={handleInstall}>
          {isIos ? 'How' : 'Install'}
        </Button>
        <button
          type="button"
          className="install-banner__close"
          aria-label="Dismiss install prompt"
          onClick={dismiss}
        >
          ×
        </button>
      </div>

      {showIosHelp && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowIosHelp(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="How to install"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="modal__grabber" aria-hidden="true" />
            <h2 className="modal__title">Add to Home Screen</h2>
            <ol className="modal__steps">
              <li>
                Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.
              </li>
              <li>
                Scroll and choose <strong>Add to Home Screen</strong>.
              </li>
              <li>
                Tap <strong>Add</strong>, Pinnacle Care joins your other apps.
              </li>
            </ol>
            <Button block onClick={() => setShowIosHelp(false)}>
              Got it
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
