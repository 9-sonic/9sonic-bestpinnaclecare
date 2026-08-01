import { useEffect, useMemo, useState } from 'react';
import { listEmployees, inviteEmployee, updateEmployee } from '../api/index.js';
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
import { fullName } from '../api/format.js';

const EMPTY = { first_name: '', last_name: '', email: '', phone: '', role: 'carer', employee_reference: '' };

export default function EmployeesPage() {
  const toast = useToast();
  const { canManage } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  async function load() {
    const list = await listEmployees();
    setRows(list);
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
    return rows
      .filter((e) => (showInactive ? true : e.active))
      .filter((e) =>
        q ? `${e.full_name} ${e.email} ${e.employee_reference ?? ''}`.toLowerCase().includes(q) : true
      );
  }, [rows, query, showInactive]);

  function validate() {
    const next = {};
    if (!form.first_name.trim()) next.first_name = 'Required';
    if (!form.last_name.trim()) next.last_name = 'Required';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid work email';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateEmployee(editing.id, form);
        toast.success('Staff record updated');
      } else {
        await inviteEmployee(form);
        toast.success(`Invitation sent to ${form.email}`);
      }
      await load();
      setInviting(false);
      setEditing(null);
      setForm(EMPTY);
    } catch (err) {
      toast.error(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(employee) {
    try {
      await updateEmployee(employee.id, { active: !employee.active });
      toast.success(
        employee.active
          ? `${employee.first_name} deactivated, they can no longer sign in`
          : `${employee.first_name} reactivated`
      );
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not update');
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (e) => (
        <span className="cell-stack">
          <b>{fullName(e)}</b>
          <span className="cell-sub">{e.email}</span>
        </span>
      ),
    },
    { key: 'ref', header: 'Reference', width: '130px', render: (e) => e.employee_reference ?? '-' },
    {
      key: 'role',
      header: 'Role',
      width: '130px',
      render: (e) => (e.role === 'senior_carer' ? 'Senior carer' : 'Carer'),
    },
    { key: 'phone', header: 'Phone', width: '150px', render: (e) => e.phone ?? '-' },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (e) =>
        e.active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>,
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            width: '170px',
            render: (e) => (
              <div className="row-actions">
                <Button
                  size="sm"
                  variant="white"
                  onClick={() => {
                    setEditing(e);
                    setForm({
                      first_name: e.first_name,
                      last_name: e.last_name,
                      email: e.email,
                      phone: e.phone ?? '',
                      role: e.role,
                      employee_reference: e.employee_reference ?? '',
                    });
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant={e.active ? 'danger' : 'white'}
                  onClick={() => toggleActive(e)}
                >
                  {e.active ? 'Deactivate' : 'Reactivate'}
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  if (loading) return <Spinner fullscreen />;

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle={`${rows.filter((e) => e.active).length} active, ${rows.length} in total`}
        actions={
          canManage && (
            <Button
              onClick={() => {
                setForm(EMPTY);
                setEditing(null);
                setInviting(true);
              }}
            >
              <Icon name="plus" size={16} />
              Invite a carer
            </Button>
          )
        }
      />

      <div className="filters">
        <input
          className="field__input filters__search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email or reference"
        />
        <button
          type="button"
          className={`chip${showInactive ? ' chip--on' : ''}`}
          onClick={() => setShowInactive((v) => !v)}
        >
          Show inactive
        </button>
      </div>

      <Card padded={false}>
        <DataTable
          columns={columns}
          rows={filtered}
          empty={<EmptyState icon="users" title="No staff match" text="Try a different search." />}
        />
      </Card>

      <Modal
        open={inviting || !!editing}
        onClose={() => {
          setInviting(false);
          setEditing(null);
        }}
        title={editing ? `Edit ${editing.first_name}` : 'Invite a carer'}
        footer={
          <>
            <Button
              variant="white"
              onClick={() => {
                setInviting(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSave}>
              {editing ? 'Save changes' : 'Send invitation'}
            </Button>
          </>
        }
      >
        {!editing && (
          <p className="modal__lead">
            They will get an email with a link to set their own password. The account stays
            inactive until they use it.
          </p>
        )}

        <div className="form-grid">
          <label className="field">
            <span className="field__label">First name</span>
            <input
              className={`field__input${errors.first_name ? ' field__input--error' : ''}`}
              value={form.first_name}
              onChange={set('first_name')}
            />
            {errors.first_name && <span className="field__error">{errors.first_name}</span>}
          </label>

          <label className="field">
            <span className="field__label">Last name</span>
            <input
              className={`field__input${errors.last_name ? ' field__input--error' : ''}`}
              value={form.last_name}
              onChange={set('last_name')}
            />
            {errors.last_name && <span className="field__error">{errors.last_name}</span>}
          </label>
        </div>

        <label className="field">
          <span className="field__label">Work email</span>
          <input
            className={`field__input${errors.email ? ' field__input--error' : ''}`}
            type="email"
            value={form.email}
            onChange={set('email')}
            disabled={!!editing}
          />
          {errors.email && <span className="field__error">{errors.email}</span>}
          {editing && <span className="field__hint">Email is the sign in name and cannot be changed here.</span>}
        </label>

        <div className="form-grid">
          <label className="field">
            <span className="field__label">Mobile</span>
            <input className="field__input" value={form.phone} onChange={set('phone')} placeholder="07700 900000" />
          </label>

          <label className="field">
            <span className="field__label">Role</span>
            <select className="field__input" value={form.role} onChange={set('role')}>
              <option value="carer">Carer</option>
              <option value="senior_carer">Senior carer</option>
            </select>
          </label>
        </div>

        <label className="field">
          <span className="field__label">Staff reference</span>
          <input
            className="field__input"
            value={form.employee_reference}
            onChange={set('employee_reference')}
            placeholder="EMP-0000"
          />
        </label>
      </Modal>
    </>
  );
}
