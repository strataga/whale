import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Evaluate escalation rules every 5 minutes
// NOTE: This requires workspaceId iteration — in production,
// you'd maintain an active workspace list or use a different approach.
// For now, this is a placeholder that shows the pattern.

// Check for stale bots every 10 minutes
crons.interval(
  "check stale bots",
  { minutes: 10 },
  (internal as any).functions.bots.checkStaleBots,
);

// Process scheduled tasks every minute
crons.interval(
  "process scheduled tasks",
  { minutes: 1 },
  (internal as any).functions.scheduler.processScheduled,
);

export default crons;
