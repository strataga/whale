import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export type UserRole = "admin" | "member" | "viewer";
export type ProjectStatus = "draft" | "active" | "completed" | "archived";
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type Workspace = InferSelectModel<
  (typeof import("@/lib/db/schema"))["workspaces"]
>;
export type NewWorkspace = InferInsertModel<
  (typeof import("@/lib/db/schema"))["workspaces"]
>;

export type User = InferSelectModel<(typeof import("@/lib/db/schema"))["users"]>;
export type NewUser = InferInsertModel<
  (typeof import("@/lib/db/schema"))["users"]
>;

export type Project = InferSelectModel<
  (typeof import("@/lib/db/schema"))["projects"]
>;
export type NewProject = InferInsertModel<
  (typeof import("@/lib/db/schema"))["projects"]
>;

export type Milestone = InferSelectModel<
  (typeof import("@/lib/db/schema"))["milestones"]
>;
export type NewMilestone = InferInsertModel<
  (typeof import("@/lib/db/schema"))["milestones"]
>;

export type Task = InferSelectModel<(typeof import("@/lib/db/schema"))["tasks"]>;
export type NewTask = InferInsertModel<
  (typeof import("@/lib/db/schema"))["tasks"]
>;

export type AuditLog = InferSelectModel<
  (typeof import("@/lib/db/schema"))["auditLogs"]
>;
export type NewAuditLog = InferInsertModel<
  (typeof import("@/lib/db/schema"))["auditLogs"]
>;

