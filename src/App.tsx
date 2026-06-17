import { useEffect, useMemo, useRef, useState } from 'react';
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

type RiskSurface = 'Low' | 'Clear' | 'Audited';

const commandActions: CommandAction[] = [
  { label: 'Open Projects', shortcut: 'Option P' },
  { label: 'Create New Task', shortcut: 'Option T' },
  { label: 'Search Documentation', shortcut: 'Option D' },
  { label: 'View Analytics', shortcut: 'Option A' },
  { label: 'Settings', shortcut: 'Enter' },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function App() {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [, setSelectedCommand] = useState(commandActions[0].label);
  const [flowIntegrity, setFlowIntegrity] = useState(94);
  const [queuedCommands, setQueuedCommands] = useState(28);
  const [riskSurface, setRiskSurface] = useState<RiskSurface>('Low');
  const [isCardMatrixInverted, setIsCardMatrixInverted] = useState(false);
  const [kickerText, setKickerText] = useState('Realtime developer productivity');

  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const kickerTimeoutRef = useRef<number | null>(null);
  const riskAuditTimeoutRef = useRef<number | null>(null);
  const isRiskAuditLockedRef = useRef(false);

  const filteredActions = useMemo(
    () => commandActions.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  const telemetryCards = useMemo<Card[]>(() => {
    const cards: Card[] = [
      {
        eyebrow: 'Focus Session',
        title: 'Flow integrity',
        value: `${flowIntegrity}%`,
        meta: flowIntegrity >= 94 ? '+12.4%' : 'recovering',
        description: 'Context switches were reduced across active branches and review loops.',
      },
      {
        eyebrow: 'Automation',
        title: 'Queued commands',
        value: String(queuedCommands),
        meta: `${Math.max(1, Math.round(queuedCommands / 5))} live`,
        description: 'High-confidence workflows are ready to execute from the command layer.',
      },
      {
        eyebrow: 'Code Health',
        title: 'Risk surface',
        value: riskSurface,
        meta: riskSurface === 'Audited' ? 'locked' : '2 files',
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

    return isCardMatrixInverted ? [...cards].reverse() : cards;
  }, [flowIntegrity, isCardMatrixInverted, queuedCommands, riskSurface]);

  useEffect(() => {
    setActiveCommandIndex(0);
  }, [query]);

  useEffect(() => {
    const telemetryInterval = window.setInterval(() => {
      setFlowIntegrity((currentValue) => {
        if (currentValue < 94) {
          return clamp(currentValue + 1, 91, 98);
        }

        const delta = Math.random() > 0.5 ? 1 : -1;
        return clamp(currentValue + delta, 91, 98);
      });

      setQueuedCommands((currentValue) => {
        if (Math.random() < 0.45) {
          const delta = Math.random() > 0.5 ? 1 : -1;
          return clamp(currentValue + delta, 20, 35);
        }

        return currentValue;
      });

      if (!isRiskAuditLockedRef.current) {
        setRiskSurface((currentValue) => (currentValue === 'Low' ? 'Clear' : 'Low'));
      }
    }, 3500);

    return () => {
      window.clearInterval(telemetryInterval);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (kickerTimeoutRef.current !== null) {
        window.clearTimeout(kickerTimeoutRef.current);
      }

      if (riskAuditTimeoutRef.current !== null) {
        window.clearTimeout(riskAuditTimeoutRef.current);
      }
    };
  }, []);

  function temporarilySetKickerText(nextText: string) {
    if (kickerTimeoutRef.current !== null) {
      window.clearTimeout(kickerTimeoutRef.current);
    }

    setKickerText(nextText);
    kickerTimeoutRef.current = window.setTimeout(() => {
      setKickerText('Realtime developer productivity');
      kickerTimeoutRef.current = null;
    }, 3500);
  }

  function lockRiskSurfaceAudit() {
    if (riskAuditTimeoutRef.current !== null) {
      window.clearTimeout(riskAuditTimeoutRef.current);
    }

    isRiskAuditLockedRef.current = true;
    setRiskSurface('Audited');
    riskAuditTimeoutRef.current = window.setTimeout(() => {
      isRiskAuditLockedRef.current = false;
      setRiskSurface('Clear');
      riskAuditTimeoutRef.current = null;
    }, 5000);
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

  function selectCommandAction(action: CommandAction) {
    setSelectedCommand(action.label);

    switch (action.label) {
      case 'Open Projects':
        setIsCardMatrixInverted((currentValue) => !currentValue);
        setQueuedCommands((currentValue) => clamp(currentValue + 3, 20, 35));
        break;
      case 'Create New Task':
        setFlowIntegrity((currentValue) => clamp(currentValue - 4, 91, 98));
        temporarilySetKickerText('Action Triggered: Initializing New Task Loop');
        break;
      case 'Search Documentation':
        lockRiskSurfaceAudit();
        temporarilySetKickerText('System Focus: Documentation Index Active');
        break;
      default:
        break;
    }

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

        if (filteredActions.length === 0) {
          return;
        }

        setActiveCommandIndex((currentIndex) => (currentIndex + 1) % filteredActions.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();

        if (filteredActions.length === 0) {
          return;
        }

        setActiveCommandIndex((currentIndex) =>
          currentIndex === 0 ? filteredActions.length - 1 : currentIndex - 1,
        );
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();

        if (filteredActions.length > 0) {
          selectCommandAction(filteredActions[activeCommandIndex]);
        }
      }
    }

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [activeCommandIndex, filteredActions, isCommandOpen]);

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

        <div
          className="hero-search-anchor"
          onClick={openCommandMenu}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openCommandMenu();
            }
          }}
          role="button"
          tabIndex={0}
        >
          <span className="hero-search-copy">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
              <path
                d="M8.75 14.25A5.5 5.5 0 1 1 8.75 3.25a5.5 5.5 0 0 1 0 11ZM13 13l3.25 3.25"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
              />
            </svg>
            <span>Search tools and actions... (⌘K)</span>
          </span>
        </div>

        <section className="hero-section" aria-labelledby="page-title" ref={heroRef}>
          <ShaderBackground targetRef={heroRef} />

          <div className="hero-content">
            <p className="kicker">{kickerText}</p>
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
          </div>
        </section>

        <section className="bento-grid" id="features" aria-label="Productivity overview">
          {telemetryCards.map((card) => (
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
        onClick={closeCommandMenu}
      >
        <div
          aria-labelledby="command-title"
          aria-modal="true"
          className="command-menu"
          role="dialog"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="command-input-row">
            <span className="command-search-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" focusable="false">
                <path
                  d="M8.75 14.25A5.5 5.5 0 1 1 8.75 3.25a5.5 5.5 0 0 1 0 11ZM13 13l3.25 3.25"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.6"
                />
              </svg>
            </span>
            <input
              aria-activedescendant={filteredActions.length > 0 ? `command-option-${activeCommandIndex}` : undefined}
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
              {filteredActions.length > 0 ? 'Suggested Commands' : 'No Results'}
            </p>

            {filteredActions.length > 0 ? (
              <ul id="command-options" role="listbox">
                {filteredActions.map((item, index) => (
                  <li key={item.label} role="presentation">
                    <button
                      aria-selected={activeCommandIndex === index}
                      className={`command-option${activeCommandIndex === index ? ' is-active' : ''}`}
                      id={`command-option-${index}`}
                      onClick={() => selectCommandAction(item)}
                      onMouseEnter={() => setActiveCommandIndex(index)}
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
            ) : (
              <p className="command-empty">No commands match your search.</p>
            )}
          </div>

          <div className="command-footer">
            <span>{filteredActions.length} commands found</span>
            <span className="command-actions-hint">
              <span>Actions</span>
              <span className="command-footer-badge" aria-hidden="true">
                <span>⌘</span>
                <span>↵</span>
              </span>
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
