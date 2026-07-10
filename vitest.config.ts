import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const workspacePackageAliases = [
  {
    find: "@viselora/dom-webgl/react",
    replacement: fileURLToPath(
      new URL("./packages/dom-webgl-runtime/src/react.ts", import.meta.url),
    ),
  },
  {
    find: "@viselora/dom-webgl",
    replacement: fileURLToPath(
      new URL("./packages/dom-webgl-runtime/src/index.ts", import.meta.url),
    ),
  },
  {
    find: "@viselora/scroll-adapters/react",
    replacement: fileURLToPath(
      new URL(
        "./packages/dom-webgl-scroll-adapters/src/react.ts",
        import.meta.url,
      ),
    ),
  },
  {
    find: "@viselora/scroll-adapters",
    replacement: fileURLToPath(
      new URL(
        "./packages/dom-webgl-scroll-adapters/src/index.ts",
        import.meta.url,
      ),
    ),
  },
];

export default defineConfig({
  resolve: {
    alias: workspacePackageAliases,
  },
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
