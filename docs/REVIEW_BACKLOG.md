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

## Non-blocking Issues

- ID: R-002
- Severity: non-blocking
- Related task: Task 13: Resource Record Lifecycle
- Files:
  - `packages/dom-webgl-runtime/src/lib/resources/resourceManager.ts`
  - `packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts`
- Problem: `normalizeResourceUrl()` returns only `pathname + search + hash`, so two absolute URLs with different origins but the same path would share the same model resource key.
- Why it violates the plan: Task 13 requires resource cache keys by normalized URL. The current behavior is adequate for app-local relative URLs but ambiguous for absolute URLs.
- Suggested fix: Preserve origin for absolute URLs, while keeping stable relative URL normalization for local paths. Add a targeted test proving different absolute origins do not collide.
- Verification command: `npm test -- --run packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts && git diff --check`

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
