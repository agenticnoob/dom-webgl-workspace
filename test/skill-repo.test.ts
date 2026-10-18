import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { buildSkillRepo } from "../scripts/build-skill-repo.mjs";

const repoRoot = process.cwd();
const outputs: string[] = [];

afterEach(() => {
  for (const directory of outputs.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("generated skill repository", () => {
  test("contains only tracked skills, a README and the LICENSE", () => {
    const output = createOutput();
    const written = buildSkillRepo(repoRoot, output);
    const files = collect(output);

    expect(files).toEqual(written);
    expect(files.filter((file) => !file.startsWith("skills/"))).toEqual([
      "LICENSE",
      "README.md",
    ]);
    expect(files).toContain("skills/viselora-dom-webgl/SKILL.md");
    expect(files).toContain("skills/viselora-dom-webgl/recipes/TextWave.tsx");
    expect(files.some((file) => file.includes("node_modules"))).toBe(false);
    expect(readFileSync(join(output, "LICENSE"), "utf8")).toBe(
      readFileSync(join(repoRoot, "LICENSE"), "utf8"),
    );
  });

  test("names every skill after its directory and documents the install source", () => {
    const output = createOutput();
    buildSkillRepo(repoRoot, output);
    for (const name of readdirSync(join(output, "skills"))) {
      const skill = readFileSync(join(output, "skills", name, "SKILL.md"), "utf8");
      expect(skill).toMatch(new RegExp(`^---\\n(?:.*\\n)*?name: ${name}\\n`));
    }
    const readme = readFileSync(join(output, "README.md"), "utf8");
    expect(readme).toContain(
      "npx skills add agenticnoob/viselora-skills --skill viselora-dom-webgl",
    );
    expect(readme).toContain("This repository is generated");
  });

  test("refuses to write into a non-empty directory", () => {
    const output = createOutput();
    buildSkillRepo(repoRoot, output);
    expect(() => buildSkillRepo(repoRoot, output)).toThrow(/must be empty/);
  });
});

function createOutput(): string {
  const directory = mkdtempSync(resolve(tmpdir(), "viselora-skill-repo-"));
  outputs.push(directory);
  return join(directory, "out");
}

function collect(directory: string, root = directory): string[] {
  return readdirSync(directory)
    .flatMap((entry) => {
      const path = join(directory, entry);
      return statSync(path).isDirectory()
        ? collect(path, root)
        : [relative(root, path).split(sep).join("/")];
    })
    .sort();
}
