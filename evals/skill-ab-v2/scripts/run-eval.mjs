#!/usr/bin/env node
// Round-2 generation phase: "Viselora + skill vs native R3F/drei".
// Every generated project lives under the system temp directory.
//
//   node evals/skill-ab-v2/scripts/run-eval.mjs [--root DIR]
//     [--configs codex-xhigh,codex-low] [--tasks a,b,c,d,e]
//     [--conditions N,V,S,VS] [--reps 1,2,3] [--concurrency 6] [--timeout-min 45]
//     [--dry-run] [--prepare-only]
//   Round-3 extensions (defaults reproduce round 2):
//     [--prompt-dir DIR]          _common.md / _common-minimal.md / _viselora.md
//                                 (falls back to this round's prompts/)
//     [--prompts full,minimal]    prompt variants; when given, run ids become
//                                 <config>-<prompt>-<task>-<condition>-r<rep>
//     [--three 0.184]             three / @types/three line of the scaffold
//     [--claude-concurrency 2]    at most this many claude runs at once
//     [--claude-weekly-cap 0.8]   stop starting claude runs above this
//                                 seven-day subscription utilization
//
// Conditions (same scaffold: Vite + React 19 + three 0.184 + R3F 9 + drei 10):
//   N   prompt does not mention Viselora, no skill
//   V   prompt names @viselora/dom-webgl 0.2.0-alpha.1, no skill
//   S   prompt does not mention Viselora, skill installed from this checkout
//   VS  prompt names Viselora and the skill is installed
import { spawn, spawnSync } from "node:child_process";
import { cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
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
const promptDir = resolve(args["prompt-dir"] ?? join(v2Root, "prompts"));
const promptVariants = (args.prompts ?? "full").split(",");
const variantInId = args.prompts !== undefined;
const threeLine = args.three ?? "0.184";
const claudeConcurrency = Number(args["claude-concurrency"] ?? 2);
const claudeWeeklyCap = Number(args["claude-weekly-cap"] ?? 0.8);
const commonPrompt = { full: "_common.md", minimal: "_common-minimal.md" };

const agentConfigs = {
  opus: { agent: "claude", model: "claude-opus-5-5", effort: "high" },
  sonnet: { agent: "claude", model: "claude-sonnet-5-5", effort: "high" },
  haiku: { agent: "claude", model: "claude-haiku-5-5", effort: "high" },
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
for (const variant of promptVariants) if (!commonPrompt[variant]) throw new Error(`unknown prompt variant ${variant}`);

const jobs = [];
for (const rep of reps)
  for (const task of tasks)
    for (const config of configs)
      for (const prompt of promptVariants)
        for (const condition of conditions) jobs.push({ rep, task, config, prompt, condition });
console.log(`eval root: ${root}\n${jobs.length} jobs`);
if (args["dry-run"] !== undefined) process.exit(0);

mkdirSync(join(root, "runs"), { recursive: true });
prepareTools();
prepareBase();
if (args["prepare-only"] !== undefined) process.exit(0);

// Claude runs share one subscription: limit their concurrency, wait for the
// five-hour window to reset when it is nearly used up, and stop starting new
// ones above the seven-day cap. Runs that still hit a limit are requeued.
const claudeGate = { running: 0, pauseUntil: 0, weeklyStop: false };
const queue = [...jobs];
await Promise.all(
  Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    for (;;) {
      const index = queue.findIndex((job) => agentConfigs[job.config].agent !== "claude" || claudeReady());
      if (index === -1) {
        if (!queue.length || queue.every((job) => agentConfigs[job.config].agent === "claude" && claudeGate.weeklyStop)) return;
        await sleep(30_000);
        continue;
      }
      const [job] = queue.splice(index, 1);
      const claude = agentConfigs[job.config].agent === "claude";
      if (claude) claudeGate.running += 1;
      try {
        const requeue = await runJob(job);
        if (requeue) queue.push(job);
      } finally {
        if (claude) claudeGate.running -= 1;
      }
    }
  }),
);
if (queue.length) console.log(`${queue.length} claude jobs not started (seven-day cap ${claudeWeeklyCap})`);
console.log("all generation jobs finished");

function claudeReady() {
  return !claudeGate.weeklyStop && claudeGate.running < claudeConcurrency && Date.now() >= claudeGate.pauseUntil;
}

// Reads the last subscription rate-limit event of a finished claude run.
function updateClaudeGate(dir, id) {
  const events = readEvents(join(dir, ".eval-transcript.jsonl")).filter((e) => e.type === "rate_limit_event");
  const info = events.at(-1)?.rate_limit_info;
  const windows = info?.unifiedWindows;
  if (!windows) return;
  const five = windows.five_hour;
  const week = windows.seven_day;
  console.log(`[${id}] claude usage: five-hour ${five?.utilization}, seven-day ${week?.utilization}`);
  if (week && week.utilization >= claudeWeeklyCap) claudeGate.weeklyStop = true;
  if ((five && five.utilization >= 0.85) || !/^allowed/.test(info.status ?? "allowed")) {
    const resetsAt = (five?.resetsAt ?? info.resetsAt ?? 0) * 1000 + 60_000;
    claudeGate.pauseUntil = Math.max(claudeGate.pauseUntil, resetsAt);
    console.log(`claude paused until ${new Date(claudeGate.pauseUntil).toISOString()}`);
  }
}

function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

// Returns true when the job hit a subscription limit and should be retried.
async function runJob({ rep, task, config, prompt: variant, condition }) {
  const { agent, model, effort } = agentConfigs[config];
  const id = variantInId ? `${config}-${variant}-${task}-${condition}-r${rep}` : `${config}-${task}-${condition}-r${rep}`;
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
    readFileSync(promptFile(commonPrompt[variant]), "utf8"),
    condition === "V" || condition === "VS" ? readFileSync(promptFile("_viselora.md"), "utf8") : "",
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
            // Only the project's settings and skills: the operator's user-level
            // CLAUDE.md, skills and hooks would otherwise leak into the run.
            "--setting-sources",
            "project,local",
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
    ...(variantInId ? { prompt: variant } : {}),
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
  if (agent === "claude") updateClaudeGate(dir, id);
  if (!record.infraError || agent !== "claude") return false;
  // Keep the failed attempt for inspection and retry after the window resets.
  mkdirSync(join(root, "runs-infra"), { recursive: true });
  renameSync(dir, join(root, "runs-infra", `${id}-${Date.now()}`));
  claudeGate.pauseUntil = Math.max(claudeGate.pauseUntil, Date.now() + 15 * 60_000);
  return true;
}

function promptFile(name) {
  return existsSync(join(promptDir, name)) ? join(promptDir, name) : join(v2Root, "prompts", name);
}

function readEvents(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

// Usage limits and authentication failures are not agent behaviour: report.mjs
// excludes these runs and they should be deleted and rerun.
function infraError(dir) {
  const read = (name) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), "utf8") : "");
  const events = readEvents(join(dir, ".eval-transcript.jsonl"));
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
  // Round 2 pinned three to 0.184 (the peer range of 0.2.0-alpha.1 was
  // ^0.184.0); round 3 passes --three 0.186, which alpha.2 supports.
  run(base, "npm", ["install", "--no-audit", "--no-fund", `three@~${threeLine}.0`, "@react-three/fiber@^9.8.1", "@react-three/drei@^10.7.9"]);
  run(base, "npm", ["install", "--no-audit", "--no-fund", "-D", `@types/three@~${threeLine}.0`]);
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
