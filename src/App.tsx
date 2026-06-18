import { useEffect, useMemo, useRef, useState } from 'react';
import { ShaderAnimation } from './components/ui/shader-lines';

type CommandAction = {
  label: string;
  shortcut: string;
};

type RiskSurface = 'Low' | 'Clear' | 'Audited';

const commandActions: CommandAction[] = [
  { label: 'Restart Microservices Engine', shortcut: 'Option R' },
  { label: 'Purge System Build Cache', shortcut: 'Option P' },
  { label: 'Deploy Cluster Snapshot', shortcut: 'Option D' },
  { label: 'View Container Registry Logs', shortcut: 'Option L' },
  { label: 'Cluster Settings', shortcut: 'Enter' },
];

const DEFAULT_KICKER_TEXT = 'Ephemeral microservice orchestration engine';
const DEFAULT_SYSTEM_LOGS = ['[SYS] Core initialization successful.', '[SYS] Viewport pipeline bound to GPU.'];
const STORAGE_KEYS = {
  flowIntegrity: 'kuber.flowIntegrity',
  queuedCommands: 'kuber.queuedCommands',
  isCardMatrixInverted: 'kuber.isCardMatrixInverted',
  systemLogs: 'kuber.systemLogs',
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readStoredNumber(key: string, fallback: number, min: number, max: number) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const storedValue = window.localStorage.getItem(key);
  const parsedValue = storedValue === null ? Number.NaN : Number(storedValue);
  return Number.isFinite(parsedValue) ? clamp(parsedValue, min, max) : fallback;
}

function readStoredBoolean(key: string, fallback: boolean) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const storedValue = window.localStorage.getItem(key);

  if (storedValue === 'true') {
    return true;
  }

  if (storedValue === 'false') {
    return false;
  }

  return fallback;
}

function readStoredLogs() {
  if (typeof window === 'undefined') {
    return DEFAULT_SYSTEM_LOGS;
  }

  try {
    const parsedValue = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.systemLogs) ?? '[]');

    if (Array.isArray(parsedValue) && parsedValue.every((entry) => typeof entry === 'string')) {
      return parsedValue.length > 0 ? parsedValue.slice(-8) : DEFAULT_SYSTEM_LOGS;
    }
  } catch {
    return DEFAULT_SYSTEM_LOGS;
  }

  return DEFAULT_SYSTEM_LOGS;
}

export default function App() {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [, setSelectedCommand] = useState(commandActions[0].label);
  const [flowIntegrity, setFlowIntegrity] = useState(() => readStoredNumber(STORAGE_KEYS.flowIntegrity, 94, 91, 98));
  const [queuedCommands, setQueuedCommands] = useState(() => readStoredNumber(STORAGE_KEYS.queuedCommands, 28, 20, 35));
  const [riskSurface, setRiskSurface] = useState<RiskSurface>('Low');
  const [isCardMatrixInverted, setIsCardMatrixInverted] = useState(() =>
    readStoredBoolean(STORAGE_KEYS.isCardMatrixInverted, false),
  );
  const [kickerText, setKickerText] = useState(DEFAULT_KICKER_TEXT);
  const [systemLogs, setSystemLogs] = useState<string[]>(readStoredLogs);

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

  useEffect(() => {
    setActiveCommandIndex(0);
  }, [query]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.flowIntegrity, String(flowIntegrity));
  }, [flowIntegrity]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.queuedCommands, String(queuedCommands));
  }, [queuedCommands]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.isCardMatrixInverted, String(isCardMatrixInverted));
  }, [isCardMatrixInverted]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.systemLogs, JSON.stringify(systemLogs));
  }, [systemLogs]);

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
      setKickerText(DEFAULT_KICKER_TEXT);
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

  function pushSystemLog(message: string) {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setSystemLogs((currentLogs) => [...currentLogs, `[${timestamp}] ${message}`].slice(-8));
  }

  function getCommandLog(actionLabel: string) {
    switch (actionLabel) {
      case 'Restart Microservices Engine':
        return '[WARN] Cluster restart sequence initiated. Re-indexing pods...';
      case 'Purge System Build Cache':
        return '[INFO] Cache purge complete. Cleared 1.8GB layer files.';
      case 'Deploy Cluster Snapshot':
        return '[SUCCESS] Cluster snapshot deployed safely. Verification ok.';
      case 'View Container Registry Logs':
        return '[INFO] Container registry log stream opened.';
      case 'Cluster Settings':
        return '[INFO] Cluster settings panel requested.';
      default:
        return `[INFO] Command executed: ${actionLabel}.`;
    }
  }

  function selectCommandAction(action: CommandAction) {
    setSelectedCommand(action.label);
    pushSystemLog(getCommandLog(action.label));

    switch (action.label) {
      case 'Restart Microservices Engine':
        setIsCardMatrixInverted((currentValue) => !currentValue);
        setFlowIntegrity((currentValue) => clamp(currentValue - 4, 91, 98));
        break;
      case 'Purge System Build Cache':
        temporarilySetKickerText('Trace Cleared: Build Cache Purged');
        break;
      case 'Deploy Cluster Snapshot':
        lockRiskSurfaceAudit();
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
      <div className="global-shader-lines-layer" aria-hidden="true">
        <ShaderAnimation />
      </div>
      <div className="global-shader-lines-layer global-shader-lines-layer-left" aria-hidden="true">
        <ShaderAnimation />
      </div>

      <a className="brand-lockup" href="#main-content" aria-label="DeployGuard home">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" focusable="false">
            <path
              d="M8.5 7.5h8.2c5.2 0 8.8 3.5 8.8 8.5s-3.6 8.5-8.8 8.5H8.5v-17Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M13 16h9M18.8 11.8 23 16l-4.2 4.2"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
            <path d="M8.5 7.5v17" stroke="currentColor" strokeLinecap="round" strokeWidth="2.6" />
          </svg>
        </span>
        <span>DeployGuard</span>
      </a>

      <main className="layout-shell" id="main-content">
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

        <section className="raycast-dashboard-feed" id="features" aria-label="Project execution feed">
          <article className="feed-row feed-analytics" aria-label="Core project compilation analytics tracker">
            <div className="feed-row-header">
              <span>Core Project Compilation Analytics Tracker</span>
              <strong>{riskSurface} Network Profile</strong>
            </div>
            <div className="analytics-grid">
              <div className="analytics-metric">
                <span>System Build Integrity</span>
                <strong>{flowIntegrity}%</strong>
                <div className="metric-track-bg" aria-hidden="true">
                  <div className="metric-track-fill" style={{ width: `${flowIntegrity}%` }} />
                </div>
              </div>
              <div className="analytics-metric">
                <span>Pending Build Files</span>
                <strong>{queuedCommands}</strong>
                <p>{queuedCommands} files left in stack</p>
              </div>
              <div className="analytics-metric">
                <span>Active Configuration</span>
                <strong>Next.js 15 + i18n Localization Engine</strong>
                <p>Client routing, locale dictionaries, edge middleware, and Supabase adapters are staged.</p>
              </div>
            </div>
          </article>

          <article className="feed-row feed-code-blueprint" aria-label="Localized code blueprint frame">
            <div className="blueprint-meta">
              <span>Localized Code Blueprint Frame</span>
              <strong>src/locales/kk/common.json</strong>
              <p>Checksum Target: i18n-kz-7f42a9 / Namespace: common / Runtime: edge-safe JSON module</p>
            </div>
            <pre className="feed-code-canvas" aria-label="Kazakh localization JSON preview">
              <code>{`{
  "navigation": {
    "features": "Мүмкіндіктер",
    "docs": "Құжаттама",
    "changelog": "Өзгерістер журналы"
  },
  "hero": {
    "kicker": "Эфемерлі микросервис оркестрация қозғалтқышы",
    "title": "Бір command қабатынан күрделі software жеткізіңіз",
    "search": "Құралдар мен әрекеттерді іздеу... (⌘K)"
  },
  "deployment": {
    "region": "central-asia-kz",
    "checksum": "sha256:8d0a7b9e4c11",
    "fallbackLocale": "en",
    "targets": ["edge", "server", "client"]
  }
}`}</code>
            </pre>
          </article>

          <article className="feed-row" aria-label="Automated file scaffolding tree map">
            <div className="feed-row-header">
              <span>Automated File Scaffolding Tree Map</span>
              <strong>5 tracked paths</strong>
            </div>
            <div className="file-tree-map">
              <div className="file-tree-item">
                <span>root / src / app / layout.tsx</span>
                <strong>Compiled Successfully</strong>
              </div>
              <div className="file-tree-item">
                <span>root / src / app / page.tsx</span>
                <strong>Hydrated</strong>
              </div>
              <div className="file-tree-item">
                <span>root / src / app / api / i18n / route.ts</span>
                <strong>Ready</strong>
              </div>
              <div className="file-tree-item">
                <span>root / src / locales / en / common.json</span>
                <strong>Token Synced</strong>
              </div>
              <div className="file-tree-item">
                <span>root / src / locales / ru / common.json</span>
                <strong>Verified</strong>
              </div>
              <div className="file-tree-item">
                <span>root / src / locales / kk / common.json</span>
                <strong>Checksum Matched</strong>
              </div>
              <div className="file-tree-item">
                <span>root / src / middleware.ts</span>
                <strong>Edge Bound</strong>
              </div>
              <div className="file-tree-item">
                <span>root / supabase / migrations / 20260617_locale_registry.sql</span>
                <strong>Queued</strong>
              </div>
            </div>
          </article>

          <article className="feed-row" aria-label="Real-time security and compliance checklist">
            <div className="feed-row-header">
              <span>Real-Time Security & Compliance Checklists</span>
              <strong>Production Gate</strong>
            </div>
            <div className="compliance-list">
              <p>
                <strong>PASS</strong>
                Project Architecture Schema Validity Verify
              </p>
              <p>
                <strong>PASS</strong>
                Client-Side Multi-Language String Matrix Verification
              </p>
              <p>
                <strong>PASS</strong>
                Content Security Policy (CSP) Frame Isolation Safeguard
              </p>
              <p>
                <strong>PASS</strong>
                Supabase Anonymous Key Boundary Surface Review
              </p>
              <p>
                <strong>PASS</strong>
                Edge Runtime Locale Fallback Consistency Audit
              </p>
            </div>
          </article>

          <section className="feed-row feed-terminal-zone" aria-label="Active monospace system console logger panel">
            <div className="feed-row-header">
              <span>Active Monospace System Console Logger Panel</span>
              <strong>{systemLogs.length} live entries</strong>
            </div>
            <div className="terminal-log-view terminal-log-view-expanded">
              {systemLogs.map((entry, index) => (
                <p className={index === systemLogs.length - 1 ? 'is-latest' : undefined} key={entry + index}>
                  {entry}
                </p>
              ))}
            </div>
          </section>
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
