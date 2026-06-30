# Runtime Performance Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the DOM WebGL runtime from a correct continuous-loop architecture to an observable, budgeted, scheduler-aware performance model.

**Architecture:** Keep the current DOM-first, one-renderer, capability-handle model. Optimize by measuring cost first, then adding explicit budgets, render scheduling, resource load limits, and only later draw-call/postprocess specialization when profiling proves it is needed. Do not expose raw Three.js internals or add multiple canvases to solve performance.

**Tech Stack:** TypeScript, Three.js, React adapter, Vitest/jsdom, npm workspaces, existing CodeGraph-indexed runtime modules.

---

## Current Truth

- The current engine direction is not being replaced. It already has one fixed transparent canvas, `renderer.setAnimationLoop(...)`, capped DPR, batched layout reads, source/resource caching, dirty content invalidation, viewport lifecycle classification, and offscreen `restore-dom` / `park` policy.
- The remaining performance gap is production control, not a new renderer architecture: the runtime needs measurable budgets, lower idle work, resource concurrency limits, and better profiling hooks.
- `ctx.visual.requestPostprocess(...)` currently records named requests and returns managed handles. It does not yet execute bloom/grain/blur passes; real postprocess implementation belongs after scheduler and budget work.
- The "performance optimal solution" for this project is not a WebGPU rewrite. The next best step is: profile -> budget telemetry -> render-on-demand scheduler -> resource/load controls -> targeted batching/postprocess if data justifies it.

## File Structure

- Modify `packages/dom-webgl-runtime/src/lib/types.ts`: add public budget/debug types only if they are stable enough for downstream consumers.
- Modify `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`: include runtime budget warning records in debug state.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`: collect runtime counters, feed scheduler dirty signals, and emit budget warnings.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.ts`: allow continuous or demand-driven rendering without moving loop ownership back to React.
- Modify `packages/dom-webgl-runtime/src/lib/resources/resourceManager.ts`: preserve absolute origin for cache keys and add controlled load concurrency.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/postprocessController.ts`: after scheduler work, turn stored requests into real low-resolution passes.
- Modify `docs/00-goal.md`, `README.md`, `docs/EXECUTION_STATE.md`, and `docs/agent/package-usage.md`: keep current truth and roadmap status aligned.

## Task 1: Performance Budgets And Debug Warnings

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Test: `packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`
- Test: `packages/dom-webgl-runtime/src/publicExports.test.ts`

- [x] **Step 1: Write failing public/debug tests**

Add test coverage that expects debug state to expose warning records when active counts exceed conservative defaults:

```ts
expect(state.warnings).toContainEqual({
  code: "performance-budget-exceeded",
  target: "activeTargets",
  count: 51,
  limit: 50,
});
```

Also add a public type fixture proving `WebGLPerformanceBudget` is exported but raw renderer metrics are not.

- [x] **Step 2: Run the focused tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: fail before implementation because `warnings` and `WebGLPerformanceBudget` do not exist.

- [x] **Step 3: Add minimal budget types and default warning generation**

Add:

```ts
export type WebGLPerformanceBudget = {
  maxActiveTargets?: number;
  maxActiveSnapshots?: number;
  maxActiveVideos?: number;
  maxActiveModels?: number;
  maxTextureSize?: number;
  maxConcurrentResourceLoads?: number;
};

export type WebGLPerformanceWarning = {
  code: "performance-budget-exceeded";
  target:
    | "activeTargets"
    | "activeSnapshots"
    | "activeVideos"
    | "activeModels"
    | "textureSize"
    | "concurrentResourceLoads";
  count: number;
  limit: number;
};
```

Keep defaults internal. Start with target/snapshot/video/model counts; leave texture memory as a later measured field unless the implementation already has exact texture dimensions.

- [x] **Step 4: Verify focused tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: pass.

## Task 2: Demand-Driven Scheduler

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

- [x] **Step 1: Write failing scheduler tests**

Add tests for these contracts:

```ts
// Static scene renders the first frame, then stops until marked dirty.
expect(render).toHaveBeenCalledTimes(1);
loop.requestFrame("resource-ready");
tick(32);
expect(render).toHaveBeenCalledTimes(2);
```

```ts
// Active effects, gate targets, video, or pointer-driven targets keep continuous mode.
expect(loop.isContinuous()).toBe(true);
```

- [x] **Step 2: Run focused scheduler tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
```

Expected: fail before scheduler APIs exist.

- [x] **Step 3: Implement scheduler state without React ownership**

Keep `setAnimationLoop(...)` in the renderer host. Add internal state for:

```ts
type RenderSchedulingMode = "continuous" | "on-demand";
type RenderDirtyReason =
  | "initial"
  | "target-register"
  | "target-unregister"
  | "dom-invalidation"
  | "resource-ready"
  | "manual-sync";
```

Current implementation renders continuously only while a target has an active
per-frame need: declared gate target/progress, video playback, pointer-driven
target, or explicit effect declaration. Pending async resources do not force continuous
rendering; completion marks `resource-ready` dirty and renders one follow-up
frame.

- [x] **Step 4: Verify focused scheduler tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/rendererLoop.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
```

Expected: pass.

Status: implemented. Verification passed with 2 files / 47 tests.

## Task 3: Layout Measurement Candidate Reduction

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/layoutPass.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/layoutPass.test.ts`

- [ ] **Step 1: Write failing measurement tests**

Lock these cases:

```ts
expect(measureElement).toHaveBeenCalledTimes(1);
// Far disposed target remains skipped during small scroll deltas.
```

```ts
// A skipped target is remeasured after a large scroll delta or viewport resize.
expect(measureElement).toHaveBeenCalledTimes(2);
```

- [ ] **Step 2: Run focused measurement tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/renderer/layoutPass.test.ts
```

Expected: fail where candidate reduction is incomplete.

- [ ] **Step 3: Extend the existing rect skip state**

Use the existing `rectSkipState` as the small-step base. Add explicit invalidation on viewport resize, target dirty keys, and large scroll jumps. Keep computed style reads out of this path.

- [ ] **Step 4: Verify focused measurement tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/renderer/layoutPass.test.ts
```

Expected: pass.

## Task 4: Resource Cache Correctness And Load Pressure

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/resources/resourceManager.ts`
- Test: `packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts`
- Modify: `docs/REVIEW_BACKLOG.md`

- [x] **Step 1: Write failing cache-key and concurrency tests**

Add tests proving:

```ts
manager.acquire(createModelDescriptor("https://a.example.com/models/hero.glb"));
manager.acquire(createModelDescriptor("https://b.example.com/models/hero.glb"));
expect(first.record.key).not.toBe(second.record.key);
```

Add a load pressure test proving only `maxConcurrentResourceLoads` loaders are active at once.

- [x] **Step 2: Run focused resource tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts
```

Expected: fail before origin-preserving keys and concurrency control.

- [x] **Step 3: Preserve origin for absolute URLs**

Keep relative URLs normalized to path/search/hash. For absolute `http:` / `https:` / protocol-relative URLs, include origin:

```ts
return `${url.origin}${url.pathname}${url.search}${url.hash}`;
```

Add a tiny internal queue for resource loads. Do not move loading into renderables.

- [x] **Step 4: Verify and close R-002**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/resources/resourceManager.test.ts && git diff --check
```

Expected: pass. Move R-002 from non-blocking to resolved in `docs/REVIEW_BACKLOG.md`.

## Task 5: Real Postprocess Pass Implementation

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/postprocessController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/postprocessController.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

- [ ] **Step 1: Write failing postprocess tests**

Add tests proving:

```ts
controller.requestPostprocess({ key: "glow", bloom: { strength: 0.4 } });
controller.render(renderBase);
expect(renderBase).toHaveBeenCalledTimes(1);
expect(effectPass.render).toHaveBeenCalled();
```

Also test `dispose()` releases render targets and handles are idempotent.

- [ ] **Step 2: Run focused postprocess tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/postprocessController.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
```

Expected: fail because the current controller stores requests but renders only the base scene.

- [ ] **Step 3: Implement low-resolution, bounded postprocess**

Use the render-target pool and budget defaults. Start with a half-resolution path for blur/grain/bloom requests. Do not expose `EffectComposer`, passes, render targets, or pass ordering publicly.

- [ ] **Step 4: Verify focused postprocess tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/postprocessController.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
```

Expected: pass.

## Task 6: Profile-Gated Batching Decision

**Files:**
- Create: `docs/performance/profile-notes.md`
- Modify only if profiling proves need: renderable files under `packages/dom-webgl-runtime/src/lib/render/renderables/`

- [ ] **Step 1: Capture baseline profile**

Run the example and record target count, active renderables, frame time, draw calls if available, and whether idle pages keep rendering.

```bash
npm run dev -w @project/dom-webgl-example
```

Use browser performance tooling to record:

```txt
Scenario: idle page, scroll page, pinned section, GLB model, image sequence.
```

- [ ] **Step 2: Decide batching from evidence**

If draw calls dominate and targets are many identical planes, plan `InstancedMesh` or `BatchedMesh` for matching material/source families. If DOM measurement or texture upload dominates, do not batch yet; finish scheduler/resource work first.

- [ ] **Step 3: Save the decision**

Write the measured result to `docs/performance/profile-notes.md` with this exact structure:

```md
# Performance Profile Notes

## Baseline
- Date: Run `date -Iseconds` and paste the exact output on this line.
- Branch: Run `git branch --show-current` and paste the exact output on this line.
- Scenario: idle page, scroll page, pinned section, GLB model, image sequence
- Observed bottleneck: DOM measurement | texture upload | draw calls | resource loading | postprocess | no dominant bottleneck

## Decision
- Next optimization: Name one concrete next optimization chosen from the observed bottleneck.
- Deferred optimization: Name one optimization intentionally not selected.
- Reason: Write one sentence connecting the measured bottleneck to the decision.
```

## Final Verification

Run the full local verification before claiming roadmap implementation is complete:

```bash
npm run test -- --run && npm run typecheck && npm run build && npm run check:imports && git diff --check
```

Expected: all commands pass. The existing Vite chunk-size warning remains non-blocking unless it changes into a build failure.
