import api from './client.js';
import env from '../config/env.js';
import { toUser } from './adapters.js';

// Passkey sign-in, backed by the server's WebAuthn endpoints.
//
// Each flow is two calls: ask for options and a signed challenge token, then
// send the browser's credential back with that same token. The token ties the
// two halves together, so they always travel as a pair.

// WebAuthn deals in ArrayBuffers, JSON deals in base64url. These convert.
function b64urlToBuffer(value) {
  const normalised = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalised.padEnd(normalised.length + ((4 - (normalised.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToB64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeCreationOptions(options) {
  return {
    ...options,
    challenge: b64urlToBuffer(options.challenge),
    user: { ...options.user, id: b64urlToBuffer(options.user.id) },
    excludeCredentials: (options.excludeCredentials ?? []).map((c) => ({
      ...c,
      id: b64urlToBuffer(c.id),
    })),
  };
}

function decodeRequestOptions(options) {
  return {
    ...options,
    challenge: b64urlToBuffer(options.challenge),
    allowCredentials: (options.allowCredentials ?? []).map((c) => ({
      ...c,
      id: b64urlToBuffer(c.id),
    })),
  };
}

function encodeCredential(credential) {
  const { response } = credential;
  return {
    id: credential.id,
    type: credential.type,
    rawId: bufferToB64url(credential.rawId),
    response: {
      clientDataJSON: bufferToB64url(response.clientDataJSON),
      ...(response.attestationObject
        ? { attestationObject: bufferToB64url(response.attestationObject) }
        : null),
      ...(response.authenticatorData
        ? {
            authenticatorData: bufferToB64url(response.authenticatorData),
            signature: bufferToB64url(response.signature),
            userHandle: response.userHandle ? bufferToB64url(response.userHandle) : null,
          }
        : null),
    },
  };
}

export function isSupported() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}

// Whether this device can do a built-in biometric check rather than an
// external security key. Used to decide if the prompt is worth offering.
export async function hasPlatformAuthenticator() {
  if (!isSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// Enrol this device. Needs an existing session, so it lives behind Preferences.
export async function registerPasskey(nickname = 'This device') {
  if (env.useMock) return { id: 1, nickname };

  const { challenge_token: challengeToken, options } = await api.post(
    '/staff/webauthn/registration/options'
  );
  const credential = await navigator.credentials.create({
    publicKey: decodeCreationOptions(options),
  });

  return api.post('/staff/webauthn/registration', {
    challenge_token: challengeToken,
    credential: encodeCredential(credential),
    nickname,
  });
}

// Passwordless sign-in with an enrolled passkey.
export async function loginWithPasskey(email) {
  if (env.useMock) {
    const { login } = await import('./auth.js');
    return login({ email, password: 'passkey' });
  }

  const { challenge_token: challengeToken, options } = await api.post(
    '/staff/webauthn/authentication/options',
    { email },
    { auth: false }
  );
  const credential = await navigator.credentials.get({
    publicKey: decodeRequestOptions(options),
  });

  const res = await api.post(
    '/staff/webauthn/authentication',
    { challenge_token: challengeToken, credential: encodeCredential(credential) },
    { auth: false }
  );

  return { token: res.access, user: toUser(res.employee) };
}
