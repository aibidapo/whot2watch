import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Daily Picks',
};

export default function PicksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
