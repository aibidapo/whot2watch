'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function HeaderActions() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [q, setQ] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem('w2w-theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    const initial = searchParams.get('q') || '';
    setQ(initial);
  }, [searchParams]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('w2w-theme', theme);
    }
  }, [theme]);

  function submit() {
    const next = new URLSearchParams(Array.from(searchParams.entries()));
    if (q) next.set('q', q);
    else next.delete('q');
    router.push(`${pathname}?${next.toString()}`);
  }

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden md:flex items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search..."
          className="w-[260px]"
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
        <Button variant="secondary" onClick={submit}>
          Search
        </Button>
      </div>
      <Button variant="secondary" aria-label="Toggle theme" onClick={toggleTheme}>
        {theme === 'dark' ? '🌙' : '☀️'}
      </Button>
      {status === 'loading' ? null : session ? (
        <div className="flex items-center gap-2">
          {session.user.image && (
            <img
              src={session.user.image}
              alt={session.user.name || 'User'}
              className="w-8 h-8 rounded-full"
            />
          )}
          <Button variant="ghost" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      ) : (
        <Button variant="primary" onClick={() => signIn()}>
          Sign in
        </Button>
      )}
    </div>
  );
}
