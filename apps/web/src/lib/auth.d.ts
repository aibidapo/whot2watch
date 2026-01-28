import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      profiles: { id: string; name: string; avatarUrl?: string | null }[];
    };
  }
}
