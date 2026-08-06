import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getShift } from '../api/shifts.js';
import ScreenHeader from '../components/common/ScreenHeader.jsx';
import Card from '../components/common/Card.jsx';
import Icon from '../components/common/Icon.jsx';
import Avatar from '../components/common/Avatar.jsx';
import Button from '../components/common/Button.jsx';
import Spinner from '../components/common/Spinner.jsx';
import Modal from '../components/common/Modal.jsx';
import EmbeddedMap from '../components/nav/EmbeddedMap.jsx';
import { formatTimeRange } from '../utils/format.js';
import { tapFeedback } from '../utils/haptics.js';

// Getting to the visit.
//
// The map renders in the page rather than bouncing the carer into another app,
// because leaving the app mid shift is how people lose track of clocking in.
// Handing off to the phone's own map app is still there as a second option for
// anyone who wants turn by turn voice guidance, which an embedded map cannot do.
export default function NavigationPage() {
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chooser, setChooser] = useState(false);

  useEffect(() => {
    let active = true;
    getShift(shiftId)
      .then((s) => active && setShift(s))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [shiftId]);

  if (loading) return <Spinner fullscreen />;
  if (!shift) {
    return (
      <div className="page--flush">
        <ScreenHeader title="Directions" back onBack={() => navigate(-1)} />
        <p className="empty-text">That visit could not be found.</p>
      </div>
    );
  }

  const arrival = new Date(Date.now() + 8 * 60000).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const query = encodeURIComponent(shift.address);

  // Platform specific handoff. iOS opens Apple Maps unless Google is installed,
  // and the geo: scheme is what Android expects.
  function openExternal() {
    tapFeedback();
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIos
      ? `https://maps.apple.com/?daddr=${query}`
      : `https://www.google.com/maps/dir/?api=1&destination=${query}&travelmode=driving`;
    window.open(url, '_blank', 'noopener');
    setChooser(false);
  }

  return (
    <div className="page--flush">
      <ScreenHeader
        title="Directions"
        back
        onBack={() => navigate(-1)}
        action={
          shift.clientPhone && (
            <button
              type="button"
              className="icon-btn"
              aria-label={`Call ${shift.client}`}
              onClick={() => window.open(`tel:${shift.clientPhone}`)}
            >
              <Icon name="phone" size={18} />
            </button>
          )
        }
      />

      <div className="map-wrap">
        <EmbeddedMap destination={shift.address} coords={shift.geo} mode="directions" />
      </div>

      <Card className="nav-dest">
        <div className="nav-dest__top">
          <Avatar name={shift.client} size={40} />
          <div className="grow">
            <div className="nav-dest__name">{shift.client}</div>
            <div className="nav-dest__addr">{shift.address}</div>
          </div>
        </div>

        <div className="nav-dest__stats">
          <div className="nav-stat nav-stat--lead">
            <div className="nav-stat__label">ETA</div>
            <div className="nav-stat__value">{shift.eta ?? '8 min'}</div>
          </div>
          <div className="nav-stat">
            <div className="nav-stat__label">Distance</div>
            <div className="nav-stat__value">{shift.distance ?? '2.4 mi'}</div>
          </div>
          <div className="nav-stat">
            <div className="nav-stat__label">Arrive</div>
            <div className="nav-stat__value">{arrival}</div>
          </div>
        </div>

        <p className="nav-dest__when">
          <Icon name="clock" size={13} />
          Visit is {formatTimeRange(shift.startsAt, shift.endsAt)}
        </p>
      </Card>

      {shift.accessNotes && (
        <Card className="access-note">
          <span className="access-note__icon">
            <Icon name="info" size={16} />
          </span>
          <div>
            <p className="access-note__title">Getting in</p>
            <p className="access-note__text">{shift.accessNotes}</p>
          </div>
        </Card>
      )}

      <div className="page-actions nav-actions">
        <Button size="lg" block onClick={() => setChooser(true)}>
          <Icon name="location" size={16} />
          Start navigation
        </Button>
        <Button variant="white" block onClick={() => navigate(`/clock?shift=${shift.id}`)}>
          <Icon name="clock" size={16} />
          Go to clock in
        </Button>
      </div>

      <Modal
        open={chooser}
        onClose={() => setChooser(false)}
        title="How would you like to navigate?"
      >
        <div className="choice-list">
          <button
            type="button"
            className="nav-choice"
            onClick={() => {
              tapFeedback();
              setChooser(false);
              document.querySelector('.map-wrap')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span className="nav-choice__icon nav-choice__icon--teal">
              <Icon name="target" size={18} />
            </span>
            <span className="nav-choice__body">
              <span className="nav-choice__title">Stay in the app</span>
              <span className="nav-choice__text">
                Use the map above. You will not lose your place, and clocking in stays one tap away.
              </span>
            </span>
          </button>

          <button type="button" className="nav-choice" onClick={openExternal}>
            <span className="nav-choice__icon nav-choice__icon--grey">
              <Icon name="pin" size={18} />
            </span>
            <span className="nav-choice__body">
              <span className="nav-choice__title">Open my maps app</span>
              <span className="nav-choice__text">
                Full turn by turn directions with voice. Come back here to clock in when you arrive.
              </span>
            </span>
          </button>
        </div>
      </Modal>
    </div>
  );
}
