import type { AuthIntent, AuthMode } from '../types';

const intentCopy: Record<AuthIntent, string> = {
  trial: 'Start your 3-day trial',
  planner: 'Build your first week',
  'log-today': 'Save today to your account',
  food: 'Save food logs',
  'copy-plan': 'Save and copy your plan',
  training: 'Start training',
  'ai-week': 'Generate your AI week',
  coach: 'Open coach mode',
  'weekly-plan': 'Start the weekly plan',
  'monthly-plan': 'Start the monthly plan',
  'coach-plan': 'Start coach mode',
  profile: 'Open your Pace profile',
};

type AuthPageProps = {
  intent: AuthIntent;
  mode: AuthMode;
  onBackHome: () => void;
  onOpenAuth: () => void;
  onSwitchMode: (mode: AuthMode) => void;
};

export function AuthPage({ intent, mode, onBackHome, onOpenAuth, onSwitchMode }: AuthPageProps) {
  const isLogin = mode === 'login';
  const alternateMode = isLogin ? 'signup' : 'login';

  return (
    <section className="auth-route-page" aria-labelledby="auth-route-title">
      <div className="auth-route-copy">
        <span className="comfort-kicker">PACE AI ACCOUNT</span>
        <h1 id="auth-route-title">{isLogin ? 'Welcome back to Pace.' : 'Create your Pace account.'}</h1>
        <p>
          {intentCopy[intent]}. Your plans, food notes, training sessions, and coach updates should follow you from
          phone to laptop without getting lost.
        </p>
        <div className="auth-route-actions">
          <button className="primary-action" onClick={onOpenAuth} type="button">
            {isLogin ? 'Log in' : 'Create account'}
          </button>
          <button className="secondary-action" onClick={() => onSwitchMode(alternateMode)} type="button">
            {isLogin ? 'Need an account?' : 'Already have one?'}
          </button>
        </div>
        <button className="auth-back-button" onClick={onBackHome} type="button">
          Back to homepage
        </button>
      </div>

      <div className="auth-route-card" aria-label="What signing in unlocks">
        {[
          ['Keep your week', 'Plans stay saved instead of living in one browser tab.'],
          ['Track progress', 'Training and food logs connect to the same simple timeline.'],
          ['Coach-ready', 'Share the right context without sending screenshots around.'],
        ].map(([title, text]) => (
          <article key={title}>
            <span aria-hidden="true" />
            <div>
              <h2>{title}</h2>
              <p>{text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
