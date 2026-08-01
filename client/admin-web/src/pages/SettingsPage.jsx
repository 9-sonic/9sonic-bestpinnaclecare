import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../api/index.js';
import PageHeader from '../components/common/PageHeader.jsx';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Provider settings.
//
// These numbers decide when the system calls a visit late, missed or overdue,
// and whether a carer outside the radius is blocked or merely flagged. They are
// business policy rather than technical configuration, so each one is labelled
// in plain words with a note on what changing it does.
const TIMING = [
  { key: 'checkin_window_before_start_minutes', label: 'Check in window', help: 'How early a carer may clock in before the visit start time.' },
  { key: 'late_grace_minutes', label: 'Late grace', help: 'How long after the start time before a visit is marked late.' },
  { key: 'missed_threshold_minutes', label: 'Missed after', help: 'How long after the start time before a visit counts as missed.' },
  { key: 'overdue_threshold_minutes', label: 'Overdue after', help: 'How long past the end time before an unfinished visit is overdue.' },
  { key: 'auto_close_after_minutes', label: 'Auto close after', help: 'When a visit with no clock out is closed for review.' },
  { key: 'early_leave_tolerance_minutes', label: 'Early leave tolerance', help: 'How far before the end time a carer may clock out without a flag.' },
];

export default function SettingsPage() {
  const toast = useToast();
  const { canManage } = useAuth();
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getSettings()
      .then((s) => {
        if (!active) return;
        setSettings(s);
        setForm(s);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const dirty = settings && JSON.stringify(settings) !== JSON.stringify(form);

  async function save() {
    setSaving(true);
    try {
      const saved = await updateSettings(form);
      setSettings(saved);
      setForm(saved);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner fullscreen />;

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="How the system decides late, missed and out of range"
        actions={
          canManage && (
            <Button loading={saving} disabled={!dirty} onClick={save}>
              Save changes
            </Button>
          )
        }
      />

      <Card className="warn-card">
        <Icon name="info" size={18} />
        <div>
          <p className="warn-card__title">These are business rules, not preferences</p>
          <p className="warn-card__text">
            Changing them changes what counts as a late or missed visit for everyone, and affects
            what carers see. Agree changes with the registered manager first.
          </p>
        </div>
      </Card>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Timing</h2>
        </div>
        <Card>
          <div className="settings-grid">
            {TIMING.map((f) => (
              <label key={f.key} className="field">
                <span className="field__label">{f.label}</span>
                <span className="field__wrap">
                  <input
                    className="field__input"
                    type="number"
                    min="0"
                    value={form[f.key] ?? 0}
                    onChange={set(f.key)}
                    disabled={!canManage}
                  />
                  <span className="field__suffix">min</span>
                </span>
                <span className="field__hint">{f.help}</span>
              </label>
            ))}
          </div>
        </Card>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Location checking</h2>
        </div>
        <Card>
          <div className="settings-grid">
            <label className="field">
              <span className="field__label">Default mode</span>
              <select
                className="field__input"
                value={form.geofence_mode ?? 'block'}
                onChange={set('geofence_mode')}
                disabled={!canManage}
              >
                <option value="block">Block, refuse clock in outside the radius</option>
                <option value="warn">Warn, allow but flag it</option>
                <option value="off">Off, record without checking</option>
              </select>
              <span className="field__hint">
                Individual addresses can override this. Blocking is strict: a carer with a poor GPS
                fix may be refused, so warn is often kinder in practice.
              </span>
            </label>

            <label className="field">
              <span className="field__label">Default radius</span>
              <span className="field__wrap">
                <input
                  className="field__input"
                  type="number"
                  min="25"
                  value={form.geofence_radius_m ?? 150}
                  onChange={set('geofence_radius_m')}
                  disabled={!canManage}
                />
                <span className="field__suffix">m</span>
              </span>
              <span className="field__hint">
                Phone GPS is typically accurate to 10 to 50m outdoors, and worse inside a building.
              </span>
            </label>
          </div>
        </Card>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Timesheets</h2>
        </div>
        <Card>
          <div className="settings-grid">
            <label className="field">
              <span className="field__label">Period</span>
              <select
                className="field__input"
                value={form.timesheet_period ?? 'weekly'}
                onChange={set('timesheet_period')}
                disabled={!canManage}
              >
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="four_weekly">Four weekly</option>
              </select>
            </label>

            <label className="field">
              <span className="field__label">Rounding</span>
              <span className="field__wrap">
                <input
                  className="field__input"
                  type="number"
                  min="0"
                  value={form.timesheet_rounding_minutes ?? 0}
                  onChange={set('timesheet_rounding_minutes')}
                  disabled={!canManage}
                />
                <span className="field__suffix">min</span>
              </span>
              <span className="field__hint">
                Zero keeps the exact recorded time. Anything else rounds worked minutes, which
                affects pay, so agree it with finance.
              </span>
            </label>
          </div>
        </Card>
      </section>

      {!canManage && (
        <p className="page-note">
          Your role can view these settings but not change them.
        </p>
      )}
    </>
  );
}
