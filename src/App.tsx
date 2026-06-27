import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AboutPage, AuthPage, DashboardPage, LandingPage, LegalPage } from './components/ui/digestisnap-site';
import { supabase } from './lib/supabase';

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (nextPath: string, options: { replace?: boolean } = {}) => {
    if (options.replace) {
      window.history.replaceState({}, '', nextPath);
    } else {
      window.history.pushState({}, '', nextPath);
    }

    setPath(nextPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthReady(true);

      if (data.session && (window.location.hash.includes('access_token') || window.location.hash.includes('refresh_token'))) {
        navigate('/dashboard', { replace: true });
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);

      if (nextSession && (window.location.hash.includes('access_token') || window.location.hash.includes('refresh_token'))) {
        navigate('/dashboard', { replace: true });
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;

    if (session && (path === '/auth' || path === '/login' || path === '/start')) {
      navigate('/dashboard', { replace: true });
      return;
    }

    if (!session && path === '/dashboard') {
      navigate('/login', { replace: true });
    }
  }, [authReady, path, session]);

  if (!authReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-zinc-950">
        <div className="text-center">
          <p className="text-lg font-black">DigestSnap</p>
          <p className="mt-2 text-sm font-bold text-zinc-500">Loading your session</p>
        </div>
      </main>
    );
  }

  if (path === '/auth' || path === '/start') {
    if (session) {
      return <DashboardPage navigate={navigate} session={session} />;
    }

    return <AuthPage navigate={navigate} startAtLogin={false} />;
  }

  if (path === '/login') {
    if (session) {
      return <DashboardPage navigate={navigate} session={session} />;
    }

    return <AuthPage navigate={navigate} startAtLogin />;
  }

  if (path === '/dashboard') {
    if (!session) {
      return <AuthPage navigate={navigate} startAtLogin />;
    }

    return <DashboardPage navigate={navigate} session={session} />;
  }

  if (path === '/privacy') {
    return <LegalPage kind="privacy" navigate={navigate} />;
  }

  if (path === '/terms') {
    return <LegalPage kind="terms" navigate={navigate} />;
  }

  if (path === '/manage-subscription') {
    return <LegalPage kind="subscription" navigate={navigate} />;
  }

  if (path === '/contact') {
    return <LegalPage kind="contact" navigate={navigate} />;
  }

  if (path === '/support') {
    return <LegalPage kind="support" navigate={navigate} />;
  }

  if (path === '/about') {
    return <AboutPage navigate={navigate} />;
  }

  return <LandingPage navigate={navigate} />;
}
