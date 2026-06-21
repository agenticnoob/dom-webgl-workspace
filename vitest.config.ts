import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 30_000,
    include: [
      "**/*.test.ts",
      "**/*.test.tsx"
    ]
  }
});
