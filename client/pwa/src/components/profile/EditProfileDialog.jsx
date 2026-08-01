import { useState } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import Avatar from '../common/Avatar.jsx';
import Icon from '../common/Icon.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { updateProfile } from '../../api/auth.js';

// Edit the fields a carer is allowed to change themselves. Staff ID and role
// are set by the office, so they are shown read only.
export default function EditProfileDialog({ open, onClose, user, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    emergencyContact: user?.emergencyContact ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = 'Enter your name';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!validate()) return;
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
          <button type="button" className="edit-photo__btn">
            <Icon name="camera" size={15} />
            Change photo
          </button>
        </div>

        <label className="field">
          <span className="field__label">Full name</span>
          <input
            className={`field__input${errors.name ? ' field__input--error' : ''}`}
            value={form.name}
            onChange={set('name')}
            autoComplete="name"
          />
          {errors.name && <span className="field__error">{errors.name}</span>}
        </label>

        <label className="field">
          <span className="field__label">Email address</span>
          <input
            className={`field__input${errors.email ? ' field__input--error' : ''}`}
            type="email"
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
            inputMode="email"
          />
          {errors.email && <span className="field__error">{errors.email}</span>}
        </label>

        <label className="field">
          <span className="field__label">Mobile number</span>
          <input
            className="field__input"
            type="tel"
            value={form.phone}
            onChange={set('phone')}
            autoComplete="tel"
            inputMode="tel"
            placeholder="07700 900000"
          />
        </label>

        <label className="field">
          <span className="field__label">Emergency contact</span>
          <input
            className="field__input"
            value={form.emergencyContact}
            onChange={set('emergencyContact')}
            placeholder="Name and number"
          />
        </label>

        <div className="readonly-note">
          <Icon name="info" size={15} />
          <span>
            Staff ID {user?.staffId} and your role are managed by the office. Contact your manager
            to change them.
          </span>
        </div>
      </form>
    </Modal>
  );
}
