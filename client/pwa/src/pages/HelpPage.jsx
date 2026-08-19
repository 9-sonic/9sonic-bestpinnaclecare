import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ScreenHeader from '../components/common/ScreenHeader.jsx';
import Card from '../components/common/Card.jsx';
import Icon from '../components/common/Icon.jsx';
import Button from '../components/common/Button.jsx';

const FAQS = [
  {
    q: 'What happens if I have no signal when I arrive?',
    a: 'Clock in as normal. The app saves the time and your location on the phone and sends it to the office automatically once you have signal again. Your recorded time is the moment you tapped, not the moment it synced.',
  },
  {
    q: 'I forgot to clock out. What do I do?',
    a: 'Message your manager through the Messages tab. They can correct the visit on their side, and the change will show in your timesheet.',
  },
  {
    q: 'Why does the app ask for my location?',
    a: 'Your location is recorded only at the moment you clock in and out, to confirm you attended the visit. The app does not track you between visits.',
  },
  {
    q: 'How do I change the days I can work?',
    a: 'Open Profile, then Availability. Tap the times you can work and save. Your manager sees the update straight away.',
  },
];

export default function HelpPage() {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div className="page--flush">
      <ScreenHeader title="Help and support" back onBack={() => navigate(-1)} />

      <div className="inset">
        <Card className="help-contact">
          <div className="help-contact__row">
            <span className="help-contact__icon">
              <Icon name="phone" size={18} />
            </span>
            <div>
              <p className="help-contact__label">On call office</p>
              <p className="help-contact__value">0113 496 0000</p>
            </div>
            <Button size="sm" onClick={() => window.open('tel:01134960000')}>
              Call
            </Button>
          </div>
          <p className="help-contact__note">
            For anything urgent about a client, call the office before messaging.
          </p>
        </Card>
      </div>

      <p className="list-group__label">Common questions</p>
      <div className="stack">
        {FAQS.map((faq, i) => {
          const open = openIndex === i;
          return (
            <Card key={faq.q} className="faq" padded={false}>
              <button
                type="button"
                className="faq__q"
                aria-expanded={open}
                onClick={() => setOpenIndex(open ? null : i)}
              >
                <span>{faq.q}</span>
                <span className={`faq__chevron${open ? ' faq__chevron--open' : ''}`}>
                  <Icon name="chevronDown" size={17} />
                </span>
              </button>
              {open && <p className="faq__a">{faq.a}</p>}
            </Card>
          );
        })}
      </div>

      <div className="page-actions">
        <Button block variant="white" onClick={() => navigate('/clock?assist=1')}>
          <Icon name="clock" size={16} />
          Request help with clocking in
        </Button>
        <Button block variant="white" onClick={() => navigate('/messages')}>
          <Icon name="chat" size={16} />
          Message my manager
        </Button>
      </div>
    </div>
  );
}
