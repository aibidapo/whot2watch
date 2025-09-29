'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function HeaderActions() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
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
    </div>
  );
}
