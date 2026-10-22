#!/usr/bin/env node
// Round-3 analysis on top of the results.json written by
// evals/skill-ab-v2/scripts/report.mjs (which grades and aggregates the runs).
// Adds the round-3 questions: prompt variant (minimal vs full), Claude vs
// codex, browser-check success in S/VS, and a comparison with round 2.
//
//   node evals/skill-ab-v3/scripts/analyze.mjs [--results results.json]
//     [--v2 evals/skill-ab-v2/results.json] [--out analysis.json] [--md analysis.md]
//     [--root DIR]   run directories, for the WebGL-probe sensitivity check
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fisherP, meanOf, permutationP, round } from "../../skill-ab-v2/scripts/stats.mjs";

const v3Root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const rows = JSON.parse(readFileSync(resolve(option("results") ?? join(v3Root, "results.json")), "utf8")).rows.filter((r) => !r.infraError);
const v2Rows = JSON.parse(readFileSync(resolve(option("v2") ?? join(v3Root, "../skill-ab-v2/results.json")), "utf8")).rows.filter((r) => !r.infraError);
const robust = ["context_loss", "a11y_tree", "reduced_motion"];
const conditions = ["N", "V", "S", "VS"];
const configs = [...new Set(rows.map((r) => r.baseConfig))].sort();
const prompts = ["minimal", "full"].filter((p) => rows.some((r) => r.prompt === p));
const pick = (list, filter) => list.filter((r) => Object.entries(filter).every(([key, value]) => r[key] === value));
const scores = (list) => list.map((r) => r.totalV2);
const blank = (list) => list.filter((r) => r.scores.pixels === 0).length;
const items = ["single_canvas", "dom_fallback", "ssr_safe", "cleanup", "scroll_resize", "public_imports", "typecheck", "build", "pixels", "task_effect", ...robust];
const runsRoot = option("root") ? join(resolve(option("root")), "runs") : null;

// 1. Cell means.
const cells = [];
for (const baseConfig of configs)
  for (const prompt of prompts)
    for (const condition of conditions) {
      const group = pick(rows, { baseConfig, prompt, condition });
      if (!group.length) continue;
      cells.push({
        baseConfig,
        prompt,
        condition,
        n: group.length,
        totalV2: round(meanOf(scores(group))),
        core: round(meanOf(group.map((r) => r.total))),
        ...Object.fromEntries(robust.map((key) => [key, round(meanOf(group.map((r) => r.robust[key])))])),
        items: Object.fromEntries(items.map((key) => [key, round(meanOf(group.map((r) => r.scores[key] ?? r.robust[key])))])),
        noWebGL: blank(group),
        usesViselora: group.filter((r) => r.usesViselora).length,
        minutes: round(meanOf(group.map((r) => (r.agentExit.durationMs ?? 0) / 60000)), 1),
        costUsd: group[0].agent === "claude" ? round(meanOf(group.map((r) => r.process.costUsd ?? 0))) : null,
        sourceLines: Math.round(meanOf(group.map((r) => r.apiUsage.sourceLines))),
      });
    }

// 2. N versus each Viselora condition, and N versus the three pooled.
const versusN = [];
for (const baseConfig of configs)
  for (const prompt of prompts) {
    const n = pick(rows, { baseConfig, prompt, condition: "N" });
    if (!n.length) continue;
    for (const other of ["V", "S", "VS", "V+S+VS"]) {
      const b = other === "V+S+VS" ? rows.filter((r) => r.baseConfig === baseConfig && r.prompt === prompt && r.condition !== "N") : pick(rows, { baseConfig, prompt, condition: other });
      if (!b.length) continue;
      versusN.push({
        baseConfig,
        prompt,
        b: other,
        n: [n.length, b.length],
        meanN: round(meanOf(scores(n))),
        meanB: round(meanOf(scores(b))),
        p: permutationP(scores(n), scores(b)),
        noWebGL: [blank(n), blank(b)],
        fisherP: fisherP(blank(n), n.length - blank(n), blank(b), b.length - blank(b)),
      });
    }
  }

// 3. Prompt effect within each config × condition (minimal vs full).
const promptEffect = [];
for (const baseConfig of configs)
  for (const condition of [...conditions, "V+S+VS"]) {
    const of = (prompt) =>
      condition === "V+S+VS"
        ? rows.filter((r) => r.baseConfig === baseConfig && r.prompt === prompt && r.condition !== "N")
        : pick(rows, { baseConfig, prompt, condition });
    const [full, minimal] = [of("full"), of("minimal")];
    if (!full.length || !minimal.length) continue;
    promptEffect.push({
      baseConfig,
      condition,
      n: [full.length, minimal.length],
      meanFull: round(meanOf(scores(full))),
      meanMinimal: round(meanOf(scores(minimal))),
      p: permutationP(scores(full), scores(minimal)),
      robustFull: Object.fromEntries(robust.map((key) => [key, round(meanOf(full.map((r) => r.robust[key])))])),
      robustMinimal: Object.fromEntries(robust.map((key) => [key, round(meanOf(minimal.map((r) => r.robust[key])))])),
    });
  }

// 4. Interaction: is the Viselora advantage larger under the minimal prompt?
// D = (pooled Viselora − N | minimal) − (pooled Viselora − N | full), with a
// seeded stratified bootstrap 95% interval (resampling runs within each of the
// four groups).
const interaction = [];
for (const baseConfig of configs) {
  const group = (prompt, native) => scores(rows.filter((r) => r.baseConfig === baseConfig && r.prompt === prompt && (r.condition === "N") === native));
  const parts = [group("minimal", true), group("minimal", false), group("full", true), group("full", false)];
  if (parts.some((part) => !part.length)) continue;
  const statistic = ([nm, vm, nf, vf]) => meanOf(vm) - meanOf(nm) - (meanOf(vf) - meanOf(nf));
  let seed = 4242;
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const boot = [];
  for (let i = 0; i < 10000; i += 1) boot.push(statistic(parts.map((part) => part.map(() => part[Math.floor(random() * part.length)]))));
  boot.sort((a, b) => a - b);
  interaction.push({
    baseConfig,
    gapMinimal: round(meanOf(parts[1]) - meanOf(parts[0])),
    gapFull: round(meanOf(parts[3]) - meanOf(parts[2])),
    diffInDiff: round(statistic(parts)),
    ci95: [round(boot[249]), round(boot[9749])],
  });
}

// 5. Skill process in S / VS: selection, verify-consumer, browser-check.
const skillProcess = [];
for (const baseConfig of configs)
  for (const prompt of prompts)
    for (const condition of ["S", "VS"]) {
      const group = pick(rows, { baseConfig, prompt, condition });
      if (!group.length) continue;
      const count = (fn) => group.filter(fn).length;
      skillProcess.push({
        baseConfig,
        prompt,
        condition,
        n: group.length,
        skillUsed: count((r) => r.process.skillCalls),
        usesViselora: count((r) => r.usesViselora),
        verifyConsumerPassed: count((r) => r.verifyConsumerPassed),
        browserCheckInvoked: count((r) => r.process.browserCheck?.invoked),
        browserCheckProduced: count((r) => r.process.browserCheck?.produced),
        browserCheckAllPass: count((r) => r.process.browserCheck?.allPass),
        driverMissingMessage: count((r) => r.process.browserCheck?.driverMissing),
        installedDriver: count((r) => r.process.browserCheck?.installedDriver),
        installedBeforeFirstCheck: count((r) => r.process.browserCheck?.installedBeforeFirstCheck),
        anyPassFailV2Style: count((r) => r.process.browserCheck?.anyPassFail),
        egoBrowser: count((r) => r.process.browserCheck?.egoBrowser),
      });
    }

// 6. Round 2 versus round 3 (same config, full prompt): alpha.1 + three 0.184
// against alpha.2 + three 0.186 (and codex-cli 0.160 against 0.163).
const versusV2 = [];
for (const baseConfig of configs)
  for (const condition of conditions) {
    const before = pick(v2Rows, { config: baseConfig, condition });
    const after = pick(rows, { baseConfig, prompt: "full", condition });
    if (!before.length || !after.length) continue;
    versusV2.push({
      baseConfig,
      condition,
      n: [before.length, after.length],
      meanV2: round(meanOf(scores(before))),
      meanV3: round(meanOf(scores(after))),
      p: permutationP(scores(before), scores(after)),
      noWebGL: [blank(before), blank(after)],
    });
  }

// 7. Sensitivity: runs that draw with exactly one canvas but leave extra live
// contexts from a "does this browser support WebGL?" probe
// (document.createElement("canvas").getContext(...)) fail single_canvas and
// part of cleanup. Recompute their score as if the probe released its context.
const probe = [];
if (runsRoot)
  for (const r of rows) {
    const dir = join(runsRoot, r.id);
    const grade = JSON.parse(readFileSync(join(dir, "grade.json"), "utf8"));
    const checkpoints = grade.details.browser?.checkpoints ?? [];
    const cleanup = grade.details.cleanup ?? {};
    const source = sourceText(join(dir, "src"));
    const probing = /createElement\(\s*["'`]canvas["'`]\s*\)/.test(source) && /getContext\(\s*["'`](webgl2?|experimental-webgl)["'`]/.test(source);
    const oneCanvas = checkpoints.length > 0 && checkpoints.every((c) => c.canvasCount === 1);
    const extra = checkpoints.some((c) => c.liveContexts > 1);
    if (!(probing && oneCanvas && extra)) continue;
    const checks = { ...cleanup.checks, contextsReleased: true, remountWorks: cleanup.remounted?.canvasCount === 1 };
    const fixedCleanup = meanOf(Object.values(checks));
    const adjusted = r.totalV2 - r.scores.single_canvas - r.scores.cleanup + 1 + fixedCleanup;
    probe.push({ id: r.id, baseConfig: r.baseConfig, prompt: r.prompt, condition: r.condition, totalV2: r.totalV2, adjusted: round(adjusted) });
  }
const probeCells = cells.map((c) => {
  const group = pick(rows, { baseConfig: c.baseConfig, prompt: c.prompt, condition: c.condition });
  const adjustedOf = (r) => probe.find((p) => p.id === r.id)?.adjusted ?? r.totalV2;
  return { ...c, probeRuns: group.filter((r) => probe.some((p) => p.id === r.id)).length, adjustedTotalV2: round(meanOf(group.map(adjustedOf))) };
});

// 8. The codex CLI loads the operator's user-level skills; count runs that
// verified pages with the globally installed ego-browser skill.
const egoBrowser = cells.map((c) => ({
  ...c,
  egoBrowser: pick(rows, { baseConfig: c.baseConfig, prompt: c.prompt, condition: c.condition }).filter((r) => r.process.browserCheck?.egoBrowser).length,
}));

// 9. Low-scoring runs, for the failure write-up.
const failures = rows
  .filter((r) => r.totalV2 < 12.5)
  .sort((a, b) => a.totalV2 - b.totalV2)
  .map((r) => ({
    id: r.id,
    totalV2: r.totalV2,
    failing: Object.entries({ ...r.scores, ...r.robust })
      .filter(([, value]) => value < 1)
      .map(([key, value]) => `${key}=${round(value)}`),
    usesViselora: r.usesViselora,
  }));

const analysis = { generatedAt: new Date().toISOString(), cells, versusN, promptEffect, interaction, skillProcess, versusV2, probe, failures };
writeFileSync(resolve(option("out") ?? join(v3Root, "analysis.json")), `${JSON.stringify(analysis, null, 2)}\n`);

const table = (head, list) => [row(head), row(head.map(() => "---")), ...list.map(row)].join("\n");
const bold = (p) => (p < 0.001 ? "**<0.001**" : p <= 0.05 ? `**${p}**` : p);
const markdown = [
  "## Cell means (totalV2 /13)",
  table(
    ["config", "prompt", "cond", "n", "v2", "core", ...robust, "no WebGL", "Viselora", "min", "$/run", "lines"],
    cells.map((c) => [c.baseConfig, c.prompt, c.condition, c.n, c.totalV2, c.core, ...robust.map((k) => c[k]), c.noWebGL, c.usesViselora, c.minutes, c.costUsd ?? "-", c.sourceLines]),
  ),
  "## Item means (1 = pass)",
  table(
    ["config", "prompt", "cond", ...items.map((k) => k.replace(/_/g, " "))],
    cells.map((c) => [c.baseConfig, c.prompt, c.condition, ...items.map((k) => c.items[k])]),
  ),
  "## WebGL-probe sensitivity (extra probe contexts forgiven) and ego-browser use",
  table(
    ["config", "prompt", "cond", "n", "v2", "probe runs", "v2 adjusted", "ego-browser runs"],
    probeCells.map((c, index) => [c.baseConfig, c.prompt, c.condition, c.n, c.totalV2, c.probeRuns, c.adjustedTotalV2, egoBrowser[index].egoBrowser]),
  ),
  "## N versus Viselora conditions (run-level permutation; Fisher on no-WebGL runs)",
  table(
    ["config", "prompt", "N → B", "n", "mean N", "mean B", "p", "no WebGL N / B", "p (Fisher)"],
    versusN.map((c) => [c.baseConfig, c.prompt, `N → ${c.b}`, c.n.join(" / "), c.meanN, c.meanB, bold(c.p), c.noWebGL.join(" / "), bold(c.fisherP)]),
  ),
  "## Prompt effect (full → minimal)",
  table(
    ["config", "cond", "n full / minimal", "full", "minimal", "p", ...robust.map((k) => `${k} full → minimal`)],
    promptEffect.map((c) => [c.baseConfig, c.condition, c.n.join(" / "), c.meanFull, c.meanMinimal, bold(c.p), ...robust.map((k) => `${c.robustFull[k]} → ${c.robustMinimal[k]}`)]),
  ),
  "## Interaction: Viselora gain under minimal minus gain under full",
  table(
    ["config", "gain (minimal)", "gain (full)", "difference", "bootstrap 95% CI"],
    interaction.map((c) => [c.baseConfig, c.gapMinimal, c.gapFull, c.diffInDiff, `[${c.ci95.join(", ")}]`]),
  ),
  "## Skill process (S / VS)",
  table(
    ["config", "prompt", "cond", "n", "skill used", "Viselora", "verify-consumer", "browser-check invoked", "PASS/FAIL printed", "all PASS", "driver-missing msg", "driver installed", "installed before check", "any PASS/FAIL (v2 style)", "ego-browser"],
    skillProcess.map((c) => [
      c.baseConfig,
      c.prompt,
      c.condition,
      c.n,
      c.skillUsed,
      c.usesViselora,
      c.verifyConsumerPassed,
      c.browserCheckInvoked,
      c.browserCheckProduced,
      c.browserCheckAllPass,
      c.driverMissingMessage,
      c.installedDriver,
      c.installedBeforeFirstCheck,
      c.anyPassFailV2Style,
      c.egoBrowser,
    ]),
  ),
  "## Round 2 → round 3 (full prompt)",
  table(
    ["config", "cond", "n v2 / v3", "v2", "v3", "p", "no WebGL v2 / v3"],
    versusV2.map((c) => [c.baseConfig, c.condition, c.n.join(" / "), c.meanV2, c.meanV3, bold(c.p), c.noWebGL.join(" / ")]),
  ),
  "## Runs below 12.5",
  table(
    ["run", "v2", "failing", "Viselora"],
    failures.map((f) => [f.id, f.totalV2, f.failing.join(", "), f.usesViselora ? "yes" : "-"]),
  ),
].join("\n\n");
if (option("md")) writeFileSync(resolve(option("md")), `${markdown}\n`);
console.log(markdown);

function sourceText(directory) {
  if (!existsSync(directory)) return "";
  return readdirSync(directory, { withFileTypes: true })
    .map((entry) =>
      entry.isDirectory() ? sourceText(join(directory, entry.name)) : /\.[cm]?[jt]sx?$/.test(entry.name) ? readFileSync(join(directory, entry.name), "utf8") : "",
    )
    .join("\n");
}

function row(cells) {
  return `| ${cells.join(" | ")} |`;
}
