import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getThread, getThreadMessages, sendMessage, markRead, attachmentTooLarge } from '../api/messages.js';
import { subscribeInbox } from '../api/cable.js';
import { useAuth } from '../hooks/useAuth.js';
import Avatar from '../components/common/Avatar.jsx';
import Icon from '../components/common/Icon.jsx';
import Spinner from '../components/common/Spinner.jsx';
import { formatChatTime } from '../utils/format.js';
import { tapFeedback, errorFeedback } from '../utils/haptics.js';
import { useToast } from '../context/ToastContext.jsx';
import { OFFICE_CONTACT } from '../content/contact.js';

const humanFileSize = (n) =>
  (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round((n ?? 0) / 1024))} KB`);
const isImage = (ct) => (ct ?? '').startsWith('image/');
const isVideo = (ct) => (ct ?? '').startsWith('video/');
const isAudio = (ct) => (ct ?? '').startsWith('audio/');

// One attachment inside a bubble. Photos and clips show inline; a voice note
// gets an audio player; anything else is a tappable file with its name and size.
function ChatAttachment({ a }) {
  // Optimistic (pending) attachment has no URL yet — show a plain chip so it
  // doesn't render a broken image while the upload is in flight.
  if (!a.url) {
    return (
      <span className="bubble__file bubble__file--pending">
        <Icon name="file" size={18} />
        <span className="bubble__file-meta">
          <span className="bubble__file-name">{a.filename}</span>
          <span className="bubble__file-size">Uploading…</span>
        </span>
      </span>
    );
  }
  if (isImage(a.contentType)) {
    return (
      <a className="bubble__media" href={a.url} target="_blank" rel="noreferrer">
        <img src={a.thumbnailUrl || a.url} alt={a.filename} loading="lazy" />
      </a>
    );
  }
  if (isVideo(a.contentType)) {
    return <video className="bubble__media" src={a.url} controls preload="metadata" />;
  }
  if (isAudio(a.contentType)) {
    return <audio className="bubble__audio" src={a.url} controls preload="metadata" />;
  }
  return (
    <a className="bubble__file" href={a.url} target="_blank" rel="noreferrer">
      <Icon name="file" size={18} />
      <span className="bubble__file-meta">
        <span className="bubble__file-name">{a.filename}</span>
        <span className="bubble__file-size">{humanFileSize(a.byteSize)}</span>
      </span>
    </a>
  );
}

// A conversation with the office.
//
// Messages are grouped into runs by sender and by day, the way every messaging
// app does it: only the last bubble in a run gets a tail and a timestamp, and a
// date chip separates days. Without that a thread reads as a stack of unrelated
// cards rather than a conversation.

// The messages carers actually send from a doorstep. Typing one handed in the
// cold is the thing to design away, so the common cases are one tap.
//
// Tapping one puts the text in the box rather than sending it. Sending straight
// away would be faster for the common case and wrong for every other one: a
// carer usually wants to add the detail that matters, and an unsendable message
// is worse than a slower one.
const QUICK_REPLIES = [
  { label: 'On my way', text: 'On my way now.' },
  { label: 'Running late', text: 'I am running about 10 minutes late, sorry.' },
  { label: 'No answer', text: 'No answer at the door. Trying to phone now.' },
  { label: 'Visit done', text: 'Visit finished, all well.' },
  { label: 'Need advice', text: 'Can someone call me when free, I need some advice.' },
];

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ChatPage() {
  const { threadId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const [files, setFiles] = useState([]);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  // Read by the socket effect below, which intentionally does not depend on
  // `thread` itself (that would tear the subscription down and rebuild it on
  // every message). A ref keeps it seeing the current participant list anyway.
  const participantsRef = useRef(null);
  useEffect(() => {
    participantsRef.current = thread?.participants;
  }, [thread?.participants]);

  useEffect(() => {
    let active = true;
    getThread(threadId, user)
      .then((t) => {
        if (!active) return;
        setThread(t);
        // Receipts are per message, so acknowledge the newest one.
        markRead(t.messages?.[t.messages.length - 1]?.id);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [threadId, user]);

  // Live: when a message lands for this thread, refetch so it renders in the
  // app's shape (the socket only signals that the thread changed).
  useEffect(() => {
    const off = subscribeInbox((payload) => {
      if (payload?.type !== 'message' || !payload.message) return;
      if (String(payload.message.conversation_id) !== String(threadId)) return;
      // Messages only: the thread's name and participants are already loaded
      // and do not change when a message arrives.
      getThreadMessages(threadId, user, participantsRef.current)
        .then((messages) => {
          setThread((prev) => (prev ? { ...prev, messages } : prev));
          markRead(messages?.[messages.length - 1]?.id);
        })
        .catch(() => { /* ignore */ });
    });
    return off;
  }, [threadId, user]);

  // Pin to the newest message whenever the thread grows.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread?.messages?.length]);

  // Messages annotated with where they sit in a run, computed once per change.
  const rows = useMemo(() => {
    const list = thread?.messages ?? [];
    const out = [];
    let lastDay = null;

    list.forEach((m, i) => {
      const day = new Date(m.at).toDateString();
      if (day !== lastDay) {
        out.push({ type: 'day', id: `day-${day}`, label: dayLabel(m.at) });
        lastDay = day;
      }

      const prev = list[i - 1];
      const next = list[i + 1];
      const sameAsPrev =
        prev && prev.mine === m.mine && new Date(prev.at).toDateString() === day;
      const sameAsNext =
        next && next.mine === m.mine && new Date(next.at).toDateString() === day;

      out.push({ type: 'msg', ...m, first: !sameAsPrev, last: !sameAsNext });
    });

    return out;
  }, [thread?.messages]);

  async function handleSend(e) {
    e.preventDefault();
    await send(text);
  }

  // Queue picked files onto the composer. Any type; each checked against the
  // 25 MB limit (the backend enforces it too) so an oversize file is refused
  // with a clear message before upload.
  function addFiles(fileList) {
    const picked = Array.from(fileList ?? []);
    if (picked.length === 0) return;
    const ok = [];
    for (const f of picked) {
      const tooBig = attachmentTooLarge(f);
      if (tooBig) { toast.error(tooBig); continue; }
      ok.push(f);
    }
    if (ok.length) setFiles((xs) => [...xs, ...ok]);
  }

  // Appends the template to whatever is already typed, then puts the cursor at
  // the end so the carer can keep writing. Existing text is kept: someone who
  // has started a sentence should not lose it by tapping a suggestion.
  function insertTemplate(template) {
    tapFeedback();
    setText((current) => {
      const trimmed = current.trimEnd();
      if (!trimmed) return template;
      // Join with a space, or a new sentence if they already ended one.
      const needsStop = !/[.!?]$/.test(trimmed);
      return `${trimmed}${needsStop ? '.' : ''} ${template}`;
    });
    // Focus after the state settles so the caret lands at the end.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }

  async function send(raw) {
    const body = raw.trim();
    const outFiles = files;
    // Nothing to send unless there's text OR at least one attachment.
    if ((!body && outFiles.length === 0) || sending) return;

    setText('');
    setFiles([]);
    tapFeedback();
    setSending(true);

    // Show it straight away. A carer on a slow connection should see their
    // message land, not watch a spinner. Attachments show as a placeholder note
    // until the server returns the real, viewable attachment.
    const optimistic = {
      id: `pending-${Date.now()}`,
      mine: true,
      text: body,
      at: new Date().toISOString(),
      pending: true,
      attachments: outFiles.map((f, i) => ({ id: `pf-${i}`, filename: f.name, contentType: f.type, byteSize: f.size, url: null })),
    };
    setThread((t) => ({ ...t, messages: [...(t?.messages ?? []), optimistic] }));

    try {
      const saved = await sendMessage({ threadId, text: body, files: outFiles });
      setThread((t) => ({
        ...t,
        messages: t.messages.map((m) => (m.id === optimistic.id ? saved : m)),
      }));
    } catch (err) {
      errorFeedback();
      // Roll the optimistic message back and give the text (and files) back so
      // nothing the carer prepared is lost.
      setThread((t) => ({
        ...t,
        messages: t.messages.filter((m) => m.id !== optimistic.id),
      }));
      setText(body);
      setFiles(outFiles);
      toast.error(err.message || 'Message not sent. Try again.');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  if (loading) return <Spinner fullscreen />;

  return (
    <div className="chat">
      <header className="chat__header">
        <button
          type="button"
          className="icon-btn"
          onClick={() => navigate('/messages')}
          aria-label="Back to messages"
        >
          <Icon name="back" size={20} />
        </button>

        <div className="chat__peer">
          <Avatar name={thread?.name ?? ''} src={thread?.avatar} size={30} />
          <span className="chat__peer-name">{thread?.name}</span>
          {thread?.role && <span className="chat__peer-role">{thread.role}</span>}
        </div>

        <button
          type="button"
          className="icon-btn"
          aria-label={`Call ${thread?.name ?? 'contact'}`}
          onClick={() => window.open(`tel:${OFFICE_CONTACT.tel}`)}
        >
          <Icon name="phone" size={18} />
        </button>
      </header>

      <div className="chat__body" ref={bodyRef}>
        {rows.length === 0 && (
          <p className="chat__empty">
            No messages yet. Anything you send here goes to the office.
          </p>
        )}

        {rows.map((row) =>
          row.type === 'day' ? (
            <span key={row.id} className="chat__day">
              {row.label}
            </span>
          ) : (
            /* Sender above, time below, both outside the bubble. Inside, they
               forced every long message to leave a gap for them, and the
               sender was not shown at all — which matters in a channel where
               several people post. */
            <div
              key={row.id}
              className={`msg${row.mine ? ' msg--mine' : ''}`}
            >
              {row.first && !row.mine && row.senderName && (
                <p className="msg-sender">{row.senderName}</p>
              )}

              <div
                className={[
                  'bubble',
                  row.mine ? 'bubble--mine' : 'bubble--theirs',
                  row.first && 'bubble--first',
                  !row.last && 'bubble--grouped',
                  row.pending && 'bubble--pending',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {row.text && <span className="bubble__text">{row.text}</span>}
                {(row.attachments ?? []).map((a) => (
                  <ChatAttachment key={a.id} a={a} />
                ))}
              </div>

              {row.last && (
                <span className="bubble__time">
                  {row.pending ? 'Sending' : formatChatTime(row.at)}
                  {/* Read receipts only mean anything on your own messages. */}
                  {row.mine && !row.pending && row.readAt && ' · Read'}
                </span>
              )}
            </div>
          )
        )}
      </div>

      {showQuick && (
        <div className="quick-replies" data-no-swipe>
          <div className="quick-replies__scroll">
            {QUICK_REPLIES.map((q) => (
              <button
                key={q.label}
                type="button"
                className="quick-reply"
                onClick={() => insertTemplate(q.text)}
                disabled={sending}
              >
                {q.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="quick-replies__hide"
            onClick={() => setShowQuick(false)}
            aria-label="Hide quick replies"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {files.length > 0 && (
        <div className="chat__pending" data-no-swipe>
          {files.map((f, i) => (
            <span key={i} className="chat__pending-chip">
              <Icon name={f.type?.startsWith('image/') ? 'camera' : 'file'} size={13} />
              <span className="chat__pending-name">{f.name}</span>
              <button
                type="button"
                className="chat__pending-remove"
                aria-label={`Remove ${f.name}`}
                onClick={() => setFiles((xs) => xs.filter((_, j) => j !== i))}
              >
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <form className="chat__composer" onSubmit={handleSend}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
        <button
          type="button"
          className="chat__attach"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          aria-label="Attach a file or photo"
        >
          <Icon name="paperclip" size={19} />
        </button>
        <input
          ref={inputRef}
          className="chat__input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the office"
          aria-label="Message"
          enterKeyHint="send"
        />
        <button
          type="submit"
          className="chat__send"
          disabled={(!text.trim() && files.length === 0) || sending}
          aria-label="Send message"
        >
          <Icon name="send" size={18} />
        </button>
      </form>
    </div>
  );
}
