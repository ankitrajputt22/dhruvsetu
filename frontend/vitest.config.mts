import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next.js keeps JSX as it is, so the tests need their own JSX setting.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
