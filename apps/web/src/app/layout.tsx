import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { HeaderActions } from '@/components/HeaderActions';
import { ChatFab } from '@/components/chat/ChatFab';

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
        <header className="sticky top-0 z-40 glass">
          <div className="mx-auto max-w-6xl px-4 flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="Whot2Watch" width={28} height={28} />
              <h1 className="text-xl font-semibold brand-text">Whot2Watch</h1>
            </div>
            <nav className="flex gap-1 text-sm">
              <a href="/" className="px-3 py-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors duration-200">
                Search
              </a>
              <a href="/picks" className="px-3 py-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors duration-200">
                Picks
              </a>
              <a href="/lists" className="px-3 py-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors duration-200">
                Lists
              </a>
              <a href="/subscriptions" className="px-3 py-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors duration-200">
                Subscriptions
              </a>
            </nav>
            <Suspense fallback={null}>
              <HeaderActions />
            </Suspense>
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-4 py-6">
          <main>{children}</main>
          <footer className="mt-10 border-t border-border pt-6 text-xs text-muted">
            © {new Date().getFullYear()} Whot2Watch
            <span className="mx-2">•</span>
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/v1/docs`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
            >
              API Docs
            </a>
          </footer>
        </div>
        <Suspense fallback={null}>
          <ChatFab />
        </Suspense>
      </body>
    </html>
  );
}
