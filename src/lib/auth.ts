import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const SCHOOL_EMAIL_DOMAINS = new Set(["skku.edu", "g.skku.edu"]);

function isSchoolEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  return Boolean(domain && SCHOOL_EMAIL_DOMAINS.has(domain));
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          hd: "g.skku.edu",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider === "google") {
        const email = user.email?.toLowerCase();
        if (!email || !isSchoolEmail(email)) return false;

        const idToken = account.id_token;
        if (!idToken) return false;

        const payload = decodeJwtPayload(idToken);
        if (!payload) return false;

        const hd = payload.hd;
        if (hd !== "g.skku.edu") return false;

        const profileEmail = typeof profile?.email === "string" ? profile.email.toLowerCase() : "";
        if (profileEmail && !isSchoolEmail(profileEmail)) return false;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email;
      }
      return session;
    },
    async redirect({ baseUrl, url }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      return url;
    },
  },
  pages: {
    signIn: "/login",
  },
});

export type SessionUser = typeof auth extends (...args: never[]) => Promise<infer T>
  ? T extends { user?: infer U }
    ? U
    : never
  : never;
