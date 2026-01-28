import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { PrismaClient } from '@prisma/client';
import { authConfig } from './auth.config';

const prisma = new PrismaClient();

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (user.id && account?.provider) {
        // Update authProvider field
        await prisma.user.update({
          where: { id: user.id },
          data: { authProvider: account.provider },
        });
        // Auto-create default profile if none exists
        const count = await prisma.profile.count({ where: { userId: user.id } });
        if (count === 0) {
          await prisma.profile.create({
            data: {
              userId: user.id,
              name: user.name || user.email?.split('@')[0] || 'Default',
              avatarUrl: user.image || undefined,
            },
          });
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
        const profiles = await prisma.profile.findMany({
          where: { userId: token.sub },
          select: { id: true, name: true, avatarUrl: true },
        });
        session.user.profiles = profiles;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
  },
});
