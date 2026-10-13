# Current Status

**Last verified: 2026-10-14 (React/R3F migration and release preparation).**

This is the only repository-wide current-state document. App behavior and
browser evidence belong to each app's documentation.

## Project state

The workspace uses a React 19 / Next.js runtime built on React Three Fiber 9
and Three.js 0.184. Runtime production source is reduced from 124 files / 28,010
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

The source version is `@viselora/dom-webgl@0.2.0-alpha.0` and
`@viselora/scroll-adapters@0.2.0-alpha.0`. This breaking React/R3F revision is
prepared for publication through the `alpha` channel; registry confirmation is
pending. The current registry `alpha` is still `0.1.0-alpha.2`, which implements
the previous API. Use matching local tarballs until publication completes.
The release workflow publishes both packages together in dependency order and
checks their integrity, exports, dependency versions and distribution tags.
Production application deployment is separate from npm publication.

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

`npm run verify:release` passed, including root typecheck, the complete suite
(104 files / 526 tests), package and application production builds, public import
guards, version alignment, tarball inspection, an installed external consumer,
and the runnable skill template. Version/lockfile guards cover both applications
and reject nested old registry copies. Unused postprocessing dependencies and
duplicate app asset warmups are removed.

The installed-tarball consumer passed SSR imports, semantic rendering, typecheck,
unit tests, production build and Chromium checks for actual GLB drawing, native
physical materials, rendered pixels, reversible progress, context-loss fallback,
and runtime unmount/remount. Its captured page/console error list was empty.

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
