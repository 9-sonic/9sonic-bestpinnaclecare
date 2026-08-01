import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Icon from './Icon.jsx';

// Shown when the browser will not hand over an install prompt.
//
// That happens for ordinary reasons rather than faults: iOS never offers one,
// Chrome withholds it until it is satisfied the app qualifies and the person
// has engaged with the page, and browsers inside another app cannot install at
// all. A button that silently does nothing is the worst outcome, so this
// explains which case applies and what to do instead.

const IOS_STEPS = [
  'Tap the Share button at the bottom of Safari, the square with an arrow.',
  'Scroll down and choose Add to Home Screen.',
  'Tap Add. The app appears on your home screen like any other.',
];

const ANDROID_STEPS = [
  'Tap the three dots at the top right of Chrome.',
  'Choose Install app, or Add to Home screen.',
  'Confirm. The app appears in your app drawer.',
];

export default function InstallHelp({ open, onClose, isIos, supported }) {
  const steps = isIos ? IOS_STEPS : ANDROID_STEPS;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Install this app"
      footer={
        <Button block variant="white" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="sheet-lead">
        <Icon name="download" size={17} />
        <p>
          {isIos
            ? 'On iPhone and iPad this is done from the Safari share menu.'
            : supported
              ? 'Your browser has not offered the install button yet. You can add it manually from the browser menu.'
              : 'This browser cannot install apps. Open the site in Chrome and try again.'}
        </p>
      </div>

      <ol className="install-steps">
        {steps.map((step, i) => (
          <li key={step}>
            <span className="install-steps__num">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <p className="install-why">
        Installing means the app opens full screen, starts faster, and keeps
        working when you have no signal. Nothing is downloaded from an app store.
      </p>
    </Modal>
  );
}
