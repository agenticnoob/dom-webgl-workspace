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
| R3F host and React target hooks | `packages/dom-webgl-runtime/src/lib/Runtime.tsx` |
| Shared runtime state | `packages/dom-webgl-runtime/src/lib/runtimeManager.ts` |
| DOM measurement and fallback | `packages/dom-webgl-runtime/src/lib/domRuntime.ts` |
| Text layout and CanvasTexture | `packages/dom-webgl-runtime/src/lib/domTextLayout.ts`, `domTextTexture.ts` |
| Scroll adapters | `packages/dom-webgl-scroll-adapters/src/` |
| Public consumers | `apps/example/`, `apps/hero-next/` |
| Public API and repository guards | `packages/dom-webgl-runtime/test/`, `test/` |

## Repository boundaries

- This is an open-source（开源）, reusable React/Next.js DOM coordination runtime.
- Apps consume the four public Viselora entrypoints plus React, R3F, Three.js
  and selected ecosystem packages. Never import `packages/*/src` from an app.
- Runtime/package source must not hardcode（硬编码）app keys, assets, DOM
  structure, layout or copy.
- R3F owns one Canvas, rendering, reconciliation, resize and native picking.
  Applications own their native Three.js scene, materials, loaders and animation.
- Viselora coordinates DOM targets, layout, progress, fallback and availability.
  Do not reintroduce a parallel scene/material/effect declaration compiler.
- Do not create a second renderer, Canvas or renderer requestAnimationFrame loop.
- Tests do not live under production `src/`.

## Implementation rules

- Use `create*()` factories, object literals and `type`; do not add classes.
- Use exhaustive discriminated-union switches without `default`.
- Prefer `satisfies`; avoid unsafe assertions and `as any`.
- Type-boundary tests may use `@ts-expect-error`; never use `@ts-ignore`.
- Keep module imports SSR-safe. Create browser resources after mount or through
  explicit DOM utility calls.
- Cleanup is idempotent. Preserve semantic fallback during loading/error and
  report readiness against the captured target identity for asynchronous work.
- Hide fallback paint only on opted-in registered leaves. Preserve accessibility
  and current consumer styles when restoring the property owned by the runtime.
- Use native refs and `useFrame` for high-frequency visuals, with delta in seconds.
- Distinguish shared loader assets from owned model instances and textures before
  disposing. Follow R3F/Three.js resource ownership instead of adding a new cache.
- `node:*` imports are limited to scripts and tests.

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
