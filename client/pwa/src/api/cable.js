import env from '../config/env.js';
import { getToken } from '../utils/storage.js';

// Minimal ActionCable client for the carer app. Browsers can't set headers on a
// WebSocket, so the JWT rides as a query param (?token=...) — the server decodes
// it the same way as an HTTP request. Subscribes to InboxChannel and calls
// onMessage(payload) for each broadcast. Reconnects with backoff.

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

// subscribeInbox(onMessage) -> unsubscribe(). onMessage receives the raw payload
// broadcast by the server, e.g. { type: 'message', conversation_id, message }.
export function subscribeInbox(onMessage) {
  // Mock mode has no backend, so a socket would only fail its handshake and log
  // a console error (which the layout tests treat as a failure). Do nothing.
  if (env.useMock) return () => {};

  const IDENTIFIER = JSON.stringify({ channel: 'InboxChannel' });
  let ws = null;
  let closed = false;
  let retries = 0;

  function open() {
    if (closed || !getToken()) return;
    try { ws = new WebSocket(cableUrl()); } catch { schedule(); return; }
    ws.onmessage = (ev) => {
      let data;
      try { data = JSON.parse(ev.data); } catch { return; }
      if (data.type === 'welcome') { ws.send(JSON.stringify({ command: 'subscribe', identifier: IDENTIFIER })); return; }
      if (data.type === 'ping' || data.type === 'confirm_subscription' || data.type === 'reject_subscription') return;
      if (data.message) onMessage(data.message);
    };
    ws.onopen = () => { retries = 0; };
    ws.onclose = () => { if (!closed) schedule(); };
    ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
  }

  function schedule() {
    const delay = Math.min(1000 * 2 ** retries, 15000);
    retries += 1;
    setTimeout(open, delay);
  }

  open();
  return () => { closed = true; try { if (ws) ws.close(); } catch { /* noop */ } };
}
