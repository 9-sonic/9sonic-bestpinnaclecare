import api from './client.js';
import env from '../config/env.js';
import * as mock from '../mocks/mockApi.js';
import { toNotifications } from './adapters.js';

export async function listNotifications() {
  const res = env.useMock ? await mock.listNotifications() : await api.get('/notifications');
  return toNotifications(res);
}

// The API marks one notification seen at a time.
export function markSeen(id) {
  if (env.useMock) return mock.markNotificationSeen(id);
  return api.post(`/notifications/${id}/seen`);
}

// No bulk endpoint exists, so this fans out over the unread ids.
// See api_missing.md.
export async function markAllRead(ids = []) {
  if (env.useMock) return mock.markAllNotificationsRead();
  await Promise.all(ids.map((id) => api.post(`/notifications/${id}/seen`)));
  return { ok: true };
}

export function getPreferences() {
  if (env.useMock) return mock.getNotificationPreferences();
  return api.get('/notification_preferences');
}

export function updatePreferences(patch) {
  if (env.useMock) return mock.updateNotificationPreferences(patch);
  return api.patch('/notification_preferences', patch);
}
