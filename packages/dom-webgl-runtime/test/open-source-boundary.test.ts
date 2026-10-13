import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

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
  test("records that the runtime is an open source implementation, not an app-specific build", async () => {
    const agents = await readFile(
      path.join(workspaceRoot, "AGENTS.md"),
      "utf8",
    );

    expect(agents).toContain("开源");
    expect(agents).toContain("example");
    expect(agents).toContain("app");
    expect(agents).toContain("硬编码");
  });

  test("keeps removed demo-only literals out of runtime implementation source", async () => {
    const files = await collectImplementationFiles(runtimeSourceRoot);
    const violations: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");

      for (const literal of forbiddenDemoLiterals) {
        if (source.includes(literal)) {
          violations.push(
            `${path.relative(workspaceRoot, file)} contains ${literal}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("keeps implementation imports independent of apps and Node APIs", async () => {
    const files = await collectImplementationFiles(runtimeSourceRoot);
    const violations: string[] = [];
    for (const file of files) {
      const source = ts.createSourceFile(
        file,
        await readFile(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      visit(source);
      function visit(node: ts.Node) {
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        ) {
          const name = node.moduleSpecifier.text;
          const resolved = path.resolve(path.dirname(file), name);
          if (
            name.startsWith("node:") ||
            resolved.startsWith(path.join(workspaceRoot, "apps") + path.sep) ||
            name.startsWith("@viselora/example")
          ) {
            violations.push(
              `${path.relative(workspaceRoot, file)} imports ${name}`,
            );
          }
        }
        ts.forEachChild(node, visit);
      }
    }
    expect(violations).toEqual([]);
  });

  test("delegates rendering to one R3F Canvas without a custom renderer engine", async () => {
    const files = await collectImplementationFiles(runtimeSourceRoot);
    let canvases = 0;
    const rendererConstructors: string[] = [];
    for (const file of files) {
      const source = ts.createSourceFile(
        file,
        await readFile(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      visit(source);
      function visit(node: ts.Node) {
        if (
          (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
          node.tagName.getText(source) === "Canvas"
        )
          canvases += 1;
        if (
          ts.isNewExpression(node) &&
          /(?:^|\.)WebGLRenderer$/.test(node.expression.getText(source))
        )
          rendererConstructors.push(file);
        ts.forEachChild(node, visit);
      }
    }
    expect(canvases).toBe(1);
    expect(rendererConstructors).toEqual([]);
  });
});

async function collectImplementationFiles(
  directory: string,
): Promise<string[]> {
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
