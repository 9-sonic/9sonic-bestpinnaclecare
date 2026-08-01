import { useEffect, useMemo, useState } from 'react';
import { listServiceUsers, createServiceUser, updateServiceUser } from '../api/index.js';
import PageHeader from '../components/common/PageHeader.jsx';
import Card from '../components/common/Card.jsx';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import Modal from '../components/common/Modal.jsx';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import DataTable from '../components/common/DataTable.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fullName, addressOf } from '../api/format.js';

const EMPTY = {
  first_name: '', last_name: '', reference: '', phone: '',
  address_line1: '', address_line2: '', city: '', postcode: '',
  lat: '', lng: '', geofence_radius_m: 150, geofence_mode: 'block', access_notes: '',
};

const GEOFENCE_HELP = {
  block: 'Clocking in is refused outside the radius. Use where attendance must be exact.',
  warn: 'Clocking in is allowed but flagged for the office to review.',
  off: 'Location is recorded but never checked against the address.',
};

export default function ServiceUsersPage() {
  const toast = useToast();
  const { canManage } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    setRows(await listServiceUsers());
  }

  useEffect(() => {
    let active = true;
    load().finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((s) =>
      `${s.full_name} ${s.reference ?? ''} ${s.postcode ?? ''}`.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        lat: form.lat === '' ? null : Number(form.lat),
        lng: form.lng === '' ? null : Number(form.lng),
        geofence_radius_m: Number(form.geofence_radius_m) || 150,
      };
      if (editing) {
        await updateServiceUser(editing.id, payload);
        toast.success('Record updated');
      } else {
        await createServiceUser(payload);
        toast.success('Person added');
      }
      await load();
      setEditing(null);
      setCreating(false);
      setForm(EMPTY);
    } catch (err) {
      toast.error(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (s) => (
        <span className="cell-stack">
          <b>{fullName(s)}</b>
          <span className="cell-sub">{s.reference ?? 'No reference'}</span>
        </span>
      ),
    },
    {
      key: 'address',
      header: 'Address',
      render: (s) => <span className="cell-sub">{addressOf(s)}</span>,
    },
    {
      key: 'geo',
      header: 'Geofence',
      width: '160px',
      render: (s) =>
        s.lat == null ? (
          <Badge tone="warn">No coordinates</Badge>
        ) : (
          <span className="cell-sub">
            {s.geofence_radius_m}m, {s.geofence_mode ?? 'block'}
          </span>
        ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            width: '90px',
            render: (s) => (
              <Button
                size="sm"
                variant="white"
                onClick={() => {
                  setEditing(s);
                  setForm({ ...EMPTY, ...s, lat: s.lat ?? '', lng: s.lng ?? '' });
                }}
              >
                Edit
              </Button>
            ),
          },
        ]
      : []),
  ];

  if (loading) return <Spinner fullscreen />;

  const missingCoords = rows.filter((s) => s.lat == null).length;

  return (
    <>
      <PageHeader
        title="People we support"
        subtitle={`${rows.length} on the books${missingCoords ? `, ${missingCoords} without coordinates` : ''}`}
        actions={
          canManage && (
            <Button
              onClick={() => {
                setForm(EMPTY);
                setEditing(null);
                setCreating(true);
              }}
            >
              <Icon name="plus" size={16} />
              Add a person
            </Button>
          )
        }
      />

      {missingCoords > 0 && (
        <Card className="warn-card">
          <Icon name="alert" size={18} />
          <div>
            <p className="warn-card__title">
              {missingCoords} {missingCoords === 1 ? 'address has' : 'addresses have'} no coordinates
            </p>
            <p className="warn-card__text">
              Without a latitude and longitude the geofence cannot be checked, so clock ins at those
              addresses are recorded without a location check.
            </p>
          </div>
        </Card>
      )}

      <div className="filters">
        <input
          className="field__input filters__search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, reference or postcode"
        />
      </div>

      <Card padded={false}>
        <DataTable
          columns={columns}
          rows={filtered}
          empty={<EmptyState icon="user" title="Nobody matches" text="Try a different search." />}
        />
      </Card>

      <Modal
        open={creating || !!editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? `Edit ${editing.first_name}` : 'Add a person'}
        wide
        footer={
          <>
            <Button
              variant="white"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button loading={saving} onClick={save}>
              Save
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <label className="field">
            <span className="field__label">First name</span>
            <input className="field__input" value={form.first_name} onChange={set('first_name')} />
          </label>
          <label className="field">
            <span className="field__label">Last name</span>
            <input className="field__input" value={form.last_name} onChange={set('last_name')} />
          </label>
        </div>

        <div className="form-grid">
          <label className="field">
            <span className="field__label">Reference</span>
            <input className="field__input" value={form.reference} onChange={set('reference')} />
          </label>
          <label className="field">
            <span className="field__label">Phone</span>
            <input className="field__input" value={form.phone} onChange={set('phone')} />
          </label>
        </div>

        <label className="field">
          <span className="field__label">Address</span>
          <input
            className="field__input"
            value={form.address_line1}
            onChange={set('address_line1')}
            placeholder="Line 1"
          />
        </label>

        <div className="form-grid">
          <label className="field">
            <span className="field__label">Town or city</span>
            <input className="field__input" value={form.city} onChange={set('city')} />
          </label>
          <label className="field">
            <span className="field__label">Postcode</span>
            <input className="field__input" value={form.postcode} onChange={set('postcode')} />
          </label>
        </div>

        <p className="form-section">Geofence</p>

        <div className="form-grid form-grid--three">
          <label className="field">
            <span className="field__label">Latitude</span>
            <input className="field__input" value={form.lat} onChange={set('lat')} placeholder="53.8225" />
          </label>
          <label className="field">
            <span className="field__label">Longitude</span>
            <input className="field__input" value={form.lng} onChange={set('lng')} placeholder="-1.5203" />
          </label>
          <label className="field">
            <span className="field__label">Radius, metres</span>
            <input
              className="field__input"
              type="number"
              value={form.geofence_radius_m}
              onChange={set('geofence_radius_m')}
            />
          </label>
        </div>

        <label className="field">
          <span className="field__label">Checking mode</span>
          <select className="field__input" value={form.geofence_mode} onChange={set('geofence_mode')}>
            <option value="block">Block, refuse clock in outside the radius</option>
            <option value="warn">Warn, allow but flag it</option>
            <option value="off">Off, record location without checking</option>
          </select>
          <span className="field__hint">{GEOFENCE_HELP[form.geofence_mode]}</span>
        </label>

        <label className="field">
          <span className="field__label">Access notes for carers</span>
          <textarea
            className="textarea"
            rows={3}
            value={form.access_notes}
            onChange={set('access_notes')}
            placeholder="Key safe code, parking, who is usually in, anything a carer needs at the door."
          />
        </label>
      </Modal>
    </>
  );
}
