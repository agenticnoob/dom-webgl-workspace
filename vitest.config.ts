import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    testTimeout: 30_000,
    include: [
      "**/*.test.ts",
      "**/*.test.tsx"
    ]
  }
});
