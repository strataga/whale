import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export async function GET() {
  const ws = db.select().from(schema.workspaces).limit(1).get();

  const content = ws?.whaleMdContent ?? `# Welcome to Whale

This workspace has not configured a whale.md file yet.

Visit \`/dashboard/settings\` to set up your workspace onboarding document.
`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
