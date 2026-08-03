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

// One call now that POST /notifications/seen_all exists. The ids argument is
// kept so callers do not all have to change at once, and because it is still
// the fallback if the bulk route is unavailable — a carer with thirty unread
// items should not fire thirty requests on a phone connection.
export async function markAllRead(ids = []) {
  if (env.useMock) return mock.markAllNotificationsRead();

  try {
    return await api.post('/notifications/seen_all');
  } catch (error) {
    if (error?.status !== 404) throw error;
    await Promise.all(ids.map((id) => api.post(`/notifications/${id}/seen`)));
    return { ok: true };
  }
}

export function getPreferences() {
  if (env.useMock) return mock.getNotificationPreferences();
  return api.get('/notification_preferences');
}

export function updatePreferences(patch) {
  if (env.useMock) return mock.updateNotificationPreferences(patch);
  return api.patch('/notification_preferences', patch);
}
