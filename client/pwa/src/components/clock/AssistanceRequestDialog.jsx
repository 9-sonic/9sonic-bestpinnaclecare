import { useEffect, useMemo, useState } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import { createRequest } from '../../api/requests.js';
import { enqueue } from '../../utils/assistanceQueue.js';
import { newUuid, deviceFingerprint } from '../../utils/ids.js';
import { formatTime } from '../../utils/format.js';
import { useOnline } from '../../hooks/useOnline.js';
import { useToast } from '../../context/ToastContext.jsx';
import { tapFeedback, successFeedback, warnFeedback, errorFeedback } from '../../utils/haptics.js';

// Structured "I can't clock in" request, sent to the office through the carer
// requests pipeline as kind=clock_assistance. Works offline: the request is
// built once with its client_request_id and either posted now or queued for
// the next connection (utils/assistanceQueue.js, drained by
// useAssistanceQueueSync).

const ASSISTANCE_REASONS = [
  { id: 'too_far', label: 'Too far from address' },
  { id: 'no_gps', label: "Can't get location" },
  { id: 'too_early', label: "Shift hasn't started" },
  { id: 'no_signal', label: 'No phone signal' },
  { id: 'client_issue', label: 'Client / door issue' },
  { id: 'other', label: 'Something else' },
];

// Maps the clock failure the carer just hit to the most likely reason, so the
// form usually needs nothing but a tap on Send.
const ERROR_TO_REASON = {
  too_far: 'too_far',
  location_required: 'no_gps',
  too_early: 'too_early',
  no_connection: 'no_signal',
};

export default function AssistanceRequestDialog({ open, onClose, shift, errorContext, onSubmitted }) {
  const online = useOnline();
  const toast = useToast();
  const [reason, setReason] = useState('other');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  // Fresh form each time it opens, preselected from the error that triggered
  // it when there is one.
  useEffect(() => {
    if (!open) return;
    setReason(ERROR_TO_REASON[errorContext?.code] ?? 'other');
    setNote('');
    setSending(false);
  }, [open, errorContext?.code]);

  // Read-only recap of what will be attached, so the carer can see the office
  // gets the useful details without typing them.
  const contextLine = useMemo(() => {
    const parts = [];
    if (shift) parts.push(`Visit: ${shift.client}`);
    if (errorContext?.attemptedAt) parts.push(`Tried at ${formatTime(errorContext.attemptedAt)}`);
    if (errorContext?.code === 'too_far' && errorContext?.distanceM != null) {
      parts.push(`about ${errorContext.distanceM}m from the address`);
    }
    return parts.join(' · ');
  }, [shift, errorContext]);

  async function handleSubmit() {
    tapFeedback();
    setSending(true);

    const reasonLabel = ASSISTANCE_REASONS.find((r) => r.id === reason)?.label ?? 'Something else';
    // Built once: the same body goes to the live call or the offline queue,
    // so a replay keeps the same client_request_id.
    const body = {
      kind: 'clock_assistance',
      summary: `Can't clock in — ${reasonLabel}${shift ? ` (${shift.client})` : ''}`,
      detail: note.trim() || null,
      payload: {
        visit_assignment_id: shift?.id ?? null,
        attempted_at: errorContext?.attemptedAt ?? new Date().toISOString(),
        error_code: errorContext?.code ?? null,
        distance_m: errorContext?.distanceM ?? null,
        lat: errorContext?.location?.latitude ?? null,
        lng: errorContext?.location?.longitude ?? null,
        accuracy_m:
          errorContext?.location?.accuracy != null ? Math.round(errorContext.location.accuracy) : null,
        device_fingerprint: deviceFingerprint(),
        client_request_id: newUuid(),
        reason,
      },
    };

    try {
      if (!online) throw Object.assign(new Error('offline'), { isNetworkError: true });
      await createRequest(body);
      successFeedback();
      toast.success('The office has been notified.');
      onSubmitted?.();
      onClose();
    } catch (err) {
      if (err?.isNetworkError || !online) {
        enqueue(body);
        warnFeedback();
        toast.warn('Saved on this phone. It will be sent when you have signal.');
        onSubmitted?.();
        onClose();
      } else {
        // The server refused it: keep the form as filled so nothing is lost
        // and the carer can adjust and try again.
        errorFeedback();
        toast.error(err.message || 'Could not send the request. Try again.');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request help from the office"
      footer={
        <>
          <Button variant="white" pill onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button pill loading={sending} onClick={handleSubmit}>
            {online ? 'Send request' : 'Save & send when I have signal'}
          </Button>
        </>
      }
    >
      <div className="cover-modal">
        <p className="cover-modal__lead">
          Tell the office what happened and they will sort the clock-in record with you.
          {contextLine ? ` Attached: ${contextLine}.` : ''}
        </p>

        <label className="label">What went wrong?</label>
        <div className="cover-reasons">
          {ASSISTANCE_REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`cover-reason-chip${reason === r.id ? ' cover-reason-chip--active' : ''}`}
              onClick={() => {
                tapFeedback();
                setReason(r.id);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <label className="label" htmlFor="assist-note">Anything to add? (optional)</label>
        <textarea
          id="assist-note"
          className="textarea"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. I'm at the door but the app says I'm 200m away..."
        />

        <p className="cover-modal__lead">
          For anything urgent about a client, call the office first.
        </p>
      </div>
    </Modal>
  );
}
