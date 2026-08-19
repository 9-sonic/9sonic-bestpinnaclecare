// The one real phone number for reaching the office/manager, used everywhere
// the app offers a call. Previously duplicated as a placeholder ("0113 496
// 0000") independently in content/legal.js, HelpPage and ChatPage, which is
// how it went stale in three places while being fixed in a fourth. Single
// source now, so there is nowhere left for it to drift out of sync.
export const OFFICE_CONTACT = {
  label: 'On call office',
  value: '07427 165307',
  tel: '+447427165307',
};
