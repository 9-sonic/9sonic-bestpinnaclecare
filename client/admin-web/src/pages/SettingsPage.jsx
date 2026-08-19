import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Panel, PanelTitle, Button, fieldStyle } from '../ds/console.jsx';

// System settings — the single place the office configures how clocking behaves.
// Every field here is a REAL, enforced setting the backend reads at runtime
// (Setting.instance.*), so nothing about the policy is hard-coded: change the
// grace period here and the escalation timing changes with it. Saves are audited
// (settings.updated event) and gated to a registered manager / manager.

const inputStyle = (dis) => fieldStyle({ disabled: dis });

function Field({ label, hint, children }) {
  return (
    <label style={s('display:flex;flex-direction:column;gap:6px')}>
      <span style={s('font-size:12.5px;font-weight:600;color:var(--d-ink2)')}>{label}</span>
      {children}
      {hint && <span style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);line-height:1.45')}>{hint}</span>}
    </label>
  );
}

function NumberField({ value, onChange, suffix, min, disabled }) {
  return (
    <div style={{ ...fieldStyle({ disabled }), display: 'flex', alignItems: 'center' }}>
      <input type="number" min={min} value={value ?? ''} onChange={onChange} disabled={disabled} style={{ ...s('flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:13.5px;font-weight:600;color:var(--d-ink)'), fontFamily: 'inherit' }} />
      {suffix && <span style={s('font-size:12px;font-weight:600;color:var(--d-muted)')}>{suffix}</span>}
    </div>
  );
}

function SelectField({ value, onChange, options, disabled }) {
  return (
    <select value={value ?? ''} onChange={onChange} disabled={disabled} style={{ ...inputStyle(disabled) }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Section({ title, hint, children }) {
  return (<Panel style={{ padding: '22px 24px' }}><PanelTitle hint={hint}>{title}</PanelTitle><div style={s('display:flex;flex-direction:column;gap:16px;margin-top:4px')}>{children}</div></Panel>);
}

const GEOFENCE_MODES = [
  { value: 'record', label: 'Record only — clock-ins away from the address are logged, not blocked' },
  { value: 'warn', label: 'Warn — the carer is warned but can still clock in' },
  { value: 'block', label: 'Block — a clock-in outside the fence is refused' },
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
      .then((v) => { if (!active) return; setSettings(v); setForm(v); })
      .catch(() => active && toast.error('Could not load settings'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [toast]);

  // Text/select fields keep the raw value; number fields coerce to a number so
  // the API gets integers, not strings.
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setNum = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value === '' ? '' : Number(e.target.value) }));
  const dirty = settings && JSON.stringify(settings) !== JSON.stringify(form);

  async function save() {
    setSaving(true);
    try {
      const saved = await updateSettings(form);
      setSettings(saved); setForm(saved);
      toast.success('Settings saved — the system uses these straight away');
    } catch (err) {
      toast.error(err.message || 'Could not save settings');
    } finally { setSaving(false); }
  }

  if (loading) return <Spinner fullscreen />;

  const ro = !canManage;

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      <div style={s('display:flex;align-items:center;gap:12px;flex-wrap:wrap')}>
        <div style={s('flex:1')} />
        {canManage && <Button variant="primary" icon="check" disabled={saving || !dirty} onClick={saving || !dirty ? undefined : save}>{saving ? 'Saving…' : 'Save changes'}</Button>}
      </div>

      <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;align-items:start')}>

        {/* Attendance & escalation — the enforced timing policy */}
        <Section title="Attendance & escalation" hint="How the system decides late and missed">
          <Field label="Check-in window before start" hint="How early a carer may clock in before the scheduled start.">
            <NumberField value={form.checkin_window_before_start_minutes} onChange={setNum('checkin_window_before_start_minutes')} suffix="min" min="0" disabled={ro} />
          </Field>
          <Field label="Grace period" hint="Clock-ins within this window of the start count as on time. Once it passes with no clock-in, the office is alerted so it can contact the carer or reassign.">
            <NumberField value={form.late_grace_minutes} onChange={setNum('late_grace_minutes')} suffix="min" min="0" disabled={ro} />
          </Field>
          <Field label="Missed threshold" hint="How long after the start a visit is treated as fully missed for reporting.">
            <NumberField value={form.missed_threshold_minutes} onChange={setNum('missed_threshold_minutes')} suffix="min" min="0" disabled={ro} />
          </Field>
          <Field label="Overdue (no clock-out) threshold" hint="How long past the scheduled end an open visit waits before it is flagged overdue.">
            <NumberField value={form.overdue_threshold_minutes} onChange={setNum('overdue_threshold_minutes')} suffix="min" min="0" disabled={ro} />
          </Field>
          <Field label="Auto-close after" hint="A visit still open this long past its end is closed to pending review automatically.">
            <NumberField value={form.auto_close_after_minutes} onChange={setNum('auto_close_after_minutes')} suffix="min" min="0" disabled={ro} />
          </Field>
          <Field label="Early-leave tolerance" hint="A clock-out this far before the end is allowed but flagged for review.">
            <NumberField value={form.early_leave_tolerance_minutes} onChange={setNum('early_leave_tolerance_minutes')} suffix="min" min="0" disabled={ro} />
          </Field>
          <Field label="Clock-skew tolerance" hint="A tap whose time is off from the server by more than this is flagged for review.">
            <NumberField value={form.clock_skew_tolerance_minutes} onChange={setNum('clock_skew_tolerance_minutes')} suffix="min" min="0" disabled={ro} />
          </Field>
        </Section>

        {/* Geofence — location at clock only */}
        <Section title="Geofence" hint="Location is captured at clock moments only, never between visits">
          <Field label="Enforcement" hint="What happens when a carer clocks in away from the client's address.">
            <SelectField value={form.geofence_mode} onChange={set('geofence_mode')} options={GEOFENCE_MODES} disabled={ro} />
          </Field>
          <Field label="Fence radius" hint="How close to the registered address a clock-in must be.">
            <NumberField value={form.geofence_radius_m} onChange={setNum('geofence_radius_m')} suffix="m" min="0" disabled={ro} />
          </Field>
        </Section>

        {/* Organisation */}
        <Section title="Organisation" hint="Your registered details, shown on exports and the CQC audit">
          <Field label="Company name"><input value={form.company_name ?? ''} onChange={set('company_name')} disabled={ro} style={inputStyle(ro)} /></Field>
          <Field label="Trading name"><input value={form.trading_name ?? ''} onChange={set('trading_name')} disabled={ro} style={inputStyle(ro)} /></Field>
          <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:12px')}>
            <Field label="CQC provider ID"><input value={form.cqc_provider_id ?? ''} onChange={set('cqc_provider_id')} disabled={ro} style={inputStyle(ro)} /></Field>
            <Field label="CQC location ID"><input value={form.cqc_location_id ?? ''} onChange={set('cqc_location_id')} disabled={ro} style={inputStyle(ro)} /></Field>
          </div>
          <Field label="Address line 1"><input value={form.address_line1 ?? ''} onChange={set('address_line1')} disabled={ro} style={inputStyle(ro)} /></Field>
          <Field label="Address line 2"><input value={form.address_line2 ?? ''} onChange={set('address_line2')} disabled={ro} style={inputStyle(ro)} /></Field>
          <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:12px')}>
            <Field label="Town or city"><input value={form.city ?? ''} onChange={set('city')} disabled={ro} style={inputStyle(ro)} /></Field>
            <Field label="Postcode"><input value={form.postcode ?? ''} onChange={set('postcode')} disabled={ro} style={inputStyle(ro)} /></Field>
          </div>
          <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:12px')}>
            <Field label="Phone"><input value={form.phone ?? ''} onChange={set('phone')} disabled={ro} style={inputStyle(ro)} /></Field>
            <Field label="Email"><input value={form.email ?? ''} onChange={set('email')} disabled={ro} style={inputStyle(ro)} /></Field>
          </div>
        </Section>

        {/* Branding & locale */}
        <Section title="Branding & locale" hint="How the console reads and where it operates">
          <Field label="Brand colour" hint="Used for accents across the office app.">
            <div style={s('display:flex;align-items:center;gap:10px')}>
              <input type="color" value={form.brand_primary_colour || '#0a7e8e'} onChange={set('brand_primary_colour')} disabled={ro} style={{ ...s('width:44px;height:44px;border-radius:12px;border:1px solid var(--d-border);background:none;cursor:pointer'), opacity: ro ? 0.55 : 1 }} />
              <input value={form.brand_primary_colour ?? ''} onChange={set('brand_primary_colour')} disabled={ro} style={inputStyle(ro)} />
            </div>
          </Field>
          <Field label="Timezone"><input value={form.timezone ?? ''} onChange={set('timezone')} disabled={ro} placeholder="Europe/London" style={inputStyle(ro)} /></Field>
        </Section>
      </div>

      <div style={s('display:flex;align-items:center;gap:8px;font-size:12px;font-weight:500;color:var(--d-muted);padding:0 4px')}>
        <Icon name="info" size={15} /> Changes here take effect immediately and are recorded in the audit trail with your name and the time.
      </div>
    </div>
  );
}
