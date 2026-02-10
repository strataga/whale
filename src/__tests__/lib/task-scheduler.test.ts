import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";

import {
  findReadyTasks,
  findAvailableBots,
  scheduleReadyTasks,
} from "@/lib/server/task-scheduler";
import { taskDependencies, botTasks, tasks } from "@/lib/db/schema";
import {
  createTestDb,
  createTestUser,
  createTestProject,
  createTestTask,
  createTestBot,
  createTestBotTask,
  type TestDb,
} from "../helpers/setup";

describe("task-scheduler", () => {
  let db: TestDb;
  let workspaceId: string;
  let projectId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db);
    workspaceId = user.workspaceId;
    const project = createTestProject(db, workspaceId);
    projectId = project.id;
  });

  describe("findReadyTasks", () => {
    it("tasks with no dependencies are ready", () => {
      const t1 = createTestTask(db, projectId, { title: "No deps task" });

      const ready = findReadyTasks(db, workspaceId);

      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe(t1.id);
      expect(ready[0].title).toBe("No deps task");
    });

    it("tasks with all dependencies done are ready", () => {
      const prereq = createTestTask(db, projectId, {
        title: "Prerequisite",
        status: "done",
      });
      const dependent = createTestTask(db, projectId, {
        title: "Dependent",
        status: "todo",
      });

      db.insert(taskDependencies)
        .values({
          id: crypto.randomUUID(),
          taskId: dependent.id,
          dependsOnTaskId: prereq.id,
          createdAt: Date.now(),
        })
        .run();

      const ready = findReadyTasks(db, workspaceId);

      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe(dependent.id);
    });

    it("tasks with unmet dependencies are NOT ready", () => {
      const prereq = createTestTask(db, projectId, {
        title: "Prerequisite",
        status: "todo",
      });
      const dependent = createTestTask(db, projectId, {
        title: "Dependent",
        status: "todo",
      });

      db.insert(taskDependencies)
        .values({
          id: crypto.randomUUID(),
          taskId: dependent.id,
          dependsOnTaskId: prereq.id,
          createdAt: Date.now(),
        })
        .run();

      const ready = findReadyTasks(db, workspaceId);

      // Only the prerequisite should be ready (no deps), not the dependent
      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe(prereq.id);
    });

    it("tasks with active botTasks (pending/running) are excluded", () => {
      const task = createTestTask(db, projectId, { title: "Assigned task" });
      const bot = createTestBot(db, workspaceId);

      // Create a pending bot task assignment
      createTestBotTask(db, bot.id, task.id, { status: "pending" });

      const ready = findReadyTasks(db, workspaceId);

      expect(ready).toHaveLength(0);
    });

    it("tasks with completed botTasks are still ready", () => {
      const task = createTestTask(db, projectId, { title: "Re-assignable" });
      const bot = createTestBot(db, workspaceId);

      // Bot task that already completed — should not block
      createTestBotTask(db, bot.id, task.id, { status: "completed" });

      const ready = findReadyTasks(db, workspaceId);

      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe(task.id);
    });

    it("tasks with running botTasks are excluded", () => {
      const task = createTestTask(db, projectId, { title: "Running task" });
      const bot = createTestBot(db, workspaceId);

      createTestBotTask(db, bot.id, task.id, { status: "running" });

      const ready = findReadyTasks(db, workspaceId);

      expect(ready).toHaveLength(0);
    });

    it("returns tasks sorted by priority (urgent > high > medium > low)", () => {
      const low = createTestTask(db, projectId, {
        title: "Low",
        priority: "low",
      });
      const medium = createTestTask(db, projectId, {
        title: "Medium",
        priority: "medium",
      });
      const urgent = createTestTask(db, projectId, {
        title: "Urgent",
        priority: "urgent",
      });
      const high = createTestTask(db, projectId, {
        title: "High",
        priority: "high",
      });

      const ready = findReadyTasks(db, workspaceId);

      expect(ready).toHaveLength(4);
      expect(ready[0].id).toBe(urgent.id);
      expect(ready[1].id).toBe(high.id);
      expect(ready[2].id).toBe(medium.id);
      expect(ready[3].id).toBe(low.id);
    });

    it("only includes todo tasks — in_progress and done are excluded", () => {
      createTestTask(db, projectId, {
        title: "Todo",
        status: "todo",
      });
      createTestTask(db, projectId, {
        title: "In Progress",
        status: "in_progress",
      });
      createTestTask(db, projectId, {
        title: "Done",
        status: "done",
      });

      const ready = findReadyTasks(db, workspaceId);

      expect(ready).toHaveLength(1);
      expect(ready[0].title).toBe("Todo");
    });
  });

  describe("findAvailableBots", () => {
    it("idle bots with no tasks are available", () => {
      const bot = createTestBot(db, workspaceId, {
        name: "Idle Bot",
        status: "idle",
      });

      const available = findAvailableBots(db, workspaceId);

      expect(available).toHaveLength(1);
      expect(available[0].id).toBe(bot.id);
      expect(available[0].name).toBe("Idle Bot");
      expect(available[0].activeTasks).toBe(0);
    });

    it("working bots below capacity are available", () => {
      const bot = createTestBot(db, workspaceId, {
        name: "Working Bot",
        status: "working",
        maxConcurrentTasks: 3,
      });

      // Give it one active task — still below capacity of 3
      const task = createTestTask(db, projectId);
      createTestBotTask(db, bot.id, task.id, { status: "running" });

      const available = findAvailableBots(db, workspaceId);

      expect(available).toHaveLength(1);
      expect(available[0].id).toBe(bot.id);
      expect(available[0].activeTasks).toBe(1);
      expect(available[0].maxConcurrentTasks).toBe(3);
    });

    it("bots at max capacity are excluded", () => {
      const bot = createTestBot(db, workspaceId, {
        name: "Full Bot",
        status: "working",
        maxConcurrentTasks: 1,
      });

      const task = createTestTask(db, projectId);
      createTestBotTask(db, bot.id, task.id, { status: "pending" });

      const available = findAvailableBots(db, workspaceId);

      expect(available).toHaveLength(0);
    });

    it("offline bots are excluded", () => {
      createTestBot(db, workspaceId, {
        name: "Offline Bot",
        status: "offline",
      });

      const available = findAvailableBots(db, workspaceId);

      expect(available).toHaveLength(0);
    });

    it("maxConcurrentTasks > 1 respects capacity correctly", () => {
      const bot = createTestBot(db, workspaceId, {
        name: "Multi Bot",
        status: "working",
        maxConcurrentTasks: 3,
      });

      // Give it 2 active tasks — still has room for 1 more
      const task1 = createTestTask(db, projectId, { title: "T1" });
      const task2 = createTestTask(db, projectId, { title: "T2" });
      createTestBotTask(db, bot.id, task1.id, { status: "pending" });
      createTestBotTask(db, bot.id, task2.id, { status: "running" });

      const available = findAvailableBots(db, workspaceId);

      expect(available).toHaveLength(1);
      expect(available[0].activeTasks).toBe(2);

      // Add a third task — now at capacity
      const task3 = createTestTask(db, projectId, { title: "T3" });
      createTestBotTask(db, bot.id, task3.id, { status: "pending" });

      const afterFull = findAvailableBots(db, workspaceId);

      expect(afterFull).toHaveLength(0);
    });

    it("completed/failed botTasks do not count toward capacity", () => {
      const bot = createTestBot(db, workspaceId, {
        name: "Bot with history",
        status: "idle",
        maxConcurrentTasks: 1,
      });

      const task = createTestTask(db, projectId);
      createTestBotTask(db, bot.id, task.id, { status: "completed" });

      const available = findAvailableBots(db, workspaceId);

      expect(available).toHaveLength(1);
      expect(available[0].activeTasks).toBe(0);
    });
  });

  describe("scheduleReadyTasks", () => {
    it("assigns tasks to bots and creates botTask records", () => {
      const task = createTestTask(db, projectId, { title: "Schedulable" });
      const bot = createTestBot(db, workspaceId, {
        name: "Worker",
        status: "idle",
      });

      const result = scheduleReadyTasks(db, workspaceId);

      expect(result.assigned).toHaveLength(1);
      expect(result.assigned[0].taskId).toBe(task.id);
      expect(result.assigned[0].botId).toBe(bot.id);
      expect(result.assigned[0].botTaskId).toBeTruthy();

      // Verify botTask was actually created in the DB
      const createdBotTask = db
        .select()
        .from(botTasks)
        .where(eq(botTasks.id, result.assigned[0].botTaskId))
        .get();

      expect(createdBotTask).toBeDefined();
      expect(createdBotTask!.status).toBe("pending");
      expect(createdBotTask!.botId).toBe(bot.id);
      expect(createdBotTask!.taskId).toBe(task.id);
    });

    it("updates task status to in_progress", () => {
      const task = createTestTask(db, projectId, { title: "To schedule" });
      createTestBot(db, workspaceId, { status: "idle" });

      scheduleReadyTasks(db, workspaceId);

      const updatedTask = db
        .select()
        .from(tasks)
        .where(eq(tasks.id, task.id))
        .get();

      expect(updatedTask!.status).toBe("in_progress");
    });

    it("round-robin distributes tasks across multiple bots", () => {
      const t1 = createTestTask(db, projectId, { title: "Task 1" });
      const t2 = createTestTask(db, projectId, { title: "Task 2" });
      const t3 = createTestTask(db, projectId, { title: "Task 3" });

      const bot1 = createTestBot(db, workspaceId, {
        name: "Bot A",
        status: "idle",
        maxConcurrentTasks: 1,
      });
      const bot2 = createTestBot(db, workspaceId, {
        name: "Bot B",
        status: "idle",
        maxConcurrentTasks: 1,
      });
      const bot3 = createTestBot(db, workspaceId, {
        name: "Bot C",
        status: "idle",
        maxConcurrentTasks: 1,
      });

      const result = scheduleReadyTasks(db, workspaceId);

      expect(result.assigned).toHaveLength(3);

      // Each bot should get exactly one task
      const botIds = result.assigned.map((a) => a.botId);
      expect(botIds).toContain(bot1.id);
      expect(botIds).toContain(bot2.id);
      expect(botIds).toContain(bot3.id);
    });

    it("returns empty when no bots are available", () => {
      createTestTask(db, projectId, { title: "Orphan task" });
      // No bots created

      const result = scheduleReadyTasks(db, workspaceId);

      expect(result.assigned).toHaveLength(0);
    });

    it("returns empty when no tasks are ready", () => {
      createTestBot(db, workspaceId, { status: "idle" });
      // No tasks created

      const result = scheduleReadyTasks(db, workspaceId);

      expect(result.assigned).toHaveLength(0);
    });

    it("bot with capacity 2 gets 2 tasks before moving to next bot", () => {
      const t1 = createTestTask(db, projectId, { title: "Task 1" });
      const t2 = createTestTask(db, projectId, { title: "Task 2" });
      const t3 = createTestTask(db, projectId, { title: "Task 3" });

      const bigBot = createTestBot(db, workspaceId, {
        name: "Big Bot",
        status: "idle",
        maxConcurrentTasks: 2,
      });
      const smallBot = createTestBot(db, workspaceId, {
        name: "Small Bot",
        status: "idle",
        maxConcurrentTasks: 1,
      });

      const result = scheduleReadyTasks(db, workspaceId);

      expect(result.assigned).toHaveLength(3);

      // Big bot should get 2 tasks, small bot should get 1
      const bigBotAssignments = result.assigned.filter(
        (a) => a.botId === bigBot.id,
      );
      const smallBotAssignments = result.assigned.filter(
        (a) => a.botId === smallBot.id,
      );

      expect(bigBotAssignments).toHaveLength(2);
      expect(smallBotAssignments).toHaveLength(1);
    });

    it("stops assigning when all bots are at capacity", () => {
      createTestTask(db, projectId, { title: "Task 1" });
      createTestTask(db, projectId, { title: "Task 2" });
      createTestTask(db, projectId, { title: "Task 3" });
      createTestTask(db, projectId, { title: "Task 4" });

      createTestBot(db, workspaceId, {
        name: "Bot A",
        status: "idle",
        maxConcurrentTasks: 1,
      });
      createTestBot(db, workspaceId, {
        name: "Bot B",
        status: "idle",
        maxConcurrentTasks: 1,
      });

      const result = scheduleReadyTasks(db, workspaceId);

      // Only 2 tasks should be assigned (2 bots x 1 capacity each)
      expect(result.assigned).toHaveLength(2);
    });

    it("assigns higher priority tasks first", () => {
      const lowTask = createTestTask(db, projectId, {
        title: "Low priority",
        priority: "low",
      });
      const urgentTask = createTestTask(db, projectId, {
        title: "Urgent",
        priority: "urgent",
      });

      // Only 1 bot with capacity 1 — should get the urgent task
      createTestBot(db, workspaceId, {
        name: "Single Bot",
        status: "idle",
        maxConcurrentTasks: 1,
      });

      const result = scheduleReadyTasks(db, workspaceId);

      expect(result.assigned).toHaveLength(1);
      expect(result.assigned[0].taskId).toBe(urgentTask.id);
    });
  });
});
