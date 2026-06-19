import { Brand } from './Brand';

type HeaderProps = {
  onNavigateHome: (hash?: string) => void;
  onOpenProfile: () => void;
  onStartTrial: () => void;
};

const navItems = [
  ['How it works', '#how-it-works'],
  ['Training', '#training'],
  ['Coach mode', '#coach'],
  ['Plans', '#plans'],
];

export function Header({ onNavigateHome, onOpenProfile, onStartTrial }: HeaderProps) {
  return (
    <header className="site-header">
      <Brand onHome={() => onNavigateHome()} />
      <nav className="site-nav" aria-label="Main navigation">
        {navItems.map(([label, hash]) => (
          <a
            href={hash}
            key={hash}
            onClick={(event) => {
              event.preventDefault();
              onNavigateHome(hash);
            }}
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="header-actions">
        <button className="profile-button" onClick={onOpenProfile} type="button">
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
            <path
              d="M12 12.25a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5ZM4.75 20.25c.88-3.4 3.45-5.25 7.25-5.25s6.37 1.85 7.25 5.25"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span>Profile</span>
        </button>
        <button className="header-cta" onClick={onStartTrial} type="button">
          Start now
        </button>
      </div>
    </header>
  );
}
