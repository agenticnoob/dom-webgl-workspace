# Phase 5 Effect/Material Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first public effect/material declaration layer so authors can opt DOM-authored targets into explicit WebGL-owned styling and lightweight frame-driven motion.

**Architecture:** Keep DOM as the source for layout, content, accessibility, and interaction state. Add a small internal effect controller for known built-ins only: `solid` material and `pointer-tilt` motion. Effects consume runtime-owned renderables, layout snapshots, and shared frame input; they do not scan DOM, create renderers, own resource pipelines, or expose Three.js flags.

**Tech Stack:** TypeScript, React, Three.js, Vitest, jsdom, Vite demo app.

---

## Public Contract

- Add `effects?: WebGLEffectsDeclaration` to `WebGLDeclaration`.
- Export `WebGLEffectsDeclaration`, `WebGLMaterialDeclaration`, and `WebGLMotionDeclaration` from the root public entrypoint.
- Support only:
  - `material: { kind: "solid", color?: number, opacity?: number }`
  - `motion: { kind: "pointer-tilt", strength?: number, maxDegrees?: number }`
- Keep public Three.js `renderOrder`, `transparent`, and `depthWrite` rejected.
- Do not export internal effect target, scene object, scene adapter, or render policy types.

## Implementation Tasks

- [x] Public type tests accept the new declaration and keep rejecting internal fields.
- [x] Internal effect normalization defaults and clamps material/motion inputs.
- [x] Element snapshot scene objects expose an internal effect target for material and transform updates.
- [x] `solid` material makes only element snapshot anchors visibly WebGL-owned.
- [x] `pointer-tilt` consumes shared `WebGLFrameInput.pointer` and resets when the pointer is outside.
- [x] Runtime creates, updates, errors, and disposes target-scoped effect controllers with renderables.
- [x] Demo adds one public-API-only effect harness target.
- [x] README, goal docs, execution state, and this plan reflect Phase 5 status and boundaries.
- [x] Full verification passes: `npm run test -- --run`, `npm run typecheck`, `npm run build`, `npm run check:imports`, and `git diff --check`.

## Boundary Rules

- No custom effect registry.
- No shader authoring API.
- No particles.
- No third-party scroll adapters.
- No raycast picking.
- No multiple canvases.
- No public Three.js render flags.
- No CSS-to-WebGL fidelity expansion.
- No demo key, asset path, class name, DOM structure, or copy branches in runtime/package code.
