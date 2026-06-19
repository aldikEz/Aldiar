import { type FormEvent, type RefObject, useState } from 'react';
import { DEFAULT_FOOD_KIND, foodKinds } from '../content';
import type { FoodEntry } from '../types';

type FoodModalProps = {
  entries: FoodEntry[];
  inputRef: RefObject<HTMLInputElement>;
  isOpen: boolean;
  onAddFood: (label: string, kind: string) => string;
  onClose: () => void;
  onRemoveFood: (entryId: string) => void;
};

export function FoodModal({ entries, inputRef, isOpen, onAddFood, onClose, onRemoveFood }: FoodModalProps) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState(DEFAULT_FOOD_KIND);
  const [notice, setNotice] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = onAddFood(label, kind);
    setNotice(message);

    if (label.trim()) {
      setLabel('');
      setKind(DEFAULT_FOOD_KIND);
    }
  }

  return (
    <section aria-hidden={!isOpen} className={`food-overlay${isOpen ? ' is-open' : ''}`} onClick={onClose}>
      <div
        aria-labelledby="food-title"
        aria-modal="true"
        className="food-panel"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="food-panel-header">
          <div>
            <span>Food log</span>
            <h2 id="food-title">Track what helps. Skip what does not.</h2>
          </div>
          <button onClick={onClose} type="button">
            Close
          </button>
        </div>
        <p className="food-panel-copy">
          Start with a simple meal, snack, water, or note. This demo avoids calorie math by default so food tracking
          stays calm.
        </p>
        <form className="food-form" onSubmit={submit}>
          <label>
            <span>Food or drink</span>
            <input
              autoComplete="off"
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Example: eggs and toast"
              ref={inputRef}
              type="text"
              value={label}
            />
          </label>
          <label>
            <span>Type</span>
            <select onChange={(event) => setKind(event.target.value)} value={kind}>
              {foodKinds.map((foodKind) => (
                <option key={foodKind} value={foodKind}>
                  {foodKind}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Add</button>
        </form>
        <p className="food-notice" role="status" aria-live="polite">
          {notice}
        </p>
        <div className="food-list">
          {entries.length > 0 ? (
            entries.map((entry) => (
              <article key={entry.id}>
                <div>
                  <h3>{entry.label}</h3>
                  <p>{entry.kind}</p>
                </div>
                <button
                  onClick={() => {
                    onRemoveFood(entry.id);
                    setNotice('Food entry removed.');
                  }}
                  type="button"
                >
                  Remove
                </button>
              </article>
            ))
          ) : (
            <div className="food-empty-state">
              <h3>No food logged yet.</h3>
              <p>Add one simple item to preview the tracker.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
