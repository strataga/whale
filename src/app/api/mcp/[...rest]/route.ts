export const runtime = "nodejs";

import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";

import { createMcpHandler } from "mcp-handler";
import { db } from "@/lib/db";
import {
  agents,
  agentProducts,
  agentSkills,
  checkoutSessions,
  tasks,
} from "@/lib/db/schema";

const handler = createMcpHandler(
  (server) => {
    // Tool: list_agents — returns agents in the system
    server.tool(
      "list_agents",
      "List registered agents and their capabilities",
      {
        workspaceId: z.string().optional().describe("Filter by workspace ID"),
      },
      async (args) => {
        const conditions: any[] = [];
        if (args.workspaceId) {
          conditions.push(eq(agents.workspaceId, args.workspaceId));
        }
        conditions.push(isNull(agents.deletedAt));

        const rows = db
          .select({
            id: agents.id,
            name: agents.name,
            type: agents.type,
            description: agents.description,
            status: agents.status,
            url: agents.url,
            reputation: agents.reputation,
            capabilities: agents.capabilities,
          })
          .from(agents)
          .where(and(...conditions))
          .all();

        return {
          content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }],
        };
      },
    );

    // Tool: list_products — returns product catalog
    server.tool(
      "list_products",
      "List active products in the ACP catalog",
      {
        agentId: z.string().optional().describe("Filter by agent ID"),
      },
      async (args) => {
        let rows = db
          .select()
          .from(agentProducts)
          .where(eq(agentProducts.active, 1))
          .all();

        if (args.agentId) {
          rows = rows.filter((r) => r.agentId === args.agentId);
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }],
        };
      },
    );

    // Tool: create_checkout — creates a checkout session
    server.tool(
      "create_checkout",
      "Create an ACP checkout session for purchasing agent services",
      {
        workspaceId: z.string().describe("Workspace ID for the checkout"),
        lineItems: z
          .array(
            z.object({
              productId: z.string(),
              quantity: z.number().int().positive(),
            }),
          )
          .describe("Products to purchase"),
        buyerAgentId: z.string().optional().describe("ID of the buying agent"),
        paymentProviderId: z.string().optional().describe("Payment provider to use"),
      },
      async (args) => {
        // Calculate total
        let totalCents = 0;
        for (const item of args.lineItems) {
          const product = db
            .select()
            .from(agentProducts)
            .where(eq(agentProducts.id, item.productId))
            .get();

          if (!product) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: `Product not found: ${item.productId}` }) }],
              isError: true,
            };
          }
          totalCents += product.priceCents * item.quantity;
        }

        const id = crypto.randomUUID();
        const now = Date.now();

        db.insert(checkoutSessions)
          .values({
            id,
            workspaceId: args.workspaceId,
            buyerAgentId: args.buyerAgentId ?? null,
            status: "open",
            lineItems: JSON.stringify(args.lineItems),
            totalCents,
            paymentProviderId: args.paymentProviderId ?? null,
            expiresAt: now + 30 * 60 * 1000,
          })
          .run();

        const session = db
          .select()
          .from(checkoutSessions)
          .where(eq(checkoutSessions.id, id))
          .get();

        return {
          content: [{ type: "text" as const, text: JSON.stringify(session, null, 2) }],
        };
      },
    );

    // Tool: get_task_status — gets task by ID
    server.tool(
      "get_task_status",
      "Get the current status of a task by ID",
      {
        taskId: z.string().describe("The task ID to look up"),
      },
      async (args) => {
        const task = db
          .select()
          .from(tasks)
          .where(eq(tasks.id, args.taskId))
          .get();

        if (!task) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Task not found" }) }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }],
        };
      },
    );

    // Tool: discover_agent — discovers an external agent by URL
    server.tool(
      "discover_agent",
      "Discover an external agent by fetching its agent card from a URL",
      {
        url: z.string().url().describe("The URL of the agent to discover"),
        workspaceId: z.string().describe("Workspace to register the agent in"),
      },
      async (args) => {
        try {
          // Try to fetch the agent card from /.well-known/agent.json
          const agentCardUrl = new URL("/.well-known/agent.json", args.url).toString();
          const response = await fetch(agentCardUrl);

          if (!response.ok) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: `Failed to fetch agent card: ${response.status}` }) }],
              isError: true,
            };
          }

          const agentCard = await response.json();

          // Register the discovered agent
          const agentId = crypto.randomUUID();
          db.insert(agents)
            .values({
              id: agentId,
              workspaceId: args.workspaceId,
              type: "remote",
              name: agentCard.name ?? "Unknown Agent",
              description: agentCard.description ?? "",
              url: args.url,
              status: "online",
              capabilities: JSON.stringify(agentCard.capabilities ?? {}),
              agentCardCache: JSON.stringify(agentCard),
              agentCardCachedAt: Date.now(),
            })
            .run();

          // Register discovered skills
          if (Array.isArray(agentCard.skills)) {
            for (const skill of agentCard.skills) {
              db.insert(agentSkills)
                .values({
                  id: crypto.randomUUID(),
                  agentId,
                  skillId: skill.id ?? crypto.randomUUID(),
                  name: skill.name ?? "Unknown Skill",
                  description: skill.description ?? "",
                  inputModes: JSON.stringify(skill.inputModes ?? []),
                  outputModes: JSON.stringify(skill.outputModes ?? []),
                  tags: JSON.stringify(skill.tags ?? []),
                })
                .run();
            }
          }

          const registered = db
            .select()
            .from(agents)
            .where(eq(agents.id, agentId))
            .get();

          return {
            content: [{ type: "text" as const, text: JSON.stringify({ agent: registered, agentCard }, null, 2) }],
          };
        } catch (err) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: `Discovery failed: ${err instanceof Error ? err.message : String(err)}` }) }],
            isError: true,
          };
        }
      },
    );
  },
  {
    capabilities: {},
  },
  {
    basePath: "/api/mcp",
  },
);

export { handler as GET, handler as POST, handler as DELETE };
