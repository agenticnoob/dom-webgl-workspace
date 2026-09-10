import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, test } from "vitest";

const repoRoot = process.cwd();
const docsRoot = resolve(repoRoot, "docs");

const activeDocs = [
  "ARCHITECTURE.md",
  "README.md",
  "STATUS.md",
  "guides/effects.md",
  "guides/getting-started.md",
  "guides/scroll.md",
];

describe("repository documentation governance", () => {
  test("keeps the root and active docs surfaces intentionally small", () => {
    const rootMarkdown = readdirSync(repoRoot)
      .filter((entry) => entry.endsWith(".md"))
      .sort();
    const docsMarkdown = collectMarkdown(docsRoot)
      .filter((file) => !file.includes(`${sep}archive${sep}`))
      .map((file) => displayFrom(docsRoot, file))
      .sort();

    expect(rootMarkdown).toEqual([
      "AGENTS.md",
      "CONTRIBUTING.md",
      "README.md",
    ]);
    expect(docsMarkdown).toEqual(activeDocs);

    for (const retiredDirectory of [
      "agent",
      "examples",
      "new-project",
      "performance",
      "roadmap",
      "superpowers",
    ]) {
      expect(existsSync(resolve(docsRoot, retiredDirectory))).toBe(false);
    }
  });

  test("separates entrypoint responsibilities and prevents document dumping", () => {
    const rootReadme = read("README.md");
    const contributing = read("CONTRIBUTING.md");
    const agents = read("AGENTS.md");
    const docsIndex = read("docs/README.md");
    const status = read("docs/STATUS.md");
    const architecture = read("docs/ARCHITECTURE.md");

    for (const heading of [
      "## Install",
      "## Quick start",
      "## Repository layout",
      "## Documentation",
    ]) {
      expect(rootReadme).toContain(heading);
    }
    expect(contributing).toContain("## Development workflow");
    expect(contributing).toContain("## Documentation responsibilities");

    for (const heading of [
      "## Read order",
      "## Repository boundaries",
      "## Verification",
      "## Documentation rules",
    ]) {
      expect(agents).toContain(heading);
    }

    expect(docsIndex).toContain("## Document responsibilities");
    expect(docsIndex).toContain("Archived documents are not current truth");
    expect(status).toContain("**Last verified:");
    expect(status).toContain("0.1.0-alpha.2");
    expect(architecture).toContain("DOM element");
    expect(architecture).toContain("runtime-owned");

    expect(lineCount(rootReadme)).toBeLessThanOrEqual(260);
    expect(lineCount(contributing)).toBeLessThanOrEqual(220);
    expect(lineCount(agents)).toBeLessThanOrEqual(180);
    expect(lineCount(status)).toBeLessThanOrEqual(240);
    expect(lineCount(architecture)).toBeLessThanOrEqual(240);

    for (const guide of [
      "docs/guides/getting-started.md",
      "docs/guides/effects.md",
      "docs/guides/scroll.md",
    ]) {
      expect(lineCount(read(guide))).toBeLessThanOrEqual(320);
    }
  });

  test("keeps package versions and status truth aligned", () => {
    const corePackage = readJson("packages/dom-webgl-runtime/package.json");
    const adapterPackage = readJson(
      "packages/dom-webgl-scroll-adapters/package.json",
    );
    const status = read("docs/STATUS.md");

    expect(corePackage.version).toBe("0.1.0-alpha.2");
    expect(adapterPackage.version).toBe(corePackage.version);
    expect(
      adapterPackage.dependencies?.["@viselora/dom-webgl"],
    ).toBe(corePackage.version);
    expect(status).toContain(`@viselora/dom-webgl@${corePackage.version}`);
    expect(status).toContain(
      `@viselora/scroll-adapters@${adapterPackage.version}`,
    );
  });

  test("gives every workspace and archive an owner-local entrypoint", () => {
    for (const directory of [
      "apps/example",
      "apps/hero-next",
      "packages/dom-webgl-runtime",
      "packages/dom-webgl-scroll-adapters",
      "docs/archive",
    ]) {
      expect(existsSync(resolve(repoRoot, directory, "README.md"))).toBe(true);
    }

    const archiveReadme = read("docs/archive/README.md");
    expect(archiveReadme).toContain("not current truth");
  });

  test("keeps local links in active documentation valid", () => {
    const files = [
      resolve(repoRoot, "README.md"),
      resolve(repoRoot, "CONTRIBUTING.md"),
      resolve(repoRoot, "AGENTS.md"),
      ...collectMarkdown(docsRoot).filter(
        (file) => !file.includes(`${sep}archive${sep}`),
      ),
      ...collectMarkdown(resolve(repoRoot, "apps")).filter(
        (file) =>
          !file.includes(`${sep}.next${sep}`) &&
          !file.includes(`${sep}node_modules${sep}`),
      ),
      ...collectMarkdown(resolve(repoRoot, "packages")).filter(
        (file) =>
          !file.includes(`${sep}dist${sep}`) &&
          !file.includes(`${sep}node_modules${sep}`),
      ),
      ...collectMarkdown(resolve(repoRoot, "skills")).filter(
        (file) => !file.includes(`${sep}node_modules${sep}`),
      ),
    ];

    const broken = files.flatMap((file) =>
      localMarkdownLinks(file)
        .filter((target) => !existsSync(resolve(dirname(file), target)))
        .map((target) => `${display(file)} -> ${target}`),
    );

    expect(broken).toEqual([]);
  });

  test("type-checks marked public TypeScript examples", () => {
    const examples = [
      ...compileExamples(resolve(repoRoot, "README.md")),
      ...compileExamples(resolve(docsRoot, "guides/getting-started.md")),
      ...compileExamples(resolve(docsRoot, "guides/effects.md")),
    ];
    const temporaryDirectory = mkdtempSync(
      resolve(tmpdir(), "viselora-documentation-"),
    );

    try {
      for (const example of examples) {
        writeFileSync(
          resolve(temporaryDirectory, `${example.name}.tsx`),
          example.source,
        );
      }
      writeFileSync(
        resolve(temporaryDirectory, "tsconfig.json"),
        JSON.stringify(
          {
            extends: resolve(repoRoot, "tsconfig.base.json"),
            compilerOptions: {
              baseUrl: repoRoot,
              noEmit: true,
              types: [],
              paths: {
                "@viselora/dom-webgl": [
                  "packages/dom-webgl-runtime/src/index.ts",
                ],
                "@viselora/dom-webgl/react": [
                  "packages/dom-webgl-runtime/src/react.ts",
                ],
                react: ["node_modules/@types/react/index.d.ts"],
                "react/jsx-runtime": [
                  "node_modules/@types/react/jsx-runtime.d.ts",
                ],
              },
            },
            include: ["*.tsx"],
          },
          null,
          2,
        ),
      );

      expect(examples.map((example) => example.name)).toEqual([
        "root-quick-start",
        "getting-started-runtime",
        "target-effect-definition",
        "scene-object-effect-definition",
      ]);
      const result = spawnSync(
        resolve(repoRoot, "node_modules/.bin/tsc"),
        ["-p", resolve(temporaryDirectory, "tsconfig.json")],
        {
          cwd: repoRoot,
          encoding: "utf8",
          stdio: "pipe",
        },
      );
      expect(`${result.stdout}${result.stderr}`).toBe("");
      expect(result.status).toBe(0);
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});

function collectMarkdown(directory: string): string[] {
  if (!existsSync(directory)) return [];

  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) return collectMarkdown(path);
    return path.endsWith(".md") ? [path] : [];
  });
}

function localMarkdownLinks(file: string): string[] {
  const content = readFileSync(file, "utf8");
  return [...content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
    .map((match) => match[1].trim())
    .filter(
      (target) =>
        !target.startsWith("#") &&
        !target.startsWith("/") &&
        !/^[a-z][a-z0-9+.-]*:/i.test(target),
    )
    .map((target) => target.replace(/^<|>$/g, "").split("#", 1)[0])
    .filter(Boolean)
    .map((target) => decodeURIComponent(target));
}

function compileExamples(file: string): Array<{
  name: string;
  source: string;
}> {
  const content = readFileSync(file, "utf8");
  return [
    ...content.matchAll(
      /<!-- compile-tsx:([a-z0-9-]+) -->\s*```(?:ts|tsx)\n([\s\S]*?)\n```/g,
    ),
  ].map((match) => ({
    name: match[1],
    source: match[2],
  }));
}

function read(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function readJson(path: string): {
  version?: string;
  dependencies?: Record<string, string>;
} {
  return JSON.parse(read(path));
}

function lineCount(content: string): number {
  return content.split("\n").length;
}

function display(file: string): string {
  return displayFrom(repoRoot, file);
}

function displayFrom(root: string, file: string): string {
  return relative(root, file).split(sep).join("/");
}
