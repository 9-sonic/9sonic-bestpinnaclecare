import api from './client.js';
import env from '../config/env.js';

// Cover offers advertised to this carer. The office broadcasts an unfilled visit
// to everyone eligible; the first to accept fills it (the backend locks the
// visit), and the rest see it's gone. Accept is online-only for now — it must be
// confirmed live, not queued, because an offline accept could lose a race it
// can't yet see.

// The carer's open cover offers, soonest visit first. Each carries the visit
// detail (client, time, address) needed to decide.
export async function listCoverOffers() {
  if (env.useMock) return [];
  const res = await api.get('/staff/cover_offers');
  return (res ?? []).map(toOffer);
}

// Accept an offer. Resolves with the filled assignment on success; throws with a
// typed message when the visit was already taken or the carer has a clash.
export async function acceptCoverOffer(id) {
  const res = await api.post(`/staff/cover_offers/${id}/accept`);
  return res;
}

export async function declineCoverOffer(id) {
  return api.post(`/staff/cover_offers/${id}/decline`);
}

// API shape -> the flat shape the HomePage card reads.
function toOffer(o) {
  const v = o.visit ?? {};
  return {
    id: o.id,
    note: o.note,
    client: v.client,
    address: v.address,
    startsAt: v.scheduled_start,
    endsAt: v.scheduled_end,
    hours: v.hours,
  };
}
