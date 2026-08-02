import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import Icon from '../common/Icon.jsx';
import { TERMS, PRIVACY, HELP } from '../../content/legal.js';

// Terms, privacy and help as sheets rather than pages.
//
// These are reference material a carer dips into and dismisses, not places they
// navigate to. As sheets they keep the screen behind them in view, and the back
// button closes them, which is what people expect from a phone.

const DOCS = { terms: TERMS, privacy: PRIVACY, help: HELP };

export default function InfoSheet({ doc, onClose }) {
  const content = DOCS[doc];
  if (!content) return null;

  return (
    <Modal
      open={!!doc}
      onClose={onClose}
      title={content.title}
      size="tall"
      footer={
        <Button block variant="white" onClick={onClose}>
          Close
        </Button>
      }
    >
      {content.lead && (
        <div className="sheet-lead">
          <Icon name={content.leadIcon ?? 'info'} size={17} />
          <p>{content.lead}</p>
        </div>
      )}

      {content.contact && (
        <div className="sheet-contact">
          <div>
            <p className="sheet-contact__label">{content.contact.label}</p>
            <p className="sheet-contact__value">{content.contact.value}</p>
          </div>
          <Button size="sm" onClick={() => window.open(`tel:${content.contact.tel}`)}>
            <Icon name="phone" size={14} />
            Call
          </Button>
        </div>
      )}

      <div className="sheet-doc">
        {content.sections.map((s, i) => (
          <section key={s.heading} className="sheet-doc__section">
            <h3 className="sheet-doc__heading">
              <span className="sheet-doc__num">{i + 1}</span>
              {s.heading}
            </h3>
            <p className="sheet-doc__body">{s.body}</p>
          </section>
        ))}
      </div>

      {content.footer && <p className="sheet-doc__footer">{content.footer}</p>}
    </Modal>
  );
}
