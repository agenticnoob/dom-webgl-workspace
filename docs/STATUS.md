# Current Status

**Last verified: 2026-10-24 (0.3.0-alpha.0 publication).**

This is the only repository-wide current-state document. App behavior and
browser evidence belong to each app's documentation.

## Project state

The workspace uses a React 19.2 / Next.js runtime built on React Three Fiber 9
and Three.js 0.184–0.186. Runtime production source is reduced from 124 files / 28,010
lines to 8 files / 1,168 lines. The public surface is intentionally smaller:

- one R3F Canvas host;
- DOM registration, batched layout and live target state;
- explicit fallback readiness and renderer-availability restoration;
- offscreen visibility policy;
- shared progress/scroll inputs;
- DOM text layout, per-glyph canvas drawing and native CanvasTexture creation.

Scenes, meshes, materials, lights, models, animation, pointer picking and render
passes are native R3F/Three.js work. The previous declaration compiler, effect
facades, loaders, resource cache, physics slice and independent renderer loop
are retired. No legacy compatibility backend is maintained.

Since 0.3.0-alpha.0, `WebGLSection` and `useSectionState` pause
offscreen scene subtrees (draw only when active, React `Activity` while
asleep), the host ignores pointer hits on undrawn objects, and the React peer
floor rises to 19.2. On the one-take benchmark this raised Intel UHD 630
throughput from 5.3 to 35.1 fps at DPR 2 ([benchmark](../apps/example/docs/benchmark.md)).
Warm sections now compile materials and upload textures before drawing
(`useSectionState().warmed`), cutting frames over 50 ms from 208 to 67 on the
same run. Adaptive render quality (`quality` prop, `useRenderQuality`) sets the
canvas pixel ratio from per-tier pixel budgets and steps tiers from frame
times, undoing downgrades that do not help. Development diagnostics report
frame cost in debug state and warn about ready targets with no pixels,
sections compiling on entry or containing lights, sustained over-budget frames
and frames below 30 fps at the lowest tier. `apps/example` wraps each visual in
a target section (no warnings while scrolling 30 viewports at reading speed in
development); hero-next keeps its own chapter logic and, in a production
build, stayed at the `high` tier (DPR 1.76 instead of the previous fixed 2)
with no warnings. The first five recipes (camera rail and chapter veil, intro
reveal, DOM grid gallery, particle forms, product turntable) form
`apps/example/showcase.html`, which held 58–59 fps (p95 under 20 ms) on both
GPUs and with 4× CPU throttling, and 58 fps on a Huawei P30, where sections
took the benchmark page from 25 to 48 fps. On that phone's 0.23 MP viewport
the pixel budgets never lower the DPR, so only work scaled by tier changes.
The skill ships the recipes as copies kept identical to the showcase by a
test, with a composed example. `apps/example/index.html` is now the Viselora
site (built with the runtime and R6–R8, 59.6 fps on the UHD 630 at 1× and 4×
CPU); the former index, every View-based demo on one page, is
`effects.html`. Unreleased: `measureDOMText` line breaks now match Chrome's CSS
on long words, trailing letter spacing, `word-break` and CJK punctuation
(10 of 10 browser cases, 4 of 10 before). Remaining items from the
[performance design](./archive/specs/2026-10-22-runtime-performance-governance-design.md)
are listed there.

## Release truth

`@viselora/dom-webgl@0.3.0-alpha.0` and
`@viselora/scroll-adapters@0.3.0-alpha.0` are **published** on the official npm
registry, and both `alpha` tags resolve to them. The separate `latest` tags
remain at `0.1.0-alpha.0`, which implements the previous API; install `@alpha`
or pin the exact 0.3 version.

0.3.0-alpha.0 adds offscreen sections, adaptive render quality and
development diagnostics, and raises the React peer range to
`>=19.2.0 <19.4.0`. A fresh registry install of both packages next to
`react@19.2`, `three@0.186` and R3F 9 resolves without ERESOLVE and exports
`WebGLSection`, `useSectionState` and `useRenderQuality`.

Since 0.2.0-alpha.2 the core peer range is `three >=0.184.0 <0.187.0`; the
installed-tarball consumer passed SSR, typecheck, unit, build and Chromium
checks with Three.js 0.184, 0.185 and 0.186 (`verify-external-consumer.mjs
--three`). `0.2.0-alpha.1` declared `^0.184.0`.

Since 0.2.0-alpha.1, DOM text glyphs sit on the CSS alphabetic baseline,
including half-leading and font-metric `line-height: normal`; `DOMTextGlyph.y`
remains the line-box top and `baseline` is the real baseline. `0.2.0-alpha.0`
drew `drawDOMText`/`createDOMTextTexture` text about half the leading too high
(for example 11px for 72px text at `normal`). Both packages document
agent-critical constraints in their public JSDoc.

Release source is [8d15d8d](https://github.com/agenticnoob/dom-webgl-workspace/commit/8d15d8dfffd83fe1ae2db465653f10ec33116b03)
on `main`. The [release workflow](https://github.com/agenticnoob/dom-webgl-workspace/actions/runs/39966993154)
completed successfully after `npm-release` approval and verified registry
integrity, exports, the exact core dependency and both distribution tags. Both
packages carry SLSA provenance attestations.

Publication readback uses `https://registry.npmjs.org`. Mirrors can lag after a
successful publish; a mirror's 404 is not evidence that the official release is
missing. Production application deployment is separate from npm publication.

## Workspace applications

`apps/example` and `apps/hero-next` are migrated through public package
entrypoints. They compose native R3F scene components while retaining semantic
DOM, scroll-derived progress and one Canvas.

Application details and verification belong to:

- [Example README](../apps/example/README.md) and
  [verification](../apps/example/docs/verification.md).
- [Hero Next README](../apps/hero-next/README.md) and
  [visual design](../apps/hero-next/docs/visual-design.md).

## Verification truth

The release workflow's `npm run verify:release` passed on the release source,
including root typecheck, the complete suite
(105 files / 548 tests), package and application production builds, public import
guards, version alignment, tarball inspection, an installed external consumer,
and the runnable skill template. Version/lockfile guards cover both applications
and reject nested old registry copies. Unused postprocessing dependencies and
duplicate app asset warmups are removed.

The installed-tarball consumer passed SSR imports, semantic rendering, typecheck,
unit tests, production build and Chromium checks for actual GLB drawing, native
physical materials, rendered pixels, reversible progress, context-loss fallback,
and runtime unmount/remount. Its captured page/console error list was empty.
A fresh installation of both published packages from the official registry also
passed all four ESM entrypoint imports, shared progress and semantic SSR checks.

Runtime regressions cover StrictMode, React Activity hide/show and final cleanup,
pause/resume without rewinding the native clock, readiness/error reporting while
paused, stale asynchronous readiness, DOM mutation/resize/font invalidation,
opacity ownership, text layout and texture disposal. Both migrated applications
were inspected in desktop Chromium and mobile emulation, including real WebGL
context loss/recovery. Detailed visual evidence and limits remain in the linked
application documents; physical mobile devices were not tested.

The release-preparation React Doctor scan compared 221 files against
`origin/main` and reported 55/100 with 14 diagnostics; this is not a clean
Doctor result or a like-for-like score comparison with a narrower prior scan.
Manual review confirmed all five flagged effects remove their subscriptions,
observers and scheduled work, and both flagged browser-global initializers run
inside client-mounted R3F scenes. SSR and production-build gates passed.
The remaining advice concerns stable text index keys, shader `pow`, low-frequency
scheme callbacks and mixed component/helper exports. No lint rules were disabled.

Normal checks:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
npm run check:docs
git diff --check
```

Use `npm run verify:release` for the package-surface migration. It validates
publication artifacts without publishing them. Keep implemented, automated,
browser-verified, committed and pushed states separate.

## Agent skill

`skills/viselora-dom-webgl` targets `0.3.0-alpha.0` and is self-contained for
the `skills` CLI: three runnable recipes, the one-take folder, the Hero Next
component recipes (`recipes/hero/`, kept identical to `apps/example` by a test), `verify-consumer.mjs` and
`browser-check.mjs`. Users install it from the generated
[agenticnoob/viselora-skills](https://github.com/agenticnoob/viselora-skills)
repository (about 180 KB), whose only source is `skills/` here. Its first sync
was pushed manually from `main` 702971f; `npx skills add agenticnoob/viselora-skills`
then installed the skill into Claude Code, Codex and Hermes in 7 seconds. The
same install from this 237 MB workspace timed out while cloning.
`sync-skill.yml` authenticates with a write-scoped deploy key
(`SKILL_REPO_DEPLOY_KEY`). Its run on `main` 8d15d8d pushed
[b54b134](https://github.com/agenticnoob/viselora-skills/commit/b54b134) with
the `0.3.0-alpha.0` skill. That run finished before it could be cancelled, so
for the time the release waited for approval the skill named an unpublished
version; publish the packages before merging a skill version change. The skills.sh listing is not verified.

Three A/B rounds (256 Claude and codex runs) are summarized in the
[evaluation summary](../evals/README.md). Latest result (round 3,
`0.2.0-alpha.2`, three 0.186): under a prompt that lists no robustness
requirements, native pages scored 10.13–11.67 of 13 against 12.63–13.00 with
the skill, and the skill beat naming the package without it (p = 0.002). Strong
agents given every requirement score the same with or without Viselora.
`browser-check.mjs` produced results in only 14 of 56 round-3 skill runs; the
skill now runs it as one command with `--serve`, which is verified on the
template (8/8 checks, no server left running) but not yet re-evaluated with
agents.

## Known boundaries

- React 19.2 and R3F 9 are required; framework-independent consumers are unsupported.
- DOM fallback paint hides only on explicitly opted-in, ready registered leaves.
- Offscreen state does not dispose arbitrary application resources automatically.
- Shared GLB cache entries, cloned instances and primitive objects need deliberate
  Three.js/R3F ownership.
- DOM text snapshots use one element's computed typography, not arbitrary rich
  HTML or browser-perfect screenshot rendering.
- The source is prerelease and has no compatibility layer for the retired APIs.
- Build output, screenshots and browser profiles remain local artifacts.
