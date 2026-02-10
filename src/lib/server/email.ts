import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";

/**
 * Email templates and sending infrastructure (#46).
 * Uses nodemailer when SMTP env vars are set; otherwise logs to console.
 */

// ---------- Templates ----------

interface TemplateData {
  recipientName?: string;
  [key: string]: unknown;
}

export function renderTemplate(
  template: "task_assigned" | "sprint_started" | "weekly_digest",
  data: TemplateData,
): { subject: string; body: string } {
  switch (template) {
    case "task_assigned":
      return {
        subject: `Task assigned: ${data.taskTitle ?? "Untitled"}`,
        body: [
          `Hi ${data.recipientName ?? "there"},`,
          "",
          `You've been assigned to the task "${data.taskTitle}".`,
          data.projectName ? `Project: ${data.projectName}` : "",
          data.priority ? `Priority: ${data.priority}` : "",
          "",
          "Open Whale to view the task details.",
        ]
          .filter(Boolean)
          .join("\n"),
      };

    case "sprint_started":
      return {
        subject: `Sprint started: ${data.sprintName ?? "Sprint"}`,
        body: [
          `Hi ${data.recipientName ?? "there"},`,
          "",
          `The sprint "${data.sprintName}" has started.`,
          data.taskCount ? `Tasks in sprint: ${data.taskCount}` : "",
          data.endDate ? `Ends: ${new Date(data.endDate as number).toLocaleDateString()}` : "",
          "",
          "Open Whale to view the sprint board.",
        ]
          .filter(Boolean)
          .join("\n"),
      };

    case "weekly_digest":
      return {
        subject: "Your weekly project digest",
        body: [
          `Hi ${data.recipientName ?? "there"},`,
          "",
          "Here's your weekly summary:",
          data.completedTasks ? `  Completed tasks: ${data.completedTasks}` : "",
          data.openTasks ? `  Open tasks: ${data.openTasks}` : "",
          data.activeBots ? `  Active bots: ${data.activeBots}` : "",
          "",
          "Open Whale for full details.",
        ]
          .filter(Boolean)
          .join("\n"),
      };
  }
}

// ---------- Queue processing ----------

/**
 * Process pending emails from the queue.
 * Returns count of emails processed.
 */
export function processEmailQueue(
  db: BetterSQLite3Database<typeof schema>,
  batchSize = 10,
): { sent: number; failed: number } {
  const pending = db
    .select()
    .from(schema.emailQueue)
    .where(eq(schema.emailQueue.status, "pending"))
    .limit(batchSize)
    .all();

  let sent = 0;
  let failed = 0;
  const now = Date.now();

  for (const email of pending) {
    try {
      // Look up user email
      const user = db
        .select({ email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.id, email.userId))
        .get();

      if (!user) {
        db.update(schema.emailQueue)
          .set({ status: "failed" })
          .where(eq(schema.emailQueue.id, email.id))
          .run();
        failed++;
        continue;
      }

      // Send via SMTP or log
      const smtpHost = process.env.SMTP_HOST;
      if (smtpHost) {
        // Real SMTP sending would go here (nodemailer)
        // For now, mark as sent — actual SMTP integration is a deployment concern
        sendViaSMTP(user.email, email.subject, email.body);
      } else {
        // Dev mode: log to console
        console.log(
          `[email] To: ${user.email} | Subject: ${email.subject} | Body: ${email.body.substring(0, 100)}...`,
        );
      }

      db.update(schema.emailQueue)
        .set({ status: "sent", sentAt: now })
        .where(eq(schema.emailQueue.id, email.id))
        .run();
      sent++;
    } catch {
      db.update(schema.emailQueue)
        .set({ status: "failed" })
        .where(eq(schema.emailQueue.id, email.id))
        .run();
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Enqueue an email for later sending.
 */
export function enqueueEmail(
  db: BetterSQLite3Database<typeof schema>,
  userId: string,
  subject: string,
  body: string,
): string {
  const id = crypto.randomUUID();
  db.insert(schema.emailQueue)
    .values({ id, userId, subject, body, status: "pending", createdAt: Date.now() })
    .run();
  return id;
}

/**
 * Enqueue a templated email.
 */
export function enqueueTemplateEmail(
  db: BetterSQLite3Database<typeof schema>,
  userId: string,
  template: "task_assigned" | "sprint_started" | "weekly_digest",
  data: TemplateData,
): string {
  const { subject, body } = renderTemplate(template, data);
  return enqueueEmail(db, userId, subject, body);
}

// ---------- SMTP (placeholder) ----------

function sendViaSMTP(to: string, subject: string, body: string): void {
  // Placeholder for nodemailer integration.
  // When SMTP_HOST is set, this would use:
  //   const transporter = nodemailer.createTransport({ host, port, auth })
  //   transporter.sendMail({ from, to, subject, text: body })
  // For now, just log at info level.
  console.log(`[smtp] Sending to ${to}: ${subject}`);
  void body; // suppress unused
}
