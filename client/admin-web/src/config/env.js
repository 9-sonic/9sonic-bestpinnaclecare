// Every environment value is read here and nowhere else.
// Reminder: all of it ships to the browser and is readable by anyone.

const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  appName: import.meta.env.VITE_APP_NAME ?? 'Best Pinnacle Care',
  useMock: (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false',
  isDev: import.meta.env.DEV,
};

if (env.isDev && !env.useMock && !env.apiBaseUrl) {
  // eslint-disable-next-line no-console
  console.warn('[config] VITE_API_BASE_URL is not set. Copy .env.example to .env.');
}

export default env;
