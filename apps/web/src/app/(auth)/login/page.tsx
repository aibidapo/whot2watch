import { auth, signIn } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect('/');

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <h1 className="text-3xl font-bold">Sign in to Whot2Watch</h1>
      <p className="text-muted">Connect your account to get personalized picks</p>
      <Card className="p-6 w-full max-w-sm">
        <form
          action={async () => {
            'use server';
            await signIn('google');
          }}
          className="mb-3"
        >
          <Button type="submit" className="w-full">
            Continue with Google
          </Button>
        </form>
        {process.env.GITHUB_CLIENT_ID && (
          <form
            action={async () => {
              'use server';
              await signIn('github');
            }}
          >
            <Button type="submit" variant="secondary" className="w-full">
              Continue with GitHub
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
