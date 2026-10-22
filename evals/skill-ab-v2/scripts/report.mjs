#!/usr/bin/env node
// Grades every finished round-2 run with evals/skill-ab/scripts/grade.mjs
// (unless already graded), then aggregates scores, process metrics and
// condition comparisons into results.json and Markdown tables.
//
//   node evals/skill-ab-v2/scripts/report.mjs [--root DIR] [--regrade]
//     [--concurrency 2] [--out results.json] [--md report.md]
//
// Runs whose agent hit a usage limit or auth failure (agent-done.json
// infraError) are listed but excluded from every aggregate. Round-3 runs record
// the prompt variant in agent-done.json; their `config` becomes
// "<config>/<prompt>" so every comparison stays within one prompt variant.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fisherP, meanOf, permutationP, round, signFlipP } from "./stats.mjs";

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
    config: meta.prompt ? `${meta.config}/${meta.prompt}` : meta.config,
    baseConfig: meta.config,
    prompt: meta.prompt ?? "full",
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
const runComparisons = compareRuns(valid);
writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), comparisons, runComparisons, rows }, null, 2));
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
  "## Run-level comparisons within each config (unpaired)",
  runComparisonTable(runComparisons),
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
    // Claude may also open SKILL.md with Read instead of the Skill tool.
    if (!metrics.skillCalls && /skills\/viselora-dom-webgl\/SKILL\.md/.test(text)) metrics.skillCalls = 1;
  } else {
    const usage = lines.filter((line) => line.type === "turn.completed").map((line) => line.usage ?? {});
    metrics.inputTokens = usage.reduce((sum, u) => sum + (u.input_tokens ?? 0), 0);
    metrics.cachedInputTokens = usage.reduce((sum, u) => sum + (u.cached_input_tokens ?? 0), 0);
    metrics.outputTokens = usage.reduce((sum, u) => sum + (u.output_tokens ?? 0), 0);
    metrics.commands = lines.filter((line) => line.item?.type === "command_execution" && line.type === "item.completed").length;
    metrics.skillCalls = /skills\/viselora-dom-webgl\/SKILL\.md/.test(text) ? 1 : 0;
  }
  metrics.browserCheck = browserCheckMetrics(shellCommands(lines, agent), readJson(join(dir, "package.json")));
  return metrics;
}

// Shell commands the agent ran, in order, with their output.
function shellCommands(lines, agent) {
  if (agent !== "claude")
    return lines
      .filter((line) => line.type === "item.completed" && line.item?.type === "command_execution")
      .map((line) => ({ command: line.item.command ?? "", output: line.item.aggregated_output ?? "" }));
  const outputs = new Map();
  for (const line of lines.filter((l) => l.type === "user"))
    for (const part of Array.isArray(line.message?.content) ? line.message.content : [])
      if (part.type === "tool_result")
        outputs.set(
          part.tool_use_id,
          typeof part.content === "string" ? part.content : (part.content ?? []).map((c) => c.text ?? "").join("\n"),
        );
  return lines
    .filter((line) => line.type === "assistant")
    .flatMap((line) => line.message?.content ?? [])
    .filter((part) => part.type === "tool_use" && part.name === "Bash")
    .map((part) => ({ command: part.input?.command ?? "", output: outputs.get(part.id) ?? "" }));
}

// Round 3: did browser-check.mjs actually report PASS/FAIL lines, and was the
// playwright-core driver installed (before the first browser-check call)?
function browserCheckMetrics(commands, pkg) {
  const install = /\b(npm|pnpm|yarn|bun)\b[^\n;&|]*\b(i|install|add)\b[^\n;&|]*\bplaywright(-core)?\b/;
  const checks = commands.map((c, index) => ({ ...c, index })).filter((c) => /browser-check\.mjs/.test(c.command));
  const installs = commands.map((c, index) => ({ ...c, index })).filter((c) => install.test(c.command));
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  return {
    invoked: checks.length,
    produced: checks.some((c) => /^(PASS|FAIL) /m.test(c.output)),
    allPass: checks.some((c) => /^PASS /m.test(c.output)) && !checks.some((c) => /^FAIL /m.test(c.output)),
    driverMissing: checks.some((c) => /Install a browser driver first/.test(c.output)),
    installedDriver: installs.length > 0,
    // An install chained in front of the first check (`npm i -D playwright-core && node …`) counts.
    installedBeforeFirstCheck:
      installs.length > 0 &&
      checks.length > 0 &&
      (installs[0].index < checks[0].index || (installs[0].index === checks[0].index && !/Install a browser driver first/.test(checks[0].output))),
    driverInPackageJson: Boolean(deps["playwright-core"] ?? deps.playwright),
    // Round 2 counted PASS/FAIL lines from any command, including the agent's
    // own browser scripts (e.g. a globally installed ego-browser skill).
    anyPassFail: commands.some((c) => /^(PASS|FAIL) /m.test(c.output)),
    egoBrowser: commands.some((c) => /\bego-browser\b/.test(c.command)),
  };
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

// Within one config: every run is a sample. Mean totalV2 difference with a
// seeded Monte Carlo permutation p-value, and Fisher's exact test on the
// number of runs whose page showed no WebGL at all (pixels = 0).
function compareRuns(list) {
  const out = [];
  for (const config of [...new Set(list.map((row) => row.config))].sort()) {
    const conditions = [...new Set(list.filter((row) => row.config === config).map((row) => row.condition))].sort();
    for (let i = 0; i < conditions.length; i += 1)
      for (let j = i + 1; j < conditions.length; j += 1) {
        const a = list.filter((row) => row.config === config && row.condition === conditions[i]);
        const b = list.filter((row) => row.config === config && row.condition === conditions[j]);
        const blankA = a.filter((row) => row.scores.pixels === 0).length;
        const blankB = b.filter((row) => row.scores.pixels === 0).length;
        out.push({
          config,
          a: conditions[i],
          b: conditions[j],
          n: [a.length, b.length],
          meanA: round(meanOf(a.map((row) => row.totalV2)), 2),
          meanB: round(meanOf(b.map((row) => row.totalV2)), 2),
          p: permutationP(a.map((row) => row.totalV2), b.map((row) => row.totalV2)),
          blank: [blankA, blankB],
          blankP: fisherP(blankA, a.length - blankA, blankB, b.length - blankB),
        });
      }
  }
  return out;
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

function runComparisonTable(list) {
  const head = ["config", "A → B", "n", "mean A", "mean B", "p (permutation)", "no-WebGL runs A / B", "p (Fisher)"];
  const lines = [row(head), row(head.map(() => "---"))];
  for (const c of list)
    lines.push(
      row([
        c.config,
        `${c.a} → ${c.b}`,
        c.n.join(" / "),
        c.meanA,
        c.meanB,
        c.p <= 0.05 ? `**${c.p}**` : c.p,
        c.blank.join(" / "),
        c.blankP <= 0.05 ? `**${c.blankP}**` : c.blankP,
      ]),
    );
  return lines.join("\n");
}

function processTable(list) {
  const groups = groupBy(list, (r) => `${r.config} ${r.condition}`);
  const head = ["group", "n", "mean min", "claude $/run", "codex Mtok in/run", "source lines", "uses Viselora", "skill used", "verify-consumer pass", "browser-check output", "driver installed"];
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
        `${group.filter((r) => r.process.browserCheck?.produced).length}/${group.filter((r) => r.process.browserCheck?.invoked).length} invoked`,
        `${group.filter((r) => r.process.browserCheck?.installedDriver).length}/${group.length}`,
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
function avg(list, pick, digits = 2) {
  return round(meanOf(list.map(pick)), digits);
}
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}
