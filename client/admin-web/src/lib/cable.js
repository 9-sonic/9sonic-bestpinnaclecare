import env from '../config/env.js';
import { getToken } from '../utils/storage.js';
import { createConsumer } from '@rails/actioncable';

// Realtime inbox over ActionCable, using the official @rails/actioncable client
// so the subscribe / welcome / ping framing matches the server exactly (the
// hand-rolled socket got the protocol subtly wrong and the server rejected the
// command as nil). The JWT rides as a query param because browsers can't set
// headers on a WebSocket; the server decodes it like any HTTP request.

function cableUrl() {
  const httpBase = (env.apiBaseUrl || window.location.origin).replace(/\/api\/v1\/?$/, '');
  const u = new URL(httpBase, window.location.origin);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = '/cable';
  u.search = '';
  const token = getToken();
  if (token) u.searchParams.set('token', token);
  return u.toString();
}

// subscribeInbox(onMessage) -> unsubscribe(). onMessage receives the payload the
// server broadcasts, e.g. { type: 'message', conversation_id, message }.
export function subscribeInbox(onMessage) {
  // Mock mode has no backend to connect to.
  if (env.useMock || !getToken()) return () => {};

  const consumer = createConsumer(cableUrl());
  const subscription = consumer.subscriptions.create(
    { channel: 'InboxChannel' },
    { received: (payload) => { if (payload) onMessage(payload); } }
  );

  return () => {
    try { subscription.unsubscribe(); } catch { /* noop */ }
    try { consumer.disconnect(); } catch { /* noop */ }
  };
}
