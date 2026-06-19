import type { RefObject } from 'react';
import { legalPanels } from '../content';
import type { LegalId } from '../types';

type LegalModalProps = {
  closeRef: RefObject<HTMLButtonElement>;
  dataNotice: string;
  demoRows: string[][];
  openPanel: LegalId | null;
  onClearData: () => void;
  onClose: () => void;
  onSwitchPanel: (panel: LegalId) => void;
};

const legalTabs: LegalId[] = ['privacy', 'terms'];

export function LegalModal({
  closeRef,
  dataNotice,
  demoRows,
  openPanel,
  onClearData,
  onClose,
  onSwitchPanel,
}: LegalModalProps) {
  const currentLegal = openPanel ? legalPanels[openPanel] : null;

  return (
    <section aria-hidden={!currentLegal} className={`legal-overlay${currentLegal ? ' is-open' : ''}`} onClick={onClose}>
      {currentLegal ? (
        <div
          aria-labelledby="legal-title"
          aria-modal="true"
          className="legal-panel"
          role="dialog"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="legal-header">
            <div>
              <span>Legal</span>
              <h2 id="legal-title">{currentLegal.title}</h2>
              <p className="legal-updated">Last updated {currentLegal.updated}</p>
            </div>
            <button aria-label="Close legal document" onClick={onClose} ref={closeRef} type="button">
              Close
            </button>
          </div>
          <nav className="legal-tabs" aria-label="Legal documents">
            {legalTabs.map((panel) => (
              <button
                aria-pressed={openPanel === panel}
                className={openPanel === panel ? 'is-active' : undefined}
                key={panel}
                onClick={() => onSwitchPanel(panel)}
                type="button"
              >
                {legalPanels[panel].title}
              </button>
            ))}
          </nav>
          <p className="legal-intro">{currentLegal.intro}</p>
          <div className="legal-content">
            {currentLegal.items.map(([heading, text]) => (
              <article key={heading}>
                <h3>{heading}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          {openPanel === 'privacy' ? (
            <div className="demo-data-panel">
              <div className="demo-data-panel-copy">
                <h3>Your demo data</h3>
                <p>
                  This is the browser-only state Pace is using right now. Clearing it resets the demo without touching
                  any account.
                </p>
              </div>
              <dl>
                {demoRows.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <button className="demo-data-clear" onClick={onClearData} type="button">
                Clear demo data
              </button>
              <p className="demo-data-notice" role="status" aria-live="polite">
                {dataNotice}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
