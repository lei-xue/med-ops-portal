import { fileURLToPath } from "node:url";
import path from "node:path";

import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    // e2e/ holds the Playwright suite, run with `npm run test:e2e`.
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup-env.ts"],
    // All suites share the dockerized test database — run files sequentially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    server: {
      deps: {
        // next-auth imports "next/server" without an extension, which Node's
        // ESM loader rejects; let Vite resolve it (needed by the proxy tests).
        inline: ["next-auth"],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
});
