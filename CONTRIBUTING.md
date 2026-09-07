# Contributing

This repository is an npm-workspaces monorepo for a public DOM-first WebGL
runtime, optional scroll adapters, consumer examples, and a versioned
development skill.

Read [docs/STATUS.md](./docs/STATUS.md) before changing behavior and
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) before changing ownership or
public boundaries.

## Development workflow

Install dependencies from the repository root:

```bash
npm install
```

Use a focused RED → minimal implementation → GREEN cycle:

1. Add or update a focused test outside production `src/` directories.
2. Run the focused test and confirm the expected failure.
3. Implement the smallest general solution.
4. Run focused tests, then widen verification.
5. Update the one document that owns the changed fact.
6. Review the diff for private data, generated artifacts, and unrelated edits.

Do not change tests to hide a real correctness failure. Do not use `skip`,
`xfail`, `@ts-ignore`, or lower thresholds as a substitute for a fix.

## Repository boundaries

- Runtime code belongs in `packages/dom-webgl-runtime/src`.
- Optional Lenis/GSAP/ScrollTrigger glue belongs in
  `packages/dom-webgl-scroll-adapters/src`.
- `apps/example` and `apps/hero-next` consume public package entrypoints only.
- Runtime code must not branch on app keys, asset paths, copy, DOM structure, or
  layout.
- Package/app tests live in that workspace's `test/` directory and mirror the
  source path. Repository guards live in `test/`.
- Browser assets belong to the owning app's `public/` directory.
- Build output, browser sessions, screenshots, and temporary evidence do not
  belong in Git.

## Coding conventions

- Prefer `create*()` factory functions and object literals over classes.
- Use `type` aliases for object shapes.
- Use exhaustive switches for discriminated unions; avoid a catch-all default.
- Prefer `satisfies` to unsafe assertions.
- Use `@ts-expect-error` only in type-boundary tests; never use `@ts-ignore` or
  `as any`.
- Keep module import safe for SSR. Runtime source must not touch `window` or
  `document` at module load.
- Keep lifecycle disposal idempotent with a `disposed` guard.
- Runtime-core asynchronous flows use promises and `isPromiseLike()` rather
  than introducing broad `async` control flow.
- `node:*` imports belong only in tests and scripts.

## Public API changes

Public behavior must remain declaration-driven and runtime-owned. New
capabilities must not expose raw Three.js renderer, scene, camera, object,
material, texture, loader, mixer, raycaster, render target, scheduling, or
disposal ownership.

When a public type or export changes:

1. update package source and public-export tests;
2. update generated skill API data with `npm run skill:api:generate`;
3. update only the affected package README or user guide;
4. update [docs/STATUS.md](./docs/STATUS.md) only if current capability truth
   changed;
5. run package, skill, tarball, and consumer gates in proportion to risk.

## Documentation responsibilities

Keep one owner for each kind of information:

| Document | Put here | Do not put here |
| --- | --- | --- |
| `README.md` | Product purpose, install, minimal example, repository map, links | Release diary, exhaustive API, implementation history |
| `CONTRIBUTING.md` | Human workflow, code/test conventions, verification | Current feature status, app-specific design |
| `AGENTS.md` | Agent execution constraints and read order | Product tutorial, historical implementation truth |
| `docs/STATUS.md` | Current implementation, release, evidence, limitations, next focus | Tutorials, plans, detailed architecture |
| `docs/ARCHITECTURE.md` | Stable ownership, boundaries, data flow, non-goals | Dated status, verification logs |
| `docs/guides/*` | Task-oriented user instructions | Project diary or exhaustive generated API |
| package/app README | Owner-local purpose, commands, boundaries, links | Repository-wide status |
| `docs/archive/*` | Completed plans, superseded decisions, old reports | Current truth or active backlog |

If a fact already has an owner, link to it instead of copying it.

## Verification

Focused checks:

```bash
npm test -- --run path/to/test.ts
npm run typecheck -w <workspace-name>
npm run build -w <workspace-name>
npm run check:docs
```

Repository checks:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
npm run check:docs
git diff --check
```

Release work additionally uses `npm run verify:release`. That command includes
version, tarball, external-consumer, and skill verification and can be
substantially slower than normal development checks.

## Commit checklist

- Tests and builds relevant to the change pass.
- Documentation ownership remains clear and links resolve.
- Package versions and generated API references are aligned when applicable.
- No token, cookie, credential, private configuration, browser profile,
  screenshot, build output, or temporary file is included.
- Existing unrelated worktree changes are preserved.
- The commit message describes the behavior or structural change.
