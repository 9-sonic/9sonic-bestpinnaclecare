import api from './client.js';
import env from '../config/env.js';
import * as mock from '../mocks/mockApi.js';
import { toThreads, toThread, toMessages } from './adapters.js';
import { newUuid } from '../utils/ids.js';

// Chat is shared between the office and carers, so participants are polymorphic
// ({ type: "Admin" | "Employee", id }). The viewer is passed in so the adapter
// can work out which messages belong to this carer.

// Participant display names come from the server on the live path — the
// conversations endpoint is documented as returning names, unread counts and a
// preview. `mock.participantName` is a lookup over sample people and must never
// be reachable with a real API behind it: against live data it would either
// return nothing or, worse, label a thread with the wrong person's name.
const nameFor = (participant) => (env.useMock ? mock.participantName(participant) : undefined);

export async function listThreads(viewer) {
  const res = env.useMock ? await mock.listConversations() : await api.get('/conversations');
  return toThreads(res, {
    viewerType: 'Employee',
    viewerId: viewer?.id,
    nameFor,
  });
}

// Just the messages, for refreshing an open thread.
//
// getThread below has to fetch the conversation list too, because that is where
// the thread's name and participants live. None of that changes when a message
// arrives, so refetching it on every socket payload doubled the requests for a
// busy conversation. Screens use getThread once on open and this thereafter.
// `participants` comes from the thread already held in state (ChatPage passes
// thread.participants) — refreshing on every socket message never re-fetches
// the conversation, so this is the only source for who's who on that path.
export async function getThreadMessages(id, viewer, participants) {
  const msgs = env.useMock ? await mock.listMessages(id) : await api.get(`/conversations/${id}/messages`);
  return toMessages(msgs, { viewerType: 'Employee', viewerId: viewer?.id, participants, nameFor });
}

export async function getThread(id, viewer) {
  const [convos, msgs] = await Promise.all([
    env.useMock ? mock.listConversations() : api.get('/conversations'),
    env.useMock ? mock.listMessages(id) : api.get(`/conversations/${id}/messages`),
  ]);

  const convo = (convos ?? []).find((c) => String(c.id) === String(id));
  const thread = convo
    ? toThread(convo, {
        viewerType: 'Employee',
        viewerId: viewer?.id,
        nameFor,
      })
    : { id: String(id), name: 'Conversation', unread: 0 };

  return {
    ...thread,
    messages: toMessages(msgs, {
      viewerType: 'Employee',
      viewerId: viewer?.id,
      participants: convo?.participants,
      nameFor,
    }),
  };
}

// client_message_id makes the send idempotent, the same idea as clock events.
// Attachments (docs, images, audio, video): 25 MB per file, matching the
// backend's Message::MESSAGE_FILE_MAX_BYTES. Checked before upload for instant,
// clear feedback.
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export function attachmentTooLarge(file) {
  if (file && file.size > MAX_ATTACHMENT_BYTES) return `“${file.name}” is over 25 MB. Please choose a smaller file.`;
  return null;
}

// Flatten a message's attachments into the shape ChatPage's bubble reads.
function toAttachments(list) {
  return (list ?? []).map((a) => ({
    id: a.id, filename: a.filename, contentType: a.content_type, byteSize: a.byte_size, url: a.url,
  }));
}

export async function sendMessage({ threadId, text, files }) {
  const clientMessageId = newUuid();
  let res;
  if (files && files.length) {
    // Multipart: the api client detects FormData and lets the browser set the
    // multipart boundary. Body may be empty when it's an attachment-only message.
    const fd = new FormData();
    fd.append('body', text ?? '');
    fd.append('client_message_id', clientMessageId);
    files.forEach((f) => fd.append('files[]', f));
    res = env.useMock
      ? await mock.sendMessage({ threadId, body: text, client_message_id: clientMessageId })
      : await api.post(`/conversations/${threadId}/messages`, fd);
  } else {
    const body = { body: text, client_message_id: clientMessageId };
    res = env.useMock
      ? await mock.sendMessage({ threadId, ...body })
      : await api.post(`/conversations/${threadId}/messages`, body);
  }
  return { id: String(res.id), mine: true, text: res.body, at: res.created_at, attachments: toAttachments(res.attachments) };
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

// The office staff a carer can start a chat with — admins only. The server
// decides who's listed (active office accounts), so the carer can only ever
// reach the office, never other carers or clients.
export async function listOfficeContacts() {
  if (env.useMock) return mock.listOfficeContacts ? mock.listOfficeContacts() : [];
  return api.get('/staff/office_contacts');
}

// Start (or reuse) a direct chat with an office admin, returning the thread id
// to open. The backend dedupes to the existing DM if one already exists.
export async function startOfficeChat(adminId) {
  if (env.useMock) {
    const c = await mock.createConversation({ kind: 'direct', participants: [{ type: 'Admin', id: adminId }] });
    return String(c.id);
  }
  const c = await api.post('/conversations', { kind: 'direct', participant: { type: 'Admin', id: adminId } });
  return String(c.id);
}
