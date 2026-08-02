import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ScreenHeader from '../components/common/ScreenHeader.jsx';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import Icon from '../components/common/Icon.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../context/ToastContext.jsx';
import { updateAvailability } from '../api/auth.js';

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

const SLOTS = [
  { key: 'morning', label: 'Morning', time: '7am to 12pm' },
  { key: 'afternoon', label: 'Afternoon', time: '12pm to 5pm' },
  { key: 'evening', label: 'Evening', time: '5pm to 10pm' },
];

const DEFAULT = {
  mon: ['morning', 'afternoon'],
  tue: ['morning', 'afternoon'],
  wed: ['morning', 'afternoon'],
  thu: ['morning', 'afternoon'],
  fri: ['morning'],
  sat: [],
  sun: [],
};

// Lets a carer tell the office which parts of which days they can work.
export default function AvailabilityPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, setUser } = useAuth();
  const [avail, setAvail] = useState(() => user?.availabilityDays ?? DEFAULT);
  const [saving, setSaving] = useState(false);

  const toggle = (day, slot) =>
    setAvail((a) => {
      const current = a[day] ?? [];
      return {
        ...a,
        [day]: current.includes(slot) ? current.filter((s) => s !== slot) : [...current, slot],
      };
    });

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateAvailability(avail);
      setUser(updated);
      toast.success('Availability sent to the office');
    } catch {
      toast.error('Could not save availability');
    } finally {
      setSaving(false);
    }
  }

  const totalSlots = Object.values(avail).reduce((n, list) => n + list.length, 0);

  return (
    <div className="page--flush">
      <ScreenHeader title="Availability" back onBack={() => navigate('/profile')} />

      <div className="inset">
        <Card className="info-card">
          <Icon name="info" size={17} />
          <p>
            Tap the times you can work. Your manager uses this when building the rota, so keep it
            up to date.
          </p>
        </Card>
      </div>

      <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
        {DAYS.map((day) => (
          <Card key={day.key} className="avail-day">
            <div className="avail-day__head">
              <span className="avail-day__name">{day.label}</span>
              <span className="avail-day__count">
                {(avail[day.key] ?? []).length === 0
                  ? 'Unavailable'
                  : `${(avail[day.key] ?? []).length} of 3`}
              </span>
            </div>
            <div className="avail-day__slots">
              {SLOTS.map((slot) => {
                const on = (avail[day.key] ?? []).includes(slot.key);
                return (
                  <button
                    key={slot.key}
                    type="button"
                    aria-pressed={on}
                    className={`slot${on ? ' slot--on' : ''}`}
                    onClick={() => toggle(day.key, slot.key)}
                  >
                    <span className="slot__label">{slot.label}</span>
                    <span className="slot__time">{slot.time}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <div className="page-actions">
        <Button block size="lg" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving' : `Save availability (${totalSlots} slots)`}
        </Button>
      </div>
    </div>
  );
}
