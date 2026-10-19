#!/usr/bin/env node
// Round-2 generation phase: "Viselora + skill vs native R3F/drei".
// Every generated project lives under the system temp directory.
//
//   node evals/skill-ab-v2/scripts/run-eval.mjs [--root DIR]
//     [--configs codex-xhigh,codex-low] [--tasks a,b,c,d,e]
//     [--conditions N,V,S,VS] [--reps 1,2,3] [--concurrency 6] [--timeout-min 45]
//     [--dry-run] [--prepare-only]
//
// Conditions (same scaffold: Vite + React 19 + three 0.184 + R3F 9 + drei 10):
//   N   prompt does not mention Viselora, no skill
//   V   prompt names @viselora/dom-webgl 0.2.0-alpha.1, no skill
//   S   prompt does not mention Viselora, skill installed from this checkout
//   VS  prompt names Viselora and the skill is installed
import { spawn, spawnSync } from "node:child_process";
import { cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const v2Root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const v1Root = resolve(v2Root, "../skill-ab");
const repoRoot = resolve(v2Root, "../..");
const args = parseArgs(process.argv.slice(2));
const root = resolve(args.root ?? join(tmpdir(), "viselora-skill-ab-v2"));
const configs = (args.configs ?? "codex-xhigh,codex-low").split(",");
const tasks = (args.tasks ?? "a,b,c,d,e").split(",");
const conditions = (args.conditions ?? "N,V,S,VS").split(",");
const reps = (args.reps ?? "1,2,3").split(",").map(Number);
const concurrency = Number(args.concurrency ?? 8);
const timeoutMs = Number(args["timeout-min"] ?? 45) * 60_000;
const registry = "https://registry.npmjs.org/";

const agentConfigs = {
  opus: { agent: "claude", model: "claude-opus-5-5", effort: "high" },
  sonnet: { agent: "claude", model: "claude-sonnet-5-5", effort: "high" },
  "codex-xhigh": { agent: "codex", model: "gpt-6.1-sol", effort: "xhigh" },
  "codex-low": { agent: "codex", model: "gpt-6.1-sol", effort: "low" },
};
const taskPrompts = {
  a: join(v1Root, "prompts/a-model-card.md"),
  b: join(v1Root, "prompts/b-scroll-story.md"),
  c: join(v1Root, "prompts/c-text-wave.md"),
  d: join(v2Root, "prompts/d-feature-cards.md"),
  e: join(v2Root, "prompts/e-story-handoff.md"),
};
const skillAgent = { claude: "claude-code", codex: "codex" };
for (const config of configs) if (!agentConfigs[config]) throw new Error(`unknown config ${config}`);
for (const condition of conditions) if (!["N", "V", "S", "VS"].includes(condition)) throw new Error(`unknown condition ${condition}`);

const jobs = [];
for (const rep of reps)
  for (const task of tasks)
    for (const config of configs)
      for (const condition of conditions) jobs.push({ rep, task, config, condition });
console.log(`eval root: ${root}\n${jobs.length} jobs`);
if (args["dry-run"] !== undefined) process.exit(0);

mkdirSync(join(root, "runs"), { recursive: true });
prepareTools();
prepareBase();
if (args["prepare-only"] !== undefined) process.exit(0);

let next = 0;
await Promise.all(
  Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (next < jobs.length) await runJob(jobs[next++]);
  }),
);
console.log("all generation jobs finished");

async function runJob({ rep, task, config, condition }) {
  const { agent, model, effort } = agentConfigs[config];
  const id = `${config}-${task}-${condition}-r${rep}`;
  const dir = join(root, "runs", id);
  if (existsSync(join(dir, "agent-done.json"))) {
    console.log(`[${id}] already done, skipping`);
    return;
  }
  if (existsSync(dir)) {
    console.log(`[${id}] incomplete run directory exists; remove it to rerun`);
    return;
  }
  // APFS clone: node_modules costs no disk space until a file changes.
  run(root, "cp", ["-cR", join(root, "base"), dir]);
  git(dir, ["init", "-q"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-qm", "scaffold"]);
  if (condition === "S" || condition === "VS") {
    const install = spawnSync(
      "npx",
      ["-y", "skills", "add", repoRoot, "--skill", "viselora-dom-webgl", "-a", skillAgent[agent], "--copy", "-y"],
      { cwd: dir, encoding: "utf8", env: { ...process.env, npm_config_registry: registry } },
    );
    writeFileSync(join(dir, ".eval-skill-install.log"), install.stdout + install.stderr);
    if (install.status !== 0) throw new Error(`[${id}] skills add failed`);
    git(dir, ["add", "-A"]);
    git(dir, ["commit", "-qm", "install skill"]);
  }

  const prompt = [
    readFileSync(join(v2Root, "prompts/_common.md"), "utf8"),
    condition === "V" || condition === "VS" ? readFileSync(join(v2Root, "prompts/_viselora.md"), "utf8") : "",
    readFileSync(taskPrompts[task], "utf8"),
  ]
    .filter(Boolean)
    .join("\n");
  writeFileSync(join(dir, ".eval-prompt.md"), prompt);
  const [command, commandArgs] =
    agent === "claude"
      ? [
          "claude",
          [
            "-p",
            prompt,
            "--model",
            model,
            "--effort",
            effort,
            "--output-format",
            "stream-json",
            "--verbose",
            "--dangerously-skip-permissions",
            "--strict-mcp-config",
          ],
        ]
      : [
          "codex",
          [
            "exec",
            "--json",
            "--skip-git-repo-check",
            "--dangerously-bypass-approvals-and-sandbox",
            "-m",
            model,
            "-c",
            `model_reasoning_effort="${effort}"`,
            "-c",
            `projects."${dir}".trust_level="trusted"`,
            "-C",
            dir,
            prompt,
          ],
        ];

  // Detach the child agent from any parent Claude Code session (including its
  // minimal "simple" mode, which would hide project skills).
  const env = { ...process.env, npm_config_registry: registry };
  // CLAUDE_EFFORT would also leak the parent's effort level into the child.
  for (const key of Object.keys(env)) if (/^CLAUDE/.test(key)) delete env[key];

  console.log(`[${id}] start`);
  const started = Date.now();
  const child = spawn(command, commandArgs, { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(createWriteStream(join(dir, ".eval-transcript.jsonl")));
  child.stderr.pipe(createWriteStream(join(dir, ".eval-stderr.log")));
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
  }, timeoutMs);
  const exitCode = await new Promise((done) => child.on("close", done));
  clearTimeout(timer);
  const record = {
    id,
    config,
    agent,
    model,
    effort,
    task,
    condition,
    rep,
    exitCode,
    timedOut,
    infraError: infraError(dir),
    durationMs: Date.now() - started,
    finishedAt: new Date().toISOString(),
  };
  writeFileSync(join(dir, "agent-done.json"), JSON.stringify(record, null, 2));
  console.log(`[${id}] done exit=${exitCode} ${Math.round(record.durationMs / 1000)}s${record.infraError ? ` INFRA: ${record.infraError}` : ""}`);
}

// Usage limits and authentication failures are not agent behaviour: report.mjs
// excludes these runs and they should be deleted and rerun.
function infraError(dir) {
  const read = (name) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), "utf8") : "");
  const events = read(".eval-transcript.jsonl")
    .split("\n")
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  const limitPattern = /usage limit|rate limit|hit your limit|limit reached|not logged in|authentication|invalid api key|overloaded/i;
  // claude stream-json: rate_limit_event reports "allowed" on every turn; only
  // a rejection or an errored result is an infrastructure failure.
  const rejected = events.find((e) => e.type === "rate_limit_event" && !/^allowed/.test(e.rate_limit_info?.status ?? "allowed"));
  if (rejected) return `rate limit ${rejected.rate_limit_info.status}`;
  const result = events.find((e) => e.type === "result");
  if (result?.is_error && limitPattern.test(JSON.stringify(result))) return String(result.result ?? result.subtype).slice(0, 120);
  // codex --json: error / turn.failed events.
  const failed = events.find((e) => (e.type === "error" || e.type === "turn.failed") && limitPattern.test(JSON.stringify(e)));
  if (failed) return JSON.stringify(failed).slice(0, 160);
  const stderr = read(".eval-stderr.log").split("\n").slice(-20).join("\n");
  const match = events.length ? null : stderr.match(limitPattern);
  return match ? `stderr: ${match[0]}` : null;
}

function prepareBase() {
  const base = join(root, "base");
  if (existsSync(join(base, "node_modules/@react-three/drei"))) return;
  cpSync(join(v1Root, "scaffold"), base, { recursive: true });
  const html = readFileSync(join(base, "index.html"), "utf8").replace(/<title>.*<\/title>/, "<title>App</title>");
  writeFileSync(join(base, "index.html"), html);
  const pkg = JSON.parse(readFileSync(join(base, "package.json"), "utf8"));
  pkg.name = "app";
  writeFileSync(join(base, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
  mkdirSync(join(base, "public/models"), { recursive: true });
  cpSync(join(repoRoot, "apps/example/public/models/hero.glb"), join(base, "public/models/hero.glb"));
  // three is pinned to the 0.184 line that @viselora/dom-webgl 0.2 supports
  // (its peer range is ^0.184.0); three@latest would block the V condition.
  run(base, "npm", ["install", "--no-audit", "--no-fund", "three@~0.184.0", "@react-three/fiber@^9.8.1", "@react-three/drei@^10.7.9"]);
  run(base, "npm", ["install", "--no-audit", "--no-fund", "-D", "@types/three@~0.184.0"]);
}

function prepareTools() {
  const tools = join(root, "tools");
  if (existsSync(join(tools, "node_modules/playwright-core"))) return;
  mkdirSync(tools, { recursive: true });
  writeFileSync(join(tools, "package.json"), JSON.stringify({ name: "skill-ab-tools", private: true }));
  run(tools, "npm", ["install", "--no-audit", "--no-fund", "playwright-core@^1.55.0"]);
}

function run(cwd, command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, npm_config_registry: registry },
  });
  if (result.status !== 0) throw new Error(`${command} ${commandArgs.join(" ")} failed in ${cwd}`);
}

function git(cwd, commandArgs) {
  run(cwd, "git", ["-c", "user.name=skill-ab", "-c", "user.email=skill-ab@example.invalid", ...commandArgs]);
}

function parseArgs(list) {
  const parsed = {};
  for (let index = 0; index < list.length; index += 1) {
    const key = list[index].replace(/^--/, "");
    const value = list[index + 1];
    if (value === undefined || value.startsWith("--")) parsed[key] = "";
    else {
      parsed[key] = value;
      index += 1;
    }
  }
  return parsed;
}
