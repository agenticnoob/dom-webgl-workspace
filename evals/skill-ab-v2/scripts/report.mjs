#!/usr/bin/env node
// Grades every finished round-2 run with evals/skill-ab/scripts/grade.mjs
// (unless already graded), then aggregates scores, process metrics and
// condition comparisons into results.json and Markdown tables.
//
//   node evals/skill-ab-v2/scripts/report.mjs [--root DIR] [--regrade]
//     [--concurrency 2] [--out results.json] [--md report.md]
//
// Runs whose agent hit a usage limit or auth failure (agent-done.json
// infraError) are listed but excluded from every aggregate.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const v2Root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const grader = resolve(v2Root, "../skill-ab/scripts/grade.mjs");
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const root = resolve(option("root") ?? join(tmpdir(), "viselora-skill-ab-v2"));
const regrade = args.includes("--regrade");
const concurrency = Number(option("concurrency") ?? 2);
const runsDir = join(root, "runs");
const core = ["single_canvas", "dom_fallback", "ssr_safe", "cleanup", "scroll_resize", "public_imports", "typecheck", "build", "pixels", "task_effect"];
const robust = ["context_loss", "a11y_tree", "reduced_motion"];

const ids = readdirSync(runsDir)
  .sort()
  .filter((id) => existsSync(join(runsDir, id, "agent-done.json")));
const pending = ids.filter((id) => regrade || !existsSync(join(runsDir, id, "grade.json")));
let cursor = 0;
await Promise.all(
  Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
    while (cursor < pending.length) {
      const id = pending[cursor++];
      const code = await new Promise((done) => {
        const child = spawn(process.execPath, [grader, join(runsDir, id), "--tools", join(root, "tools")], { stdio: "inherit" });
        const timer = setTimeout(() => child.kill("SIGKILL"), 1_500_000);
        child.on("close", (status) => {
          clearTimeout(timer);
          done(status);
        });
      });
      if (code !== 0) console.error(`grading ${id} failed`);
    }
  }),
);

const rows = [];
for (const id of ids) {
  const dir = join(runsDir, id);
  const meta = JSON.parse(readFileSync(join(dir, "agent-done.json"), "utf8"));
  if (!existsSync(join(dir, "grade.json"))) continue;
  const grade = JSON.parse(readFileSync(join(dir, "grade.json"), "utf8"));
  rows.push({
    id,
    config: meta.config,
    agent: meta.agent,
    task: meta.task,
    condition: meta.condition,
    rep: meta.rep,
    infraError: meta.infraError ?? null,
    total: grade.total,
    totalV2: grade.totalV2,
    scores: grade.scores,
    robust: grade.robust,
    verifyConsumerPassed: grade.details.static.verifyConsumerPassed,
    verifyConsumerViolations: grade.details.static.verifyConsumerViolations,
    usesViselora: grade.details.static.usesViselora,
    viselora: viseloraInstall(dir),
    apiUsage: apiUsage(dir),
    process: processMetrics(dir, meta.agent),
    agentExit: { exitCode: meta.exitCode, timedOut: meta.timedOut, durationMs: meta.durationMs },
    browserNotes: grade.notes,
  });
}

const valid = rows.filter((row) => !row.infraError);
const output = resolve(option("out") ?? join(root, "results.json"));
const comparisons = compareConditions(valid);
writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), comparisons, rows }, null, 2));
const markdown = [
  "## Per run",
  perRunTable(rows),
  "## Condition × config (mean)",
  aggregateTable(valid, (row) => `${row.config} ${row.condition}`),
  "## Condition (all configs)",
  aggregateTable(valid, (row) => row.condition),
  "## Condition × task (all configs, mean totalV2)",
  taskTable(valid),
  "## Paired comparisons (cell = config × task, mean over reps)",
  comparisonTable(comparisons),
  "## Process",
  processTable(valid),
].join("\n\n");
if (option("md")) writeFileSync(resolve(option("md")), `${markdown}\n`);
console.log(`wrote ${output}\n\n${markdown}`);

// ---------- extraction ----------
function viseloraInstall(dir) {
  const pkg = readJson(join(dir, "package.json")) ?? {};
  const spec = { ...pkg.dependencies, ...pkg.devDependencies };
  const installed = readJson(join(dir, "node_modules/@viselora/dom-webgl/package.json"))?.version ?? null;
  return {
    spec: spec["@viselora/dom-webgl"] ?? null,
    scrollAdaptersSpec: spec["@viselora/scroll-adapters"] ?? null,
    installed,
    three: readJson(join(dir, "node_modules/three/package.json"))?.version ?? null,
  };
}

function apiUsage(dir) {
  const names = [
    "WebGLRuntime",
    "WebGLScrollRuntime",
    "WebGLTarget",
    "useDOMTarget",
    "setTargetReady",
    "hideWhenReady",
    "createDOMTextTexture",
    "drawDOMText",
    "createScrollEffectProgressStore",
    "View",
    "Html",
    "ScrollControls",
    "useScroll",
    "Text",
    "useGLTF",
    "useProgress",
    "GLTFLoader",
    "matchMedia",
    "webglcontextlost",
    "prefers-reduced-motion",
    "aria-hidden",
    "display: \"none\"",
  ];
  const source = sourceFiles(join(dir, "src"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  const recipes = sourceFiles(join(dir, "src")).filter((file) => /ModelTarget|ScrollStory|TextWave/.test(file)).length;
  return {
    used: names.filter((name) => new RegExp(`(^|[^A-Za-z])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z]|$)`).test(source)),
    sourceLines: source.split("\n").length,
    recipeFiles: recipes,
    drei: /@react-three\/drei/.test(source),
  };
}

function sourceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sourceFiles(join(directory, entry.name))
      : /\.[cm]?[jt]sx?$/.test(entry.name)
        ? [join(directory, entry.name)]
        : [],
  );
}

function processMetrics(dir, agent) {
  const path = join(dir, ".eval-transcript.jsonl");
  if (!existsSync(path)) return {};
  const text = readFileSync(path, "utf8");
  const lines = text
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  const metrics = {
    skillFilesTouched: [...new Set(text.match(/skills\/viselora-dom-webgl\/[A-Za-z0-9_./-]+\.(?:md|mjs|json|tsx?)/g) ?? [])],
    readPackageDist: /@viselora\/dom-webgl\/dist/.test(text),
    ranVerifyConsumer: /verify-consumer\.mjs/.test(text),
    ranBrowserCheck: /browser-check\.mjs/.test(text),
  };
  if (agent === "claude") {
    const result = lines.find((line) => line.type === "result");
    metrics.model = lines.find((line) => line.subtype === "init")?.model;
    metrics.costUsd = result?.total_cost_usd;
    metrics.turns = result?.num_turns;
    metrics.outputTokens = result?.usage?.output_tokens;
    metrics.skillCalls = lines
      .filter((line) => line.type === "assistant")
      .flatMap((line) => line.message?.content ?? [])
      .filter((part) => part.type === "tool_use" && part.name === "Skill" && /viselora/.test(JSON.stringify(part.input ?? {}))).length;
  } else {
    const usage = lines.filter((line) => line.type === "turn.completed").map((line) => line.usage ?? {});
    metrics.inputTokens = usage.reduce((sum, u) => sum + (u.input_tokens ?? 0), 0);
    metrics.cachedInputTokens = usage.reduce((sum, u) => sum + (u.cached_input_tokens ?? 0), 0);
    metrics.outputTokens = usage.reduce((sum, u) => sum + (u.output_tokens ?? 0), 0);
    metrics.commands = lines.filter((line) => line.item?.type === "command_execution" && line.type === "item.completed").length;
    metrics.skillCalls = /skills\/viselora-dom-webgl\/SKILL\.md/.test(text) ? 1 : 0;
  }
  return metrics;
}

// ---------- statistics ----------
// For each pair of conditions: one paired difference per (config, task) cell,
// using the mean over reps; exact two-sided sign-flip permutation p-value.
function compareConditions(list) {
  const conditions = [...new Set(list.map((row) => row.condition))].sort();
  const metrics = {
    totalV2: (row) => row.totalV2,
    core: (row) => row.total,
    robust: (row) => robust.reduce((sum, key) => sum + row.robust[key], 0),
    ...Object.fromEntries([...core, ...robust].map((key) => [key, (row) => row.scores[key] ?? row.robust[key]])),
  };
  const out = [];
  for (let i = 0; i < conditions.length; i += 1)
    for (let j = i + 1; j < conditions.length; j += 1) {
      const [x, y] = [conditions[i], conditions[j]];
      for (const [name, pick] of Object.entries(metrics)) {
        const diffs = [];
        for (const cell of new Set(list.map((row) => `${row.config}|${row.task}`))) {
          const a = list.filter((row) => `${row.config}|${row.task}` === cell && row.condition === x);
          const b = list.filter((row) => `${row.config}|${row.task}` === cell && row.condition === y);
          if (a.length && b.length) diffs.push(meanOf(b.map(pick)) - meanOf(a.map(pick)));
        }
        if (!diffs.length) continue;
        out.push({ metric: name, a: x, b: y, cells: diffs.length, meanDiff: round(meanOf(diffs), 3), p: signFlipP(diffs) });
      }
    }
  return out;
}

function signFlipP(diffs) {
  const observed = Math.abs(diffs.reduce((sum, d) => sum + d, 0));
  const n = diffs.length;
  if (observed < 1e-12) return 1;
  let extreme = 0;
  const total = 2 ** n;
  for (let mask = 0; mask < total; mask += 1) {
    let sum = 0;
    for (let k = 0; k < n; k += 1) sum += mask & (1 << k) ? -diffs[k] : diffs[k];
    if (Math.abs(sum) >= observed - 1e-9) extreme += 1;
  }
  return round(extreme / total, 4);
}

// ---------- tables ----------
function perRunTable(list) {
  const head = ["run", ...core.map(short), ...robust.map(short), "core", "v2", "viselora", "skill", "min", "cost/tok"];
  const lines = [row(head), row(head.map(() => "---"))];
  for (const r of list)
    lines.push(
      row([
        r.infraError ? `~~${r.id}~~ (${r.infraError})` : r.id,
        ...core.map((key) => r.scores[key]),
        ...robust.map((key) => r.robust[key]),
        r.total,
        `**${r.totalV2}**`,
        r.usesViselora ? r.viselora.spec ?? "?" : "-",
        r.process.skillCalls ? "yes" : "-",
        Math.round((r.agentExit.durationMs ?? 0) / 60000),
        r.agent === "claude" ? `$${(r.process.costUsd ?? 0).toFixed(2)}` : `${((r.process.inputTokens ?? 0) / 1e6).toFixed(1)}M`,
      ]),
    );
  return lines.join("\n");
}

function aggregateTable(list, keyOf) {
  const groups = groupBy(list, keyOf);
  const head = ["group", "n", ...core.map(short), ...robust.map(short), "core /10", "v2 /13", "uses Viselora"];
  const lines = [row(head), row(head.map(() => "---"))];
  for (const [key, group] of [...groups.entries()].sort())
    lines.push(
      row([
        key,
        group.length,
        ...core.map((k) => avg(group, (r) => r.scores[k])),
        ...robust.map((k) => avg(group, (r) => r.robust[k])),
        avg(group, (r) => r.total),
        `**${avg(group, (r) => r.totalV2)}**`,
        `${group.filter((r) => r.usesViselora).length}/${group.length}`,
      ]),
    );
  return lines.join("\n");
}

function taskTable(list) {
  const conditions = [...new Set(list.map((r) => r.condition))].sort();
  const head = ["task", ...conditions];
  const lines = [row(head), row(head.map(() => "---"))];
  for (const task of [...new Set(list.map((r) => r.task))].sort())
    lines.push(
      row([
        task,
        ...conditions.map((c) => {
          const group = list.filter((r) => r.task === task && r.condition === c);
          return group.length ? `${avg(group, (r) => r.totalV2)} (n=${group.length})` : "-";
        }),
      ]),
    );
  return lines.join("\n");
}

function comparisonTable(list) {
  const head = ["metric", "A → B", "cells", "mean(B − A)", "p (sign-flip)"];
  const lines = [row(head), row(head.map(() => "---"))];
  for (const c of list.filter((c) => ["totalV2", "core", "robust", ...robust].includes(c.metric) || c.p <= 0.1))
    lines.push(row([c.metric, `${c.a} → ${c.b}`, c.cells, c.meanDiff, c.p <= 0.05 ? `**${c.p}**` : c.p]));
  return lines.join("\n");
}

function processTable(list) {
  const groups = groupBy(list, (r) => `${r.config} ${r.condition}`);
  const head = ["group", "n", "mean min", "claude $/run", "codex Mtok in/run", "source lines", "uses Viselora", "skill used", "verify-consumer pass"];
  const lines = [row(head), row(head.map(() => "---"))];
  for (const [key, group] of [...groups.entries()].sort())
    lines.push(
      row([
        key,
        group.length,
        avg(group, (r) => (r.agentExit.durationMs ?? 0) / 60000, 1),
        group[0].agent === "claude" ? avg(group, (r) => r.process.costUsd ?? 0) : "-",
        group[0].agent === "codex" ? avg(group, (r) => (r.process.inputTokens ?? 0) / 1e6, 1) : "-",
        avg(group, (r) => r.apiUsage.sourceLines, 0),
        `${group.filter((r) => r.usesViselora).length}/${group.length}`,
        `${group.filter((r) => r.process.skillCalls).length}/${group.length}`,
        `${group.filter((r) => r.verifyConsumerPassed).length}/${group.length}`,
      ]),
    );
  return lines.join("\n");
}

// ---------- helpers ----------
function short(key) {
  return key.replace(/_/g, " ");
}
function row(cells) {
  return `| ${cells.join(" | ")} |`;
}
function groupBy(list, keyOf) {
  const groups = new Map();
  for (const item of list) groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item]);
  return groups;
}
function meanOf(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
function avg(list, pick, digits = 2) {
  return round(meanOf(list.map(pick)), digits);
}
function round(value, digits = 2) {
  return Math.round(value * 10 ** digits) / 10 ** digits;
}
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}
