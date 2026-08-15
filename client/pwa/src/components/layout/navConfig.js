// Single definition of the primary navigation, shared by the mobile tab bar
// and the desktop sidebar so they can never drift apart.
export const NAV_TABS = [
  { to: '/home', icon: 'home', label: 'Home' },
  { to: '/shifts', icon: 'calendar', label: 'Shifts' },
  { to: '/clock', icon: 'clock', label: 'Clock' },
  { to: '/messages', icon: 'chat', label: 'Chats' },
  { to: '/profile', icon: 'user', label: 'Profile' },
];

// Extra destinations that only make sense with the room a desktop gives us.
export const SECONDARY_LINKS = [
  { to: '/overview', icon: 'trend', label: 'Overview' },
  { to: '/timesheet', icon: 'wallet', label: 'Timesheet' },
  { to: '/notifications', icon: 'bell', label: 'Notifications' },
];
