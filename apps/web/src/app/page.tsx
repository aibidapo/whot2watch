'use client';
import { Suspense } from 'react';
import { HomePage } from '@/components/home/HomePage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <HomePage />
    </Suspense>
  );
}
