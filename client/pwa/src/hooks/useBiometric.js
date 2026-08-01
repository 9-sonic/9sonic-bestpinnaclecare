import { useCallback, useEffect, useState } from 'react';
import { isSupported, hasPlatformAuthenticator, registerPasskey } from '../api/webauthn.js';

// Passkey enrolment for this device.
//
// The credential itself never leaves the phone's secure hardware; the server
// only ever stores a public key. "Enrolled" here is a local hint used to decide
// what to offer in the UI, not a security decision, since the real check
// happens on the server every time the passkey is used.

const ENROLLED_KEY = 'bpc.passkey.enrolled';

export function useBiometric() {
  const [supported, setSupported] = useState(false);
  const [enrolled, setEnrolled] = useState(() => localStorage.getItem(ENROLLED_KEY) === '1');

  useEffect(() => {
    let active = true;
    hasPlatformAuthenticator().then((ok) => {
      if (active) setSupported(ok || isSupported());
    });
    return () => {
      active = false;
    };
  }, []);

  const enroll = useCallback(async (nickname) => {
    const res = await registerPasskey(nickname);
    localStorage.setItem(ENROLLED_KEY, '1');
    setEnrolled(true);
    return res;
  }, []);

  // Forgets the local hint only. The credential stays on the device and the
  // server keeps the public key, so revoking one properly needs an endpoint the
  // API does not have yet. See api_missing.md.
  const forget = useCallback(() => {
    localStorage.removeItem(ENROLLED_KEY);
    setEnrolled(false);
  }, []);

  return { supported, enrolled, enroll, forget };
}

export default useBiometric;
