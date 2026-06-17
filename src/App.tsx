import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Auth } from './components/Auth';
import { Entries } from './components/Entries';
import { supabase } from './lib/supabase';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-raycast-bg px-6 text-white">
        <p className="text-sm text-white/60">Загрузка...</p>
      </main>
    );
  }

  const userEmail = session?.user.email ?? 'user';

  return (
    <main className="flex min-h-screen items-center justify-center bg-raycast-bg px-6 py-10 text-white">
      <div className="w-full max-w-xl">
        <header className="mb-5 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-normal">Vibes App</h1>
          {session && (
            <button className="ghost mt-0" type="button" onClick={signOut}>
              Выйти
            </button>
          )}
        </header>

        {session ? <Entries userEmail={userEmail} /> : <Auth />}
      </div>
    </main>
  );
}
