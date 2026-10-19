#!/usr/bin/env node
// Grader calibration for round 2: builds reference pages and deliberately
// broken variants on the round-2 base (three 0.184 + R3F + drei), grades them
// with evals/skill-ab/scripts/grade.mjs and compares the failing items
// (10 core + 3 robust) with expectations. A case passes when every expected
// item fails and nothing outside expectFail ∪ allowFail fails.
//
//   node evals/skill-ab-v2/scripts/run-controls.mjs [--root DIR] [--only name,name]
// Requires run-eval.mjs --prepare-only to have prepared <root>/base and <root>/tools.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const v2Root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const v1Root = resolve(v2Root, "../skill-ab");
const repoRoot = resolve(v2Root, "../..");
const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};
const root = resolve(argValue("--root") ?? join(tmpdir(), "viselora-skill-ab-v2"));
if (!existsSync(join(root, "base/node_modules"))) throw new Error("run run-eval.mjs --prepare-only first");
const v1 = (name) => join(v1Root, "controls", name);
const v2 = (name) => join(v2Root, "controls", name);
const allCore = ["single_canvas", "dom_fallback", "ssr_safe", "cleanup", "scroll_resize", "pixels", "task_effect"];

const cases = [
  // Nothing built: only typecheck, build and imports pass.
  { name: "scaffold", task: "d", expectFail: [...allCore, "context_loss", "a11y_tree", "reduced_motion"] },
  // Round-1 references. Their idle spin / wave ignore prefers-reduced-motion.
  { name: "control-a", task: "a", app: v1("a-App.tsx"), viselora: true, expectFail: ["reduced_motion"] },
  { name: "control-b", task: "b", app: v1("b-App.tsx"), viselora: true, expectFail: [] },
  { name: "control-c", task: "c", app: v1("c-App.tsx"), viselora: true, expectFail: ["reduced_motion"] },
  // Pages assembled from the skill recipes. ModelTarget stops its idle spin
  // and TextWave sets its amplitude to 0 under reduced motion.
  { name: "recipe-a", task: "a", app: v1("recipe-a-App.tsx"), viselora: true, recipes: true, expectFail: [] },
  { name: "recipe-b", task: "b", app: v1("recipe-b-App.tsx"), viselora: true, recipes: true, expectFail: [] },
  { name: "recipe-c", task: "c", app: v1("recipe-c-App.tsx"), viselora: true, recipes: true, expectFail: [] },
  // Round-2 references, with and without Viselora.
  { name: "control-d", task: "d", app: v2("d-App.tsx"), viselora: true, expectFail: [] },
  { name: "native-d", task: "d", app: v2("native-d-App.tsx"), deps: ["react-error-boundary@^6.1.6"], expectFail: [] },
  { name: "control-e", task: "e", app: v2("e-App.tsx"), viselora: true, expectFail: [] },
  {
    // Objects keep the rect of their first frame: they do not follow scroll/resize.
    name: "broken-d-stale-rect",
    task: "d",
    app: v2("d-App.tsx"),
    viselora: true,
    edit: ["const { left, top, width, height } = target.rect;", "const { left, top, width, height } = (node.userData.rect ??= { ...target.rect });"],
    expectFail: ["scroll_resize"],
    allowFail: ["task_effect"],
  },
  {
    // Hover only: keyboard focus does not reach the scene.
    name: "broken-d-no-keyboard",
    task: "d",
    app: v2("d-App.tsx"),
    viselora: true,
    edit: ["onFocus={set(index)}", ""],
    expectFail: ["task_effect"],
  },
  {
    // No interaction at all.
    name: "broken-d-no-reaction",
    task: "d",
    app: v2("d-App.tsx"),
    viselora: true,
    edit: ["const on = active.current === index ? 1 : 0;", "const on = 0 * active.current;"],
    expectFail: ["task_effect"],
  },
  {
    // The scene stays centred on screen while the outro is shown.
    name: "broken-e-no-handoff",
    task: "e",
    app: v2("e-App.tsx"),
    viselora: true,
    edit: [
      ["node.position.y = Math.max(0, size.height - bottom);", "node.position.y = 0 * bottom;"],
      ["node.visible = bottom > 0;", "node.visible = true;"],
    ],
    expectFail: ["task_effect"],
  },
  {
    // Fallback removed from the accessibility tree once the model is ready.
    name: "broken-a-aria-hidden",
    task: "a",
    app: v1("a-App.tsx"),
    viselora: true,
    edit: ['runtime.setTargetReady("model", true, target);', 'runtime.setTargetReady("model", true, target);\n    target.element.setAttribute("aria-hidden", "true");'],
    expectFail: ["a11y_tree", "reduced_motion"],
  },
  {
    // Fallback hidden by hand instead of hideWhenReady: nothing restores it
    // when the WebGL context is lost.
    name: "broken-a-manual-hide",
    task: "a",
    app: v1("a-App.tsx"),
    viselora: true,
    edit: ['runtime.setTargetReady("model", true, target);', 'target.element.style.opacity = "0";'],
    expectFail: ["context_loss", "reduced_motion"],
  },
];

let mismatches = 0;
const only = argValue("--only")?.split(",");
for (const { name, task, app, edit, recipes, viselora, deps = [], expectFail, allowFail = [] } of cases) {
  if (only && !only.includes(name)) continue;
  const dir = join(root, "calibration", name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dirname(dir), { recursive: true });
  must(spawnSync("cp", ["-cR", join(root, "base"), dir], { stdio: "inherit" }));
  const install = [...(viselora ? ["@viselora/dom-webgl@0.2.0-alpha.1"] : []), ...deps];
  if (install.length)
    must(
      spawnSync("npm", ["install", "--no-audit", "--no-fund", "--save-exact", ...install], {
        cwd: dir,
        stdio: "inherit",
        env: { ...process.env, npm_config_registry: "https://registry.npmjs.org/" },
      }),
    );
  if (app) {
    let source = readFileSync(app, "utf8");
    for (const [from, to] of edit ? (Array.isArray(edit[0]) ? edit : [edit]) : []) {
      if (!source.includes(from)) throw new Error(`${name}: edit anchor not found`);
      source = source.replace(from, to);
    }
    writeFileSync(join(dir, "src/App.tsx"), source);
    if (recipes) cpSync(join(repoRoot, "skills/viselora-dom-webgl/recipes"), join(dir, "src/recipes"), { recursive: true });
  }
  must(
    spawnSync(process.execPath, [join(v1Root, "scripts/grade.mjs"), dir, "--task", task, "--tools", join(root, "tools")], {
      stdio: "inherit",
    }),
  );
  const grade = JSON.parse(readFileSync(join(dir, "grade.json"), "utf8"));
  const failed = Object.entries({ ...grade.scores, ...grade.robust })
    .filter(([, value]) => value < 1)
    .map(([key]) => key)
    .sort();
  const ok = expectFail.every((key) => failed.includes(key)) && failed.every((key) => expectFail.includes(key) || allowFail.includes(key));
  if (!ok) mismatches += 1;
  console.log(
    `${ok ? "OK  " : "MISMATCH"} ${name}: ${grade.total}/10, v2 ${grade.totalV2}/13, failing [${failed.join(", ")}], expected [${expectFail.join(", ")}]${allowFail.length ? ` (allowed [${allowFail.join(", ")}])` : ""}`,
  );
}
if (mismatches) process.exitCode = 1;

function must(result) {
  if (result.status !== 0) throw new Error("calibration step failed");
}
