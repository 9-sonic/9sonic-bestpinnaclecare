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

// InboxChannel carries two payload shapes, both addressed to
// "inbox:<Class>:<id>" so one subscription receives both:
//
//   { type: 'message',      conversation_id, message }      Messaging::SendMessage
//   { type: 'notification', notification }                   Notifications::Deliver
//
// Listeners get the payload verbatim and decide which they care about. Anything
// that only handles 'message' will silently drop notifications, which is how
// the bell used to go stale until the next poll.

// One consumer for the whole app, shared by every listener.
//
// Previously each subscribeInbox call built its own consumer, so mounting the
// layout, the thread list and a chat at once opened three sockets to the same
// channel and delivered every payload three times. The socket is opened on the
// first listener and closed after the last one leaves.
let consumer = null;
let subscription = null;
const listeners = new Set();

function teardown() {
  try { subscription?.unsubscribe(); } catch { /* noop */ }
  try { consumer?.disconnect(); } catch { /* noop */ }
  subscription = null;
  consumer = null;
}

// subscribeInbox(onPayload) -> unsubscribe().
export function subscribeInbox(onPayload) {
  // Mock mode has no backend to connect to.
  if (env.useMock || !getToken()) return () => {};

  listeners.add(onPayload);

  if (!consumer) {
    consumer = createConsumer(cableUrl());
    subscription = consumer.subscriptions.create(
      { channel: 'InboxChannel' },
      {
        received: (payload) => {
          if (!payload) return;
          // Copied first: a listener unsubscribing in response to a payload
          // must not change the set mid-iteration.
          [...listeners].forEach((fn) => {
            try { fn(payload); } catch { /* one bad listener must not stop the rest */ }
          });
        },
      }
    );
  }

  return () => {
    listeners.delete(onPayload);
    if (listeners.size === 0) teardown();
  };
}

// The token rides in the socket URL, so a sign-out or a new sign-in has to
// rebuild the connection rather than keep talking as the previous identity.
export function resetInbox() {
  teardown();
  listeners.clear();
}
