import { useRef, useState } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import Avatar from '../common/Avatar.jsx';
import Icon from '../common/Icon.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { updateProfile, uploadAvatar } from '../../api/auth.js';

// The carer's record is office controlled: name, email, mobile, staff ID and
// role are all shown read only. Emergency contact is the exception — it is the
// carer's own to keep current, and it is the field that matters most when it is
// out of date.
//
// The read-only fields are not sent on save either, so the client never asks to
// change something it does not present as changeable.
export default function EditProfileDialog({ open, onClose, user, onSaved }) {
  const toast = useToast();
  // Emergency contact is two fields because the API stores two
  // (emergency_contact_name and emergency_contact_phone). One combined box
  // would have to be split on save, and "Jane 07700 900000" has no reliable
  // split — the number is the part that matters in an emergency.
  const [form, setForm] = useState({
    emergencyContactName: user?.emergencyContactName ?? '',
    emergencyContactPhone: user?.emergencyContactPhone ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onPickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setPhotoBusy(true);
    try {
      const updated = await uploadAvatar(file);
      onSaved?.(updated); // refresh the user everywhere (header, hero, chats)
      toast.success('Photo updated');
    } catch (err) {
      toast.error(err.message || 'Could not update your photo');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateProfile(form);
      onSaved?.(updated);
      toast.success('Profile updated');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Could not save your profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit profile"
      footer={
        <>
          <Button variant="white" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSave} className="form-stack">
        <div className="edit-photo">
          <Avatar name={form.name} src={user?.avatar} size={68} />
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={onPickPhoto}
          />
          <button
            type="button"
            className="edit-photo__btn"
            onClick={() => fileRef.current?.click()}
            disabled={photoBusy}
          >
            <Icon name="camera" size={15} />
            {photoBusy ? 'Uploading…' : 'Change photo'}
          </button>
        </div>

        {/* Name, email and mobile are the office's record of this carer. They
            are shown so the carer can check them and see what to ask their
            manager about — a box that takes a change and discards it is worse
            than no box. */}
        <label className="field">
          <span className="field__label">Full name</span>
          <input
            className="field__input"
            value={user?.name ?? ''}
            readOnly
            tabIndex={-1}
            aria-describedby="profile-readonly-note"
          />
        </label>

        <label className="field">
          <span className="field__label">Email address</span>
          <input
            className="field__input"
            type="email"
            value={user?.email ?? ''}
            readOnly
            tabIndex={-1}
            aria-describedby="profile-readonly-note"
          />
        </label>

        <label className="field">
          <span className="field__label">Mobile number</span>
          <input
            className="field__input"
            type="tel"
            value={user?.phone ?? ''}
            readOnly
            tabIndex={-1}
            aria-describedby="profile-readonly-note"
          />
        </label>

        <label className="field">
          <span className="field__label">Emergency contact name</span>
          <input
            className="field__input"
            value={form.emergencyContactName}
            onChange={set('emergencyContactName')}
            placeholder="Who should we call"
          />
        </label>

        <label className="field">
          <span className="field__label">Emergency contact number</span>
          <input
            className="field__input"
            type="tel"
            value={form.emergencyContactPhone}
            onChange={set('emergencyContactPhone')}
            inputMode="tel"
            placeholder="07700 900000"
          />
        </label>

        <div className="readonly-note" id="profile-readonly-note">
          <Icon name="info" size={15} />
          <span>
            Your name, email address, mobile number, staff ID {user?.staffId} and role are
            managed by the office. Contact your manager to change them.
          </span>
        </div>
      </form>
    </Modal>
  );
}
