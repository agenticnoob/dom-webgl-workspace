# Agent evaluations

Does Viselora, and its agent skill, help coding agents build pages where
semantic DOM and a WebGL scene stay in sync? Three A/B rounds (256 agent runs)
compared pages built natively with three.js / React Three Fiber against pages
built with `@viselora/dom-webgl` and the
[`viselora-dom-webgl` skill](../skills/viselora-dom-webgl/SKILL.md).

Each round's directory holds its prompts, rubric, grader, raw results and a
detailed report (in Chinese). This page summarizes them; the round reports are
the source for every number below.

## Findings

1. **Viselora's value is safe defaults, not new capabilities.** Weaker agents,
   and strong agents that are not told every robustness requirement, build
   measurably more robust pages with Viselora and the skill. A strong agent
   given an explicit checklist does just as well without it.
2. **The difference is lifecycle and fallback mistakes.** Native pages went
   blank when React StrictMode reused a lost WebGL context, mounted one canvas
   per card, blanked the page without WebGL (no error boundary) or hid the
   fallback from screen readers. Viselora owns the single canvas and the DOM
   fallback, so these did not occur with it.
3. **The skill matters, not only the package.** Agents that were told to use
   the package without the skill still fell into the R3F `uniforms` trap
   (ready but nothing drawn, so the page went blank), ignored reduced motion
   and used version ranges. Without being named, the skill led agents to
   Viselora in 56 of 58 runs.

## Rounds

| Round | Package | Agents | Runs | Question | Result |
| --- | --- | --- | --- | --- | --- |
| [1](./skill-ab/README.md) | 0.2.0-alpha.0 | Claude Opus, codex `xhigh` | 24 | With the package named in the prompt, does the skill help? | No difference: 9.82 vs 9.83 of 10. It found the DOM text baseline bug fixed in alpha.1. |
| [2](./skill-ab-v2/README.md) | 0.2.0-alpha.1 | codex `xhigh`, `low` | 120 | Native vs Viselora vs skill, with every requirement listed | `xhigh`: 13/13 everywhere. `low`: 11.26 native vs 12.67–13.00. |
| [3](./skill-ab-v3/README.md) | 0.2.0-alpha.2, three 0.186 | Claude Opus, Haiku; codex `low` | 112 | Same, plus a minimal prompt that lists no robustness requirements | Under the minimal prompt even Opus scored 11.14 native vs 13.00 with the skill. |

Conditions in rounds 2 and 3: **N** native (Viselora not mentioned, no
skill), **V** prompt names Viselora, **S** skill installed only, **VS** both.
Scores are out of 13: ten correctness items (single canvas, DOM fallback, SSR,
cleanup, scroll/resize, public imports, typecheck, build, drawn pixels, task
effect) plus context-loss recovery, accessibility tree and reduced motion,
graded automatically in Chromium.

### Round 3, minimal prompt (mean of 13)

| Agent | N | V | S | VS |
| --- | --- | --- | --- | --- |
| Claude Haiku (tasks a, d; n=4) | 10.13 | 12.44 | 12.63 | 13.00 |
| Claude Opus (tasks a, d; n=4) | 11.14 | 12.15 | 13.00 | 13.00 |
| codex `low` (tasks a–e; n=10) | 11.67 | 12.13 | 12.92 | 12.97 |

Native vs the three Viselora conditions: Haiku p = 0.003, Opus p = 0.015
(permutation test). Skill vs naming the package only, pooled: 12.93 vs 12.21,
p = 0.002.

### Round 2, full prompt (mean of 13, n=15 per cell)

| Agent | N | V | S | VS |
| --- | --- | --- | --- | --- |
| codex `low` | 11.26 | 12.67 | 12.94 | 13.00 |
| codex `xhigh` | 13.00 | 13.00 | 13.00 | 13.00 |

Five of 15 native `low` pages drew no WebGL at all; none did with the skill.

## Changes made from the results

- 0.2.0-alpha.1: DOM text drawn on the CSS baseline; agent-critical constraints
  in the public JSDoc (agents read the `.d.ts` files in 22 of 24 round-1 runs).
- Skill: runnable recipes; the critical rules in the SKILL.md body (Claude often
  reads only that file); exact version pins.
- 0.2.0-alpha.2: Three.js 0.184–0.186 peer range.
- Skill: one command installs the `playwright-core` driver and runs
  `browser-check.mjs --serve`, which starts the dev server in the background
  and stops it afterwards. Only 14 of 56 round-3 skill runs got browser-check
  results, and the earlier wording asked agents to keep a server running,
  which led one Haiku run to drop the skill.

## Limits

- Prompts in every round asked for a DOM + WebGL page. The rounds do not
  measure whether an agent would choose this kind of page unprompted.
- Grading ran on a Vite dev server (StrictMode) with SwiftShader. Real GPUs,
  mobile devices and production builds were not covered; one sampled
  StrictMode blank page rendered in a production build.
- Visual quality was reviewed by hand only in round 1, by one person.
- Round 3 ran Claude only on tasks a and d with the minimal prompt, for cost.
- Cells hold 2–15 runs. Results for strong agents with full prompts sit at the
  ceiling and cannot show a difference.
- `setTargetReady(true)` is declared by the caller, so a wrong declaration can
  still hide the fallback; the runtime does not yet detect it.

## Reproduce

Each round's report lists its commands. Runs need logged-in `claude` and/or
`codex` CLIs, Google Chrome and the official npm registry; generated projects
stay under `$TMPDIR`.
