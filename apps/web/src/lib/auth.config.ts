import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';

/**
 * Edge-compatible auth configuration (no Prisma adapter).
 * Used by middleware for route protection.
 */
export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    ...(process.env.GITHUB_CLIENT_ID
      ? [
          GitHub({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const protectedRoutes = ['/picks', '/lists', '/subscriptions', '/friends', '/social', '/onboarding'];
      const isProtected = protectedRoutes.some((p) => nextUrl.pathname.startsWith(p));
      const isAuthPage = nextUrl.pathname.startsWith('/login');

      if (isAuthPage && isLoggedIn) {
        return Response.redirect(new URL('/', nextUrl));
      }
      if (isProtected && !isLoggedIn) {
        return false; // Redirect to signIn page
      }
      return true;
    },
  },
};
