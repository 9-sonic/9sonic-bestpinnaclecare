// Single source of truth for environment configuration.
// Read env vars ONLY here, so the rest of the app never touches import.meta.env
// directly. This keeps config validated and easy to change.
//
// Reminder: these values are PUBLIC (bundled into the browser). No secrets.

const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  mapsApiKey: import.meta.env.VITE_MAPS_API_KEY ?? '',
  appName: import.meta.env.VITE_APP_NAME ?? 'Best Pinnacle Care',
  // When true, the app uses in-browser mock data instead of the Rails API.
  //
  // Defaults to FALSE: the app talks to the real API unless something asks it
  // not to. The default used to be true, which meant any deployment that
  // forgot to set this would serve invented shifts to a real carer — a screen
  // full of confident, wrong information is worse than an error.
  //
  // The Playwright suite sets VITE_USE_MOCK=true explicitly, so it keeps
  // running against fixtures with no backend.
  useMock: (import.meta.env.VITE_USE_MOCK ?? 'false') === 'true',
  isDev: import.meta.env.DEV,
};

// Fail loudly in dev if the API URL is missing, rather than silently
// making requests to the wrong place.
if (env.isDev && !env.useMock && !env.apiBaseUrl) {
  // eslint-disable-next-line no-console
  console.warn(
    '[config] VITE_API_BASE_URL is not set. Copy .env.example to .env and set it.'
  );
}

export default env;
