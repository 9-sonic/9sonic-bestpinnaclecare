import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listConversations, listMessages, sendMessage, createChannel, createGroup, createDirect, addConversationParticipants, searchConversations, listEmployees, muteConversation, chaseUnread, pinMessage, unpinMessage, markMessageRead, editMessage, deleteMessage, updateConversation, deleteConversation, removeParticipant } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import Modal from '../components/common/Modal.jsx';
import InfoHint from '../components/common/InfoHint.jsx';
import ContextMenu from '../components/common/ContextMenu.jsx';
import { s } from '../lib/ui.jsx';
import { subscribeInbox } from '../lib/cable.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatTime, fullName } from '../api/format.js';
import { Panel, PanelTitle, Tag, Avatar, Button } from '../ds/console.jsx';

const initials = (name) => (name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const QUICK = ['On my way', 'Running late', 'Can you cover this?', 'Please call the office', 'Thanks!'];

function convoTitle(convo, adminId) {
  if (convo.title) return convo.title;
  const others = (convo.participants ?? []).filter((p) => !(p.type === 'Admin' && p.id === adminId));
  return others.map((p) => p.full_name).filter(Boolean).join(', ') || 'Conversation';
}
const nameFor = (parts, type, id) => (parts ?? []).find((p) => p.type === type && p.id === id)?.full_name ?? null;
const avatarFor = (parts, type, id) => (parts ?? []).find((p) => p.type === type && p.id === id)?.avatar_url ?? null;
const dmAvatar = (c, adminId) => (c.participants ?? []).find((p) => !(p.type === 'Admin' && p.id === adminId))?.avatar_url ?? null;
const humanFileSize = (n) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const isImage = (ct) => (ct ?? '').startsWith('image/');

export default function MessagesPage() {
  const { admin, canManage } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [convos, setConvos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  // Add-member picker on the members panel: null when closed, [] of employee ids when open.
  const [adding, setAdding] = useState(null);
  const [addBusy, setAddBusy] = useState(false);
  // Conversation ids whose MESSAGE TEXT matches the current query (backend search),
  // so a thread surfaces even when the term isn't in its title or member names.
  const [msgHitIds, setMsgHitIds] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState('');
  const [broadcast, setBroadcast] = useState(false);
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState('');
  const [staff, setStaff] = useState([]);
  // create dialog: null | 'channel' | 'group'
  const [composer, setComposer] = useState(null);
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [autoPost, setAutoPost] = useState(false);
  const [members, setMembers] = useState([]);
  const [files, setFiles] = useState([]);
  // Right-click menu on a message bubble: { x, y, msg } while open, null otherwise.
  const [msgMenu, setMsgMenu] = useState(null);
  // Inline edit: { id, text } while editing one of my own messages, else null.
  const [editing, setEditing] = useState(null);
  // Delete confirmation: the message pending deletion, or null.
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  // Manage-conversation modal: { title, purpose } while open (rename/purpose/delete), else null.
  const [manage, setManage] = useState(null);
  // Member pending removal (confirm), and whether the manage modal is asking to delete the whole thread.
  const [removing, setRemoving] = useState(null);
  const [confirmDeleteConvo, setConfirmDeleteConvo] = useState(false);
  const scrollRef = useRef(null);

  const reload = useCallback(async () => {
    const cs = (await listConversations()) ?? [];
    setConvos(cs);
    return cs;
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([reload(), listEmployees().then((e) => active && setStaff(e.filter((x) => x.active))).catch(() => {})])
      .then(([cs]) => { if (active && cs.length) setActiveId((id) => id ?? cs[0].id); })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [reload]);

  // Mark the newest message in a conversation read, then clear its unread badge
  // locally so it disappears the moment the thread is opened (rather than only
  // after the next full reload). Newest message id = highest id in the thread.
  const markConversationRead = useCallback(async (id, msgs) => {
    const newest = (msgs ?? []).reduce((max, m) => (m.id > max ? m.id : max), 0);
    if (!newest) return;
    setConvos((cs) => cs.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)));
    try { await markMessageRead(newest); } catch { /* receipt is best-effort */ }
  }, []);

  const loadMessages = useCallback(async (id) => {
    if (!id) return;
    setLoadingMsgs(true);
    try {
      const msgs = ((await listMessages(id)) ?? []).slice().reverse();
      setMessages(msgs);
      markConversationRead(id, msgs);
    } catch { setMessages([]); } finally { setLoadingMsgs(false); }
  }, [markConversationRead]);
  useEffect(() => { loadMessages(activeId); setBroadcast(false); setAdding(null); }, [activeId, loadMessages]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages]);

  // Live over the WebSocket: append to the open thread (dedupe by id) + bump the list.
  const activeIdRef = useRef(activeId);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => {
    const off = subscribeInbox((payload) => {
      if (payload?.type !== 'message' || !payload.message) return;
      const m = payload.message;
      const fromMe = m.sender_type === 'Admin' && m.sender_id === admin?.id;
      const isOpen = m.conversation_id === activeIdRef.current;
      if (isOpen) {
        // The same fan-out channel carries new messages AND edits/deletes of
        // existing ones — so replace in place when we already have the id, append
        // otherwise. (An edit/delete keeps the id; a new message brings a new one.)
        setMessages((xs) => (xs.some((x) => x.id === m.id) ? xs.map((x) => (x.id === m.id ? m : x)) : [...xs, m]));
        // Thread is open on screen, so it's already been seen — mark it read
        // and don't raise its badge. A tombstone has nothing to read.
        if (!fromMe && !m.deleted_at) markMessageRead(m.id).catch(() => {});
      }
      // An edit/delete of an existing message must NOT bump the thread to the top
      // or raise its unread badge — only a genuinely new message does. A deleted
      // message never becomes the preview; an edit refreshes the preview only if
      // it's still the newest line, which the next full load settles anyway.
      const isEditOrDelete = m.edited_at || m.deleted_at;
      setConvos((cs) => cs.map((c) => (c.id === m.conversation_id
        ? (isEditOrDelete
            ? c
            : {
                ...c,
                last_message_preview: m.body || 'Attachment',
                last_message_at: m.created_at || new Date().toISOString(),
                unread_count: isOpen ? 0 : (c.unread_count ?? 0) + (fromMe ? 0 : 1),
              })
        : c)));
    });
    return off;
  }, [admin?.id]);

  // Backend message-text search, debounced. A thread whose message body matches
  // the query surfaces even when the term isn't in its title or member names
  // (the client filter below only sees title/preview/participants). Short terms
  // are allowed — searching "hi" should find the DM whose last message is "hi".
  useEffect(() => {
    const term = query.trim();
    if (!term) { setMsgHitIds([]); return undefined; }
    let live = true;
    const t = setTimeout(() => {
      searchConversations(term)
        .then((r) => { if (live) setMsgHitIds((r?.results ?? []).map((x) => x.conversation_id)); })
        .catch(() => { if (live) setMsgHitIds([]); });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [query]);

  const active = useMemo(() => convos.find((c) => c.id === activeId), [convos, activeId]);
  const mine = (m) => m.sender_type === 'Admin' && m.sender_id === admin?.id;

  async function send() {
    const body = draft.trim();
    if ((!body && files.length === 0) || sending || !active) return;
    setSending(true);
    try {
      const saved = await sendMessage(activeId, body, crypto.randomUUID(), broadcast && active.kind === 'channel', null, files.length ? files : null);
      setMessages((xs) => [...xs, saved]); setDraft(''); setFiles([]);
      setConvos((cs) => cs.map((c) => (c.id === activeId ? { ...c, last_message_preview: body || `${files.length} attachment${files.length === 1 ? '' : 's'}`, last_message_at: new Date().toISOString() } : c)));
    } catch (e) { toast.error(e.message || 'Could not send'); } finally { setSending(false); }
  }

  // A direct message needs exactly one carer and no name; a group/channel needs a
  // name and at least one member.
  const canCreate = composer === 'direct' ? members.length === 1 : (name.trim() && members.length > 0);

  async function create() {
    if (!canCreate) return;
    try {
      let c;
      if (composer === 'direct') {
        c = await createDirect(members[0]); // dedupes to the existing thread if any
      } else {
        const label = composer === 'group' ? name.trim() : (name.trim().startsWith('#') ? name.trim() : `#${name.trim()}`);
        c = composer === 'group'
          ? await createGroup(label, members, purpose.trim() || undefined)
          : await createChannel(label, members, purpose.trim() || undefined, autoPost);
      }
      const noun = composer === 'direct' ? 'Message' : composer === 'group' ? 'Group' : 'Channel';
      toast.success(composer === 'direct' ? 'Conversation opened' : `${noun} created`);
      setComposer(null); setName(''); setPurpose(''); setAutoPost(false); setMembers([]);
      await reload(); setActiveId(c.id);
    } catch (e) { toast.error(e.message || 'Could not open the conversation'); }
  }

  // Staff not already in the active conversation — the pool the add-picker draws from.
  const addableStaff = useMemo(() => {
    if (!active) return [];
    const inConvo = new Set((active.participants ?? []).filter((p) => p.type === 'Employee').map((p) => p.id));
    return staff.filter((e) => !inConvo.has(e.id));
  }, [active, staff]);

  async function addMembers() {
    if (!active || !adding?.length) return;
    setAddBusy(true);
    try {
      await addConversationParticipants(active.id, adding);
      toast.success(`Added ${adding.length} ${adding.length === 1 ? 'person' : 'people'}`);
      setAdding(null);
      const cs = await reload(); setConvos(cs);
    } catch (e) { toast.error(e.message || 'Could not add'); } finally { setAddBusy(false); }
  }

  async function toggleMute() {
    if (!active) return;
    try { const c = await muteConversation(active.id, !active.muted); setConvos((cs) => cs.map((x) => (x.id === c.id ? c : x))); toast.info(c.muted ? 'Muted' : 'Unmuted'); }
    catch (e) { toast.error(e.message || 'Could not update'); }
  }
  // Save a rename / purpose edit from the Manage modal.
  async function saveManage() {
    if (!active || !manage) return;
    const title = manage.title.trim();
    if (!title) { toast.error('A name is needed.'); return; }
    setBusy(true);
    try {
      const c = await updateConversation(active.id, { title, purpose: manage.purpose.trim() });
      setConvos((cs) => cs.map((x) => (x.id === c.id ? c : x)));
      setManage(null);
      toast.success('Saved');
    } catch (e) { toast.error(e.message || 'Could not save'); } finally { setBusy(false); }
  }
  // Delete (soft-archive) the whole channel/group. It drops from everyone's list.
  async function deleteConvo() {
    if (!active) return;
    setBusy(true);
    try {
      await deleteConversation(active.id);
      const id = active.id;
      setConvos((cs) => cs.filter((c) => c.id !== id));
      setActiveId(null);
      setConfirmDeleteConvo(false);
      setManage(null);
      toast.success('Conversation deleted');
    } catch (e) { toast.error(e.message || 'Could not delete'); } finally { setBusy(false); }
  }
  // Remove one member from the group/channel (soft). `removing` is the participant.
  async function removeMember() {
    if (!active || !removing) return;
    setBusy(true);
    try {
      const c = await removeParticipant(active.id, removing.type, removing.id);
      setConvos((cs) => cs.map((x) => (x.id === c.id ? c : x)));
      setRemoving(null);
      toast.success(`Removed ${removing.full_name ?? 'member'}`);
    } catch (e) { toast.error(e.message || 'Could not remove'); } finally { setBusy(false); }
  }
  async function doChase() {
    if (!active) return;
    try { const r = await chaseUnread(active.id); toast.success(r.chased > 0 ? `Reminder sent to ${r.chased} who haven't read it` : 'Everyone has already read it'); }
    catch (e) { toast.error(e.message || 'Could not chase'); }
  }
  async function togglePin(m) {
    try {
      const updated = m.pinned_at ? await unpinMessage(active.id, m.id) : await pinMessage(active.id, m.id);
      setMessages((xs) => xs.map((x) => (x.id === m.id ? { ...x, pinned_at: updated.pinned_at } : x)));
      setConvos((cs) => cs.map((c) => (c.id === active.id ? { ...c, pinned_message: updated.pinned_at ? updated : null } : c)));
    } catch (e) { toast.error(e.message || 'Could not pin'); }
  }
  async function copyText(m) {
    try {
      await navigator.clipboard.writeText(m.body ?? '');
      toast.success('Copied to clipboard');
    } catch { toast.error('Could not copy'); }
  }
  // Quote the message into the composer as a reply. Non-destructive: it just
  // seeds the draft, the office still types and sends normally.
  function quoteReply(m) {
    const who = nameFor(active.participants, m.sender_type, m.sender_id) || 'them';
    const quoted = (m.body ?? '').split('\n').map((l) => `> ${l}`).join('\n');
    setDraft((d) => `${quoted}\n\n${d}`.trimStart());
    toast.success(`Replying to ${who}`);
  }
  // Save an inline edit to one of my own messages. Backend stamps edited_at and
  // fans the new body out over the socket; we also patch it in locally so the
  // change shows instantly without waiting for the echo.
  async function saveEdit() {
    if (!editing) return;
    const text = editing.text.trim();
    if (!text) { setConfirmDelete(messages.find((m) => m.id === editing.id)); setEditing(null); return; }
    setBusy(true);
    try {
      const updated = await editMessage(active.id, editing.id, text);
      setMessages((xs) => xs.map((x) => (x.id === updated.id ? { ...x, body: updated.body, edited_at: updated.edited_at } : x)));
      setEditing(null);
    } catch (e) { toast.error(e.message || 'Could not edit'); }
    finally { setBusy(false); }
  }
  // Soft-delete my own message. It stays in the thread as a "message deleted"
  // tombstone (the record that it existed stands) — the body just disappears.
  async function doDelete() {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      const updated = await deleteMessage(active.id, confirmDelete.id);
      setMessages((xs) => xs.map((x) => (x.id === updated.id ? { ...x, body: null, deleted_at: updated.deleted_at, pinned_at: null, attachments: [], visit: null } : x)));
      setConvos((cs) => cs.map((c) => (c.id === active.id && c.pinned_message?.id === updated.id ? { ...c, pinned_message: null } : c)));
      setConfirmDelete(null);
    } catch (e) { toast.error(e.message || 'Could not delete'); }
    finally { setBusy(false); }
  }
  // Build the right-click menu for a message. Copy/reply are client-side; pin,
  // edit and delete hit the backend. Edit and delete only appear on my OWN,
  // not-yet-deleted messages — a tombstone or someone else's message offers
  // neither. A deleted message has no actions worth showing at all.
  function openMsgMenu(e, m) {
    if (m.sender_type === 'System' || m.deleted_at) return;
    e.preventDefault();
    setMsgMenu({ x: e.clientX, y: e.clientY, msg: m });
  }
  const menuItems = (m) => {
    const own = mine(m);
    return [
      m.body ? { label: 'Copy text', icon: 'copy', onClick: () => copyText(m) } : null,
      { label: 'Reply', icon: 'reply', onClick: () => quoteReply(m) },
      { label: m.pinned_at ? 'Unpin' : 'Pin', icon: 'pin', onClick: () => togglePin(m) },
      own && m.body ? { label: 'Edit', icon: 'edit', onClick: () => setEditing({ id: m.id, text: m.body }) } : null,
      own ? { label: 'Delete', icon: 'trash', danger: true, onClick: () => setConfirmDelete(m) } : null,
    ].filter(Boolean);
  };

  if (loading) return <Spinner fullscreen />;

  const q = query.trim().toLowerCase();
  const msgHits = new Set(msgHitIds);
  // A thread matches when the term is in its title (or DM participant names, via
  // convoTitle), in any participant's name, OR in a message body (backend search
  // -> msgHits). The message-text path is what lets searching "hi" find the DM
  // whose last message is "hi".
  const match = (c) => {
    if (!q) return true;
    if (convoTitle(c, admin?.id).toLowerCase().includes(q)) return true;
    if ((c.participants ?? []).some((p) => (p.full_name ?? '').toLowerCase().includes(q))) return true;
    return msgHits.has(c.id);
  };
  const groups = [
    { kind: 'channel', label: 'Channels', icon: 'chat', items: convos.filter((c) => c.kind === 'channel' && match(c)) },
    { kind: 'group', label: 'Groups', icon: 'users', items: convos.filter((c) => c.kind === 'group' && match(c)) },
    { kind: 'direct', label: 'Direct messages', icon: 'user', items: convos.filter((c) => c.kind === 'direct' && match(c)) },
  ];

  const railItem = (c, groupIcon) => {
    const on = c.id === activeId;
    const nm = convoTitle(c, admin?.id);
    return (
      <button key={c.id} type="button" onClick={() => setActiveId(c.id)}
        style={{ ...s('width:100%;text-align:left;display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:12px;cursor:pointer;border:0;margin-bottom:1px'), background: on ? 'var(--d-primary-soft)' : 'transparent', fontFamily: 'inherit' }} className={on ? '' : 'hv'}>
        {c.kind === 'direct'
          ? <Avatar initials={initials(nm)} size="sm" src={dmAvatar(c, admin?.id)} />
          : <span style={{ ...s('width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none'), background: 'var(--d-panel)', color: 'var(--d-muted)' }}><Icon name={groupIcon} size={15} /></span>}
        <span style={s('flex:1;min-width:0')}>
          <span style={{ ...s('display:block;font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'), color: on ? 'var(--d-primary-deep)' : 'var(--d-ink)' }}>{nm}</span>
          <span style={s('display:block;font-size:11px;font-weight:500;color:var(--d-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{c.last_message_preview ?? 'No messages yet'}</span>
        </span>
        <span style={s('display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex:none')}>
          {c.last_message_at && <span className="d-num" style={s('font-size:10px;font-weight:500;color:var(--d-faint)')}>{formatTime(c.last_message_at)}</span>}
          {c.unread_count > 0 && <span className="d-num" style={s('min-width:18px;height:18px;border-radius:9px;background:var(--d-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;padding:0 5px')}>{c.unread_count}</span>}
        </span>
      </button>
    );
  };

  const lastWithReceipts = [...messages].reverse().find((m) => (m.recipient_count ?? 0) > 0);
  const otherEmp = active?.kind === 'direct' ? (active.participants ?? []).find((p) => p.type === 'Employee') : null;
  const carerCtx = otherEmp ? staff.find((e) => e.id === otherEmp.id) : null;

  return (
    <div style={{ ...s('display:grid;gap:14px;height:100%;min-height:0'), gridTemplateColumns: 'minmax(240px,280px) minmax(0,1fr) 300px' }}>
      {/* Pane 1 — thread list */}
      <div style={s('background:var(--d-card);border-radius:20px;display:flex;flex-direction:column;overflow:hidden;min-height:0')}>
        <div data-tour="messages-new" style={s('padding:14px 14px 10px;display:flex;align-items:center;gap:8px')}>
          <div style={s('font-size:15px;font-weight:700;color:var(--d-ink)')}>Messages</div>
          <InfoHint text="Start a new conversation: a direct message to one person, a private group, or a channel (which can auto-post shift alerts and request read receipts)." />
          <div style={s('flex:1')} />
          <div data-tour="messages-new-message" onClick={() => { setComposer('direct'); setName(''); setMembers([]); }} className="hv tip" data-tip="New message" style={{ ...s('width:28px;height:28px;border-radius:9px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2)'), '--hbg': 'var(--d-panel)' }}><Icon name="edit" size={15} /></div>
          <div onClick={() => { setComposer('group'); setName(''); setMembers([]); }} className="hv tip" data-tip="New group" style={{ ...s('width:28px;height:28px;border-radius:9px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2)'), '--hbg': 'var(--d-panel)' }}><Icon name="users" size={15} /></div>
          <div onClick={() => { setComposer('channel'); setName(''); setMembers([]); }} className="hv tip" data-tip="New channel" style={{ ...s('width:28px;height:28px;border-radius:9px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-primary)'), '--hbg': 'var(--d-panel)' }}><Icon name="plus" size={16} /></div>
        </div>
        <div style={s('padding:0 12px 10px')}>
          <div style={s('height:38px;background:var(--d-field);border:1.5px solid var(--d-border);border-radius:19px;display:flex;align-items:center;gap:8px;padding:0 13px')}>
            <Icon name="search" size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations" style={{ ...s('flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:12.5px;font-weight:500;color:var(--d-ink)'), fontFamily: 'inherit' }} />
          </div>
        </div>
        <div style={s('flex:1;min-height:0;overflow-y:auto;padding:0 8px 8px')}>
          {groups.map((g) => (
            <div key={g.kind} style={s('margin-bottom:10px')}>
              <div style={s('padding:6px 8px 4px;font-size:10px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.08em')}>{g.label}</div>
              {g.items.length === 0 ? <div style={s('padding:2px 8px 4px;font-size:11px;font-weight:500;color:var(--d-faint)')}>None</div> : g.items.map((c) => railItem(c, g.icon))}
            </div>
          ))}
        </div>
      </div>

      {/* Pane 2 — conversation */}
      <div style={s('background:var(--d-card);border-radius:20px;display:flex;flex-direction:column;overflow:hidden;min-height:0')}>
        {!active ? (
          <div style={s('flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px')}>
            <div style={s('width:56px;height:56px;border-radius:18px;background:var(--d-sage);display:flex;align-items:center;justify-content:center;color:var(--d-muted)')}><Icon name="chat" size={26} /></div>
            <div style={s('font-size:15px;font-weight:700;color:var(--d-ink2)')}>Pick a conversation</div>
          </div>
        ) : (
          <>
            <div style={s('display:flex;align-items:center;gap:11px;padding:14px 20px;border-bottom:1px solid var(--d-border);flex:none')}>
              {active.kind !== 'direct' && <span style={{ ...s('width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none'), background: 'var(--d-panel)', color: 'var(--d-muted)' }}><Icon name={active.kind === 'channel' ? 'chat' : 'users'} size={16} /></span>}
              <div style={s('flex:1;min-width:0')}>
                <div style={s('font-size:15px;font-weight:700;color:var(--d-ink);display:flex;align-items:center;gap:6px')}>{active.kind === 'channel' && <span style={s('color:var(--d-muted)')}>#</span>}{convoTitle(active, admin?.id)}</div>
                <div style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{active.purpose ? `${active.purpose} · ` : ''}{(active.participants ?? []).length} members</div>
              </div>
              {active.auto_post && <Tag tone="info">Auto-posts alerts</Tag>}
              {active.kind !== 'direct' && <Button size="sm" icon="bell" onClick={toggleMute}>{active.muted ? 'Unmute' : 'Mute'}</Button>}
              {canManage && active.kind !== 'direct' && (
                <Button size="sm" variant="ghost" icon="settings" onClick={() => setManage({ title: active.title ?? '', purpose: active.purpose ?? '' })}>Manage</Button>
              )}
            </div>

            {active.pinned_message && (
              <div style={s('display:flex;align-items:center;gap:8px;padding:9px 20px;background:var(--d-warn-bg);color:var(--d-warn-ink);border-bottom:1px solid var(--d-border);flex:none')}>
                <Icon name="pin" size={14} />
                <span style={s('flex:1;min-width:0;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{active.pinned_message.body}</span>
                <span onClick={() => togglePin(active.pinned_message)} style={s('font-size:11px;font-weight:700;cursor:pointer;text-decoration:underline')}>Unpin</span>
              </div>
            )}

            <div ref={scrollRef} style={s('flex:1;min-height:0;overflow-y:auto;padding:18px 20px;display:flex;flex-direction:column;gap:14px')}>
              {loadingMsgs ? <div style={s('margin:auto;font-size:13px;color:var(--d-muted)')}>Loading…</div>
                : messages.length === 0 ? <div style={s('margin:auto;font-size:13px;color:var(--d-muted)')}>No messages yet — say hello.</div>
                : messages.map((m) => {
                  const out = mine(m);
                  const system = m.sender_type === 'System';
                  if (system) return <div key={m.id} style={s('display:flex;justify-content:center')}><span style={s('background:var(--d-panel);border-radius:999px;padding:4px 12px;font-size:11px;font-weight:600;color:var(--d-muted)')}>{m.body} · {formatTime(m.created_at)}</span></div>;
                  const author = out ? (fullName(admin) || 'You') : (nameFor(active.participants, m.sender_type, m.sender_id) ?? 'Someone');
                  const rc = m.recipient_count ?? 0;
                  return (
                    <div key={m.id} onContextMenu={(e) => openMsgMenu(e, m)} style={{ ...s('display:flex;gap:10px;max-width:82%;cursor:context-menu'), flexDirection: out ? 'row-reverse' : 'row', alignSelf: out ? 'flex-end' : 'flex-start' }}>
                      <Avatar initials={initials(author)} size="sm" src={out ? admin?.avatar_url : avatarFor(active.participants, m.sender_type, m.sender_id)} />
                      <div style={{ ...s('min-width:0'), textAlign: out ? 'right' : 'left' }}>
                        <div style={s('font-size:11px;font-weight:600;color:var(--d-muted);margin-bottom:3px')}>{author} · <span className="d-num">{formatTime(m.created_at)}</span></div>
                        {m.deleted_at ? (
                          <div style={{ ...s('display:inline-flex;align-items:center;gap:6px;padding:9px 13px;font-size:12.5px;font-weight:600;font-style:italic;line-height:1.45;border-radius:15px;border:1px dashed var(--d-border);color:var(--d-faint)') }}>
                            <Icon name="trash" size={12} />Message deleted
                          </div>
                        ) : editing?.id === m.id ? (
                          <div style={s('display:flex;flex-direction:column;gap:6px;align-items:stretch')}>
                            <textarea
                              autoFocus
                              value={editing.text}
                              onChange={(e) => setEditing((ed) => ({ ...ed, text: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                                if (e.key === 'Escape') setEditing(null);
                              }}
                              style={{ ...s('width:260px;max-width:100%;min-height:64px;border-radius:12px;border:1px solid var(--d-border);background:var(--d-field);padding:9px 12px;font-size:13px;font-weight:500;color:var(--d-ink);outline:none;resize:vertical'), fontFamily: 'inherit' }}
                            />
                            <div style={s('display:flex;gap:8px;justify-content:flex-end')}>
                              <Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
                              <Button onClick={saveEdit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ ...s('display:inline-block;padding:9px 13px;font-size:13px;font-weight:500;line-height:1.45;border-radius:15px;text-align:left'), background: out ? 'var(--d-primary)' : 'var(--d-panel)', color: out ? 'var(--d-primary-ink)' : 'var(--d-ink)' }}>
                            {m.broadcast && <div style={{ ...s('display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px'), color: out ? 'var(--d-primary-ink)' : 'var(--d-primary)' }}><Icon name="send" size={11} />Broadcast</div>}
                            {m.body}
                            {m.visit && (
                              <div style={{ ...s('display:flex;align-items:center;gap:6px;margin-top:7px;border-radius:9px;padding:6px 9px;font-size:11.5px;font-weight:600'), background: out ? 'rgba(255,255,255,0.18)' : 'var(--d-card)' }}>
                                <Icon name="calendar" size={13} />{m.visit.client} · {formatTime(m.visit.scheduled_start)}
                              </div>
                            )}
                            {(m.attachments ?? []).map((a) => (isImage(a.content_type) ? (
                              <a key={a.id} href={a.url} target="_blank" rel="noreferrer" style={s('display:block;margin-top:7px')}><img src={a.url} alt={a.filename} style={s('max-width:220px;max-height:200px;border-radius:10px;display:block')} /></a>
                            ) : (
                              <a key={a.id} href={a.url} target="_blank" rel="noreferrer" style={{ ...s('display:flex;align-items:center;gap:8px;margin-top:7px;border-radius:9px;padding:8px 10px;font-size:11.5px;font-weight:700;text-decoration:none'), background: out ? 'rgba(255,255,255,0.18)' : 'var(--d-card)', color: out ? 'var(--d-primary-ink)' : 'var(--d-ink)' }}><Icon name="file" size={14} /><span style={s('min-width:0')}>{a.filename}<span style={s('display:block;font-weight:500;opacity:0.7')}>{humanFileSize(a.byte_size)}</span></span></a>
                            )))}
                          </div>
                        )}
                        {!m.deleted_at && editing?.id !== m.id && (
                          <div style={{ ...s('display:flex;align-items:center;gap:8px;margin-top:3px'), justifyContent: out ? 'flex-end' : 'flex-start' }}>
                            {m.edited_at && <span style={s('font-size:10.5px;font-weight:600;color:var(--d-faint)')}>edited</span>}
                            <span onClick={() => togglePin(m)} className="hv tip" data-tip={m.pinned_at ? 'Unpin' : 'Pin'} style={{ ...s('font-size:10.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:3px;border-radius:6px;padding:1px 5px'), color: m.pinned_at ? 'var(--d-warn-ink)' : 'var(--d-faint)', '--hbg': 'var(--d-panel)' }}><Icon name="pin" size={11} />{m.pinned_at ? 'Pinned' : 'Pin'}</span>
                            {out && rc > 0 && (
                              <span style={{ ...s('display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:600'), color: (m.read_count ?? 0) >= rc ? 'var(--d-ok-ink)' : 'var(--d-muted)' }}>
                                <Icon name="check" size={12} />{rc <= 1 ? ((m.read_count ?? 0) > 0 ? 'Read' : 'Delivered') : `${m.read_count ?? 0} of ${rc} read`}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div style={s('flex:none;padding:12px 16px 14px;border-top:1px solid var(--d-border);display:flex;flex-direction:column;gap:9px')}>
              <div style={s('display:flex;flex-wrap:wrap;gap:6px')}>
                {QUICK.map((qr) => (
                  <button key={qr} type="button" onClick={() => setDraft(qr)} className="hv" style={{ ...s('border:1px solid var(--d-border);border-radius:999px;padding:4px 11px;font-size:11.5px;font-weight:600;color:var(--d-muted);cursor:pointer;background:transparent'), '--hbg': 'var(--d-panel)', fontFamily: 'inherit' }}>{qr}</button>
                ))}
              </div>
              {active.kind === 'channel' && (
                <div onClick={() => setBroadcast((v) => !v)} style={s('display:flex;align-items:center;gap:8px;cursor:pointer;align-self:flex-start')}>
                  <div style={{ ...s('width:34px;height:20px;border-radius:10px;position:relative;transition:background 0.15s'), background: broadcast ? 'var(--d-primary)' : 'var(--d-panel)' }}><div style={{ ...s('position:absolute;top:3px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left 0.15s'), left: broadcast ? '17px' : '3px' }} /></div>
                  <span style={s('font-size:11.5px;font-weight:700;color:var(--d-ink2)')}>Broadcast — request read acknowledgement</span>
                </div>
              )}
              {files.length > 0 && (
                <div style={s('display:flex;flex-wrap:wrap;gap:6px')}>
                  {files.map((f, i) => (
                    <div key={i} style={s('display:flex;align-items:center;gap:6px;background:var(--d-panel);border-radius:10px;padding:5px 9px;font-size:11.5px;font-weight:600;color:var(--d-ink2)')}>
                      <Icon name={isImage(f.type) ? 'camera' : 'file'} size={13} />{f.name}
                      <span onClick={() => setFiles((xs) => xs.filter((_, j) => j !== i))} className="hv" style={{ ...s('cursor:pointer;border-radius:5px;padding:1px;display:inline-flex'), '--hbg': 'var(--d-sage)' }}><Icon name="close" size={12} /></span>
                    </div>
                  ))}
                </div>
              )}
              <div style={s('display:flex;align-items:center;gap:10px')}>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={broadcast ? 'Write a broadcast…' : `Message ${active.kind === 'direct' ? convoTitle(active, admin?.id) : `#${convoTitle(active, admin?.id).replace(/^#/, '')}`}`} style={{ ...s('flex:1;height:44px;border-radius:22px;background:var(--d-field);padding:0 18px;border:1.5px solid var(--d-border);outline:none;font-size:13.5px;font-weight:500;color:var(--d-ink)'), fontFamily: 'inherit' }} />
                <div onClick={send} className="hv tip" data-tip="Send" style={{ ...s('width:44px;height:44px;border-radius:50%;background:var(--d-pill);color:var(--d-pill-ink);display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none'), '--hbg': 'var(--d-pill-hover)', opacity: sending || (!draft.trim() && files.length === 0) ? 0.5 : 1 }}><Icon name="send" size={18} /></div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Pane 3 — context */}
      <div style={s('display:flex;flex-direction:column;gap:14px;overflow-y:auto;min-height:0')}>
        {active && lastWithReceipts && (
          <Panel>
            <PanelTitle hint="On the most recent message with recipients">Read receipts</PanelTitle>
            <div className="d-num" style={s('font-size:26px;font-weight:700;color:var(--d-ink);line-height:1')}>{lastWithReceipts.read_count ?? 0}<span style={s('font-size:15px;font-weight:600;color:var(--d-muted)')}> / {lastWithReceipts.recipient_count}</span></div>
            <div style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);margin-top:5px')}>{(lastWithReceipts.read_count ?? 0) >= lastWithReceipts.recipient_count ? 'Everyone has read it.' : `${lastWithReceipts.recipient_count - (lastWithReceipts.read_count ?? 0)} still to read.`}</div>
            {(lastWithReceipts.read_count ?? 0) < lastWithReceipts.recipient_count && <div style={s('margin-top:12px')}><Button size="sm" icon="bell" onClick={doChase}>Chase unread</Button></div>}
          </Panel>
        )}

        {carerCtx && (
          <Panel>
            <PanelTitle hint="Live context for this carer">Shift context</PanelTitle>
            <div style={s('display:flex;align-items:center;gap:11px')}>
              <Avatar initials={initials(fullName(carerCtx))} src={carerCtx.avatar_url} />
              <div style={s('min-width:0')}>
                <div style={s('font-size:13.5px;font-weight:700;color:var(--d-ink)')}>{fullName(carerCtx)}</div>
                <div style={s('font-size:11.5px;font-weight:500;color:var(--d-muted)')}>{carerCtx.role === 'senior_carer' ? 'Senior carer' : 'Carer'}</div>
              </div>
            </div>
            <div style={s('display:flex;flex-direction:column;gap:7px;margin-top:12px')}>
              {carerCtx.hours_this_week != null && <div style={s('display:flex;justify-content:space-between;font-size:12.5px')}><span style={s('color:var(--d-muted);font-weight:500')}>Hours this week</span><b className="d-num" style={s('font-weight:700;color:var(--d-ink)')}>{carerCtx.hours_this_week}h</b></div>}
              {carerCtx.punctuality != null && <div style={s('display:flex;justify-content:space-between;font-size:12.5px')}><span style={s('color:var(--d-muted);font-weight:500')}>Punctuality</span><b className="d-num" style={s('font-weight:700;color:var(--d-ink)')}>{carerCtx.punctuality}%</b></div>}
            </div>
            <div style={s('margin-top:12px')}><Button size="sm" icon="calendar" onClick={() => navigate('/rota')}>View rota</Button></div>
          </Panel>
        )}

        {active && (
          <Panel>
            <div style={s('display:flex;align-items:center;gap:8px')}>
              <div style={s('flex:1')}><PanelTitle hint="Everyone in this conversation">Members ({(active.participants ?? []).length})</PanelTitle></div>
              {/* Add member — only for a group/channel (a direct thread is 1:1), and only for managers. */}
              {canManage && active.kind !== 'direct' && adding == null && (
                <Button size="sm" icon="plus" onClick={() => setAdding([])}>Add</Button>
              )}
            </div>

            {/* Inline add-member picker */}
            {adding != null && (
              <div style={s('display:flex;flex-direction:column;gap:8px;margin-bottom:12px;padding:12px;background:var(--d-panel);border-radius:14px')}>
                <div style={s('font-size:12px;font-weight:700;color:var(--d-ink2)')}>Add carers ({adding.length})</div>
                <div style={s('display:flex;flex-direction:column;gap:4px;max-height:240px;overflow-y:auto')}>
                  {addableStaff.length === 0 && <div style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);padding:4px')}>Everyone is already in this conversation.</div>}
                  {addableStaff.map((e) => {
                    const on = adding.includes(e.id);
                    return (
                      <div key={e.id} onClick={() => setAdding((m) => (on ? m.filter((x) => x !== e.id) : [...m, e.id]))} className="hv" style={{ ...s('display:flex;align-items:center;gap:10px;padding:7px 9px;border-radius:11px;cursor:pointer'), background: on ? 'var(--d-card)' : 'transparent', '--hbg': 'var(--d-card)' }}>
                        <Avatar initials={initials(fullName(e))} size="sm" src={e.avatar_url} />
                        <div style={s('flex:1;min-width:0;font-size:12.5px;font-weight:700;color:var(--d-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{fullName(e)}</div>
                        {on && <Icon name="check" size={15} />}
                      </div>
                    );
                  })}
                </div>
                <div style={s('display:flex;gap:8px;justify-content:flex-end')}>
                  <Button variant="ghost" size="sm" onClick={() => setAdding(null)}>Cancel</Button>
                  <Button size="sm" variant="primary" icon="check" disabled={addBusy || adding.length === 0} onClick={addBusy || adding.length === 0 ? undefined : addMembers}>{addBusy ? 'Adding…' : 'Add'}</Button>
                </div>
              </div>
            )}

            <div style={s('display:flex;flex-direction:column;gap:8px')}>
              {(active.participants ?? []).map((p) => {
                const isMe = p.type === 'Admin' && p.id === admin?.id;
                const canRemove = canManage && active.kind !== 'direct' && !isMe;
                return (
                  <div key={`${p.type}:${p.id}`} className="hv-row" style={s('display:flex;align-items:center;gap:10px')}>
                    <Avatar initials={initials(p.full_name)} size="sm" src={p.avatar_url} />
                    <div style={s('flex:1;min-width:0')}>
                      <div style={s('font-size:12.5px;font-weight:700;color:var(--d-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{p.full_name ?? '—'}{isMe && ' (you)'}</div>
                      <div style={s('font-size:11px;font-weight:500;color:var(--d-muted);text-transform:capitalize')}>{p.role ?? (p.type === 'Admin' ? 'Office' : 'Carer')}</div>
                    </div>
                    {canRemove && (
                      <span onClick={() => setRemoving(p)} className="hv tip" data-tip={`Remove ${p.full_name ?? ''}`.trim()} style={{ ...s('width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-faint)'), '--hbg': 'var(--d-danger-bg)' }}><Icon name="close" size={14} /></span>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        )}
      </div>

      {/* Create direct / group / channel dialog */}
      {composer && (
        <Modal
          onClose={() => setComposer(null)}
          title={composer === 'direct' ? 'New message' : `New ${composer}`}
          footer={(
            <div style={s('display:flex;justify-content:flex-end;gap:10px')}>
              <Button variant="ghost" onClick={() => setComposer(null)}>Cancel</Button>
              <Button variant="primary" icon={composer === 'direct' ? 'send' : 'plus'} disabled={!canCreate} onClick={canCreate ? create : undefined}>{composer === 'direct' ? 'Open conversation' : `Create ${composer}`}</Button>
            </div>
          )}
        >
          <div data-tour="messages-dialog" style={s('padding:0 24px 4px')}>
            <div style={s('display:inline-flex;gap:3px;background:var(--d-panel);border-radius:12px;padding:3px')}>
              {['direct', 'channel', 'group'].map((k) => (
                <button key={k} type="button" onClick={() => { setComposer(k); setMembers([]); }} style={{ ...s('border:0;border-radius:9px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer'), background: composer === k ? 'var(--d-pill)' : 'transparent', color: composer === k ? 'var(--d-pill-ink)' : 'var(--d-ink2)', fontFamily: 'inherit' }}>{k === 'direct' ? 'Message' : k[0].toUpperCase() + k.slice(1)}</button>
              ))}
            </div>
          </div>
          <div style={s('flex:1;overflow-y:auto;padding:14px 24px;display:flex;flex-direction:column;gap:14px')}>
            {composer !== 'direct' && (
              <label style={s('display:flex;flex-direction:column;gap:6px')}>
                <span style={s('font-size:12px;font-weight:700;color:var(--d-ink2)')}>{composer === 'channel' ? 'Channel name' : 'Group name'}</span>
                <div style={s('height:44px;border-radius:14px;background:var(--d-field);border:1.5px solid var(--d-border);display:flex;align-items:center;padding:0 15px')}>
                  {composer === 'channel' && <span style={s('font-size:14px;font-weight:700;color:var(--d-muted)')}>#</span>}
                  <input value={name.replace(/^#/, '')} onChange={(e) => setName(e.target.value)} placeholder={composer === 'channel' ? 'north-team' : 'Weekend cover'} style={{ ...s('flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:14px;font-weight:600;color:var(--d-ink);padding-left:4px'), fontFamily: 'inherit' }} />
                </div>
              </label>
            )}
            {composer !== 'direct' && (
              <label style={s('display:flex;flex-direction:column;gap:6px')}>
                <span style={s('font-size:12px;font-weight:700;color:var(--d-ink2)')}>Purpose <span style={s('font-weight:500;color:var(--d-muted)')}>(optional)</span></span>
                <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="What is this conversation for?" style={{ ...s('height:42px;border-radius:14px;background:var(--d-field);padding:0 15px;border:1.5px solid var(--d-border);outline:0;font-size:13.5px;font-weight:500;color:var(--d-ink)'), fontFamily: 'inherit' }} />
              </label>
            )}
            {composer === 'channel' && (
              <div onClick={() => setAutoPost((v) => !v)} style={s('display:flex;align-items:center;gap:10px;cursor:pointer;background:var(--d-panel);border-radius:12px;padding:11px 13px')}>
                <div style={{ ...s('width:34px;height:20px;border-radius:10px;position:relative;flex:none'), background: autoPost ? 'var(--d-primary)' : 'var(--d-field)' }}><div style={{ ...s('position:absolute;top:3px;width:14px;height:14px;border-radius:50%;background:#fff'), left: autoPost ? '17px' : '3px' }} /></div>
                <div style={s('min-width:0')}>
                  <div style={s('font-size:12.5px;font-weight:700;color:var(--d-ink)')}>Auto-post shift alerts</div>
                  <div style={s('font-size:11px;font-weight:500;color:var(--d-muted)')}>Late, missed and geofence alerts appear here automatically.</div>
                </div>
              </div>
            )}
            <div style={s('font-size:12px;font-weight:700;color:var(--d-ink2)')}>{composer === 'direct' ? 'To' : `Members (${members.length})`}</div>
            <div style={s('display:flex;flex-direction:column;gap:4px;max-height:240px;overflow-y:auto')}>
              {staff.map((e) => {
                const on = members.includes(e.id);
                // Direct is single-select: picking someone replaces the choice.
                const toggle = () => setMembers((m) => (composer === 'direct' ? (on ? [] : [e.id]) : (on ? m.filter((x) => x !== e.id) : [...m, e.id])));
                return (
                  <div key={e.id} onClick={toggle} className="hv" style={{ ...s('display:flex;align-items:center;gap:11px;padding:8px 11px;border-radius:12px;cursor:pointer'), background: on ? 'var(--d-panel)' : 'transparent', '--hbg': 'var(--d-panel)' }}>
                    <Avatar initials={`${e.first_name?.[0] ?? ''}${e.last_name?.[0] ?? ''}`} size="sm" />
                    <div style={s('flex:1;font-size:13px;font-weight:700;color:var(--d-ink)')}>{fullName(e)}</div>
                    <div style={{ ...s('width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center'), background: on ? 'var(--d-primary)' : 'var(--d-panel)', color: '#fff' }}>{on && <Icon name="check" size={13} />}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}
      {msgMenu && (
        <ContextMenu x={msgMenu.x} y={msgMenu.y} items={menuItems(msgMenu.msg)} onClose={() => setMsgMenu(null)} />
      )}
      {confirmDelete && (
        <Modal
          title="Delete this message?"
          onClose={() => (busy ? null : setConfirmDelete(null))}
          footer={(
            <div style={s('display:flex;gap:8px;justify-content:flex-end')}>
              <Button variant="ghost" onClick={() => setConfirmDelete(null)} disabled={busy}>Keep it</Button>
              <Button variant="danger" onClick={doDelete} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</Button>
            </div>
          )}
        >
          <div style={s('font-size:13.5px;font-weight:500;line-height:1.5;color:var(--d-ink2)')}>
            It’ll be removed for everyone and replaced with “Message deleted.” The
            fact it was sent stays in the record — you just can’t bring the text back.
          </div>
          {confirmDelete.body && (
            <div style={s('margin-top:12px;border-radius:12px;background:var(--d-panel);padding:10px 13px;font-size:13px;font-weight:500;color:var(--d-ink);max-height:120px;overflow:auto')}>
              {confirmDelete.body}
            </div>
          )}
        </Modal>
      )}

      {/* Manage a channel/group: rename, edit purpose, or delete it. */}
      {manage && active && (
        <Modal
          title={`Manage ${active.kind === 'channel' ? 'channel' : 'group'}`}
          onClose={() => (busy ? null : setManage(null))}
          footer={(
            <div style={s('display:flex;align-items:center;gap:8px;width:100%')}>
              <Button variant="danger" icon="trash" onClick={() => setConfirmDeleteConvo(true)} disabled={busy}>Delete</Button>
              <div style={s('flex:1')} />
              <Button variant="ghost" onClick={() => setManage(null)} disabled={busy}>Cancel</Button>
              <Button onClick={saveManage} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
            </div>
          )}
        >
          <label style={s('display:block;font-size:12px;font-weight:700;color:var(--d-ink2);margin-bottom:6px')}>Name</label>
          <input
            value={manage.title}
            onChange={(e) => setManage((m) => ({ ...m, title: e.target.value }))}
            placeholder={active.kind === 'channel' ? 'e.g. Morning handover' : 'e.g. Weekend team'}
            style={{ ...s('width:100%;border-radius:12px;border:1px solid var(--d-border);background:var(--d-field);padding:10px 13px;font-size:13px;font-weight:500;color:var(--d-ink);outline:none'), fontFamily: 'inherit' }}
          />
          <label style={s('display:block;font-size:12px;font-weight:700;color:var(--d-ink2);margin:14px 0 6px')}>Purpose <span style={s('font-weight:500;color:var(--d-muted)')}>(optional)</span></label>
          <textarea
            value={manage.purpose}
            onChange={(e) => setManage((m) => ({ ...m, purpose: e.target.value }))}
            placeholder="What is this conversation for?"
            style={{ ...s('width:100%;min-height:70px;border-radius:12px;border:1px solid var(--d-border);background:var(--d-field);padding:10px 13px;font-size:13px;font-weight:500;color:var(--d-ink);outline:none;resize:vertical'), fontFamily: 'inherit' }}
          />
        </Modal>
      )}

      {/* Confirm removing one member. */}
      {removing && (
        <Modal
          title="Remove from conversation?"
          onClose={() => (busy ? null : setRemoving(null))}
          footer={(
            <div style={s('display:flex;gap:8px;justify-content:flex-end')}>
              <Button variant="ghost" onClick={() => setRemoving(null)} disabled={busy}>Cancel</Button>
              <Button variant="danger" onClick={removeMember} disabled={busy}>{busy ? 'Removing…' : 'Remove'}</Button>
            </div>
          )}
        >
          <div style={s('font-size:13.5px;font-weight:500;line-height:1.5;color:var(--d-ink2)')}>
            <b style={s('color:var(--d-ink)')}>{removing.full_name ?? 'This person'}</b> will lose access to this
            conversation. Their past messages stay in the thread, and you can add them back later.
          </div>
        </Modal>
      )}

      {/* Confirm deleting the whole channel/group. */}
      {confirmDeleteConvo && active && (
        <Modal
          title={`Delete this ${active.kind === 'channel' ? 'channel' : 'group'}?`}
          onClose={() => (busy ? null : setConfirmDeleteConvo(false))}
          footer={(
            <div style={s('display:flex;gap:8px;justify-content:flex-end')}>
              <Button variant="ghost" onClick={() => setConfirmDeleteConvo(false)} disabled={busy}>Keep it</Button>
              <Button variant="danger" onClick={deleteConvo} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</Button>
            </div>
          )}
        >
          <div style={s('font-size:13.5px;font-weight:500;line-height:1.5;color:var(--d-ink2)')}>
            It’ll be removed from everyone’s message list. The history is kept on the
            record, but no one will be able to open or post to it again.
          </div>
        </Modal>
      )}
    </div>
  );
}
