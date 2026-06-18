import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const runtimeSourceRoot = path.join(
  workspaceRoot,
  "packages/dom-webgl-runtime/src",
);

const forbiddenDemoLiterals = [
  "demo.",
  "/demo/",
  "apps/demo",
  "@project/dom-webgl-demo",
  "/models/hero.glb",
] as const;

describe("open source implementation boundary", () => {
  test("records that the runtime is an open source implementation, not a demo-specific build", async () => {
    const agents = await readFile(path.join(workspaceRoot, "AGENTS.md"), "utf8");

    expect(agents).toContain("开源");
    expect(agents).toContain("demo");
    expect(agents).toContain("硬编码");
  });

  test("keeps demo-only literals out of runtime implementation source", async () => {
    const files = await collectImplementationFiles(runtimeSourceRoot);
    const violations: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");

      for (const literal of forbiddenDemoLiterals) {
        if (source.includes(literal)) {
          violations.push(`${path.relative(workspaceRoot, file)} contains ${literal}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

async function collectImplementationFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const nextPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectImplementationFiles(nextPath);
      }

      if (!entry.isFile()) {
        return [];
      }

      if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.includes(".test.")) {
        return [];
      }

      return [nextPath];
    }),
  );

  return files.flat();
}
