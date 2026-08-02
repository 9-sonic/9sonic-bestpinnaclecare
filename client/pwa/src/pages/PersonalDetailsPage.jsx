import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ScreenHeader from '../components/common/ScreenHeader.jsx';
import Card from '../components/common/Card.jsx';
import Icon from '../components/common/Icon.jsx';
import Button from '../components/common/Button.jsx';
import Avatar from '../components/common/Avatar.jsx';
import EditProfileDialog from '../components/profile/EditProfileDialog.jsx';
import { useAuth } from '../hooks/useAuth.js';

function DetailRow({ label, value, icon }) {
  return (
    <div className="detail-row">
      <span className="detail-row__icon">
        <Icon name={icon} size={17} />
      </span>
      <span className="detail-row__text">
        <span className="detail-row__label">{label}</span>
        <span className="detail-row__value">{value || 'Not set'}</span>
      </span>
    </div>
  );
}

export default function PersonalDetailsPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [editing, setEditing] = useState(false);

  return (
    <div className="page--flush">
      <ScreenHeader
        title="Personal details"
        back
        onBack={() => navigate('/profile')}
        action={
          <button
            type="button"
            className="icon-btn"
            aria-label="Edit personal details"
            onClick={() => setEditing(true)}
          >
            <Icon name="edit" size={18} />
          </button>
        }
      />

      <div className="detail-head">
        <Avatar name={user?.name ?? ''} src={user?.avatar} size={72} />
        <h2 className="detail-head__name">{user?.name}</h2>
        <p className="detail-head__role">{user?.role}</p>
      </div>

      <p className="list-group__label">Contact</p>
      <Card className="stack-card" padded={false}>
        <DetailRow icon="user" label="Full name" value={user?.name} />
        <DetailRow icon="chat" label="Email" value={user?.email} />
        <DetailRow icon="phone" label="Mobile" value={user?.phone} />
        <DetailRow icon="alert" label="Emergency contact" value={user?.emergencyContact} />
      </Card>

      <p className="list-group__label">Employment</p>
      <Card className="stack-card" padded={false}>
        <DetailRow icon="file" label="Staff ID" value={user?.staffId} />
        <DetailRow icon="shield" label="Role" value={user?.role} />
        <DetailRow icon="calendar" label="Availability" value={user?.availability} />
      </Card>

      <div className="page-actions">
        <Button block onClick={() => setEditing(true)}>
          <Icon name="edit" size={16} />
          Edit details
        </Button>
      </div>

      <EditProfileDialog
        open={editing}
        onClose={() => setEditing(false)}
        user={user}
        onSaved={setUser}
      />
    </div>
  );
}
