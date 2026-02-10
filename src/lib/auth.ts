import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";

import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users, workspaces } from "@/lib/db/schema";
import { loginSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Auto-provisions an OAuth user on first sign-in.
 * If no users exist yet, creates a workspace and assigns admin role.
 * Otherwise joins the existing workspace as a member.
 */
function provisionOAuthUser(profile: {
  email: string;
  name?: string | null;
  image?: string | null;
}): { id: string; email: string; name: string; role: string; workspaceId: string } {
  const existing = db
    .select({ id: users.id, workspaceId: users.workspaceId, role: users.role, name: users.name })
    .from(users)
    .where(eq(users.email, profile.email))
    .get();

  if (existing) {
    return {
      id: existing.id,
      email: profile.email,
      name: existing.name ?? profile.name ?? profile.email,
      role: existing.role,
      workspaceId: existing.workspaceId,
    };
  }

  // First-time OAuth user — auto-provision
  const firstUser = db
    .select({ id: users.id, workspaceId: users.workspaceId })
    .from(users)
    .limit(1)
    .get();

  let workspaceId: string;
  let role: "admin" | "member" = "member";

  if (!firstUser) {
    workspaceId = crypto.randomUUID();
    role = "admin";
    db.insert(workspaces)
      .values({ id: workspaceId, name: "My Workspace" })
      .run();
  } else {
    workspaceId = firstUser.workspaceId;
  }

  const userId = crypto.randomUUID();
  db.insert(users)
    .values({
      id: userId,
      workspaceId,
      email: profile.email,
      passwordHash: "", // OAuth users have no password
      name: profile.name ?? profile.email.split("@")[0] ?? "User",
      role,
    })
    .run();

  return { id: userId, email: profile.email, name: profile.name ?? "User", role, workspaceId };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // #12 Rate-limit login attempts per email
        const rl = rateLimit(`auth:login:${email}`, { limit: 10, windowMs: 60_000 });
        if (!rl.allowed) return null;

        const user = db
          .select({
            id: users.id,
            workspaceId: users.workspaceId,
            email: users.email,
            passwordHash: users.passwordHash,
            name: users.name,
            role: users.role,
          })
          .from(users)
          .where(eq(users.email, email))
          .get();

        if (!user) return null;

        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          workspaceId: user.workspaceId,
        };
      },
    }),
  ],
  callbacks: {
    signIn: async ({ user, account }) => {
      // OAuth sign-in: auto-provision user in DB if needed
      if (account?.provider === "google" || account?.provider === "github") {
        if (!user.email) return false;
        const provisioned = provisionOAuthUser({
          email: user.email,
          name: user.name,
          image: user.image,
        });
        // Attach DB fields to the user object for the jwt callback
        (user as typeof user & { role?: string }).role = provisioned.role;
        (user as typeof user & { workspaceId?: string }).workspaceId = provisioned.workspaceId;
        user.id = provisioned.id;
      }
      return true;
    },
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = (user as typeof user & { role?: string }).role;
        token.workspaceId = (user as typeof user & { workspaceId?: string })
          .workspaceId;
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.workspaceId = token.workspaceId as string;
      }

      return session;
    },
  },
});
