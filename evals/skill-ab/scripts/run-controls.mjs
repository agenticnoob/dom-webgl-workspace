#!/usr/bin/env node
// Grader calibration: builds the empty scaffold, the three hand-written
// reference implementations and deliberately broken variants in the temp eval
// root, grades them and compares the failing rubric items with expectations.
//
//   node evals/skill-ab/scripts/run-controls.mjs [--root DIR]
// Requires run-eval.mjs to have prepared <root>/base and <root>/tools.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const evalRoot = resolve(scriptDir, "..");
const rootIndex = process.argv.indexOf("--root");
const root = resolve(rootIndex === -1 ? join(tmpdir(), "viselora-skill-ab") : process.argv[rootIndex + 1]);
if (!existsSync(join(root, "base/node_modules"))) throw new Error("run run-eval.mjs first to prepare base/");

const cases = [
  { name: "scaffold", task: "a", expectFail: ["single_canvas", "dom_fallback", "ssr_safe", "cleanup", "scroll_resize", "pixels", "task_effect"] },
  { name: "control-a", task: "a", app: "a-App.tsx", expectFail: [] },
  { name: "control-b", task: "b", app: "b-App.tsx", expectFail: [] },
  { name: "control-c", task: "c", app: "c-App.tsx", expectFail: [] },
  {
    // Model drawn at the viewport centre instead of following the card.
    name: "broken-a-not-following",
    task: "a",
    app: "a-App.tsx",
    edit: ["node.position.set(left + width / 2 - size.width / 2, size.height / 2 - top - height / 2, 0);", "node.position.set(0, 0, 0);"],
    expectFail: ["scroll_resize", "task_effect"],
  },
  {
    // Time-based spin: the same scroll position no longer restores the same frame.
    name: "broken-b-time-animation",
    task: "b",
    app: "b-App.tsx",
    edit: ["node.rotation.set(progress * Math.PI, progress * Math.PI * 2, 0);", "node.rotation.set(progress * Math.PI, progress * Math.PI * 2, performance.now() / 300);"],
    expectFail: ["scroll_resize"],
  },
  {
    // WebGL text offset 40px to the right of the DOM heading.
    name: "broken-c-offset",
    task: "c",
    app: "c-App.tsx",
    edit: ["node.position.set(left + width / 2 - size.width / 2,", "node.position.set(left + 40 + width / 2 - size.width / 2,"],
    expectFail: ["scroll_resize", "task_effect"],
  },
  {
    // Texture captured once; a resize that re-wraps the heading leaves it stale.
    name: "broken-c-stale-texture",
    task: "c",
    app: "c-App.tsx",
    edit: ["if (target && target.revision !== revision) setRevision(target.revision);", "if (target && revision < 0) setRevision(target.revision);"],
    expectFail: ["scroll_resize"],
  },
];
const controlDeps = [
  "@viselora/dom-webgl@0.2.0-alpha.0",
  "@react-three/fiber@^9.3.0",
  "three@^0.184.0",
  "@types/three@^0.184.0",
];

let mismatches = 0;
for (const { name, task, app, edit, expectFail } of cases) {
  const dir = join(root, "calibration", name);
  rmSync(dir, { recursive: true, force: true });
  cpSync(join(root, "base"), dir, { recursive: true, verbatimSymlinks: true });
  if (app) {
    must(spawnSync("npm", ["install", "--no-audit", "--no-fund", ...controlDeps], { cwd: dir, stdio: "inherit" }));
    let source = readFileSync(join(evalRoot, "controls", app), "utf8");
    if (edit) {
      if (!source.includes(edit[0])) throw new Error(`${name}: edit anchor not found`);
      source = source.replace(edit[0], edit[1]);
    }
    writeFileSync(join(dir, "src/App.tsx"), source);
  }
  must(
    spawnSync(process.execPath, [join(scriptDir, "grade.mjs"), dir, "--task", task, "--tools", join(root, "tools")], {
      stdio: "inherit",
    }),
  );
  const grade = JSON.parse(readFileSync(join(dir, "grade.json"), "utf8"));
  const failed = Object.entries(grade.scores)
    .filter(([, value]) => value < 1)
    .map(([key]) => key)
    .sort();
  const ok = JSON.stringify(failed) === JSON.stringify([...expectFail].sort());
  if (!ok) mismatches += 1;
  console.log(`${ok ? "OK  " : "MISMATCH"} ${name}: ${grade.total}/10, failing [${failed.join(", ")}], expected [${expectFail.join(", ")}]`);
}
if (mismatches) process.exitCode = 1;

function must(result) {
  if (result.status !== 0) throw new Error("calibration step failed");
}
