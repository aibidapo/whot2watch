import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { HeaderActions } from '@/components/HeaderActions';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Whot2Watch',
  description: 'Find what to watch across all your services',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="mx-auto max-w-6xl px-4 py-6">
          <header className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="Whot2Watch" width={28} height={28} />
              <h1 className="text-2xl font-semibold brand-text">Whot2Watch</h1>
            </div>
            <nav className="flex gap-4 text-sm text-slate-500">
              <a href="/" className="hover:text-slate-800">
                Search
              </a>
              <a href="/picks" className="hover:text-slate-800">
                Picks
              </a>
              <a href="/lists" className="hover:text-slate-800">
                Lists
              </a>
              <a href="/subscriptions" className="hover:text-slate-800">
                Subscriptions
              </a>
            </nav>
            <Suspense fallback={null}>
              <HeaderActions />
            </Suspense>
          </header>
          <main>{children}</main>
          <footer className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-500">
            © {new Date().getFullYear()} Whot2Watch
            <span className="mx-2">•</span>
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/v1/docs`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-700"
            >
              API Docs
            </a>
          </footer>
        </div>
      </body>
    </html>
  );
}
