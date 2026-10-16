#!/usr/bin/env node
// Runs the skill A/B generation phase. Every generated project lives under the
// system temp directory, never inside the repository.
//
//   node evals/skill-ab/scripts/run-eval.mjs [--root DIR] [--agents claude,codex]
//     [--tasks a,b,c] [--conditions A,B] [--variant full|minimal]
//     [--concurrency 4] [--timeout-min 45]
//
// Condition A: empty Vite + React project, no skill.
// Condition B: same project after `npx skills add <repo> --skill viselora-dom-webgl
//              -a <claude-code|codex> --copy -y`.
// Variant full: prompts/_common.md lists the engineering requirements.
// Variant minimal: prompts/_common-minimal.md states only the feature.
import { spawn, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  createWriteStream,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const evalRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(evalRoot, "../..");
const args = parseArgs(process.argv.slice(2));
const root = resolve(args.root ?? join(tmpdir(), "viselora-skill-ab"));
const agents = (args.agents ?? "claude,codex").split(",");
const tasks = (args.tasks ?? "a,b,c").split(",");
const conditions = (args.conditions ?? "A,B").split(",");
const concurrency = Number(args.concurrency ?? 4);
const timeoutMs = Number(args["timeout-min"] ?? 45) * 60_000;
const variant = args.variant ?? "full";
const commonPrompt = { full: "_common.md", minimal: "_common-minimal.md" }[variant];
if (!commonPrompt) throw new Error(`unknown variant ${variant}`);

const taskFiles = {
  a: "a-model-card.md",
  b: "b-scroll-story.md",
  c: "c-text-wave.md",
};
const skillAgent = { claude: "claude-code", codex: "codex" };

mkdirSync(join(root, "runs"), { recursive: true });
console.log(`eval root: ${root}`);
prepareTools();
prepareBase();

const jobs = [];
for (const task of tasks)
  for (const agent of agents)
    for (const condition of conditions) jobs.push({ task, agent, condition });

let next = 0;
await Promise.all(
  Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (next < jobs.length) await runJob(jobs[next++]);
  }),
);
console.log("all generation jobs finished");

async function runJob({ task, agent, condition }) {
  const id = `${agent}-${task}-${condition}${variant === "full" ? "" : "-min"}`;
  const dir = join(root, "runs", id);
  if (existsSync(join(dir, "agent-done.json"))) {
    console.log(`[${id}] already done, skipping`);
    return;
  }
  if (existsSync(dir)) {
    console.log(`[${id}] incomplete run directory exists; remove it to rerun`);
    return;
  }
  cpSync(join(root, "base"), dir, { recursive: true, verbatimSymlinks: true });
  git(dir, ["init", "-q"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-qm", "scaffold"]);
  if (condition === "B") {
    const install = spawnSync(
      "npx",
      [
        "-y",
        "skills",
        "add",
        repoRoot,
        "--skill",
        "viselora-dom-webgl",
        "-a",
        skillAgent[agent],
        "--copy",
        "-y",
      ],
      { cwd: dir, encoding: "utf8" },
    );
    writeFileSync(
      join(dir, ".eval-skill-install.log"),
      install.stdout + install.stderr,
    );
    if (install.status !== 0) throw new Error(`[${id}] skills add failed`);
    git(dir, ["add", "-A"]);
    git(dir, ["commit", "-qm", "install skill"]);
  }

  const prompt =
    readFileSync(join(evalRoot, "prompts", commonPrompt), "utf8") +
    "\n" +
    readFileSync(join(evalRoot, "prompts", taskFiles[task]), "utf8");
  const [command, commandArgs] =
    agent === "claude"
      ? [
          "claude",
          [
            "-p",
            prompt,
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
            "-c",
            `projects."${dir}".trust_level="trusted"`,
            "-C",
            dir,
            prompt,
          ],
        ];

  // Detach the child agent from any parent Claude Code session (including its
  // minimal "simple" mode, which would hide project skills).
  const env = { ...process.env };
  for (const key of [
    "CLAUDECODE",
    "CLAUDE_CODE_ENTRYPOINT",
    "CLAUDE_CODE_SIMPLE",
    "CLAUDE_CODE_SESSION_ID",
    "CLAUDE_CODE_CHILD_SESSION",
    "CLAUDE_CODE_HOST_SESSION_ID",
    "CLAUDE_CODE_MESSAGING_SOCKET",
    "CLAUDE_CODE_MESSAGING_TOKEN",
    "CLAUDE_CODE_SESSION_ATTENDED",
    "CLAUDE_PID",
  ])
    delete env[key];

  console.log(`[${id}] start`);
  const started = Date.now();
  const child = spawn(command, commandArgs, {
    cwd: dir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
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
    agent,
    task,
    condition,
    variant,
    exitCode,
    timedOut,
    durationMs: Date.now() - started,
    finishedAt: new Date().toISOString(),
  };
  writeFileSync(join(dir, "agent-done.json"), JSON.stringify(record, null, 2));
  console.log(`[${id}] done exit=${exitCode} ${Math.round(record.durationMs / 1000)}s`);
}

function prepareBase() {
  const base = join(root, "base");
  if (existsSync(join(base, "node_modules"))) return;
  cpSync(join(evalRoot, "scaffold"), base, { recursive: true });
  mkdirSync(join(base, "public/models"), { recursive: true });
  cpSync(
    join(repoRoot, "apps/example/public/models/hero.glb"),
    join(base, "public/models/hero.glb"),
  );
  run(base, "npm", ["install", "--no-audit", "--no-fund"]);
}

function prepareTools() {
  const tools = join(root, "tools");
  if (existsSync(join(tools, "node_modules/playwright-core"))) return;
  mkdirSync(tools, { recursive: true });
  writeFileSync(
    join(tools, "package.json"),
    JSON.stringify({ name: "skill-ab-tools", private: true }),
  );
  run(tools, "npm", [
    "install",
    "--no-audit",
    "--no-fund",
    "playwright-core@^1.55.0",
  ]);
}

function run(cwd, command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd, stdio: "inherit" });
  if (result.status !== 0)
    throw new Error(`${command} ${commandArgs.join(" ")} failed in ${cwd}`);
}

function git(cwd, commandArgs) {
  run(cwd, "git", [
    "-c",
    "user.name=skill-ab",
    "-c",
    "user.email=skill-ab@example.invalid",
    ...commandArgs,
  ]);
}

function parseArgs(list) {
  const parsed = {};
  for (let index = 0; index < list.length; index += 1) {
    const key = list[index].replace(/^--/, "");
    parsed[key] = list[index + 1];
    index += 1;
  }
  return parsed;
}
