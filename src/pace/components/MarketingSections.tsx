import { highlights, PLAN_CTA, steps, tiers } from '../content';

type MarketingSectionsProps = {
  coachCount: number;
  coachNames: string[];
  onOpenCoach: () => void;
  onPickTier: (tier: string) => void;
};

export function MarketingSections({
  coachCount,
  coachNames,
  onOpenCoach,
  onPickTier,
}: MarketingSectionsProps) {
  return (
    <>
      <section className="comfort-section" id="how-it-works" aria-labelledby="how-title">
        <div className="section-heading">
          <span className="comfort-kicker">How it works</span>
          <h2 id="how-title">Simple enough to actually use.</h2>
          <p>No giant dashboard. No spreadsheet energy. Just the next right move.</p>
        </div>
        <div className="comfort-step-list">
          {steps.map(([title, text], index) => (
            <article className="comfort-step" key={title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="product-section" aria-labelledby="product-title">
        <div className="section-heading">
          <h2 id="product-title">Built for weeks that do not go perfectly.</h2>
          <p>The app is allowed to be simple because life already is not.</p>
        </div>
        <div className="product-grid">
          {highlights.map(([title, text]) => (
            <article className="product-card" key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="coach-band" id="coach" aria-labelledby="coach-title">
        <div>
          <span className="comfort-kicker">Optional coach mode</span>
          <h2 id="coach-title">Only when someone helps your week.</h2>
          <p>
            Most people can use Pace alone. If a coach, parent, or trainer is part of the routine, they get short notes
            and plan context without turning it into another noisy group chat.
          </p>
        </div>
        <div className="coach-note-stack">
          {['Private by default', 'Share only if useful', 'Short notes, no noise'].map((item) => (
            <span key={item}>{item}</span>
          ))}
          <button className="coach-open-button" onClick={onOpenCoach} type="button">
            {coachCount === 1 ? '1 person saved' : coachCount > 1 ? `${coachCount} people saved` : 'Open coach demo'}
          </button>
          {coachNames.length > 0 ? (
            <div className="coach-inline-roster">
              {coachNames.slice(0, 3).map((name) => (
                <span key={name}>{name}</span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="faq-section" aria-labelledby="faq-title">
        <div className="section-heading">
          <span className="comfort-kicker qa-kicker">Q and A</span>
          <h2 id="faq-title">The honest version.</h2>
        </div>
        <div className="faq-list">
          {[
            [
              'Is this a real app yet?',
              'This is a polished front-end demo. The planner, training session, food log, coach demo, command menu, and privacy clear action work with local data.',
            ],
            ['Does it replace a coach?', 'No. Pace organizes the week so coaches, parents, and athletes can talk with better context.'],
            ['Why start with a trial?', 'Because people should feel the plan first. Three days is enough to see if the routine actually helps.'],
          ].map(([question, answer]) => (
            <article className="faq-item" key={question}>
              <h3>{question}</h3>
              <p>{answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="comfort-section pricing-section" id="plans" aria-labelledby="pricing-title">
        <div className="section-heading">
          <h2 id="pricing-title">Start small. Keep going if it helps.</h2>
          <p>Every paid plan starts with a 3-day trial. Weekly, monthly, or coach mode.</p>
        </div>
        <div className="pricing-grid">
          {tiers.map(([name, price, description, features]) => (
            <article className={`pricing-card pricing-card-${name.toLowerCase()}`} key={name}>
              <div>
                <h3>{name}</h3>
                <strong>{price}</strong>
                <p>{description}</p>
              </div>
              <ul>
                {features.map((feature) => (
                  <li key={`${name}-${feature}`}>{feature}</li>
                ))}
              </ul>
              <button onClick={() => onPickTier(name)} type="button">
                {PLAN_CTA}
              </button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
