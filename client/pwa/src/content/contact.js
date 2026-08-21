// The real phone numbers for reaching the office/manager, used everywhere the
// app offers a call. Previously duplicated as a placeholder ("0113 496 0000")
// independently in content/legal.js, HelpPage and ChatPage, which is how it went
// stale in three places while being fixed in a fourth. Single source now, so
// there is nowhere left for it to drift out of sync.
//
// OFFICE_CONTACT stays the primary line (its shape is what call buttons read);
// OFFICE_CONTACT_ALT is the second office line from the company site, and
// OFFICE_CONTACTS lists both for screens that show every way to reach the office.
export const OFFICE_CONTACT = {
  label: 'On call office',
  value: '07427 165307',
  tel: '+447427165307',
};

export const OFFICE_CONTACT_ALT = {
  label: 'Office (alternate)',
  value: '07926 431397',
  tel: '+447926431397',
};

export const OFFICE_CONTACTS = [OFFICE_CONTACT, OFFICE_CONTACT_ALT];

// The office email and registered address, from bestpinnaclecare.co.uk. Used in
// the legal/help text; kept here so all company contact details live in one file.
export const OFFICE_EMAIL = 'info@bestpinnaclecare.co.uk';
export const OFFICE_ADDRESS = 'Best Pinnacle Care Ltd, 8 Shaftesbury Centre, Rodbourne, Percy Street, Swindon, SN2 2AZ';
