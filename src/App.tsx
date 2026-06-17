import { useEffect, useRef, useState } from 'react';
import ShaderBackground from './components/ShaderBackground';

type Card = {
  eyebrow: string;
  title: string;
  value: string;
  meta: string;
  description: string;
};

type CommandAction = {
  label: string;
  shortcut: string;
};

const commandActions: CommandAction[] = [
  { label: 'Open Projects', shortcut: 'Option P' },
  { label: 'Create New Task', shortcut: 'Option T' },
  { label: 'Search Documentation', shortcut: 'Option D' },
  { label: 'View Analytics', shortcut: 'Option A' },
  { label: 'Settings', shortcut: 'Enter' },
];

const cards: Card[] = [
  {
    eyebrow: 'Focus Session',
    title: 'Flow integrity',
    value: '94%',
    meta: '+12.4%',
    description: 'Context switches were reduced across active branches and review loops.',
  },
  {
    eyebrow: 'Automation',
    title: 'Queued commands',
    value: '28',
    meta: '6 live',
    description: 'High-confidence workflows are ready to execute from the command layer.',
  },
  {
    eyebrow: 'Code Health',
    title: 'Risk surface',
    value: 'Low',
    meta: '2 files',
    description: 'Recent diffs touch isolated UI modules with complete type coverage.',
  },
  {
    eyebrow: 'Reviews',
    title: 'Signal quality',
    value: '8.7',
    meta: 'A grade',
    description: 'Noise is filtered before the team sees suggestions, failures, or alerts.',
  },
  {
    eyebrow: 'Deployments',
    title: 'Preview velocity',
    value: '4m 12s',
    meta: '-31s',
    description: 'Build cache and test prioritization keep preview cycles compact.',
  },
  {
    eyebrow: 'Knowledge',
    title: 'Repo memory',
    value: '1.8k',
    meta: 'indexed',
    description: 'Architecture decisions, owners, and conventions are mapped for agents.',
  },
];

export default function App() {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [selectedCommand, setSelectedCommand] = useState(commandActions[0].label);
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const commandOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const heroRef = useRef<HTMLElement | null>(null);

  function openCommandMenu() {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActiveCommandIndex(0);
    setQuery('');
    setIsCommandOpen(true);
  }

  function closeCommandMenu() {
    setIsCommandOpen(false);

    requestAnimationFrame(() => {
      previousFocusRef.current?.focus();
    });
  }

  function selectCommand(index: number) {
    setSelectedCommand(commandActions[index].label);
    closeCommandMenu();
  }

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        event.stopPropagation();

        if (isCommandOpen) {
          closeCommandMenu();
        } else {
          openCommandMenu();
        }

        return;
      }

      if (!isCommandOpen) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        closeCommandMenu();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveCommandIndex((currentIndex) => (currentIndex + 1) % commandActions.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveCommandIndex((currentIndex) =>
          currentIndex === 0 ? commandActions.length - 1 : currentIndex - 1,
        );
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        selectCommand(activeCommandIndex);
      }
    }

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [activeCommandIndex, isCommandOpen]);

  useEffect(() => {
    if (!isCommandOpen) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      commandInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [isCommandOpen]);

  return (
    <div className="app-shell">
      <main className="layout-shell" id="main-content">
        <header className="page-header">
          <a className="global-brand" href="#main-content" aria-label="Vector OS home">
            VECTOR // OS
          </a>
          <nav className="global-nav" aria-label="Global navigation">
            <ul>
              <li>
                <a href="#features">Features</a>
              </li>
              <li>
                <a href="#docs">Docs</a>
              </li>
              <li>
                <a href="#changelog">
                  Changelog
                  <span className="global-shortcut" aria-hidden="true">
                    G then F
                  </span>
                </a>
              </li>
            </ul>
          </nav>
        </header>

        <section className="hero-section" aria-labelledby="page-title" ref={heroRef}>
          <ShaderBackground targetRef={heroRef} />
          <div className="hero-content">
            <p className="kicker">Realtime developer productivity</p>
            <h1 id="page-title" className="hero-title">
              <span className="text-mask">
                <span className="text-reveal text-reveal-line-1">
                  Ship <span className="accent-text">complex</span> software
                </span>
              </span>
              <span className="text-mask">
                <span className="text-reveal text-reveal-line-2">
                  from one <span className="accent-text">command</span> layer.
                </span>
              </span>
            </h1>
            <p className="hero-copy text-mask">
              <span className="text-reveal text-reveal-subheadline">
                Coordinate agents, diffs, reviews, deploys, and team memory without losing the thread.
              </span>
            </p>
            <p className="selected-command" aria-live="polite">
              Last command: <span>{selectedCommand}</span>
            </p>
          </div>
        </section>

        <section className="bento-grid" id="features" aria-label="Productivity overview">
          {cards.map((card) => (
            <article className="data-card" key={card.title}>
              <div className="card-topline">
                <span>{card.eyebrow}</span>
                <span>{card.meta}</span>
              </div>
              <div className="card-heading">
                <h2>{card.title}</h2>
                <strong>{card.value}</strong>
              </div>
              <p>{card.description}</p>
            </article>
          ))}
        </section>
      </main>

      <section
        aria-hidden={!isCommandOpen}
        aria-label="Command menu overlay"
        className={`command-overlay${isCommandOpen ? ' is-open' : ''}`}
      >
        <div aria-labelledby="command-title" aria-modal="true" className="command-menu" role="dialog">
          <div className="command-input-row">
            <input
              aria-activedescendant={`command-option-${activeCommandIndex}`}
              aria-label="Search commands or tools"
              aria-controls="command-options"
              autoComplete="off"
              id="command-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search commands or tools... (Press Command K)"
              ref={commandInputRef}
              tabIndex={isCommandOpen ? 0 : -1}
              type="search"
              value={query}
            />
          </div>

          <div className="command-results">
            <p id="command-title" className="command-title">
              Suggested Commands
            </p>
            <ul id="command-options" role="listbox">
              {commandActions.map((item, index) => (
                <li key={item.label} role="presentation">
                  <button
                    aria-selected={activeCommandIndex === index}
                    className={`command-option${activeCommandIndex === index ? ' is-active' : ''}`}
                    id={`command-option-${index}`}
                    onClick={() => selectCommand(index)}
                    onMouseEnter={() => setActiveCommandIndex(index)}
                    ref={(node) => {
                      commandOptionRefs.current[index] = node;
                    }}
                    role="option"
                    tabIndex={isCommandOpen ? 0 : -1}
                    type="button"
                  >
                    <span>{item.label}</span>
                    <span className="command-shortcut" aria-hidden="true">
                      {item.shortcut}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
