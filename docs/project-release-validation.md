# Viselora Alpha Release Validation

**Date:** 2026-07-10
**Status:** Capability-stable; local release validation in progress
**Baseline before release work:** `72d7e0ac`

## Decision

The previous conclusion that this repository was completely frozen and that
future work had to migrate to React Three Fiber is withdrawn.

Viselora's implemented DOM-first runtime is a publishable capability set. The
runtime is capability-stable for the first alpha: release engineering must not
be used to add features or redesign the public API, but package hardening,
documentation, the public agent skill, defect fixes, and external-consumer
validation are active work.

The release units are lockstep ESM-only packages:

- `@viselora/dom-webgl@0.1.0-alpha.0`
- `@viselora/scroll-adapters@0.1.0-alpha.0`

The same repository owns the public consumer skill at
`skills/viselora-dom-webgl/`.

## Preserved Product Boundary

Viselora remains a DOM-first managed WebGL runtime. It preserves:

- one runtime-owned canvas;
- DOM targets as layout and accessibility anchors;
- fallback, loading, offscreen, and disposal policy;
- one managed scroll source and one managed pointer source;
- public root and React entrypoints;
- controlled, application-authored effects;
- runtime-owned resources, rendering, scheduling, and debug state.

This release does not add CommonJS, React Three Fiber, raw Three.js ownership,
new runtime capabilities, a compatibility layer for former package names, or a
formal MVP application.

## Local Release Gate

The alpha is locally ready only when all of the following pass from a clean
checkout:

```bash
npm run typecheck
npm run test -- --run
npm run build
npm run check:imports
npm run verify:versions
npm run verify:tarballs
npm run verify:consumer
npm run verify:skill
git diff --check
```

Package validation must prove that exports resolve only to `dist`, the two
versions remain lockstep, each tarball contains only its package metadata,
README, LICENSE, JavaScript, declarations, and sourcemaps, and a repository-
external React/Vite fixture can install both tarballs and validate types, SSR
imports, one runtime canvas, cleanup, and a production build.

Skill validation must prove the published workflow uses one runtime, one canvas,
one scroll source, one pointer source, public entrypoints, stable effect arrays,
fallback/offscreen/disposal policy, and no R3F or second renderer.

## Publication Gate

Local implementation and verification do not authorize publication. The first
public release may run only after the user explicitly confirms:

1. the `@viselora` npm Organization exists and the publishing account can
   publish public scoped packages;
2. a short-lived granular npm token is configured for the first release;
3. the protected GitHub `npm-release` Environment is configured;
4. the intended repository/ref and npm package ownership are correct.

The first release uses the `alpha` dist-tag and publishes core before adapters.
After success, configure npm Trusted Publishing for the release workflow,
verify an OIDC release, and revoke the bootstrap token. Release automation must
skip an already-published matching version, fail on a mismatch, and never
unpublish or overwrite a version.

## Later Consumer MVP

A formal MVP may be created later in a separate repository after the packages
and skill are public. The notes under `docs/new-project/` describe that future
consumer-validation project. This repository does not create the formal MVP.
