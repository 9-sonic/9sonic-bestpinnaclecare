import { useParams, useNavigate } from 'react-router-dom';
import ScreenHeader from '../components/common/ScreenHeader.jsx';
import Card from '../components/common/Card.jsx';
import Icon from '../components/common/Icon.jsx';

// Terms and the privacy notice.
//
// The privacy text is written for carers rather than lawyers, because the thing
// staff actually worry about is whether the company can see where they are when
// they are not working. The honest answer is no, and saying so plainly in the
// app does more for trust than a policy nobody opens.
//
// Wording still needs sign off from Best Pinnacle before release: it describes
// how the system behaves, but the data controller details and retention periods
// are the client's to confirm.

const TERMS = [
  {
    heading: 'Who this app is for',
    body: 'This app is for people employed or engaged by Best Pinnacle Care. Your account is issued by the office and is personal to you. Do not share your sign in details or let anyone else clock in or out as you.',
  },
  {
    heading: 'Recording your time',
    body: 'Clocking in and out creates a record of when you started and finished a visit. That record is used for your timesheet and for evidence that the visit took place. If you clock in with no signal, the app saves the time you tapped and sends it later, so your record shows when you were actually there.',
  },
  {
    heading: 'Corrections',
    body: 'If a time is wrong, tell the office. A manager can add a correction, but your original record is never deleted or overwritten. Both are kept, along with a note of who made the change and why.',
  },
  {
    heading: 'Your device',
    body: 'You can install this app on your own phone. It stores your visits and any unsent clock events on the device so it works without signal. Signing out clears that data.',
  },
  {
    heading: 'Acceptable use',
    body: 'Only record your own visits, and only record them when they happen. Deliberately recording time you did not work is a disciplinary matter and may be fraud.',
  },
];

const PRIVACY = [
  {
    heading: 'What we record',
    body: 'Your name, work email, phone number, employee reference and the visits you are assigned. When you clock in or out we record the time, and your location at that moment.',
  },
  {
    heading: 'Location, and when it is used',
    body: 'Your location is captured only at the moment you tap clock in or clock out. It is not recorded at any other time. The app does not follow you between visits, it does not run in the background, and it cannot see where you are when you are off shift.',
  },
  {
    heading: 'Why location is used at all',
    body: 'To confirm you attended the right address. The distance between you and the home is stored alongside the clock record. If your phone cannot get a fix, you can still clock in and the record is marked as having no location rather than being refused.',
  },
  {
    heading: 'Who can see it',
    body: 'Office staff at Best Pinnacle Care who manage rotas, timesheets and care quality. Records may also be shown to a regulator such as the CQC, or used to answer a query about a visit.',
  },
  {
    heading: 'How long it is kept',
    body: 'Clock records and visit notes are kept as part of the care record and for employment purposes. The office can tell you the exact retention period for your role.',
  },
  {
    heading: 'Your rights',
    body: 'You can ask for a copy of the personal data held about you, ask for mistakes to be corrected, and object to how it is used. Speak to your manager or the office to start any of these.',
  },
  {
    heading: 'Messages',
    body: 'Messages you send in the app are between you and the office. Treat them as work records, not private conversation, and do not put anything about a client in them that does not belong in the care record.',
  },
];

const CONTENT = {
  terms: { title: 'Terms of use', sections: TERMS },
  privacy: { title: 'Privacy notice', sections: PRIVACY },
};

export default function LegalPage() {
  const { doc } = useParams();
  const navigate = useNavigate();
  const content = CONTENT[doc] ?? CONTENT.terms;

  return (
    <div className="page--flush">
      <ScreenHeader title={content.title} back onBack={() => navigate(-1)} />

      {doc === 'privacy' && (
        <div className="inset">
          <Card className="info-card">
            <Icon name="pin" size={17} />
            <p>
              Your location is only ever recorded at the moment you clock in or out. The app does
              not track you between visits.
            </p>
          </Card>
        </div>
      )}

      <div className="legal">
        {content.sections.map((s) => (
          <section key={s.heading} className="legal__section">
            <h2 className="legal__heading">{s.heading}</h2>
            <p className="legal__body">{s.body}</p>
          </section>
        ))}

        <p className="legal__footer">
          Best Pinnacle Care. If anything here is unclear, ask your manager rather than guessing.
        </p>
      </div>
    </div>
  );
}
