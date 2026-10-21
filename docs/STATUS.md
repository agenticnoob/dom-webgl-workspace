# Current Status

**Last verified: 2026-10-18 (0.2.0-alpha.1 publication).**

This is the only repository-wide current-state document. App behavior and
browser evidence belong to each app's documentation.

## Project state

The workspace uses a React 19 / Next.js runtime built on React Three Fiber 9
and Three.js 0.184 (source supports 0.184–0.186). Runtime production source is reduced from 124 files / 28,010
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

## Release truth

`@viselora/dom-webgl@0.2.0-alpha.1` and
`@viselora/scroll-adapters@0.2.0-alpha.1` are **published** on the official npm
registry, and both `alpha` tags resolve to them. The separate `latest` tags
remain at `0.1.0-alpha.0`, which implements the previous API; install `@alpha`
or pin the exact 0.2 version.

0.2.0-alpha.1 places DOM text glyphs on the CSS alphabetic baseline, including
half-leading and font-metric `line-height: normal`; `DOMTextGlyph.y` remains the
line-box top and `baseline` is the real baseline. `0.2.0-alpha.0` drew
`drawDOMText`/`createDOMTextTexture` text about half the leading too high (for
example 11px for 72px text at `normal`). The release also documents
agent-critical constraints in the public JSDoc of both packages.

Release source is [7c82976](https://github.com/agenticnoob/dom-webgl-workspace/commit/7c829761c41cf311fa76e1e3dac0d08f9be4f113)
on `main`. The [release workflow](https://github.com/agenticnoob/dom-webgl-workspace/actions/runs/39133782681)
completed successfully after `npm-release` approval and verified registry
integrity, exports, the exact core dependency and both distribution tags. Both
packages carry SLSA provenance attestations. An
[earlier run](https://github.com/agenticnoob/dom-webgl-workspace/actions/runs/39126440622)
failed in verification on a test teardown race and published nothing.

**Prepared, not yet published:** `@viselora/dom-webgl@0.2.0-alpha.2` and
`@viselora/scroll-adapters@0.2.0-alpha.2` are versioned in source and not yet on
the registry. The release widens the core peer range to
`three >=0.184.0 <0.187.0`; published `0.2.0-alpha.1` still declares
`^0.184.0`, so an application on `three@0.186` hits ERESOLVE until then. The
installed-tarball consumer passed SSR, typecheck, unit, build and Chromium
checks with Three.js 0.184, 0.185 and 0.186 (`verify-external-consumer.mjs --three`).
The consumer skill and template target `0.2.0-alpha.2`.

A fresh install of both packages from the official registry exposes the JSDoc
in the published declarations, the alphabetic-baseline drawing in `dist`, and
importable ESM entrypoints.

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

`skills/viselora-dom-webgl` targets `0.2.0-alpha.1` and is self-contained for
the `skills` CLI: three runnable recipes, `verify-consumer.mjs` and
`browser-check.mjs`. Users install it from the generated
[agenticnoob/viselora-skills](https://github.com/agenticnoob/viselora-skills)
repository (about 180 KB), whose only source is `skills/` here. Its first sync
was pushed manually from `main` 702971f; `npx skills add agenticnoob/viselora-skills`
then installed the skill into Claude Code, Codex and Hermes in 7 seconds. The
same install from this 237 MB workspace timed out while cloning.
`sync-skill.yml` authenticates with a write-scoped deploy key
(`SKILL_REPO_DEPLOY_KEY`). Its first run on `main` 102b336 checked out
`viselora-skills` with that key and found the content already matching, so it
made no commit; the push path runs on the next change under `skills/`. The
skills.sh listing is not verified.

The [first A/B evaluation](../evals/skill-ab/README.md) found no difference
with or without the earlier skill when prompts named Viselora (9.83 vs 9.82 of
10, 24 runs). The [second evaluation](../evals/skill-ab-v2/README.md) (120 codex
runs, five tasks) compared native three.js/R3F with Viselora and the skill:
codex `xhigh` scored 13/13 in every condition, while codex `low` rose from 11.26
(native) to 12.94–13.00 (p ≤ 0.034). Five of 15 weak native runs drew no WebGL
because StrictMode reused a lost context; no skill-installed run did. Without
being named, the skill led codex to Viselora in 30 of 30 runs. Claude was not
evaluated in that round, and no human visual review was done.

## Known boundaries

- React 19 and R3F 9 are required; framework-independent consumers are unsupported.
- DOM fallback paint hides only on explicitly opted-in, ready registered leaves.
- Offscreen state does not dispose arbitrary application resources automatically.
- Shared GLB cache entries, cloned instances and primitive objects need deliberate
  Three.js/R3F ownership.
- DOM text snapshots use one element's computed typography, not arbitrary rich
  HTML or browser-perfect screenshot rendering.
- The source is prerelease and has no compatibility layer for the retired APIs.
- Build output, screenshots and browser profiles remain local artifacts.
