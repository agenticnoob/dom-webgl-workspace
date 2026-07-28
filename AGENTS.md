# Agent Rules

These rules apply to the entire repository. A deeper `AGENTS.md` may add
subtree-specific constraints.

Default communication is concise Chinese. State uncertainty explicitly and
lead debugging reports with root cause, direct fix, verification, and next
diagnostic step.

## Read order

Before editing:

1. `git status --short --branch`
2. [docs/STATUS.md](./docs/STATUS.md)
3. [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
4. the README and `AGENTS.md` nearest to the target file
5. relevant source and focused tests

If `.codegraph/` exists, use CodeGraph before searching or reading indexed
source. Markdown and configuration files may be read directly.

## Where to look

| Task | Path |
| --- | --- |
| Runtime creation and frame pipeline | `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts` |
| Three renderer host | `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts` |
| Effect definitions | `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts` |
| Effect scheduling | `packages/dom-webgl-runtime/src/lib/effects/effectController.ts` |
| Scroll and scene gate | `packages/dom-webgl-runtime/src/lib/input/scrollController.ts` |
| Pointer input | `packages/dom-webgl-runtime/src/lib/input/pointerController.ts` |
| React runtime/targets | `packages/dom-webgl-runtime/src/lib/react/` |
| Resources | `packages/dom-webgl-runtime/src/lib/resources/resourceManager.ts` |
| Layout/lifecycle/offscreen | `packages/dom-webgl-runtime/src/lib/renderer/` |
| Scroll adapters | `packages/dom-webgl-scroll-adapters/src/` |
| Public API consumer example | `apps/example/` |
| Next.js consumer | `apps/hero-next/` |
| Package boundary guards | `packages/dom-webgl-runtime/test/`, `test/` |

## Repository boundaries

- This is an open-source（开源）, public, reusable DOM-first WebGL runtime.
- Apps consume only `@viselora/dom-webgl`,
  `@viselora/dom-webgl/react`, `@viselora/scroll-adapters`, and
  `@viselora/scroll-adapters/react`.
- Never import `packages/*/src` from an app.
- Runtime/package source must not hardcode（硬编码）app keys, app asset paths,
  app DOM structure, app layout, or app copy.
- Tests do not live under production `src/`.
- The runtime owns renderer, scene, camera, render loop, resources, loaders,
  materials, mixers, input, lifecycle, and disposal.
- Do not expose raw Three.js ownership or introduce a second renderer/canvas.

## Implementation rules

- Use `create*()` factories, object literals, and `type`; do not add classes.
- Use exhaustive discriminated-union switches without `default`.
- Prefer `satisfies`; avoid unsafe assertions.
- Type-boundary tests may use `@ts-expect-error`; never use `@ts-ignore` or
  `as any`.
- Keep module loading SSR-safe. Browser globals are accessed only at runtime.
- Lifecycle methods use an idempotent `disposed` guard.
- Runtime core uses promise chaining plus `isPromiseLike()` for asynchronous
  control flow.
- `node:*` imports are limited to scripts and tests.
- Preserve stable React declarations: a mounted target's source/effects/scroll/
  pointer/lifecycle declaration does not mutate; remount with a new key.
- Keep runtime-level effect arrays referentially stable.

## Public effect boundary

- Effects use array declarations:
  `effects: [{ kind: "app.effect", ...params }]`.
- Define target effects with `defineWebGLEffect(...)` and scene-object effects
  with `defineWebGLSceneObjectEffect(...)`.
- Effect authors control visuals through `ctx.object`; they do not scan DOM,
  create renderers, own loaders, or dispose runtime resources directly.
- `ctx.object.position` is scene-space placement.
- `model/glb` targets are fitted to the DOM rect until an effect takes over
  position or scale.
- `ctx.runtime.postprocess` is canvas/pass scoped, not object scoped.
- Draco paths are declared through `source.loader.draco.decoderPath`; do not
  expose loader callbacks.

## Testing

- Prefer dependency injection over mocking the module under test.
- Mock Three constructors only where a GPU-backed constructor prevents jsdom
  testing.
- Control asynchronous ordering with deferred promises, not fake timers.
- Use explicit assertions; do not add snapshots.
- React tests use `createElement`, `createRoot`, and `act`.
- A real correctness failure is a hard stop. Do not weaken tests to get green.

## Verification

Focused:

```bash
npm test -- --run path/to/test.ts
npm run typecheck -w <workspace-name>
npm run build -w <workspace-name>
```

Repository:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
npm run check:docs
git diff --check
```

Use `npm run verify:release` only for release-surface changes.

## Documentation rules

- `README.md`: product discovery, install, minimal usage, repository map, links.
- `CONTRIBUTING.md`: human development workflow and verification.
- `AGENTS.md`: agent-only execution constraints; no feature diary.
- `docs/STATUS.md`: the only repository-wide current-state document.
- `docs/ARCHITECTURE.md`: stable ownership and boundaries; no dated logs.
- `docs/guides/`: task-oriented user guidance; no project history.
- package/app README: owner-local purpose, commands, and links.
- `docs/archive/`: completed or superseded records; never current truth.

Update the single owning document and link to it elsewhere. Do not copy current
status, full API lists, long plans, browser evidence tables, or app-specific
configuration into README or AGENTS files.

## Safety

- Preserve unrelated dirty worktree changes.
- Do not reset, restore, clean, or overwrite user work.
- Deletion, force-push, production deployment, publication, credentials,
  permissions, and authentication changes require explicit authorization.
- Do not commit credentials, cookies, tokens, local browser profiles, output,
  screenshots, generated build directories, or private assets.
- Report implemented, automated-verified, browser/physical-verified, committed,
  and pushed states separately.
