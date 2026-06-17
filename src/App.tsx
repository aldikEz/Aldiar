import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

type NavItem = {
  label: string;
  count?: string;
  icon: 'command' | 'branch' | 'spark' | 'deploy' | 'pulse' | 'settings';
};

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

const navItems: NavItem[] = [
  { label: 'Command Center', count: '12', icon: 'command' },
  { label: 'Workflows', count: '8', icon: 'branch' },
  { label: 'Agents', count: '5', icon: 'spark' },
  { label: 'Deployments', count: '3', icon: 'deploy' },
  { label: 'Telemetry', icon: 'pulse' },
  { label: 'Settings', icon: 'settings' },
];

const commandActions: CommandAction[] = [
  { label: 'Open Projects', shortcut: '⌥ P' },
  { label: 'Create New Task', shortcut: '⌥ T' },
  { label: 'Search Documentation', shortcut: '⌥ D' },
  { label: 'View Analytics', shortcut: '⌥ A' },
  { label: 'Settings', shortcut: '↵ Enter' },
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

function Icon({ name }: { name: NavItem['icon'] }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
  };

  const paths: Record<NavItem['icon'], JSX.Element> = {
    command: (
      <>
        <path d="M9 9H7.8A2.8 2.8 0 1 1 10.6 6.2V18A2.8 2.8 0 1 1 7.8 15H16.2A2.8 2.8 0 1 1 13.4 17.8V6.2A2.8 2.8 0 1 1 16.2 9H9Z" />
      </>
    ),
    branch: (
      <>
        <path d="M7 7A3 3 0 1 0 7 13A3 3 0 0 0 7 7Z" />
        <path d="M17 4A3 3 0 1 0 17 10A3 3 0 0 0 17 4Z" />
        <path d="M17 14A3 3 0 1 0 17 20A3 3 0 0 0 17 14Z" />
        <path d="M9.8 10.1L14.2 7.9M9.8 11.9L14.2 16.1" />
      </>
    ),
    spark: (
      <>
        <path d="M12 3L13.9 8.1L19 10L13.9 11.9L12 17L10.1 11.9L5 10L10.1 8.1L12 3Z" />
        <path d="M18 15L18.8 17.2L21 18L18.8 18.8L18 21L17.2 18.8L15 18L17.2 17.2L18 15Z" />
      </>
    ),
    deploy: (
      <>
        <path d="M12 4L19 8V16L12 20L5 16V8L12 4Z" />
        <path d="M12 12L19 8M12 12V20M12 12L5 8" />
      </>
    ),
    pulse: (
      <>
        <path d="M4 12H8L10 6L14 18L16 12H20" />
      </>
    ),
    settings: (
      <>
        <path d="M12 15.2A3.2 3.2 0 1 0 12 8.8A3.2 3.2 0 0 0 12 15.2Z" />
        <path d="M19 12A7.1 7.1 0 0 0 18.9 10.8L21 9.2L19 5.8L16.5 6.8A7.7 7.7 0 0 0 14.4 5.6L14 3H10L9.6 5.6A7.7 7.7 0 0 0 7.5 6.8L5 5.8L3 9.2L5.1 10.8A7.6 7.6 0 0 0 5.1 13.2L3 14.8L5 18.2L7.5 17.2A7.7 7.7 0 0 0 9.6 18.4L10 21H14L14.4 18.4A7.7 7.7 0 0 0 16.5 17.2L19 18.2L21 14.8L18.9 13.2A7.1 7.1 0 0 0 19 12Z" />
      </>
    ),
  };

  return (
    <svg {...common} className="nav-icon">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6">
        {paths[name]}
      </g>
    </svg>
  );
}

export default function App() {
  const [activeNav, setActiveNav] = useState(navItems[0].label);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [selectedCommand, setSelectedCommand] = useState(commandActions[0].label);
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const commandOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleCardPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;

    event.currentTarget.style.setProperty('--pointer-x', `${x}%`);
    event.currentTarget.style.setProperty('--pointer-y', `${y}%`);
  }

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
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <span />
          </div>
          <div>
            <p className="brand-name">Vector</p>
            <p className="brand-meta">Developer OS</p>
          </div>
        </div>

        <nav className="nav-stack">
          {navItems.map((item) => (
            <button
              aria-current={activeNav === item.label ? 'page' : undefined}
              className="nav-link"
              key={item.label}
              onClick={() => setActiveNav(item.label)}
              type="button"
            >
              <span className="nav-label">
                <Icon name={item.icon} />
                {item.label}
              </span>
              {item.count ? <span className="nav-count">{item.count}</span> : null}
            </button>
          ))}
        </nav>

        <section className="sidebar-status" aria-labelledby="workspace-title">
          <p id="workspace-title" className="status-title">
            Workspace
          </p>
          <p className="status-copy">Production branch monitored across 18 services.</p>
        </section>
      </aside>

      <main className="main-content" id="main-content">
        <section className="hero-section" aria-labelledby="page-title">
          <p className="kicker">Realtime developer productivity</p>
          <h1 id="page-title">Ship complex software from one command layer.</h1>
          <p className="hero-copy">
            Coordinate agents, diffs, reviews, deploys, and team memory without losing the thread.
          </p>
          <p className="selected-command" aria-live="polite">
            Last command: <span>{selectedCommand}</span>
          </p>
        </section>

        <section
          aria-hidden={!isCommandOpen}
          aria-label="Command menu overlay"
          className={`command-overlay${isCommandOpen ? ' is-open' : ''}`}
        >
          <div
            aria-labelledby="command-title"
            aria-modal="true"
            className="command-menu"
            role="dialog"
          >
            <div className="command-input-row">
              <label className="sr-only" htmlFor="command-search">
                Search commands or tools
              </label>
              <input
                aria-activedescendant={`command-option-${activeCommandIndex}`}
                aria-controls="command-options"
                autoComplete="off"
                id="command-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search commands or tools... (Press ⌘K)"
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

        <section className="bento-grid" aria-label="Productivity overview">
          {cards.map((card) => (
            <article className="data-card" key={card.title} onPointerMove={handleCardPointerMove}>
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
    </div>
  );
}
