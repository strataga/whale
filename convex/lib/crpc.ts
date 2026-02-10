import { initCRPC, CRPCError } from "better-convex/server";
import {
  query,
  mutation,
  action,
  httpAction,
  internalQuery,
  internalMutation,
  internalAction,
} from "../_generated/server";
import type { DataModel } from "../_generated/dataModel";

type Meta = {
  auth?: "optional" | "required";
  role?: "admin";
};

const c = initCRPC.dataModel<DataModel>().create({
  query,
  mutation,
  action,
  httpAction,
  internalQuery,
  internalMutation,
  internalAction,
});

// ── Auth middleware ──
// Validates session and injects user + workspaceId into context

const authMiddleware = c.middleware<{
  user: { _id: string; email: string; name?: string; role: string; workspaceId: string };
  workspaceId: string;
}>(async ({ ctx, meta, next }) => {
  if (meta.auth === "optional") {
    // Allow unauthenticated access but still try to get user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return next({ ctx: { ...ctx, user: undefined, workspaceId: undefined } as any });
    }
  }

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new CRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  // Look up the user in our users table by their auth subject (email)
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", identity.email!))
    .first();

  if (!user) {
    throw new CRPCError({
      code: "UNAUTHORIZED",
      message: "User not found in workspace",
    });
  }

  return next({
    ctx: {
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        workspaceId: user.workspaceId,
      },
      workspaceId: user.workspaceId,
    },
  });
});

// ── Role middleware ──
// Checks admin role from meta after auth middleware

const roleMiddleware = c.middleware<object>(({ ctx, meta, next }) => {
  const user = (ctx as { user?: { role?: string | null } }).user;
  if ((meta as Meta).role === "admin" && user?.role !== "admin") {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});

// ── Public procedures (no auth required) ──

export const publicQuery = c.query;
export const publicMutation = c.mutation;
export const publicAction = c.action;

// ── Internal procedures (server-to-server only) ──

export const privateQuery = c.query.internal();
export const privateMutation = c.mutation.internal();
export const privateAction = c.action.internal();

// ── Authenticated procedures ──

export const authQuery = c.query
  .meta({ auth: "required" } satisfies Meta)
  .use(authMiddleware)
  .use(roleMiddleware);

export const authMutation = c.mutation
  .meta({ auth: "required" } satisfies Meta)
  .use(authMiddleware)
  .use(roleMiddleware);

export const authAction = c.action
  .meta({ auth: "required" } satisfies Meta)
  .use(authMiddleware)
  .use(roleMiddleware);

// ── Admin procedures ──

export const adminQuery = c.query
  .meta({ auth: "required", role: "admin" } satisfies Meta)
  .use(authMiddleware)
  .use(roleMiddleware);

export const adminMutation = c.mutation
  .meta({ auth: "required", role: "admin" } satisfies Meta)
  .use(authMiddleware)
  .use(roleMiddleware);

// ── HTTP route builder ──

export const publicRoute = c.httpAction;
export const router = c.router;

// Re-export for convenience
export { CRPCError };
