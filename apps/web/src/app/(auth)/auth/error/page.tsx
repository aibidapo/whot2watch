import { Card } from '@/components/ui/Card';
import Link from 'next/link';

type SearchParams = Promise<{ error?: string }>;

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <h1 className="text-3xl font-bold">Authentication Error</h1>
      <Card className="p-6">
        <p className="text-error-text">{params.error || 'An error occurred during sign in.'}</p>
        <Link href="/login" className="text-brand-cyan hover:underline mt-4 block">
          Try again
        </Link>
      </Card>
    </div>
  );
}
