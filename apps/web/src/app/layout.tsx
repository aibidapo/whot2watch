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
  title: {
    default: 'Whot2Watch',
    template: '%s | Whot2Watch',
  },
  description: 'Find what to watch across all your streaming services',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    type: 'website',
    siteName: 'Whot2Watch',
    title: 'Whot2Watch',
    description: 'Find what to watch across all your streaming services',
  },
  twitter: {
    card: 'summary',
    title: 'Whot2Watch',
    description: 'Find what to watch across all your streaming services',
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
        {/* Skip to content */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-lg focus:outline focus:outline-2 focus:outline-brand-cyan"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-40 glass">
          <div className="mx-auto max-w-6xl px-4 flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="Whot2Watch" width={28} height={28} />
              <span className="text-xl font-semibold brand-text">Whot2Watch</span>
            </div>
            <nav aria-label="Main navigation" className="flex gap-1 text-sm">
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
              <a href="/friends" className="px-3 py-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors duration-200">
                Friends
              </a>
              <a href="/social" className="px-3 py-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors duration-200">
                Social
              </a>
            </nav>
            <Suspense fallback={null}>
              <HeaderActions />
            </Suspense>
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-4 py-6">
          <main id="main-content">{children}</main>
          <footer className="mt-10 border-t border-border pt-6 text-xs text-muted">
            &copy; {new Date().getFullYear()} Whot2Watch
            <span className="mx-2">&bull;</span>
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Whot2Watch',
              url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
              description: 'Find what to watch across all your streaming services',
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/?q={search_term_string}`,
                },
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
      </body>
    </html>
  );
}
