import { type FormEvent, type RefObject, useState } from 'react';
import type { CoachPerson } from '../types';

type CoachModalProps = {
  inputRef: RefObject<HTMLInputElement>;
  isOpen: boolean;
  people: CoachPerson[];
  onAddPerson: (name: string) => string;
  onClose: () => void;
  onRemovePerson: (personId: string) => void;
};

export function CoachModal({ inputRef, isOpen, people, onAddPerson, onClose, onRemovePerson }: CoachModalProps) {
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = onAddPerson(name);
    setNotice(message);

    if (name.trim()) {
      setName('');
    }
  }

  return (
    <section aria-hidden={!isOpen} className={`coach-overlay${isOpen ? ' is-open' : ''}`} onClick={onClose}>
      <div
        aria-labelledby="coach-title-modal"
        aria-modal="true"
        className="coach-panel"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="coach-panel-header">
          <div>
            <span>Coach mode</span>
            <h2 id="coach-title-modal">Add people without making a mess.</h2>
          </div>
          <button onClick={onClose} type="button">
            Close
          </button>
        </div>
        <p className="coach-panel-copy">
          This demo keeps the roster in your browser. Real coach accounts should use consent, roles, and limited
          visibility before private data is shared.
        </p>
        <form className="coach-form" onSubmit={submit}>
          <label>
            <span>Person name</span>
            <input
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Example: Sam"
              ref={inputRef}
              type="text"
              value={name}
            />
          </label>
          <button type="submit">Add</button>
        </form>
        <p className="coach-notice" role="status" aria-live="polite">
          {notice}
        </p>
        <div className="coach-roster-panel">
          {people.length > 0 ? (
            people.map((person) => (
              <article key={person.id}>
                <div>
                  <h3>{person.name}</h3>
                  <p>{person.focus}</p>
                </div>
                <button
                  onClick={() => {
                    onRemovePerson(person.id);
                    setNotice('Removed from this browser.');
                  }}
                  type="button"
                >
                  Remove
                </button>
              </article>
            ))
          ) : (
            <div className="coach-empty-state">
              <h3>No people added yet.</h3>
              <p>Add one name to preview the coach workflow.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
