import { useState } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import { tapFeedback, errorFeedback } from '../../utils/haptics.js';

// Asks before something that cannot be undone, or that a carer would not want
// to do by accident. The confirming button carries the destructive styling so
// the consequence is visible at the moment of choosing, not just in the text.
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  icon,
}) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (destructive) errorFeedback();
    else tapFeedback();
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="white" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger-solid' : 'primary'}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? <span className="btn__spinner" aria-hidden="true" /> : null}
            {busy ? 'Working' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="confirm">
        {icon && (
          <span className={`confirm__icon${destructive ? ' confirm__icon--danger' : ''}`}>
            <Icon name={icon} size={22} />
          </span>
        )}
        <p className="confirm__text">{message}</p>
      </div>
    </Modal>
  );
}
