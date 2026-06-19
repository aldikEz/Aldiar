import type { CommandAction } from '../types';

type CommandPaletteProps = {
  activeIndex: number;
  inputRef: React.RefObject<HTMLInputElement>;
  isOpen: boolean;
  lastAction: string;
  query: string;
  results: CommandAction[];
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onRun: (command: CommandAction) => void;
  onSetActiveIndex: (index: number) => void;
};

export function CommandPalette({
  activeIndex,
  inputRef,
  isOpen,
  lastAction,
  query,
  results,
  onClose,
  onQueryChange,
  onRun,
  onSetActiveIndex,
}: CommandPaletteProps) {
  return (
    <section
      aria-hidden={!isOpen}
      className={`gate-overlay${isOpen ? ' is-open' : ''}`}
      onClick={onClose}
    >
      <div
        aria-labelledby="gate-title"
        aria-modal="true"
        className="gate-panel"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="gate-input-row">
          <span className="gate-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path
                d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </span>
          <input
            aria-activedescendant={results.length > 0 ? `gate-option-${activeIndex}` : undefined}
            aria-controls="gate-options"
            aria-expanded={isOpen}
            aria-label="Search Pace demo actions"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="What do you want to do?"
            ref={inputRef}
            role="combobox"
            type="text"
            value={query}
          />
        </div>

        <div className="gate-results">
          <p id="gate-title" className="gate-title">
            {results.length > 0 ? 'Quick Actions' : 'No Matching Actions'}
          </p>
          {results.length > 0 ? (
            <ul id="gate-options" role="listbox">
              {results.map((item, index) => (
                <li key={item.label} role="presentation">
                  <button
                    aria-selected={activeIndex === index}
                    className={`gate-option${activeIndex === index ? ' is-active' : ''}`}
                    id={`gate-option-${index}`}
                    onClick={() => onRun(item)}
                    onMouseEnter={() => onSetActiveIndex(index)}
                    role="option"
                    type="button"
                  >
                    <span>{item.label}</span>
                    <span className="gate-shortcut" aria-hidden="true">
                      {item.shortcut}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="gate-empty">Try plan, AI, training, food, log, or coach.</p>
          )}
        </div>

        <div className="gate-footer">
          <span>Last: {lastAction}</span>
          <span className="gate-actions-hint">
            <span>Run</span>
            <span className="gate-footer-badge" aria-hidden="true">
              <span>Enter</span>
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
