import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyOtpCode } from "@/lib/email-otp";

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
      authorization: {
        params: {
          hd: "g.skku.edu",
        },
      },
    }),
    Credentials({
      id: "email-otp",
      name: "Email OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toString().trim().toLowerCase();
        const code = credentials?.code?.toString().trim();
        if (!email || !code || !isSchoolEmail(email)) return null;

        const valid = await verifyOtpCode(email, code);
        if (!valid) return null;

        const user = await prisma.user.upsert({
          where: { email },
          update: { authMethod: "EMAIL_OTP" },
          create: {
            email,
            authMethod: "EMAIL_OTP",
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
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

        await prisma.user.upsert({
          where: { email },
          update: { authMethod: "GOOGLE_SKKU", name: user.name ?? undefined },
          create: {
            email,
            name: user.name ?? null,
            authMethod: "GOOGLE_SKKU",
          },
        });
      }

      if (account?.provider === "email-otp") {
        if (!user.email || !isSchoolEmail(user.email.toLowerCase())) return false;
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
