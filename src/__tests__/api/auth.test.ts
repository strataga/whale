import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { hash, compare } from "bcryptjs";
import * as schema from "@/lib/db/schema";
import {
  registerSchema,
  loginSchema,
} from "@/lib/validators";
import {
  createTestDb,
  createTestUser,
  type TestDb,
} from "../helpers/setup";

describe("Auth — registerSchema validation", () => {
  it("accepts valid registration input", () => {
    const result = registerSchema.safeParse({
      email: "alice@example.com",
      password: "strongPassword1",
      name: "Alice",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing email", () => {
    const result = registerSchema.safeParse({
      password: "strongPassword1",
      name: "Alice",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = registerSchema.safeParse({
      email: "not-an-email",
      password: "strongPassword1",
      name: "Alice",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      email: "alice@example.com",
      password: "short",
      name: "Alice",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password longer than 128 characters", () => {
    const result = registerSchema.safeParse({
      email: "alice@example.com",
      password: "a".repeat(129),
      name: "Alice",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = registerSchema.safeParse({
      email: "alice@example.com",
      password: "strongPassword1",
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 200 characters", () => {
    const result = registerSchema.safeParse({
      email: "alice@example.com",
      password: "strongPassword1",
      name: "A".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("trims name whitespace", () => {
    const result = registerSchema.safeParse({
      email: "alice@example.com",
      password: "strongPassword1",
      name: "  Alice  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Alice");
    }
  });
});

describe("Auth — loginSchema validation", () => {
  it("accepts valid login", () => {
    const result = loginSchema.safeParse({
      email: "alice@example.com",
      password: "strongPassword1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing password", () => {
    const result = loginSchema.safeParse({
      email: "alice@example.com",
    });
    expect(result.success).toBe(false);
  });
});

describe("Auth — user creation logic", () => {
  let db: TestDb;

  beforeEach(() => {
    db = createTestDb();
  });

  it("hashes password with bcrypt and stores in DB", async () => {
    const password = "mySecretPass1";
    const passwordHash = await hash(password, 4);

    const workspaceId = crypto.randomUUID();
    const now = Date.now();
    db.insert(schema.workspaces)
      .values({ id: workspaceId, name: "WS", createdAt: now, updatedAt: now })
      .run();

    const userId = crypto.randomUUID();
    db.insert(schema.users)
      .values({
        id: userId,
        workspaceId,
        email: "alice@example.com",
        passwordHash,
        name: "Alice",
        role: "member",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .get();

    expect(user).toBeDefined();
    expect(user!.email).toBe("alice@example.com");
    expect(user!.passwordHash).not.toBe(password);
    expect(await compare(password, user!.passwordHash)).toBe(true);
  });

  it("rejects duplicate email", async () => {
    const { workspaceId } = await createTestUser(db, {
      email: "dupe@example.com",
    });

    // Check for existing user before insert (same logic as route handler)
    const existing = db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, "dupe@example.com"))
      .get();

    expect(existing).toBeDefined();

    // Attempting to insert a duplicate email should throw (UNIQUE constraint)
    expect(() => {
      const now = Date.now();
      db.insert(schema.users)
        .values({
          id: crypto.randomUUID(),
          workspaceId,
          email: "dupe@example.com",
          passwordHash: "hash",
          name: "Dupe",
          role: "member",
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }).toThrow();
  });

  it("first user gets admin role and creates workspace", async () => {
    // Simulate first-user logic from the register route
    const firstUser = db
      .select({ id: schema.users.id, workspaceId: schema.users.workspaceId })
      .from(schema.users)
      .limit(1)
      .get();

    expect(firstUser).toBeUndefined();

    // First user flow: create workspace + admin user
    const workspaceId = crypto.randomUUID();
    const now = Date.now();
    db.insert(schema.workspaces)
      .values({
        id: workspaceId,
        name: "My Workspace",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const userId = crypto.randomUUID();
    const passwordHash = await hash("password12", 4);
    db.insert(schema.users)
      .values({
        id: userId,
        workspaceId,
        email: "first@example.com",
        passwordHash,
        name: "First User",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const admin = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .get();

    expect(admin).toBeDefined();
    expect(admin!.role).toBe("admin");

    // Verify workspace was created
    const ws = db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, workspaceId))
      .get();

    expect(ws).toBeDefined();
    expect(ws!.name).toBe("My Workspace");
  });

  it("second user gets member role and joins existing workspace", async () => {
    // First user creates the workspace
    const { workspaceId } = await createTestUser(db, {
      email: "first@example.com",
      role: "admin",
    });

    // Check that a user already exists
    const firstUser = db
      .select({ id: schema.users.id, workspaceId: schema.users.workspaceId })
      .from(schema.users)
      .limit(1)
      .get();

    expect(firstUser).toBeDefined();

    // Second user should join existing workspace as member
    const secondId = crypto.randomUUID();
    const passwordHash = await hash("password12", 4);
    const now = Date.now();
    db.insert(schema.users)
      .values({
        id: secondId,
        workspaceId: firstUser!.workspaceId,
        email: "second@example.com",
        passwordHash,
        name: "Second User",
        role: "member",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const second = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, secondId))
      .get();

    expect(second).toBeDefined();
    expect(second!.role).toBe("member");
    expect(second!.workspaceId).toBe(workspaceId);
  });
});
