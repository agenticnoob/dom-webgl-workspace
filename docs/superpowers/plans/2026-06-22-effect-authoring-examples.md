# Effect Authoring Examples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build React-only package-consumer effect authoring examples in `apps/example`, backed by documentation and a friction report.

**Current truth note (2026-06-26):** The original plan shipped the first
catalog. The current `apps/example` surface bucket has since grown to include
`example.surfaceVideoBackground`, `example.surfaceGhostCursor`, and
`example.surfaceWaves` alongside `example.surfaceFill` and
`example.surfacePulse`; see `docs/examples/effect-authoring.md` for the current
catalog.

**Architecture:** Keep package core primitive-only and example-owned. `apps/example` uses only public runtime and React entrypoints, defines local effects with `defineWebGLEffect(...)`, and exercises each source handle through a Chinese full-width vertical effect catalog built from React `WebGLRuntime` and `WebGLTarget`, with reusable click-to-expand explanation overlays on each row.

**Tech Stack:** TypeScript, React, Vite, Vitest, jsdom, `@project/dom-webgl-runtime`.

---

## Files

- Create: `apps/example/package.json`
- Create: `apps/example/index.html`
- Create: `apps/example/src/main.tsx`
- Create: `apps/example/src/App.tsx`
- Create: `apps/example/src/example.css`
- Create: `apps/example/src/exampleEffects.ts`
- Create: `apps/example/src/exampleEffects.test.ts`
- Create: `apps/example/src/App.test.tsx`
- Create: `apps/example/src/import-boundary.test.ts`
- Create: `docs/examples/effect-authoring.md`
- Create: `docs/agent/effect-authoring-example-report.md`
- Modify: `README.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/agent/custom-effects.md`
- Modify: `docs/EXECUTION_STATE.md`
- Modify: `scripts/assert-demo-public-imports.mjs`

## Task 1: Document The Contract First

- [x] Expand custom effect docs into a standalone authoring guide.
- [x] Add a consumer tutorial at `docs/examples/effect-authoring.md`.
- [x] Link the example from README and package usage docs.
- [x] Keep docs explicit that examples are app-owned, not package exports.
- [x] Run `git diff --check`.

## Task 2: Create React Example App Skeleton

- [x] Add `apps/example/package.json` with Vite React build scripts and public runtime dependency.
- [x] Add `index.html`, `src/main.tsx`, `src/App.tsx`, and `src/example.css`.
- [x] Add a first failing render/import-boundary test for public-only imports.
- [x] Implement the skeleton with no runtime internals and no demo source imports.
- [x] Run `npm test -- --run apps/example/src/App.test.tsx apps/example/src/import-boundary.test.ts`.

## Task 3: Add Application-Owned Example Effects

- [x] Write failing tests for local effects covering source-kind matching and no-op behavior.
- [x] Implement the local catalog effects: `example.surfaceFill`, `example.surfacePulse`, `example.textWave`, `example.textReveal`, `example.imagePan`, `example.imageZoom`, `example.videoPlayback`, `example.videoDrift`, `example.modelSpin`, and `example.modelFloat`.
- [x] Later pinned-scroll API dogfood extends the catalog with
  `example.pinnedReveal`, backed by `ScrollEffectSection` progress and
  `ctx.progress.get(progressKey)`.
- [x] Register a stable module-scope effect array in the React app.
- [x] Declare a full-width vertical one-effect-per-row catalog across `snapshot/element`, `snapshot/text`, `image`, `video`, and `model/glb` sources through `<WebGLTarget />`, with a reusable click-to-expand explanation overlay per row.
- [x] Run `npm test -- --run apps/example/src`.

## Task 4: Add Friction Report

- [x] Build the example as a simulated downstream user.
- [x] Record friction in `docs/agent/effect-authoring-example-report.md`.
- [x] Separate documentation gaps, counterintuitive API behavior, missing capabilities, and boundaries to preserve.
- [x] Update `docs/EXECUTION_STATE.md` with the completed example pass.

## Task 5: Final Verification

- [x] Run `npm test -- --run apps/example/src`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run check:imports`.
- [x] Run `npm run build`.
- [x] Run `git diff --check`.
