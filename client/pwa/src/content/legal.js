// Reference text shown in the Terms, Privacy and Help sheets.
//
// Kept out of the components so the wording can be reviewed and changed by
// someone who is not editing JSX. Everything here still needs sign off from
// Best Pinnacle before release: it describes how the system behaves, but the
// data controller details and retention periods are the client's to confirm.

import { OFFICE_CONTACT } from './contact.js';

export const TERMS = {
  title: 'Terms of use',
  sections: [
    {
      heading: 'Who this app is for',
      body: 'This app is for people employed or engaged by Best Pinnacle Care. Your account is issued by the office and is personal to you. Do not share your sign in details, and never let anyone else clock in or out as you.',
    },
    {
      heading: 'Recording your time',
      body: 'Clocking in and out creates a record of when you started and finished a visit. That record is used for your timesheet and as evidence the visit took place. If you clock in with no signal, the app saves the time you tapped and sends it later, so your record shows when you were actually there.',
    },
    {
      heading: 'Corrections',
      body: 'If a time is wrong, tell the office. A manager can add a correction, but your original record is never deleted or overwritten. Both are kept, with a note of who made the change and why.',
    },
    {
      heading: 'Your device',
      body: 'You can install this app on your own phone. It stores your visits and any unsent clock events on the device so it works without signal. Signing out clears that data.',
    },
    {
      heading: 'Acceptable use',
      body: 'Only record your own visits, and only when they happen. Deliberately recording time you did not work is a disciplinary matter and may be fraud.',
    },
  ],
  footer: 'If anything here is unclear, ask your manager rather than guessing.',
};

export const PRIVACY = {
  title: 'Privacy notice',
  lead: 'Your location is only ever recorded at the moment you clock in or out. The app does not track you between visits.',
  leadIcon: 'pin',
  sections: [
    {
      heading: 'What we record',
      body: 'Your name, work email, phone number, employee reference and the visits you are assigned. When you clock in or out we record the time and your location at that moment.',
    },
    {
      heading: 'Location, and when it is used',
      body: 'Only at the moment you tap clock in or clock out. Not at any other time. The app does not follow you between visits, does not run in the background, and cannot see where you are when you are off shift.',
    },
    {
      heading: 'Why location is used at all',
      body: 'To confirm you attended the right address. The distance between you and the home is stored with the clock record. If your phone cannot get a fix you can still clock in, and the record is marked as having no location rather than being refused.',
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
      body: 'Messages you send in the app are between you and the office. Treat them as work records, and do not put anything about a client in them that does not belong in the care record.',
    },
  ],
};

export const HELP = {
  title: 'Help and support',
  contact: OFFICE_CONTACT,
  lead: 'For anything urgent about a person you support, call the office before messaging.',
  leadIcon: 'phone',
  sections: [
    {
      heading: 'What if I have no signal when I arrive?',
      body: 'Clock in as normal. The app saves the time and your location on the phone and sends it once you have signal. Your recorded time is the moment you tapped, not the moment it synced.',
    },
    {
      heading: 'I forgot to clock out',
      body: 'Message your manager through the Messages tab. They can add a correction on their side, and it will show in your timesheet. Your original record stays as it is.',
    },
    {
      heading: 'It says I am too far away',
      body: 'The app checks you are at the address when you clock in. If you are sure you are in the right place, move outside for a better GPS fix and try again. If it still refuses, call the office rather than waiting.',
    },
    {
      heading: 'How do I change the days I can work?',
      body: 'Open Profile, then Availability. Tap the times you can work and save. Your manager sees the update straight away.',
    },
    {
      heading: 'Something in the app is broken',
      body: 'Tell your manager what you were doing and what you saw. If you can, note the version shown at the bottom of the Profile screen, it helps whoever fixes it.',
    },
  ],
};
