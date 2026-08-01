import api from './client.js';
import env from '../config/env.js';
import * as mock from '../mocks/mockApi.js';
import { toThreads, toThread, toMessages } from './adapters.js';
import { newUuid } from '../utils/ids.js';

// Chat is shared between the office and carers, so participants are polymorphic
// ({ type: "Admin" | "Employee", id }). The viewer is passed in so the adapter
// can work out which messages belong to this carer.

export async function listThreads(viewer) {
  const res = env.useMock ? await mock.listConversations() : await api.get('/conversations');
  return toThreads(res, {
    viewerType: 'Employee',
    viewerId: viewer?.id,
    nameFor: mock.participantName,
  });
}

export async function getThread(id, viewer) {
  const [convos, msgs] = await Promise.all([
    env.useMock ? mock.listConversations() : api.get('/conversations'),
    env.useMock ? mock.listMessages(id) : api.get(`/conversations/${id}/messages`),
  ]);

  const convo = convos.find((c) => String(c.id) === String(id));
  const thread = convo
    ? toThread(convo, {
        viewerType: 'Employee',
        viewerId: viewer?.id,
        nameFor: mock.participantName,
      })
    : { id: String(id), name: 'Conversation', unread: 0 };

  return {
    ...thread,
    messages: toMessages(msgs, { viewerType: 'Employee', viewerId: viewer?.id }),
  };
}

// client_message_id makes the send idempotent, the same idea as clock events.
export async function sendMessage({ threadId, text }) {
  const body = { body: text, client_message_id: newUuid() };
  const res = env.useMock
    ? await mock.sendMessage({ threadId, ...body })
    : await api.post(`/conversations/${threadId}/messages`, body);
  return { id: String(res.id), mine: true, text: res.body, at: res.created_at };
}

// Read receipts are per message, so the UI marks the newest one on open.
export function markRead(messageId) {
  if (env.useMock) return mock.markThreadRead(messageId);
  if (!messageId) return Promise.resolve({ ok: true });
  return api.post(`/messages/${messageId}/receipts`);
}

export function createConversation({ participants, title, kind = 'direct' }) {
  if (env.useMock) return mock.createConversation({ participants, title, kind });
  return api.post('/conversations', { kind, title, participants });
}
