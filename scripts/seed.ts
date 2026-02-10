/**
 * Seed script for Whale demo data.
 * Populates the database with realistic demo data for development and demos.
 *
 * Usage: node --experimental-strip-types scripts/seed.ts
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import * as schema from "../src/lib/db/schema";

const databasePath = process.env.DATABASE_URL ?? "./whale.db";
const sqlite = new Database(databasePath);
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

// ── Helpers ──

const now = Date.now();
const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Returns a timestamp N days ago from now */
function daysAgo(n: number): number {
  return now - n * DAY;
}

/** Returns a timestamp N days from now */
function daysFromNow(n: number): number {
  return now + n * DAY;
}

async function seed() {
  console.log("Checking for existing data...");

  const existingWorkspace = sqlite
    .prepare("SELECT id FROM workspaces WHERE name = ?")
    .get("Acme Corp");

  if (existingWorkspace) {
    console.log('Workspace "Acme Corp" already exists. Skipping seed.');
    sqlite.close();
    return;
  }

  // Push schema to ensure all columns exist before seeding.
  // If you haven't run `pnpm db:push` recently, do so first.

  console.log("Seeding database...");

  // ── 1. Workspace ──
  console.log("  Creating workspace...");
  const workspaceId = crypto.randomUUID();
  db.insert(schema.workspaces)
    .values({
      id: workspaceId,
      name: "Acme Corp",
      timezone: "America/New_York",
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30),
    })
    .run();

  // ── 2. Users ──
  console.log("  Creating users...");
  const passwordHash = await hash("Password123!", 10);

  const adminId = crypto.randomUUID();
  const aliceId = crypto.randomUUID();
  const bobId = crypto.randomUUID();

  db.insert(schema.users)
    .values({
      id: adminId,
      workspaceId,
      email: "admin@acme.com",
      passwordHash,
      name: "Admin User",
      role: "admin",
      lastActiveAt: daysAgo(0),
      createdAt: daysAgo(30),
      updatedAt: daysAgo(0),
    })
    .run();

  db.insert(schema.users)
    .values({
      id: aliceId,
      workspaceId,
      email: "alice@acme.com",
      passwordHash,
      name: "Alice Developer",
      role: "member",
      lastActiveAt: daysAgo(0),
      createdAt: daysAgo(28),
      updatedAt: daysAgo(0),
    })
    .run();

  db.insert(schema.users)
    .values({
      id: bobId,
      workspaceId,
      email: "bob@acme.com",
      passwordHash,
      name: "Bob Designer",
      role: "member",
      lastActiveAt: daysAgo(1),
      createdAt: daysAgo(28),
      updatedAt: daysAgo(1),
    })
    .run();

  // ── 3. Projects ──
  console.log("  Creating projects...");

  // Project 1: Website Redesign (active)
  const proj1Id = crypto.randomUUID();
  db.insert(schema.projects)
    .values({
      id: proj1Id,
      workspaceId,
      name: "Website Redesign",
      description:
        "Complete overhaul of the company website with modern design, improved UX, and mobile-first approach.",
      status: "active",
      createdAt: daysAgo(14),
      updatedAt: daysAgo(1),
    })
    .run();

  // Project 2: Mobile App (active)
  const proj2Id = crypto.randomUUID();
  db.insert(schema.projects)
    .values({
      id: proj2Id,
      workspaceId,
      name: "Mobile App",
      description:
        "Native mobile application for iOS and Android with push notifications and offline support.",
      status: "active",
      createdAt: daysAgo(10),
      updatedAt: daysAgo(2),
    })
    .run();

  // Project 3: API Documentation (draft)
  const proj3Id = crypto.randomUUID();
  db.insert(schema.projects)
    .values({
      id: proj3Id,
      workspaceId,
      name: "API Documentation",
      description:
        "Comprehensive API documentation with examples, tutorials, and SDK guides.",
      status: "draft",
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    })
    .run();

  // ── 4. Milestones ──
  console.log("  Creating milestones...");

  // Website Redesign milestones
  const ms1Id = crypto.randomUUID();
  db.insert(schema.milestones)
    .values({
      id: ms1Id,
      projectId: proj1Id,
      name: "Design Phase",
      dueDate: daysFromNow(7),
      position: 0,
      createdAt: daysAgo(14),
      updatedAt: daysAgo(14),
    })
    .run();

  const ms2Id = crypto.randomUUID();
  db.insert(schema.milestones)
    .values({
      id: ms2Id,
      projectId: proj1Id,
      name: "Development Phase",
      dueDate: daysFromNow(21),
      position: 1,
      createdAt: daysAgo(14),
      updatedAt: daysAgo(14),
    })
    .run();

  // Mobile App milestone
  const ms3Id = crypto.randomUUID();
  db.insert(schema.milestones)
    .values({
      id: ms3Id,
      projectId: proj2Id,
      name: "MVP Release",
      dueDate: daysFromNow(30),
      position: 0,
      createdAt: daysAgo(10),
      updatedAt: daysAgo(10),
    })
    .run();

  // ── 5. Tasks ──
  console.log("  Creating tasks...");

  // Website Redesign tasks (6 total)
  const task1Id = crypto.randomUUID();
  db.insert(schema.tasks)
    .values({
      id: task1Id,
      projectId: proj1Id,
      milestoneId: ms1Id,
      title: "Create wireframes for homepage",
      description:
        "Design low-fidelity wireframes for the new homepage layout including hero section, features grid, and testimonials.",
      status: "done",
      priority: "high",
      assigneeId: bobId,
      dueDate: daysAgo(3),
      tags: JSON.stringify(["design", "wireframes"]),
      position: 0,
      sortOrder: 0,
      estimatedMinutes: 240,
      createdAt: daysAgo(13),
      updatedAt: daysAgo(4),
    })
    .run();

  const task2Id = crypto.randomUUID();
  db.insert(schema.tasks)
    .values({
      id: task2Id,
      projectId: proj1Id,
      milestoneId: ms1Id,
      title: "Design color palette and typography system",
      description:
        "Define the brand color palette, typography scale, and spacing system for the new design.",
      status: "done",
      priority: "high",
      assigneeId: bobId,
      dueDate: daysAgo(5),
      tags: JSON.stringify(["design", "branding"]),
      position: 1,
      sortOrder: 1,
      estimatedMinutes: 120,
      createdAt: daysAgo(12),
      updatedAt: daysAgo(6),
    })
    .run();

  const task3Id = crypto.randomUUID();
  db.insert(schema.tasks)
    .values({
      id: task3Id,
      projectId: proj1Id,
      milestoneId: ms1Id,
      title: "Design responsive navigation component",
      description:
        "Create a responsive navigation bar with mobile hamburger menu, dropdowns, and search integration.",
      status: "in_progress",
      priority: "medium",
      assigneeId: bobId,
      dueDate: daysFromNow(3),
      tags: JSON.stringify(["design", "components"]),
      position: 2,
      sortOrder: 2,
      estimatedMinutes: 180,
      createdAt: daysAgo(10),
      updatedAt: daysAgo(1),
    })
    .run();

  const task4Id = crypto.randomUUID();
  db.insert(schema.tasks)
    .values({
      id: task4Id,
      projectId: proj1Id,
      milestoneId: ms2Id,
      title: "Implement homepage with Next.js",
      description:
        "Build the homepage using Next.js App Router with server components, implementing the approved wireframes.",
      status: "todo",
      priority: "high",
      assigneeId: aliceId,
      dueDate: daysFromNow(10),
      tags: JSON.stringify(["frontend", "nextjs"]),
      position: 0,
      sortOrder: 0,
      estimatedMinutes: 480,
      createdAt: daysAgo(7),
      updatedAt: daysAgo(7),
    })
    .run();

  const task5Id = crypto.randomUUID();
  db.insert(schema.tasks)
    .values({
      id: task5Id,
      projectId: proj1Id,
      milestoneId: ms2Id,
      title: "Set up CI/CD pipeline",
      description:
        "Configure GitHub Actions for automated testing, linting, and deployment to staging environment.",
      status: "todo",
      priority: "medium",
      assigneeId: aliceId,
      dueDate: daysFromNow(14),
      tags: JSON.stringify(["devops", "ci-cd"]),
      position: 1,
      sortOrder: 1,
      estimatedMinutes: 120,
      createdAt: daysAgo(7),
      updatedAt: daysAgo(7),
    })
    .run();

  const task6Id = crypto.randomUUID();
  db.insert(schema.tasks)
    .values({
      id: task6Id,
      projectId: proj1Id,
      milestoneId: ms2Id,
      title: "Write end-to-end tests for critical flows",
      description:
        "Create Playwright E2E tests for signup, login, navigation, and key user journeys.",
      status: "todo",
      priority: "low",
      assigneeId: null,
      dueDate: daysFromNow(18),
      tags: JSON.stringify(["testing", "e2e"]),
      position: 2,
      sortOrder: 2,
      estimatedMinutes: 360,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    })
    .run();

  // Mobile App tasks (4 total)
  const task7Id = crypto.randomUUID();
  db.insert(schema.tasks)
    .values({
      id: task7Id,
      projectId: proj2Id,
      milestoneId: ms3Id,
      title: "Set up React Native project scaffold",
      description:
        "Initialize React Native project with TypeScript, navigation, and state management boilerplate.",
      status: "done",
      priority: "urgent",
      assigneeId: aliceId,
      dueDate: daysAgo(2),
      tags: JSON.stringify(["mobile", "setup"]),
      position: 0,
      sortOrder: 0,
      estimatedMinutes: 180,
      createdAt: daysAgo(9),
      updatedAt: daysAgo(3),
    })
    .run();

  const task8Id = crypto.randomUUID();
  db.insert(schema.tasks)
    .values({
      id: task8Id,
      projectId: proj2Id,
      milestoneId: ms3Id,
      title: "Implement authentication screens",
      description:
        "Build login, registration, and password reset screens with form validation and biometric auth support.",
      status: "in_progress",
      priority: "high",
      assigneeId: aliceId,
      dueDate: daysFromNow(5),
      tags: JSON.stringify(["mobile", "auth"]),
      position: 1,
      sortOrder: 1,
      estimatedMinutes: 360,
      createdAt: daysAgo(7),
      updatedAt: daysAgo(1),
    })
    .run();

  const task9Id = crypto.randomUUID();
  db.insert(schema.tasks)
    .values({
      id: task9Id,
      projectId: proj2Id,
      milestoneId: ms3Id,
      title: "Design app icon and splash screen",
      description:
        "Create app icon in all required sizes and an animated splash screen for iOS and Android.",
      status: "todo",
      priority: "medium",
      assigneeId: bobId,
      dueDate: daysFromNow(12),
      tags: JSON.stringify(["mobile", "design"]),
      position: 2,
      sortOrder: 2,
      estimatedMinutes: 120,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    })
    .run();

  const task10Id = crypto.randomUUID();
  db.insert(schema.tasks)
    .values({
      id: task10Id,
      projectId: proj2Id,
      milestoneId: ms3Id,
      title: "Set up push notification service",
      description:
        "Integrate Firebase Cloud Messaging for push notifications on both iOS and Android platforms.",
      status: "todo",
      priority: "low",
      assigneeId: null,
      dueDate: daysFromNow(20),
      tags: JSON.stringify(["mobile", "notifications"]),
      position: 3,
      sortOrder: 3,
      estimatedMinutes: 240,
      createdAt: daysAgo(4),
      updatedAt: daysAgo(4),
    })
    .run();

  // API Documentation tasks (3 total, no milestone)
  const task11Id = crypto.randomUUID();
  db.insert(schema.tasks)
    .values({
      id: task11Id,
      projectId: proj3Id,
      milestoneId: null,
      title: "Write REST API endpoint reference",
      description:
        "Document all REST API endpoints with request/response examples, authentication, and error codes.",
      status: "todo",
      priority: "high",
      assigneeId: aliceId,
      dueDate: daysFromNow(15),
      tags: JSON.stringify(["docs", "api"]),
      position: 0,
      sortOrder: 0,
      estimatedMinutes: 480,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    })
    .run();

  const task12Id = crypto.randomUUID();
  db.insert(schema.tasks)
    .values({
      id: task12Id,
      projectId: proj3Id,
      milestoneId: null,
      title: "Create getting started tutorial",
      description:
        "Write a step-by-step tutorial for new developers covering authentication, first API call, and webhooks.",
      status: "todo",
      priority: "medium",
      assigneeId: null,
      dueDate: daysFromNow(20),
      tags: JSON.stringify(["docs", "tutorial"]),
      position: 1,
      sortOrder: 1,
      estimatedMinutes: 240,
      createdAt: daysAgo(4),
      updatedAt: daysAgo(4),
    })
    .run();

  const task13Id = crypto.randomUUID();
  db.insert(schema.tasks)
    .values({
      id: task13Id,
      projectId: proj3Id,
      milestoneId: null,
      title: "Generate SDK code samples",
      description:
        "Create code samples in Python, JavaScript, and Go for the most common API operations.",
      status: "todo",
      priority: "low",
      assigneeId: null,
      dueDate: daysFromNow(25),
      tags: JSON.stringify(["docs", "sdk"]),
      position: 2,
      sortOrder: 2,
      estimatedMinutes: 360,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    })
    .run();

  // ── 6. Bots ──
  console.log("  Creating bots...");

  const codeBotId = crypto.randomUUID();
  db.insert(schema.bots)
    .values({
      id: codeBotId,
      workspaceId,
      name: "CodeBot",
      host: "localhost:9100",
      deviceId: "codebot-dev-001",
      status: "idle",
      capabilities: JSON.stringify(["code", "test"]),
      lastSeenAt: now - 2 * 60_000, // 2 minutes ago
      tokenPrefix: "whk_codebot",
      tokenHash: crypto.randomUUID(), // placeholder hash
      maxConcurrentTasks: 2,
      environment: "dev",
      labels: JSON.stringify(["backend", "testing"]),
      version: "1.2.0",
      onboardedAt: daysAgo(14),
      createdAt: daysAgo(14),
      updatedAt: now - 2 * 60_000,
    })
    .run();

  const docBotId = crypto.randomUUID();
  db.insert(schema.bots)
    .values({
      id: docBotId,
      workspaceId,
      name: "DocBot",
      host: "localhost:9200",
      deviceId: "docbot-dev-001",
      status: "working",
      capabilities: JSON.stringify(["docs", "review"]),
      lastSeenAt: now - 30_000, // 30 seconds ago
      tokenPrefix: "whk_docbot",
      tokenHash: crypto.randomUUID(), // placeholder hash
      maxConcurrentTasks: 1,
      environment: "dev",
      labels: JSON.stringify(["documentation", "review"]),
      version: "1.0.3",
      onboardedAt: daysAgo(10),
      createdAt: daysAgo(10),
      updatedAt: now - 30_000,
    })
    .run();

  // ── 7. Bot Tasks ──
  console.log("  Creating bot tasks...");

  // Completed bot task: CodeBot finished writing tests
  const botTask1Id = crypto.randomUUID();
  db.insert(schema.botTasks)
    .values({
      id: botTask1Id,
      botId: codeBotId,
      taskId: task1Id,
      status: "completed",
      outputSummary:
        "Generated wireframe component structure with 12 React components and associated Storybook stories.",
      artifactLinks: JSON.stringify([
        "https://github.com/acme/website/pull/42",
      ]),
      retryCount: 0,
      maxRetries: 2,
      confidenceScore: 92,
      confidenceReason: "High confidence based on clear requirements and existing design system.",
      startedAt: daysAgo(5),
      completedAt: daysAgo(4),
      createdAt: daysAgo(5),
      updatedAt: daysAgo(4),
    })
    .run();

  // Running bot task: DocBot is working on docs review
  const botTask2Id = crypto.randomUUID();
  db.insert(schema.botTasks)
    .values({
      id: botTask2Id,
      botId: docBotId,
      taskId: task11Id,
      status: "running",
      outputSummary: "",
      artifactLinks: JSON.stringify([]),
      retryCount: 0,
      maxRetries: 1,
      confidenceScore: 78,
      confidenceReason: "Moderate confidence; large endpoint surface area requires careful documentation.",
      startedAt: now - 45 * 60_000, // 45 minutes ago
      createdAt: now - HOUR,
      updatedAt: now - 45 * 60_000,
    })
    .run();

  // Update DocBot to reference current task
  db.update(schema.bots)
    .set({ currentBotTaskId: botTask2Id })
    .where(eq(schema.bots.id, docBotId))
    .run();

  // Pending bot task: CodeBot queued for CI/CD
  const botTask3Id = crypto.randomUUID();
  db.insert(schema.botTasks)
    .values({
      id: botTask3Id,
      botId: codeBotId,
      taskId: task5Id,
      status: "pending",
      queuePosition: 1,
      outputSummary: "",
      artifactLinks: JSON.stringify([]),
      retryCount: 0,
      maxRetries: 3,
      timeoutMinutes: 60,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    })
    .run();

  // Failed bot task: CodeBot tried homepage implementation but hit issues
  const botTask4Id = crypto.randomUUID();
  db.insert(schema.botTasks)
    .values({
      id: botTask4Id,
      botId: codeBotId,
      taskId: task4Id,
      status: "failed",
      outputSummary:
        "Failed to generate homepage: missing design tokens. Requires color palette and typography system to be finalized first.",
      artifactLinks: JSON.stringify([]),
      retryCount: 2,
      maxRetries: 2,
      confidenceScore: 35,
      confidenceReason: "Low confidence due to missing design dependencies.",
      startedAt: daysAgo(3),
      completedAt: daysAgo(3) + 15 * 60_000,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3) + 15 * 60_000,
    })
    .run();

  // Completed bot task: CodeBot set up the mobile project
  const botTask5Id = crypto.randomUUID();
  db.insert(schema.botTasks)
    .values({
      id: botTask5Id,
      botId: codeBotId,
      taskId: task7Id,
      status: "completed",
      outputSummary:
        "Initialized React Native project with TypeScript template, React Navigation, and Zustand state management.",
      artifactLinks: JSON.stringify([
        "https://github.com/acme/mobile-app/pull/1",
      ]),
      retryCount: 0,
      maxRetries: 1,
      confidenceScore: 97,
      confidenceReason: "Standard project scaffolding with well-known tooling.",
      startedAt: daysAgo(4),
      completedAt: daysAgo(3) - 2 * HOUR,
      createdAt: daysAgo(4),
      updatedAt: daysAgo(3) - 2 * HOUR,
    })
    .run();

  // ── 8. Automation Rules ──
  console.log("  Creating automation rules...");

  db.insert(schema.automationRules)
    .values({
      id: crypto.randomUUID(),
      workspaceId,
      name: "Auto-assign urgent tasks",
      trigger: "task.created",
      conditions: JSON.stringify([
        { field: "priority", operator: "eq", value: "urgent" },
      ]),
      actions: JSON.stringify([
        {
          type: "assign_to_user",
          userId: adminId,
          reason: "Urgent tasks auto-assigned to admin for triage",
        },
      ]),
      active: 1,
      createdAt: daysAgo(12),
      updatedAt: daysAgo(12),
    })
    .run();

  db.insert(schema.automationRules)
    .values({
      id: crypto.randomUUID(),
      workspaceId,
      name: "Notify on task completion",
      trigger: "task.updated",
      conditions: JSON.stringify([
        { field: "status", operator: "eq", value: "done" },
      ]),
      actions: JSON.stringify([
        {
          type: "send_notification",
          channel: "in_app",
          message: "Task {{task.title}} has been completed",
        },
      ]),
      active: 1,
      createdAt: daysAgo(10),
      updatedAt: daysAgo(10),
    })
    .run();

  // ── 9. Notifications ──
  console.log("  Creating notifications...");

  db.insert(schema.notifications)
    .values({
      id: crypto.randomUUID(),
      userId: adminId,
      type: "task.completed",
      title: "Task completed",
      body: '"Create wireframes for homepage" has been marked as done by Bob Designer.',
      link: `/dashboard/projects/${proj1Id}`,
      readAt: daysAgo(3),
      createdAt: daysAgo(4),
    })
    .run();

  db.insert(schema.notifications)
    .values({
      id: crypto.randomUUID(),
      userId: adminId,
      type: "bot_task.failed",
      title: "Bot task failed",
      body: 'CodeBot failed to complete "Implement homepage with Next.js" after 2 retries.',
      link: `/dashboard/projects/${proj1Id}`,
      readAt: null,
      createdAt: daysAgo(3),
    })
    .run();

  db.insert(schema.notifications)
    .values({
      id: crypto.randomUUID(),
      userId: adminId,
      type: "task.completed",
      title: "Task completed",
      body: '"Set up React Native project scaffold" has been completed by CodeBot.',
      link: `/dashboard/projects/${proj2Id}`,
      readAt: null,
      createdAt: daysAgo(3) - 2 * HOUR,
    })
    .run();

  db.insert(schema.notifications)
    .values({
      id: crypto.randomUUID(),
      userId: adminId,
      type: "bot.status_change",
      title: "Bot status change",
      body: "DocBot is now working on API documentation.",
      link: "/dashboard/bots/health",
      readAt: null,
      createdAt: now - HOUR,
    })
    .run();

  db.insert(schema.notifications)
    .values({
      id: crypto.randomUUID(),
      userId: adminId,
      type: "system",
      title: "Welcome to Whale",
      body: "Your workspace is set up and ready. Start by creating a project or pairing a bot.",
      link: "/dashboard",
      readAt: daysAgo(29),
      createdAt: daysAgo(30),
    })
    .run();

  // ── 10. Audit Logs ──
  console.log("  Creating audit log entries...");

  db.insert(schema.auditLogs)
    .values({
      id: crypto.randomUUID(),
      workspaceId,
      userId: adminId,
      action: "workspace.created",
      metadata: JSON.stringify({ name: "Acme Corp" }),
      createdAt: daysAgo(30),
    })
    .run();

  db.insert(schema.auditLogs)
    .values({
      id: crypto.randomUUID(),
      workspaceId,
      userId: adminId,
      action: "project.created",
      metadata: JSON.stringify({ projectId: proj1Id, name: "Website Redesign" }),
      createdAt: daysAgo(14),
    })
    .run();

  db.insert(schema.auditLogs)
    .values({
      id: crypto.randomUUID(),
      workspaceId,
      userId: adminId,
      action: "bot.paired",
      metadata: JSON.stringify({ botId: codeBotId, name: "CodeBot" }),
      createdAt: daysAgo(14),
    })
    .run();

  // ── 11. Project Members ──
  console.log("  Creating project memberships...");

  // All users on Website Redesign
  db.insert(schema.projectMembers)
    .values({
      id: crypto.randomUUID(),
      projectId: proj1Id,
      userId: adminId,
      role: "admin",
      createdAt: daysAgo(14),
    })
    .run();

  db.insert(schema.projectMembers)
    .values({
      id: crypto.randomUUID(),
      projectId: proj1Id,
      userId: aliceId,
      role: "member",
      createdAt: daysAgo(14),
    })
    .run();

  db.insert(schema.projectMembers)
    .values({
      id: crypto.randomUUID(),
      projectId: proj1Id,
      userId: bobId,
      role: "member",
      createdAt: daysAgo(14),
    })
    .run();

  // Alice and Admin on Mobile App
  db.insert(schema.projectMembers)
    .values({
      id: crypto.randomUUID(),
      projectId: proj2Id,
      userId: adminId,
      role: "admin",
      createdAt: daysAgo(10),
    })
    .run();

  db.insert(schema.projectMembers)
    .values({
      id: crypto.randomUUID(),
      projectId: proj2Id,
      userId: aliceId,
      role: "member",
      createdAt: daysAgo(10),
    })
    .run();

  // Admin on API Documentation
  db.insert(schema.projectMembers)
    .values({
      id: crypto.randomUUID(),
      projectId: proj3Id,
      userId: adminId,
      role: "admin",
      createdAt: daysAgo(5),
    })
    .run();

  // ── 12. Task Comments ──
  console.log("  Creating task comments...");

  db.insert(schema.taskComments)
    .values({
      id: crypto.randomUUID(),
      taskId: task1Id,
      authorId: bobId,
      authorType: "user",
      body: "Wireframes are done. Uploaded to Figma. Ready for review.",
      createdAt: daysAgo(4),
    })
    .run();

  db.insert(schema.taskComments)
    .values({
      id: crypto.randomUUID(),
      taskId: task1Id,
      authorId: adminId,
      authorType: "user",
      body: "Looks great! Approved. Moving forward with the development phase.",
      createdAt: daysAgo(4) + 2 * HOUR,
    })
    .run();

  db.insert(schema.taskComments)
    .values({
      id: crypto.randomUUID(),
      taskId: task4Id,
      authorId: null,
      authorType: "bot",
      body: "Attempted implementation but failed. Missing design tokens from the color palette task. Please complete task dependencies first.",
      createdAt: daysAgo(3),
    })
    .run();

  // ── 13. Bot Logs ──
  console.log("  Creating bot logs...");

  db.insert(schema.botLogs)
    .values({
      id: crypto.randomUUID(),
      botId: codeBotId,
      workspaceId,
      level: "info",
      message: "Bot started and connected to workspace",
      metadata: JSON.stringify({ version: "1.2.0" }),
      createdAt: daysAgo(14),
    })
    .run();

  db.insert(schema.botLogs)
    .values({
      id: crypto.randomUUID(),
      botId: codeBotId,
      workspaceId,
      level: "info",
      message: "Task completed: Create wireframes for homepage",
      metadata: JSON.stringify({ taskId: task1Id, duration: "4h 12m" }),
      botTaskId: botTask1Id,
      createdAt: daysAgo(4),
    })
    .run();

  db.insert(schema.botLogs)
    .values({
      id: crypto.randomUUID(),
      botId: codeBotId,
      workspaceId,
      level: "error",
      message:
        "Task failed: Implement homepage with Next.js - missing design tokens dependency",
      metadata: JSON.stringify({
        taskId: task4Id,
        error: "MISSING_DEPENDENCY",
        retryCount: 2,
      }),
      botTaskId: botTask4Id,
      createdAt: daysAgo(3),
    })
    .run();

  db.insert(schema.botLogs)
    .values({
      id: crypto.randomUUID(),
      botId: docBotId,
      workspaceId,
      level: "info",
      message: "Started working on: Write REST API endpoint reference",
      metadata: JSON.stringify({ taskId: task11Id }),
      botTaskId: botTask2Id,
      createdAt: now - HOUR,
    })
    .run();

  // ── Done ──
  console.log("");
  console.log("Seed complete! Summary:");
  console.log("  1 workspace (Acme Corp)");
  console.log("  3 users (admin, alice, bob)");
  console.log("  3 projects (Website Redesign, Mobile App, API Documentation)");
  console.log("  3 milestones");
  console.log("  13 tasks");
  console.log("  2 bots (CodeBot, DocBot)");
  console.log("  5 bot tasks (1 completed, 1 running, 1 pending, 1 failed, 1 completed)");
  console.log("  2 automation rules");
  console.log("  5 notifications");
  console.log("  3 audit log entries");
  console.log("  6 project memberships");
  console.log("  3 task comments");
  console.log("  4 bot logs");
  console.log("");
  console.log("Login credentials:");
  console.log("  admin@acme.com  / Password123!");
  console.log("  alice@acme.com  / Password123!");
  console.log("  bob@acme.com    / Password123!");

  sqlite.close();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  sqlite.close();
  process.exit(1);
});
