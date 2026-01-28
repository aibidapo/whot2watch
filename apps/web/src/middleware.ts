import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

const protectedRoutes = ['/picks', '/lists', '/subscriptions', '/friends', '/social', '/onboarding'];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isProtected = protectedRoutes.some((p) => req.nextUrl.pathname.startsWith(p));
  const isAuthPage = req.nextUrl.pathname.startsWith('/login');

  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodeURIComponent(req.nextUrl.pathname)}`, req.url)
    );
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
