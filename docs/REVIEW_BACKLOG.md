# Review Backlog

## Review Date
2026-06-16

## Reviewed Range
- Last checked task: Task 14: DOM-Native Resource Adoption
- Reviewed milestones: M1 Project Skeleton, M2 Public Types, M3 Target Descriptor, M4 Source Descriptor Inference, M5 renderRole + Render Policy, M6 Resource Manager
- Reviewed commits: 70598bc through 70de992 (`Task 1: Root Workspace Skeleton` through `Fix review issues after M6 Resource Manager`)

## Blocking Issues

None.

## Resolved Blocking Issues

- ID: R-001
- Severity: resolved
- Related task: Task 14: DOM-Native Resource Adoption
- Files:
  - `packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts`
- Problem: `npm run typecheck` fails because the test helper functions return `WebGLSourceDescriptor`, then the tests access `.element` on values typed as the full source descriptor union. TypeScript correctly reports that `WebGLModelSourceDescriptor` has no `element` property.
- Why it violates the plan: Checked tasks should leave the repository type-clean. Task 14's targeted Vitest suite passes, but the workspace typecheck currently fails against the completed-task test file.
- Fix applied: Test helper return types were narrowed to concrete descriptor variants, so `.element` access is type-safe for image and video descriptors.
- Verification command: `npm run typecheck && npm test -- --run packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts && git diff --check`

## Resolved Non-blocking Issues

- ID: R-003
- Severity: resolved
- Related task: Task 13: Resource Record Lifecycle
- Files:
  - `packages/dom-webgl-runtime/src/lib/resources/resourceManager.ts`
  - `packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts`
- Problem: Resource URL normalization collapsed query-string and hash variants
  onto the same resource record, so `/models/hero.glb?tenant=a`,
  `/models/hero.glb?tenant=b`, and `/models/hero.glb#preview` could share one
  cache entry.
- Fix applied: URL normalization now preserves `pathname + search + hash` for
  protocol-relative, absolute HTTP(S), and relative/app-local URLs. Regression
  coverage proves query and hash variants acquire separate resource records.
- Verification command: `npm test -- --run packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts && npm run check && npm run build && npm run check:imports && git diff --check`

- ID: R-002
- Severity: resolved
- Related task: Task 13: Resource Record Lifecycle
- Files:
  - `packages/dom-webgl-runtime/src/lib/resources/resourceManager.ts`
  - `packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts`
- Problem: `normalizeResourceUrl()` returns only `pathname + search + hash`, so two absolute URLs with different origins but the same path would share the same model resource key.
- Fix applied: Absolute HTTP(S) and protocol-relative resource URLs now include
  origin plus `pathname + search + hash` in cache keys. Relative/app-local URLs
  keep path/search/hash normalization. Resource load pressure is also bounded
  by the runtime performance budget's `maxConcurrentResourceLoads`.
- Verification command: `npm test -- --run packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts && git diff --check`

## Resolved Runtime Performance Issues

- ID: R-004
- Severity: resolved
- Related task: Runtime performance roadmap
- Files:
  - `packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.ts`
  - `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
  - `packages/dom-webgl-runtime/src/lib/resources/resourceManager.ts`
  - `packages/dom-webgl-runtime/src/lib/renderer/layoutPass.ts`
  - `packages/dom-webgl-runtime/src/lib/renderer/postprocessController.ts`
  - `docs/performance/profile-notes.md`
- Problem: The runtime has the correct one-renderer, batched-layout foundation,
  and now has explicit performance budgets, debug warnings, and resource load
  pressure controls. Demand-driven idle scheduling is implemented for static
  scenes, with one-shot dirty frames for resource readiness and continuous
  rendering retained for active effects, declared gate targets, video, and
  pointer-driven targets.
- Fix applied: Runtime performance roadmap Tasks 1 through 6 are implemented or
  decided. Layout measurement candidates are reduced for stable offscreen
  targets, named postprocess requests run through bounded internal
  bloom/grain/blur passes, and `docs/performance/profile-notes.md` records the
  profile-gated batching decision: batching is deferred because no dominant
  draw-call bottleneck was proven across the measured scenarios.
- Verification command: `npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check`

## Non-blocking Issues

None currently recorded for the runtime performance roadmap closeout.

## Deferred / Not Phase 1

- Scene-gated scroll, scroll lock, `sceneProgress`, and reverse gate behavior are explicitly excluded from Phase 1 and must not be implemented while fixing the above issues.
- Effect registry, effect layer, and effect-owned resource pipelines are explicitly excluded from Phase 1 and must not be added while fixing the above issues.
- WebGL raycast picking and mesh-level interaction are excluded from Phase 1.
- Lenis and GSAP ScrollTrigger adapters are excluded from Phase 1.
- Class-based compatibility layers are excluded from Phase 1.
- Renderer/canvas creation is unchecked future scope until M8; do not add renderer or canvas behavior while fixing M1-M6 review issues.
- Base renderables, concrete renderables, renderable factory, page scroll input, pointer controller, React runtime components, demo public-import scanner, demo scene, debug panel, and final export contract belong to unchecked future tasks and should not be treated as missing in the reviewed range.

## Verification Commands To Run After Fixes

- `npm run typecheck`
- `npm test -- --run packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts`
- `npm test -- --run`
- `git diff --check`
