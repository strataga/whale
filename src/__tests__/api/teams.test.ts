import { describe, it, expect, beforeEach } from "vitest";
import { eq, and, isNull } from "drizzle-orm";

import * as schema from "@/lib/db/schema";
import {
  createTestDb,
  createTestUser,
  createTestBot,
  createTestTeam,
  createTestTeamMember,
  type TestDb,
} from "../helpers/setup";

// ---------------------------------------------------------------------------
// Team CRUD (direct DB operations matching route logic)
// ---------------------------------------------------------------------------
describe("Teams", () => {
  let db: TestDb;
  let workspaceId: string;
  let userId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db, { role: "admin" });
    workspaceId = user.workspaceId;
    userId = user.userId;
  });

  describe("team creation", () => {
    it("creates a team with slug and adds creator as lead", () => {
      const team = createTestTeam(db, workspaceId, {
        name: "Alpha Team",
        slug: "alpha",
      });

      createTestTeamMember(db, team.id, {
        memberType: "user",
        userId,
        role: "lead",
      });

      const row = db
        .select()
        .from(schema.teams)
        .where(eq(schema.teams.id, team.id))
        .get();

      expect(row).toBeDefined();
      expect(row!.name).toBe("Alpha Team");
      expect(row!.slug).toBe("alpha");

      const members = db
        .select()
        .from(schema.teamMembers)
        .where(eq(schema.teamMembers.teamId, team.id))
        .all();
      expect(members).toHaveLength(1);
      expect(members[0].role).toBe("lead");
      expect(members[0].userId).toBe(userId);
    });

    it("can create a default team", () => {
      const team = createTestTeam(db, workspaceId, {
        name: "Default",
        slug: "default",
        isDefault: 1,
      });

      const row = db
        .select()
        .from(schema.teams)
        .where(eq(schema.teams.id, team.id))
        .get();
      expect(row!.isDefault).toBe(1);
    });
  });

  describe("team membership", () => {
    it("adds a user member", () => {
      const team = createTestTeam(db, workspaceId);
      const member = createTestTeamMember(db, team.id, {
        memberType: "user",
        userId,
        role: "member",
      });

      const row = db
        .select()
        .from(schema.teamMembers)
        .where(eq(schema.teamMembers.id, member.id))
        .get();
      expect(row!.memberType).toBe("user");
      expect(row!.userId).toBe(userId);
      expect(row!.removedAt).toBeNull();
    });

    it("adds a bot member", () => {
      const bot = createTestBot(db, workspaceId);
      const team = createTestTeam(db, workspaceId);
      const member = createTestTeamMember(db, team.id, {
        memberType: "bot",
        botId: bot.id,
        role: "member",
      });

      const row = db
        .select()
        .from(schema.teamMembers)
        .where(eq(schema.teamMembers.id, member.id))
        .get();
      expect(row!.memberType).toBe("bot");
      expect(row!.botId).toBe(bot.id);
    });

    it("soft-removes a member by setting removedAt", () => {
      const team = createTestTeam(db, workspaceId);
      const member = createTestTeamMember(db, team.id, {
        memberType: "user",
        userId,
      });

      db.update(schema.teamMembers)
        .set({ removedAt: Date.now() })
        .where(eq(schema.teamMembers.id, member.id))
        .run();

      const active = db
        .select()
        .from(schema.teamMembers)
        .where(
          and(
            eq(schema.teamMembers.teamId, team.id),
            isNull(schema.teamMembers.removedAt),
          ),
        )
        .all();
      expect(active).toHaveLength(0);
    });

    it("counts active members correctly", () => {
      const team = createTestTeam(db, workspaceId);
      const m1 = createTestTeamMember(db, team.id, { userId, memberType: "user" });
      const user2 = crypto.randomUUID();
      db.insert(schema.users)
        .values({
          id: user2,
          workspaceId,
          email: "u2@test.com",
          passwordHash: "hash",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .run();
      createTestTeamMember(db, team.id, { userId: user2, memberType: "user" });
      // Remove first member
      db.update(schema.teamMembers)
        .set({ removedAt: Date.now() })
        .where(eq(schema.teamMembers.id, m1.id))
        .run();

      const active = db
        .select()
        .from(schema.teamMembers)
        .where(
          and(
            eq(schema.teamMembers.teamId, team.id),
            isNull(schema.teamMembers.removedAt),
          ),
        )
        .all();
      expect(active).toHaveLength(1);
    });
  });

  describe("team soft-delete", () => {
    it("soft-deletes a team by setting deletedAt", () => {
      const team = createTestTeam(db, workspaceId, { name: "To Delete" });

      db.update(schema.teams)
        .set({ deletedAt: Date.now() })
        .where(eq(schema.teams.id, team.id))
        .run();

      const active = db
        .select()
        .from(schema.teams)
        .where(
          and(
            eq(schema.teams.workspaceId, workspaceId),
            isNull(schema.teams.deletedAt),
          ),
        )
        .all();
      expect(active.find((t) => t.id === team.id)).toBeUndefined();
    });
  });

  describe("team collaborations", () => {
    it("creates a bidirectional collaboration between teams", () => {
      const t1 = createTestTeam(db, workspaceId, { name: "Team A", slug: "team-a" });
      const t2 = createTestTeam(db, workspaceId, { name: "Team B", slug: "team-b" });

      const collabId = crypto.randomUUID();
      const now = Date.now();
      db.insert(schema.teamCollaborations)
        .values({
          id: collabId,
          workspaceId,
          sourceTeamId: t1.id,
          targetTeamId: t2.id,
          scope: "tasks",
          direction: "bidirectional",
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const collab = db
        .select()
        .from(schema.teamCollaborations)
        .where(eq(schema.teamCollaborations.id, collabId))
        .get();
      expect(collab).toBeDefined();
      expect(collab!.sourceTeamId).toBe(t1.id);
      expect(collab!.targetTeamId).toBe(t2.id);
      expect(collab!.direction).toBe("bidirectional");
    });
  });

  describe("public team visibility", () => {
    it("only public teams are visible in public queries", () => {
      createTestTeam(db, workspaceId, { name: "Public Team", slug: "pub", visibility: "public" });
      createTestTeam(db, workspaceId, { name: "Private Team", slug: "priv", visibility: "private" });

      const publicTeams = db
        .select()
        .from(schema.teams)
        .where(
          and(
            eq(schema.teams.workspaceId, workspaceId),
            eq(schema.teams.visibility, "public"),
            isNull(schema.teams.deletedAt),
          ),
        )
        .all();

      expect(publicTeams).toHaveLength(1);
      expect(publicTeams[0].name).toBe("Public Team");
    });
  });
});
