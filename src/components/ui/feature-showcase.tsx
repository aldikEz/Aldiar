import { useEffect, useMemo, useRef, useState } from 'react';

export type TabMedia = {
  value: string;
  label: string;
  title: string;
  summary: string;
  rows: Array<{
    label: string;
    value: string;
    meta: string;
  }>;
  metrics?: Array<{
    label: string;
    value: string;
  }>;
};

export type ShowcaseStep = {
  id: string;
  title: string;
  text: string;
};

type FeatureShowcaseProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  stats?: string[];
  steps?: ShowcaseStep[];
  tabs: TabMedia[];
  defaultTab?: string;
  panelMinHeight?: number;
  className?: string;
};

const defaultSteps: ShowcaseStep[] = [
  {
    id: 'review',
    title: 'Review the release',
    text: 'Open one clean view before production and see what still needs attention.',
  },
  {
    id: 'spot',
    title: 'Spot risky changes',
    text: 'Turn scattered signals into a short list your team can understand quickly.',
  },
  {
    id: 'keep',
    title: 'Keep the decision',
    text: 'Save the final call so the team knows what shipped and why.',
  },
];

export function FeatureShowcase({
  eyebrow = 'What we offer',
  title,
  description,
  stats = ['Release review', 'Clear checks', 'Decision record'],
  steps = defaultSteps,
  tabs,
  defaultTab,
  panelMinHeight = 520,
  className = '',
}: FeatureShowcaseProps) {
  const initialTab = defaultTab ?? tabs[0]?.value ?? '';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [openStepId, setOpenStepId] = useState(steps[0]?.id ?? '');
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  const activePanel = useMemo(
    () => tabs.find((tab) => tab.value === activeTab) ?? tabs[0],
    [activeTab, tabs],
  );

  useEffect(() => {
    const section = sectionRef.current;

    if (!section) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.24 },
    );

    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  return (
    <section
      className={`feature-showcase${isVisible ? ' is-visible' : ''} ${className}`}
      id="features"
      aria-labelledby="feature-showcase-title"
      ref={sectionRef}
    >
      <div className="feature-showcase-shell">
        <div className="feature-copy">
          <span className="feature-eyebrow">{eyebrow}</span>
          <h2 id="feature-showcase-title" className="feature-title">
            {title}
          </h2>
          {description ? <p className="feature-description">{description}</p> : null}

          {stats.length > 0 ? (
            <div className="feature-stats" aria-label="Feature benefits">
              {stats.map((stat) => (
                <span className="feature-stat" key={stat}>
                  {stat}
                </span>
              ))}
            </div>
          ) : null}

          <div className="feature-steps">
            {steps.map((step) => {
              const isOpen = openStepId === step.id;

              return (
                <article className={`feature-step${isOpen ? ' is-open' : ''}`} key={step.id}>
                  <button
                    aria-expanded={isOpen}
                    className="feature-step-trigger"
                    onClick={() => setOpenStepId(isOpen ? '' : step.id)}
                    type="button"
                  >
                    <span>{step.title}</span>
                    <span aria-hidden="true">{isOpen ? '-' : '+'}</span>
                  </button>
                  <div className="feature-step-content-wrap">
                    <p className="feature-step-content">{step.text}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="feature-panel" style={{ minHeight: panelMinHeight }}>
          {activePanel ? (
            <div className="feature-panel-content" key={activePanel.value}>
              <div className="feature-panel-header">
                <span className="feature-panel-kicker">{activePanel.label}</span>
                <h3>{activePanel.title}</h3>
                <p>{activePanel.summary}</p>
              </div>

              {activePanel.metrics?.length ? (
                <div className="feature-metrics" aria-label={`${activePanel.label} metrics`}>
                  {activePanel.metrics.map((metric) => (
                    <div className="feature-metric" key={`${activePanel.value}-${metric.label}`}>
                      <strong>{metric.value}</strong>
                      <span>{metric.label}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="feature-row-list">
                {activePanel.rows.map((row) => (
                  <div className="feature-preview-row" key={`${activePanel.value}-${row.label}`}>
                    <div>
                      <span>{row.label}</span>
                      <p>{row.meta}</p>
                    </div>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="feature-tabs" role="tablist" aria-label="Feature preview">
            {tabs.map((tab) => (
              <button
                aria-selected={activeTab === tab.value}
                className={`feature-tab${activeTab === tab.value ? ' is-active' : ''}`}
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
