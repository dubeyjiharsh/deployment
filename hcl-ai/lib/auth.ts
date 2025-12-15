import NextAuth, { User as NextAuthUser, Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { userRepository } from "@/services/database/user-repository";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      teamId: string | null;
      mustChangePassword: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    teamId: string | null;
    mustChangePassword: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<NextAuthUser | null> {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await userRepository.getUserByEmail(credentials.email as string);

        if (!user) {
          return null;
        }

        const isValidPassword = userRepository.verifyPassword(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValidPassword) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          teamId: user.teamId,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user.role || "").toLowerCase();
        token.teamId = user.teamId;
        token.mustChangePassword = user.mustChangePassword;
      }

      // SECURITY: Check if sessions should be invalidated (e.g., after password change)
      if (token.id) {
        const dbUser = await userRepository.getUserById(token.id as string);

        if (dbUser && dbUser.sessionsInvalidBefore && token.iat) {
          const sessionsInvalidBefore = new Date(dbUser.sessionsInvalidBefore).getTime();
          const tokenIssuedAt = token.iat * 1000; // JWT iat is in seconds

          // If token was issued before the invalidation timestamp, reject it
          if (tokenIssuedAt < sessionsInvalidBefore) {
            console.log(`[Security] Token invalidated for user ${token.id} - issued before password change`);
            return {}; // Return empty token to invalidate session
          }

          // If token is valid and issued after invalidation, clear the invalidation flag
          // This allows future logins without constant DB checks
          console.log(`[Security] Valid token after password change - clearing invalidation flag for user ${token.id}`);
          await userRepository.clearSessionInvalidation(token.id as string);
        }

        // Update must_change_password flag from DB in case it changed
        if (dbUser) {
          token.mustChangePassword = dbUser.mustChangePassword;
        }
      }

      return token;
    },
    async session({ session, token }): Promise<Session> {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string | undefined)?.toLowerCase() || "user";
        session.user.teamId = token.teamId as string | null;
        session.user.mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
    maxAge: 2 * 60 * 60, // 2 hours (reduced from 8 hours for security)
  },
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax", // CSRF protection
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
});
