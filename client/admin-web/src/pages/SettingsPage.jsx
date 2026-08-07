import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Panel, PanelTitle, Tag, Button, TableWrap, Th, Td, Row } from '../ds/console.jsx';

const inputStyle = (dis) => ({ ...s('height:44px;border-radius:14px;background:var(--d-field);padding:0 14px;font-size:13.5px;font-weight:600;color:var(--d-ink);outline:none;box-sizing:border-box;width:100%;border:1.5px solid transparent'), fontFamily: 'inherit', opacity: dis ? 0.55 : 1 });

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
    <div style={{ ...s('height:44px;border-radius:14px;background:var(--d-field);display:flex;align-items:center;padding:0 14px;border:1.5px solid transparent'), opacity: disabled ? 0.55 : 1 }}>
      <input type="number" min={min} value={value} onChange={onChange} disabled={disabled} style={{ ...s('flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:13.5px;font-weight:600;color:var(--d-ink)'), fontFamily: 'inherit' }} />
      {suffix && <span style={s('font-size:12px;font-weight:600;color:var(--d-muted)')}>{suffix}</span>}
    </div>
  );
}
function Toggle({ label, hint, on, onChange }) {
  return (
    <div style={s('display:flex;align-items:flex-start;gap:12px')}>
      <div style={s('flex:1;min-width:0')}>
        <div style={s('font-size:12.5px;font-weight:600;color:var(--d-ink)')}>{label}</div>
        {hint && <div style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);line-height:1.45;margin-top:1px')}>{hint}</div>}
      </div>
      <div onClick={() => onChange(!on)} style={{ ...s('width:40px;height:24px;border-radius:12px;flex:none;cursor:pointer;position:relative;transition:background 0.15s'), background: on ? 'var(--d-primary)' : 'var(--d-panel2)' }}>
        <div style={{ ...s('position:absolute;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left 0.15s'), left: on ? '19px' : '3px' }} />
      </div>
    </div>
  );
}
function Section({ title, hint, children }) {
  return (<Panel style={{ padding: '22px 24px' }}><PanelTitle hint={hint}>{title}</PanelTitle><div style={s('display:flex;flex-direction:column;gap:16px')}>{children}</div></Panel>);
}

const DEFAULT_POLICY = { gpsOptional: true, offline: true, pinTablets: true, photoPin: false, managerEntry: true, retainCarer: true, weeklyEmail: true, anonymise: false, failButton: true, autoOpen: true, smsFallback: false, shiftReminder: true, rotaNotice: true, openBroadcast: true };
const PERMS = [
  ['Registered manager', true, true, true, true],
  ['Manager', true, true, true, false],
  ['Coordinator', true, true, false, false],
  ['Finance', true, false, false, true],
  ['Auditor', true, false, false, false],
  ['Carer', false, false, false, false],
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
    getSettings().then((v) => { if (!active) return; setSettings(v); setForm(v); }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const policy = { ...DEFAULT_POLICY, ...(form.policy ?? {}) };
  const pset = (k) => (v) => setForm((f) => ({ ...f, policy: { ...DEFAULT_POLICY, ...(f.policy ?? {}), [k]: v } }));
  const dirty = settings && JSON.stringify(settings) !== JSON.stringify(form);

  async function save() {
    setSaving(true);
    try { const saved = await updateSettings(form); setSettings(saved); setForm(saved); toast.success('Settings saved'); }
    catch (err) { toast.error(err.message || 'Could not save'); } finally { setSaving(false); }
  }

  if (loading) return <Spinner fullscreen />;

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      <div style={s('display:flex;align-items:center;gap:12px;flex-wrap:wrap')}>
        <div style={s('font-size:13.5px;font-weight:500;color:var(--d-muted);max-width:620px;line-height:1.5')}>How the system decides late, missed and out of range, and the policies that govern clocking. Everything here saves to the live system — agree changes with the registered manager first.</div>
        <div style={s('flex:1')} />
        {canManage && <Button variant="primary" icon="check" disabled={saving || !dirty} onClick={saving || !dirty ? undefined : save}>{saving ? 'Saving…' : 'Save changes'}</Button>}
      </div>

      <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;align-items:start')}>
        {/* Grace & rounding — REAL */}
        <Section title="Grace periods & rounding" hint="How much leeway before a shift is flagged late">
          <Field label="Clock-in grace period" hint="Arrivals inside this window count as on time."><NumberField value={form.late_grace_minutes ?? 5} onChange={set('late_grace_minutes')} suffix="min" min="0" disabled={!canManage} /></Field>
          <Field label="Missed clock-out flag" hint="How long a record stays open before it becomes an exception."><NumberField value={form.auto_close_after_minutes ?? 30} onChange={set('auto_close_after_minutes')} suffix="min" min="0" disabled={!canManage} /></Field>
          <Field label="Rounding rule" hint="Applied to verified hours before they reach payroll. Zero keeps exact minutes."><NumberField value={form.timesheet_rounding_minutes ?? 0} onChange={set('timesheet_rounding_minutes')} suffix="min" min="0" disabled={!canManage} /></Field>
        </Section>

        {/* Geofencing — REAL + policy toggles */}
        <Section title="Geofencing" hint="Location capture at the moment of clocking only">
          <Field label="Geofence mode" hint="Flag for review, warn only, or block clock-in outside the fence.">
            <select style={inputStyle(!canManage)} value={form.geofence_mode ?? 'block'} onChange={set('geofence_mode')} disabled={!canManage}>
              <option value="warn">Warn — flag for review (recommended)</option>
              <option value="off">Off — record without checking</option>
              <option value="block">Block — refuse outside the radius</option>
            </select>
          </Field>
          <Field label="Fence radius" hint="Distance from the registered client address."><NumberField value={form.geofence_radius_m ?? 150} onChange={set('geofence_radius_m')} suffix="m" min="25" disabled={!canManage} /></Field>
          <Toggle label="Allow clocking without GPS" hint="Care is never blocked by a poor signal — the record is flagged instead." on={policy.gpsOptional} onChange={pset('gpsOptional')} />
          <Toggle label="Offline capture" hint="Store clock times on the device and sync with original timestamps." on={policy.offline} onChange={pset('offline')} />
        </Section>

        {/* PIN tablets */}
        <Section title="PIN tablets & devices" hint="For sites where personal phones are not used">
          <Toggle label="Wall-mounted PIN tablets" hint="Shared kiosk clocking for care homes and supported living." on={policy.pinTablets} onChange={pset('pinTablets')} />
          <Toggle label="Photo capture on PIN entry" hint="Optional snapshot to confirm identity at shared devices." on={policy.photoPin} onChange={pset('photoPin')} />
          <Toggle label="Manager manual entry" hint="Managers can record a clocking on a carer's behalf, always audited." on={policy.managerEntry} onChange={pset('managerEntry')} />
        </Section>

        {/* Escalation timings */}
        <Section title="Escalation timings" hint="Who hears about a missed clock-in, and when">
          {[['Tier 1 — carer reminder', `+${form.late_grace_minutes ?? 5} min`], ['Tier 2 — coordinator alert', '+15 min'], ['Tier 3 — manager SMS', '+30 min'], ['Tier 4 — cover broadcast', '+45 min']].map(([l, v]) => (
            <div key={l} style={s('display:flex;align-items:center;gap:12px')}>
              <div style={s('flex:1;font-size:12.5px;font-weight:600;color:var(--d-ink)')}>{l}</div>
              <Tag tone="primary">{v}</Tag>
            </div>
          ))}
          <div style={s('font-size:11px;font-weight:500;color:var(--d-muted)')}>Tier 1 follows the live grace period above.</div>
        </Section>

        {/* Permissions — REAL role matrix */}
        <Section title="Permissions" hint="Who can change a clocking record">
          <TableWrap minWidth={460}>
            <thead><tr><Th>Role</Th><Th>View board</Th><Th>Resolve</Th><Th>Amend times</Th><Th align="right">Approve pay</Th></tr></thead>
            <tbody>
              {PERMS.map((r) => (
                <Row key={r[0]}>
                  <Td><b style={s('font-weight:700;color:var(--d-ink)')}>{r[0]}</b></Td>
                  {r.slice(1).map((v, i) => <Td key={i} align={i === 3 ? 'right' : 'left'}>{v ? <Tag tone="success">Yes</Tag> : <Tag tone="muted">No</Tag>}</Td>)}
                </Row>
              ))}
            </tbody>
          </TableWrap>
        </Section>

        {/* Data & retention */}
        <Section title="Data & retention" hint="UK GDPR and NHS data standards">
          <Toggle label="Carer access to own records" hint="Carers can view and download their own clocking history in the app." on={policy.retainCarer} onChange={pset('retainCarer')} />
          <Toggle label="Weekly summary to carers" hint="Email each carer their verified hours before payroll closes." on={policy.weeklyEmail} onChange={pset('weeklyEmail')} />
          <Toggle label="Anonymise reporting exports" hint="Replace names with staff references in board-level reports." on={policy.anonymise} onChange={pset('anonymise')} />
        </Section>

        {/* Clock-in failure */}
        <Section title="Clock-in failure alerts" hint="What happens when a carer physically cannot clock in">
          <Toggle label={'“I can’t clock in” button in the carer app'} hint="Raises an alert to the on-duty manager with the reason and last known position." on={policy.failButton} onChange={pset('failButton')} />
          <Toggle label="Auto-open the visit record" hint="Care is never delayed — the visit starts as pending and is reconciled afterwards." on={policy.autoOpen} onChange={pset('autoOpen')} />
          <Toggle label="SMS fallback clocking" hint="Carer can text a code when the app cannot reach the network at all." on={policy.smsFallback} onChange={pset('smsFallback')} />
        </Section>

        {/* Notifications */}
        <Section title="Notifications & messaging" hint="Automatic messages sent from the console">
          <Toggle label="Shift reminder to carers" hint="Push 30 minutes before a visit is due to start." on={policy.shiftReminder} onChange={pset('shiftReminder')} />
          <Toggle label="Rota change notice" hint="Notify a carer whenever their assigned visits are edited." on={policy.rotaNotice} onChange={pset('rotaNotice')} />
          <Toggle label="Open shift broadcast" hint="Post unfilled visits to the relevant team channel automatically." on={policy.openBroadcast} onChange={pset('openBroadcast')} />
        </Section>
      </div>

      <div style={s('display:flex;align-items:center;gap:8px;font-size:12px;font-weight:500;color:var(--d-muted);padding:0 4px')}>
        <Icon name="info" size={15} /> All settings here — timings, geofence, permissions view and every policy toggle — save to the live system. Permissions reflects the real admin roles.
      </div>
    </div>
  );
}
