import type { PlanItem } from '../types';

type PlanPreviewProps = {
  coachPinned: boolean;
  copyNotice: string;
  foodSummary: string;
  note: string;
  plan: PlanItem[];
  profileSummary?: string;
  onCopyPlan: () => void;
  onEditPlan: () => void;
  onLogFood: () => void;
  onLogToday: () => void;
};

export function PlanPreview({
  coachPinned,
  copyNotice,
  foodSummary,
  note,
  plan,
  profileSummary,
  onCopyPlan,
  onEditPlan,
  onLogFood,
  onLogToday,
}: PlanPreviewProps) {
  return (
    <section className="preview-section" aria-labelledby="preview-title">
      <section className="today-panel" aria-label="Today in Pace">
        <div className="today-panel-header">
          <div>
            <span>This week</span>
            <h2 id="preview-title">Plan that fits.</h2>
          </div>
          <div className="today-status">
            <span>Today&apos;s plan</span>
            <strong>{plan.length} steps</strong>
          </div>
        </div>

        <div className="today-plan-list">
          {plan.map((item) => (
            <article className="today-plan-item" key={`${item.time}-${item.title}`}>
              <time>{item.time}</time>
              <span className={`plan-dot plan-dot-${item.tone}`} aria-hidden="true" />
              <div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="today-note">
          <span>Pace note</span>
          <p>
            {note}
            {coachPinned ? ' Coach update is available when you need it.' : ''}
          </p>
        </div>

        {profileSummary ? (
          <div className="setup-summary">
            <span>Saved setup</span>
            <p>{profileSummary}</p>
          </div>
        ) : null}

        <div className="food-summary">
          <span>Food log</span>
          <p>{foodSummary}</p>
        </div>

        <div className="today-action-row">
          <button className="today-log-button" onClick={onLogToday} type="button">
            Log today
          </button>
          <button className="today-food-button" onClick={onLogFood} type="button">
            Log food
          </button>
          <button className="today-copy-button" onClick={onCopyPlan} type="button">
            Copy plan
          </button>
          <button className="today-edit-button" onClick={onEditPlan} type="button">
            Edit plan
          </button>
        </div>

        <p className="copy-notice" role="status" aria-live="polite">
          {copyNotice}
        </p>
      </section>
    </section>
  );
}
