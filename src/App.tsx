import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthPage, DashboardPage, LandingPage, LegalPage } from './components/ui/sensibite-site';
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

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const navigate = (nextPath: string) => {
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!authReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbfbf8] text-zinc-950">
        <div className="text-center">
          <p className="text-lg font-black tracking-tight">SensiBite AI</p>
          <p className="mt-2 text-sm font-bold text-zinc-500">Loading your session...</p>
        </div>
      </main>
    );
  }

  if (path === '/auth') {
    return <AuthPage navigate={navigate} startAtLogin={false} />;
  }

  if (path === '/login') {
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

  return <LandingPage navigate={navigate} />;
}
