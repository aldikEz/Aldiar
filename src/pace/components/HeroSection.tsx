type HeroSectionProps = {
  hooks: string[];
  onSeePlans: () => void;
  onStartTrial: () => void;
};

export function HeroSection({ hooks, onSeePlans, onStartTrial }: HeroSectionProps) {
  return (
    <section className="hero-section comfort-hero" aria-labelledby="page-title">
      <div className="hero-content comfort-hero-copy">
        <p className="comfort-kicker">MEET PACE AI</p>
        <h1 id="page-title" className="hero-title">
          All-in-one planning <span>for real life.</span>
        </h1>
        <p className="hero-copy">
          Make progress with one simple tracker for everything you are working on: training, food, school, recovery,
          and the rest of your week.
        </p>
        <div className="comfort-actions">
          <button className="primary-action" onClick={onStartTrial} type="button">
            Start now
          </button>
          <button className="secondary-action" onClick={onSeePlans} type="button">
            See plans
          </button>
        </div>
        <div className="hero-hook-row" aria-label="Pace AI benefits">
          {hooks.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
