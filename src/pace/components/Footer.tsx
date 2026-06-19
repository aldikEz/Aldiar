import type { LegalId } from '../types';

type FooterProps = {
  onOpenLegal: (panel: LegalId) => void;
};

export function Footer({ onOpenLegal }: FooterProps) {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <span>PACE AI</span>
        <p>One simple tracker for everything you are trying to keep together.</p>
      </div>
      <p className="footer-meta">© 2026 Pace AI. Demo product.</p>
      <nav aria-label="Legal navigation">
        <button onClick={() => onOpenLegal('privacy')} type="button">
          Privacy Policy
        </button>
        <button onClick={() => onOpenLegal('terms')} type="button">
          User Terms Agreement
        </button>
      </nav>
    </footer>
  );
}
