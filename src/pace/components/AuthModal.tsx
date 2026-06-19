import { useEffect, useState, type FormEvent, type RefObject } from 'react';
import type { AuthMode } from '../types';

type AuthModalProps = {
  emailInputRef: RefObject<HTMLInputElement>;
  isOpen: boolean;
  mode: AuthMode;
  onClose: () => void;
  onSubmit: (email: string) => void;
  onSwitchMode: (mode: AuthMode) => void;
};

export function AuthModal({ emailInputRef, isOpen, mode, onClose, onSubmit, onSwitchMode }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLogin = mode === 'login';

  useEffect(() => {
    if (!isOpen) {
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim()) {
      setError('Add an email first.');
      return;
    }

    if (password.trim().length < 6) {
      setError('Use at least 6 characters.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    window.setTimeout(() => {
      setIsSubmitting(false);
      onSubmit(email.trim());
    }, 360);
  }

  return (
    <section aria-hidden={!isOpen} className={`auth-overlay${isOpen ? ' is-open' : ''}`} onClick={onClose}>
      <div
        aria-labelledby="auth-modal-title"
        aria-modal="true"
        className="auth-panel"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="auth-panel-header">
          <div>
            <span>{isLogin ? 'Log in' : 'Sign up'}</span>
            <h2 id="auth-modal-title">{isLogin ? 'Continue your week.' : 'Start with a free account.'}</h2>
          </div>
          <button aria-label="Close signup and login" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="auth-mode-switch" role="tablist" aria-label="Choose account action">
          <button
            aria-selected={!isLogin}
            className={!isLogin ? 'is-active' : undefined}
            onClick={() => onSwitchMode('signup')}
            role="tab"
            type="button"
          >
            Sign up
          </button>
          <button
            aria-selected={isLogin}
            className={isLogin ? 'is-active' : undefined}
            onClick={() => onSwitchMode('login')}
            role="tab"
            type="button"
          >
            Log in
          </button>
        </div>

        <form className="auth-form" onSubmit={submit} noValidate>
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              ref={emailInputRef}
              type="email"
              value={email}
            />
          </label>

          <label>
            <span>Password</span>
            <input
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              type="password"
              value={password}
            />
          </label>

          <p className="auth-error" role="alert" aria-live="polite">
            {error}
          </p>

          <button className="auth-submit-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'One moment...' : isLogin ? 'Log in' : 'Create account'}
          </button>
        </form>

        <p className="auth-demo-note">
          Demo only: this does not create a real account yet. The next step is connecting this screen to Supabase auth.
        </p>
      </div>
    </section>
  );
}
