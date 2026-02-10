import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/__tests__/**/*.test.ts"],
    env: {
      NEXTAUTH_SECRET: "test-secret-for-vitest",
    },
    server: {
      deps: {
        inline: ["convex", "convex-test", "convex-ents"],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@convex": path.resolve(__dirname, "./convex"),
      // Next.js helper module; in tests we stub it to a no-op.
      "server-only": path.resolve(__dirname, "./src/__tests__/helpers/server-only.ts"),
    },
  },
});
