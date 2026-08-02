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
  // Flip to false (in .env) once the backend is ready. Defaults to true so
  // the frontend runs standalone out of the box.
  useMock: (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false',
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
