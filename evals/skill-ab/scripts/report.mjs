#!/usr/bin/env node
// Grades every finished run (unless already graded) and aggregates scores and
// agent-process metrics into <root>/results.json plus a Markdown table.
//
//   node evals/skill-ab/scripts/report.mjs [--root DIR] [--regrade] [--out results.json]
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const root = resolve(option("root") ?? join(tmpdir(), "viselora-skill-ab"));
const regrade = args.includes("--regrade");
const runsDir = join(root, "runs");
const keys = [
  "single_canvas",
  "dom_fallback",
  "ssr_safe",
  "cleanup",
  "scroll_resize",
  "public_imports",
  "typecheck",
  "build",
  "pixels",
  "task_effect",
];

const rows = [];
for (const id of readdirSync(runsDir).sort()) {
  const dir = join(runsDir, id);
  if (!existsSync(join(dir, "agent-done.json"))) continue;
  if (regrade || !existsSync(join(dir, "grade.json"))) {
    const graded = spawnSync(process.execPath, [join(scriptDir, "grade.mjs"), dir, "--tools", join(root, "tools")], {
      stdio: "inherit",
      timeout: 1_200_000,
    });
    if (graded.status !== 0) console.error(`grading ${id} failed`);
  }
  if (!existsSync(join(dir, "grade.json"))) continue;
  const grade = JSON.parse(readFileSync(join(dir, "grade.json"), "utf8"));
  rows.push({
    id,
    agent: grade.agent,
    task: grade.task,
    condition: grade.condition,
    total: grade.total,
    scores: grade.scores,
    verifyConsumerPassed: grade.details.static.verifyConsumerPassed,
    verifyConsumerViolations: grade.details.static.verifyConsumerViolations,
    usesViselora: grade.details.static.usesViselora,
    variant: grade.variant ?? "full",
    apiUsage: apiUsage(dir),
    process: processMetrics(dir, grade.agent),
    agentExit: { exitCode: grade.exitCode, timedOut: grade.timedOut, durationMs: grade.durationMs },
  });
}

const output = resolve(option("out") ?? join(root, "results.json"));
writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
console.log(`wrote ${output}\n`);
console.log(table(rows));
console.log(`\n${aggregate(rows)}`);

// Which Viselora / R3F entry points the generated source actually uses.
function apiUsage(dir) {
  const names = [
    "WebGLRuntime",
    "WebGLScrollRuntime",
    "WebGLTarget",
    "useDOMTarget",
    "useWebGLRuntime",
    "setTargetReady",
    "hideWhenReady",
    "createDOMTextTexture",
    "measureDOMText",
    "drawDOMText",
    "createScrollEffectProgressStore",
    "WebGLScrollTimeline",
    "useScrollEffectProgressStore",
    "progressSignals",
    "useGLTF",
    "useLoader",
    "GLTFLoader",
    "ErrorBoundary",
  ];
  const source = sourceFiles(join(dir, "src"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  return {
    used: names.filter((name) => new RegExp(`\\b${name}\\b`).test(source)),
    sourceLines: source.split("\n").length,
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
  const lines = readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  const text = readFileSync(path, "utf8");
  const metrics = {
    skillFileMentions: (text.match(/skills\/viselora-dom-webgl\/[A-Za-z./-]+/g) ?? []).length,
    skillFilesTouched: [...new Set(text.match(/skills\/viselora-dom-webgl\/[A-Za-z0-9_./-]+\.(?:md|mjs|json|tsx?)/g) ?? [])],
    readPackageDist: /@viselora\/dom-webgl\/dist/.test(text),
  };
  if (agent === "claude") {
    const result = lines.find((line) => line.type === "result");
    metrics.model = lines.find((line) => line.subtype === "init")?.model;
    metrics.costUsd = result?.total_cost_usd;
    metrics.turns = result?.num_turns;
    metrics.viseloraSkillCalls = lines
      .filter((line) => line.type === "assistant")
      .flatMap((line) => line.message?.content ?? [])
      .filter(
        (part) =>
          part.type === "tool_use" &&
          part.name === "Skill" &&
          /viselora/.test(JSON.stringify(part.input ?? {})),
      ).length;
  } else {
    const usage = lines.filter((line) => line.type === "turn.completed").map((line) => line.usage ?? {});
    metrics.inputTokens = usage.reduce((sum, u) => sum + (u.input_tokens ?? 0), 0);
    metrics.outputTokens = usage.reduce((sum, u) => sum + (u.output_tokens ?? 0), 0);
    metrics.commands = lines.filter((line) => line.item?.type === "command_execution" && line.type === "item.completed").length;
  }
  return metrics;
}

// Mean per rubric item for each agent × prompt variant × condition.
function aggregate(list) {
  const groups = new Map();
  for (const row of list) {
    const key = `${row.agent} ${row.variant} ${row.condition}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const head = ["agent variant condition", "n", ...keys.map((key) => key.replace(/_/g, " ")), "mean total"];
  const lines = [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`];
  for (const [key, group] of [...groups.entries()].sort()) {
    const avg = (pick) => Math.round((group.reduce((sum, row) => sum + pick(row), 0) / group.length) * 100) / 100;
    lines.push(`| ${[key, group.length, ...keys.map((k) => avg((row) => row.scores[k])), `**${avg((row) => row.total)}**`].join(" | ")} |`);
  }
  return lines.join("\n");
}

function table(list) {
  const head = ["run", ...keys.map((key) => key.replace(/_/g, " ")), "total", "verify", "min"];
  const lines = [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`];
  for (const row of list)
    lines.push(
      `| ${[
        row.id,
        ...keys.map((key) => row.scores[key]),
        `**${row.total}**`,
        row.verifyConsumerPassed ? "pass" : "fail",
        Math.round((row.agentExit.durationMs ?? 0) / 60000),
      ].join(" | ")} |`,
    );
  return lines.join("\n");
}
