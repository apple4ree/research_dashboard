import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db';
import type { PrismaClient } from '@/lib/generated/prisma/client';

export const { handlers, signIn, signOut, auth } = NextAuth({
  // PrismaAdapter expects the upstream @prisma/client shape; our generated
  // v7 client is structurally compatible at runtime but not at the type level,
  // hence the cast. All adapter calls go through Member/User/Account/Session/
  // VerificationToken tables which exist in the generated client.
  adapter: PrismaAdapter(prisma as unknown as PrismaClient),
  providers: [
    GitHub({
      // Explicit bindings — don't rely solely on NextAuth v5's AUTH_GITHUB_*
      // auto-pick. Read either naming convention for safety so either
      // .env.local style works.
      clientId: process.env.AUTH_GITHUB_ID ?? process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET ?? process.env.GITHUB_CLIENT_SECRET,
      // Link the GitHub account to an existing User row when the email matches.
      // We still gate access on the Member allowlist in the signIn callback.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  trustHost: true,
  session: { strategy: 'database' },
  callbacks: {
    async signIn({ user, profile, account }) {
      if (account?.provider !== 'github') return false;

      const githubLogin = (profile as { login?: string } | undefined)?.login ?? null;
      const email = user.email ?? null;

      if (!githubLogin && !email) return false;

      const orClauses: { githubLogin?: string; email?: string }[] = [];
      if (githubLogin) orClauses.push({ githubLogin });
      if (email) orClauses.push({ email });

      const member = await prisma.member.findFirst({
        where: { OR: orClauses },
      });

      // Not an allowlisted Member — forward to the error page.
      if (!member) return '/auth/error?error=AccessDenied';

      // Back-fill any missing Member identity fields from the GitHub profile.
      const updates: {
        email?: string;
        githubLogin?: string;
        avatarUrl?: string;
      } = {};
      if (!member.email && email) updates.email = email;
      if (!member.githubLogin && githubLogin) updates.githubLogin = githubLogin;
      if (!member.avatarUrl && user.image) updates.avatarUrl = user.image;
      if (Object.keys(updates).length > 0) {
        await prisma.member.update({
          where: { login: member.login },
          data: updates,
        });
      }

      // Link the NextAuth User row to our domain Member (one-time).
      if (user.id) {
        await prisma.user
          .update({
            where: { id: user.id },
            data: { memberLogin: member.login },
          })
          .catch(() => {});
      }

      return true;
    },
    async session({ session, user }) {
      const u = await prisma.user.findUnique({
        where: { id: user.id },
        select: { memberLogin: true, email: true, image: true },
      });
      let memberLogin = u?.memberLogin ?? null;

      // Lazy backfill: the signIn callback runs BEFORE the PrismaAdapter
      // creates the User row, so our prisma.user.update({ where: { id: user.id } })
      // inside signIn silently no-ops for a brand-new user. Repair on first
      // session read by matching by email (which signIn did backfill onto Member).
      if (!memberLogin && u?.email) {
        const member = await prisma.member.findFirst({
          where: { email: u.email },
        });
        if (member) {
          memberLogin = member.login;
          await prisma.user
            .update({ where: { id: user.id }, data: { memberLogin } })
            .catch(() => {});
          // Backfill avatar on Member if it was missing (defensive).
          if (u.image) {
            await prisma.member
              .update({
                where: { login: member.login },
                data: { avatarUrl: u.image },
              })
              .catch(() => {});
          }
        }
      }

      if (memberLogin) {
        (session as { memberLogin?: string }).memberLogin = memberLogin;
      }
      return session;
    },
  },
});
