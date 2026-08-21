import { useEffect, useState } from 'react';
import Modal from '../common/Modal.jsx';
import Avatar from '../common/Avatar.jsx';
import Icon from '../common/Icon.jsx';
import { SkeletonList } from '../common/Skeleton.jsx';
import { listOfficeContacts, startOfficeChat } from '../../api/messages.js';

// Lets a carer pick an office staff member and open (or reuse) a direct chat.
// Only the office is listed — the server returns admins only, so a carer can
// never reach another carer or a client from here.
export default function NewOfficeChatSheet({ open, onClose, onOpened }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    setError(null);
    listOfficeContacts()
      .then((data) => active && setContacts(Array.isArray(data) ? data : []))
      .catch(() => active && setError('Could not load the office team. Please try again.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [open]);

  async function pick(contact) {
    if (busyId) return;
    setBusyId(contact.id);
    try {
      const threadId = await startOfficeChat(contact.id);
      onOpened(threadId);
    } catch {
      setError('Could not start the chat. Please try again.');
      setBusyId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Message the office">
      {loading ? (
        <SkeletonList count={4} />
      ) : error ? (
        <p className="thread-row__sub" style={{ padding: '12px 4px' }}>{error}</p>
      ) : contacts.length === 0 ? (
        <p className="thread-row__sub" style={{ padding: '12px 4px' }}>No office contacts are available right now.</p>
      ) : (
        <div className="thread-list">
          {contacts.map((c) => (
            <button
              key={`${c.type}:${c.id}`}
              type="button"
              className="thread-row"
              disabled={busyId != null}
              onClick={() => pick(c)}
            >
              <Avatar name={c.full_name} src={c.avatar_url} size={44} varied />
              <span className="thread-row__body">
                <span className="thread-row__top">
                  <span className="thread-row__name">{c.full_name}</span>
                </span>
                {c.role_label && <span className="thread-row__sub">{c.role_label}</span>}
              </span>
              <span className="thread-row__side">
                {busyId === c.id ? <Icon name="clock" size={18} /> : <Icon name="chevronRight" size={18} />}
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
