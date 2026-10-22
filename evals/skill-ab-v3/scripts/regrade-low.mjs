#!/usr/bin/env node
// Grader repeatability check: regrades every run below a threshold and keeps
// each pass as grade-pass<k>.json. When the first two passes disagree, a third
// pass decides: grade.json becomes the pass whose totalV2 is the median.
// report.mjs must be rerun afterwards (without --regrade) to refresh results.json.
//
//   node evals/skill-ab-v3/scripts/regrade-low.mjs [--root DIR] [--below 13]
//     [--concurrency 3]
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const grader = resolve(dirname(fileURLToPath(import.meta.url)), "../../skill-ab/scripts/grade.mjs");
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const root = resolve(option("root") ?? join(tmpdir(), "viselora-skill-ab-v3"));
const below = Number(option("below") ?? 13);
const concurrency = Number(option("concurrency") ?? 3);
const runsDir = join(root, "runs");
const read = (path) => JSON.parse(readFileSync(path, "utf8"));

const low = readdirSync(runsDir)
  .sort()
  .filter((id) => existsSync(join(runsDir, id, "grade.json")) && !existsSync(join(runsDir, id, "grade-pass2.json")))
  .filter((id) => read(join(runsDir, id, "grade.json")).totalV2 < below);
console.log(`${low.length} runs below ${below}`);

const log = [];
let cursor = 0;
await Promise.all(
  Array.from({ length: Math.min(concurrency, low.length) }, async () => {
    while (cursor < low.length) {
      const id = low[cursor++];
      const dir = join(runsDir, id);
      copyFileSync(join(dir, "grade.json"), join(dir, "grade-pass1.json"));
      const passes = [read(join(dir, "grade-pass1.json"))];
      for (let k = 2; k <= 3; k += 1) {
        if (k === 3 && passes[0].totalV2 === passes[1].totalV2) break;
        await grade(dir);
        copyFileSync(join(dir, "grade.json"), join(dir, `grade-pass${k}.json`));
        passes.push(read(join(dir, "grade.json")));
      }
      const totals = passes.map((p) => p.totalV2);
      const chosen = totals.length === 3 ? totals.indexOf([...totals].sort((a, b) => a - b)[1]) : 0;
      copyFileSync(join(dir, `grade-pass${chosen + 1}.json`), join(dir, "grade.json"));
      log.push({ id, totals, final: totals[chosen] });
      console.log(`${id}: ${totals.join(" / ")} -> ${totals[chosen]}`);
    }
  }),
);
writeFileSync(join(root, "regrade-low.json"), `${JSON.stringify(log, null, 2)}\n`);

function grade(dir) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [grader, dir, "--tools", join(root, "tools")], { stdio: "ignore" });
    const timer = setTimeout(() => child.kill("SIGKILL"), 1_500_000);
    child.on("close", () => {
      clearTimeout(timer);
      done();
    });
  });
}
