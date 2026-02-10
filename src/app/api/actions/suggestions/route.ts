import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

const ACTION_CATALOG = [
  { id: "assign_bot", label: "Assign Bot to Task", keywords: "assign bot delegate" },
  { id: "change_status", label: "Change Task Status", keywords: "status update move progress done" },
  { id: "create_project", label: "Create New Project", keywords: "create new project add" },
  { id: "create_task", label: "Create New Task", keywords: "create new task add todo" },
  { id: "create_milestone", label: "Create Milestone", keywords: "milestone create add" },
  { id: "invite_user", label: "Invite Team Member", keywords: "invite user team member add" },
  { id: "run_ai_plan", label: "Generate AI Plan", keywords: "ai plan generate decompose" },
  { id: "view_reports", label: "View Reports", keywords: "reports analytics dashboard" },
  { id: "manage_bots", label: "Manage Bots", keywords: "bots fleet manage configure" },
  { id: "export_data", label: "Export Data", keywords: "export csv json download" },
  { id: "search", label: "Search Everything", keywords: "search find lookup" },
  { id: "settings", label: "Open Settings", keywords: "settings preferences configure" },
  { id: "create_sprint", label: "Create Sprint", keywords: "sprint create plan iteration" },
  { id: "bulk_update", label: "Bulk Update Tasks", keywords: "bulk update batch tasks" },
  { id: "create_template", label: "Create Template", keywords: "template create reusable" },
  { id: "view_calendar", label: "View Calendar", keywords: "calendar schedule timeline" },
];

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").toLowerCase().trim();

  if (!q) {
    return NextResponse.json({ actions: ACTION_CATALOG.map(({ id, label }) => ({ id, label })) });
  }

  const matches = ACTION_CATALOG.filter(
    (action) =>
      action.label.toLowerCase().includes(q) ||
      action.keywords.toLowerCase().includes(q),
  ).map(({ id, label }) => ({ id, label }));

  return NextResponse.json({ actions: matches });
}
