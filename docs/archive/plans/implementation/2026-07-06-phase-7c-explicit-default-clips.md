# Phase 7C Explicit Default Clips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit multi-clip defaults for scene-native `WebGLModel` so an app can declaratively start several named GLB clips together without adding a broad `playAllClips` switch, action graph, state machine, or raw Three.js access.

**Architecture:** Keep React authoring descriptor-driven: `WebGLModel` remains a null component nested under `WebGLScene`, and `animation.defaultClips` is ordinary descriptor data passed through props. Runtime normalization folds legacy `defaultClip` and new `defaultClips` into a single internal list, then starts each named clip once through the existing controlled `ModelAnimationController.play(...)` facade. No raw `AnimationMixer`, `AnimationAction`, scene, camera, object, mesh, material, texture, render target, renderer, or render-loop handles are exposed.

**Tech Stack:** TypeScript, React descriptor components, existing runtime-owned Three.js animation controller, Vitest/jsdom, Playwright browser smoke, npm workspaces, existing Phase 7B `WebGLModel.prepare.renderWarmup` path.

---

## Context Verified For This Plan

- Phase 7B is verified in the active roadmap and docs. It corrected the dogfood to use `MainSkeleton.001`, added `prepare={{ renderWarmup: "idle" }}`, added skeleton-safe clone behavior, and recorded profile notes.
- Current public `WebGLModelAnimationDeclaration` supports only `defaultClip`, `scrub`, `blend`, and `morphs`.
- Current `apps/example/src/ManagedModelAnimationExample.tsx` declares only one default clip:
  `defaultClip: { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160 }`.
- `Sprint.glb` includes many independent clips. The explicit multi-clip dogfood should start only known, intentional clips. This plan uses:
  - `MainSkeleton.001` for the main character skeleton;
  - `SpeedLines.001` for visible scene motion;
  - `BagArmature.001` for the bag sub-rig.
- This is not a `playAllClips` feature. The API must not start every clip in an asset by default because `Sprint.glb` has many object-level clips and unrelated tracks.
- User constraints for this plan:
  - Keep React mental model: declarative components, props/descriptor driven, nesting communicates ownership.
  - API must be agent-first, clearly named, clearly scoped, and have clear defaults.
  - Prefer Three-like vocabulary where it improves comprehension: `position`, `rotation`, `scale`, `material`, `lights`, `camera`, `scene`, `animation`, `renderPass`.
  - Expose only managed descriptors and controlled facades, not raw Three.js ownership.
  - Keep modules small, low-coupled, cohesive, single-responsibility, and data flow explicit.
  - Do not over-design.

## Scope

Implement the smallest complete Phase 7C:

- Add `animation.defaultClips` as an explicit list of named default clip playback declarations.
- Preserve `animation.defaultClip` for existing single-clip users.
- Let `defaultClip` and `defaultClips` compose by normalizing both into one internal list. `defaultClip` comes first for backward-compatible ordering.
- Start each normalized default clip once when the model becomes ready.
- Reuse existing `ModelAnimationController.play(...)`, active clip debug, and missing-clip diagnostics.
- Update the Phase 7 model dogfood to use `defaultClips` for `MainSkeleton.001`, `SpeedLines.001`, and `BagArmature.001`.
- Verify browser debug state shows all declared default clips as active and no missing-clip diagnostic.

## Non-Goals

- Do not add `playAllClips`, wildcard clips, regex matching, clip groups, animation graphs, additive layers, IK, retargeting, bone attachments, state machines, or clip priority rules.
- Do not add weights to `defaultClips`. Weighted transitions remain `blend` / `crossFade` work.
- Do not add scene-native `WebGLModel.effects`; that remains Phase 8 object/effect scope design.
- Do not expose raw `AnimationMixer`, `AnimationAction`, `Object3D`, `Mesh`, `Material`, `Texture`, `Bone`, `Skeleton`, renderer, scene, camera, render pass, render target, composer, or render-loop handles.
- Do not use React state churn or GSAP timelines to start clips. The runtime owns playback.
- Do not infer clip names from the GLB. Agents and applications must name the clips they want.

## File Structure

- Modify `packages/dom-webgl-runtime/src/lib/types.ts`
  - Adds `defaultClips?: readonly WebGLModelClipPlaybackDeclaration[]`.
- Modify `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts`
  - Normalizes `defaultClip` + `defaultClips` into one internal list and starts all defaults once.
- Modify `packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts`
  - Covers combined legacy/default list playback and missing diagnostics.
- Modify `packages/dom-webgl-runtime/test/lib/react/WebGLModel.test.tsx`
  - Verifies `defaultClips` remains React descriptor data.
- Modify `packages/dom-webgl-runtime/test/publicExports.test.ts`
  - Guards public type shape and raw handle rejection.
- Modify `apps/example/src/ManagedModelAnimationExample.tsx`
  - Uses explicit `defaultClips` in the dogfood.
- Modify `apps/example/test/ManagedModelAnimationExample.test.tsx`
  - Updates dogfood prop expectations.
- Modify `apps/example/test/App.test.tsx`
  - Updates app-level dogfood order/props expectations if it asserts model animation details.
- Modify `apps/example/test/managedModelAssetContract.test.ts`
  - Asserts all dogfood clip names exist in `Sprint.glb`.
- Modify `README.md`, `docs/STATUS.md`, `docs/examples/effect-authoring.md`, `docs/agent/package-onboarding.md`, `docs/agent/package-usage.md`, and `docs/roadmap/managed-render-system.md`
  - Documents `defaultClips`, keeps `defaultClip`, and clarifies that this is not `playAllClips`.

## Public API Direction

Add one field:

```ts
export type WebGLModelAnimationDeclaration = {
  readonly defaultClip?: WebGLModelClipPlaybackDeclaration;
  readonly defaultClips?: readonly WebGLModelClipPlaybackDeclaration[];
  readonly scrub?: WebGLModelClipScrubDeclaration;
  readonly blend?: WebGLModelClipBlendDeclaration;
  readonly morphs?: readonly WebGLModelMorphWeightDeclaration[];
};
```

Usage:

```tsx
<WebGLModel
  id="example.managedModel.sprint"
  src="/models/Sprint.glb"
  loader={{ draco: { decoderPath: "/draco/gltf/", preload: true } }}
  position={[240, -60, -80]}
  rotation={[0, 0, 0]}
  scale={8}
  prepare={{ renderWarmup: "idle" }}
  animation={{
    defaultClips: [
      { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160 },
      { clip: "SpeedLines.001", loop: "repeat" },
      { clip: "BagArmature.001", loop: "repeat" },
    ],
  }}
/>
```

Defaults and compatibility:

- `defaultClip` remains valid and behaves exactly as before.
- `defaultClips` omitted means no multi-clip default playback.
- If both are present, runtime starts `defaultClip` first, then each `defaultClips` entry in array order.
- Missing names remain controlled diagnostics through existing `missing-clip` debug entries.
- Duplicate clip names are not a new public feature. If an app lists the same clip twice, the existing action map means the later play call can reset the same action. Docs should tell authors to list each default clip once.

## Tasks

### Task 1: Lock The Multi-Clip Dogfood Asset Contract

**Files:**
- Modify: `apps/example/test/managedModelAssetContract.test.ts`

- [ ] **Step 1: Add failing asset assertions for all explicit dogfood clips**

In `apps/example/test/managedModelAssetContract.test.ts`, extend the existing `Sprint.glb` contract test:

```ts
const dogfoodClipNames = [
  "MainSkeleton.001",
  "SpeedLines.001",
  "BagArmature.001",
] as const;

describe("managed model dogfood asset contract", () => {
  test("uses explicit Sprint clips that exist in the GLB", () => {
    const glb = readGLBJSON("apps/example/public/models/Sprint.glb");

    for (const clip of dogfoodClipNames) {
      expect(readAnimation(glb, clip).channels.length).toBeGreaterThan(0);
    }
  });

  test("uses the Sprint main skeleton clip for visible animation dogfood", () => {
    const glb = readGLBJSON("apps/example/public/models/Sprint.glb");
    const mainSkeleton = readAnimation(glb, "MainSkeleton.001");
    const bag = readAnimation(glb, "BagArmature.001");

    expect(mainSkeleton.channels.length).toBeGreaterThanOrEqual(80);
    expect(bag.channels.length).toBeLessThan(mainSkeleton.channels.length);
    expect(
      mainSkeleton.channels.some((channel) =>
        readNodeName(glb, channel.target.node).startsWith("mixamorig:"),
      ),
    ).toBe(true);
  });
});
```

Keep the existing `readGLBJSON(...)`, `readAnimation(...)`, and `readNodeName(...)` helpers.

- [ ] **Step 2: Run the asset contract**

Run:

```bash
npm test -- --run apps/example/test/managedModelAssetContract.test.ts
```

Expected: PASS. This task should not require package code changes; it proves the chosen explicit clip names exist before API work starts.

### Task 2: Add Public Type And React Descriptor Coverage

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/react/WebGLModel.test.tsx`
- Modify: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [ ] **Step 1: Add failing React passthrough coverage**

In `packages/dom-webgl-runtime/test/lib/react/WebGLModel.test.tsx`, extend the existing model registration test or add a new one:

```tsx
test("passes explicit default clips through as descriptor data", async () => {
  const runtime = createRuntimeHarness();

  render(
    createElement(
      RuntimeContext.Provider,
      { value: runtime },
      createElement(
        WebGLSceneContext.Provider,
        { value: "world" },
        createElement(WebGLModel, {
          id: "character",
          src: "/models/Sprint.glb",
          animation: {
            defaultClips: [
              { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160 },
              { clip: "SpeedLines.001", loop: "repeat" },
              "BagArmature.001",
            ],
          },
        }),
      ),
    ),
  );

  expect(runtime.registerModel).toHaveBeenCalledWith(
    expect.objectContaining({
      id: "character",
      sceneId: "world",
      src: "/models/Sprint.glb",
      animation: {
        defaultClips: [
          { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160 },
          { clip: "SpeedLines.001", loop: "repeat" },
          "BagArmature.001",
        ],
      },
    }),
  );
});
```

Use the exact local harness names in the file. Do not introduce JSX.

- [ ] **Step 2: Run the React test to verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/react/WebGLModel.test.tsx
```

Expected: TypeScript/test failure because `WebGLModelAnimationDeclaration` has no `defaultClips`.

- [ ] **Step 3: Add `defaultClips` to the public type**

In `packages/dom-webgl-runtime/src/lib/types.ts`, update `WebGLModelAnimationDeclaration`:

```ts
export type WebGLModelAnimationDeclaration = {
  readonly defaultClip?: WebGLModelClipPlaybackDeclaration;
  readonly defaultClips?: readonly WebGLModelClipPlaybackDeclaration[];
  readonly scrub?: WebGLModelClipScrubDeclaration;
  readonly blend?: WebGLModelClipBlendDeclaration;
  readonly morphs?: readonly WebGLModelMorphWeightDeclaration[];
};
```

No `WebGLModel.tsx` implementation change should be needed because `animation` is already passed through as descriptor data.

- [ ] **Step 4: Add public export guard coverage**

In `packages/dom-webgl-runtime/test/publicExports.test.ts`, add a compile sample near the existing model animation declarations:

```ts
const explicitDefaultClips = [
  { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160 },
  { clip: "SpeedLines.001", loop: "repeat" },
  "BagArmature.001",
] satisfies WebGLModelClipPlaybackDeclaration[];

const modelAnimation = {
  defaultClips: explicitDefaultClips,
} satisfies WebGLModelAnimationDeclaration;

modelAnimation.defaultClips?.map((clip) =>
  typeof clip === "string" ? clip : clip.clip,
);

// @ts-expect-error model animation descriptors must not expose raw mixers
const invalidAnimation: WebGLModelAnimationDeclaration = { mixer: {} };

// @ts-expect-error defaultClips must be an explicit readonly list of playback declarations
const invalidDefaultClips: WebGLModelAnimationDeclaration = { defaultClips: true };
```

Adapt to the file's existing source-string pattern.

- [ ] **Step 5: Verify type and React coverage**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/react/WebGLModel.test.tsx packages/dom-webgl-runtime/test/publicExports.test.ts
npm run typecheck -w @project/dom-webgl-runtime
```

Expected: tests and package typecheck pass.

### Task 3: Normalize And Play Multiple Default Clips In The Registry

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts`
- Modify: `packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts`

- [ ] **Step 1: Add failing registry test for multiple defaults**

In `packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts`, add:

```ts
test("starts legacy and explicit default clips once in declaration order", async () => {
  const worldAdapter = createSceneAdapter();
  const registry = createRegistry({
    worldAdapter,
    loadModel: async () => ({
      scene: new Group(),
      animations: [
        new AnimationClip("Idle", 1, []),
        new AnimationClip("MainSkeleton.001", 1, []),
        new AnimationClip("SpeedLines.001", 1, []),
        new AnimationClip("BagArmature.001", 1, []),
      ],
    }),
  });

  registry.registerModel({
    id: "character",
    sceneId: "world",
    src: "/models/Sprint.glb",
    animation: {
      defaultClip: { clip: "Idle", loop: "repeat" },
      defaultClips: [
        { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160 },
        { clip: "SpeedLines.001", loop: "repeat" },
        "BagArmature.001",
      ],
    },
  });

  await registry.update({ delta: 16 }, { get: () => 0 });
  await registry.update({ delta: 16 }, { get: () => 0 });

  expect(registry.inspect().models[0]).toMatchObject({
    clips: ["Idle", "MainSkeleton.001", "SpeedLines.001", "BagArmature.001"],
    activeClips: ["Idle", "MainSkeleton.001", "SpeedLines.001", "BagArmature.001"],
  });
});
```

- [ ] **Step 2: Add failing diagnostics coverage for missing explicit clips**

In the same test file, add:

```ts
test("reports missing explicit default clips without throwing", async () => {
  const worldAdapter = createSceneAdapter();
  const registry = createRegistry({
    worldAdapter,
    loadModel: async () => ({
      scene: new Group(),
      animations: [new AnimationClip("MainSkeleton.001", 1, [])],
    }),
  });

  registry.registerModel({
    id: "character",
    sceneId: "world",
    src: "/models/Sprint.glb",
    animation: {
      defaultClips: ["MainSkeleton.001", "MissingSceneClip"],
    },
  });

  await registry.update({ delta: 16 }, { get: () => 0 });
  await registry.update({ delta: 16 }, { get: () => 0 });

  expect(registry.inspect().models[0]).toMatchObject({
    activeClips: ["MainSkeleton.001"],
    diagnostics: [{ kind: "missing-clip", name: "MissingSceneClip" }],
  });
});
```

- [ ] **Step 3: Run the registry tests to verify failure**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts
```

Expected: compile/test failure because normalization and playback do not support `defaultClips`.

- [ ] **Step 4: Normalize default clips to one internal list**

In `packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts`, change the normalized animation type:

```ts
type NormalizedModelAnimationDeclaration = {
  readonly defaultClips: readonly NormalizedModelClipPlaybackDeclaration[];
  readonly scrub?: NormalizedModelClipScrubDeclaration;
  readonly blend?: NormalizedModelClipBlendDeclaration;
  readonly morphs: readonly NormalizedModelMorphWeightDeclaration[];
};
```

Rename entry state from `defaultClipStarted` to:

```ts
readonly defaultClipsStarted?: boolean;
```

Update `normalizeModelAnimationDeclaration(...)`:

```ts
function normalizeModelAnimationDeclaration(
  declaration: WebGLModelAnimationDeclaration,
): NormalizedModelAnimationDeclaration {
  return {
    defaultClips: [
      ...(declaration.defaultClip
        ? [normalizeClipPlaybackDeclaration(declaration.defaultClip)]
        : []),
      ...(declaration.defaultClips ?? []).map(normalizeClipPlaybackDeclaration),
    ],
    ...(declaration.scrub
      ? { scrub: normalizeClipScrubDeclaration(declaration.scrub) }
      : {}),
    ...(declaration.blend
      ? { blend: normalizeClipBlendDeclaration(declaration.blend) }
      : {}),
    morphs: (declaration.morphs ?? []).map(normalizeMorphWeightDeclaration),
  };
}
```

- [ ] **Step 5: Start all default clips once**

Update `updateEntryAnimation(...)`:

```ts
if (
  animation &&
  declaration.defaultClips.length > 0 &&
  !entry.defaultClipsStarted
) {
  for (const clip of declaration.defaultClips) {
    animation.play(clip.clip, clip.options);
  }
  Object.assign(entry, { defaultClipsStarted: true });
}
```

Keep the rest of scrub, blend, morph, and `animation?.update(deltaMilliseconds)` unchanged.

- [ ] **Step 6: Verify registry behavior**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts
```

Expected: registry tests pass, including existing single `defaultClip` coverage.

### Task 4: Dogfood Explicit Default Clips In The Example

**Files:**
- Modify: `apps/example/src/ManagedModelAnimationExample.tsx`
- Modify: `apps/example/test/ManagedModelAnimationExample.test.tsx`
- Modify: `apps/example/test/App.test.tsx`

- [ ] **Step 1: Update failing example expectations**

In `apps/example/test/ManagedModelAnimationExample.test.tsx`, update expected animation:

```tsx
animation: {
  defaultClips: [
    { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160 },
    { clip: "SpeedLines.001", loop: "repeat" },
    { clip: "BagArmature.001", loop: "repeat" },
  ],
},
```

In `apps/example/test/App.test.tsx`, update any matching `example.managedModel.sprint` assertion to the same shape.

- [ ] **Step 2: Run app tests to verify failure**

Run:

```bash
npm test -- --run apps/example/test/ManagedModelAnimationExample.test.tsx apps/example/test/App.test.tsx
```

Expected: failure because the example still declares single `defaultClip`.

- [ ] **Step 3: Update the dogfood descriptor**

In `apps/example/src/ManagedModelAnimationExample.tsx`, change:

```tsx
const sprintModelAnimation = {
  defaultClips: [
    { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160 },
    { clip: "SpeedLines.001", loop: "repeat" },
    { clip: "BagArmature.001", loop: "repeat" },
  ],
} satisfies NonNullable<WebGLModelProps["animation"]>;
```

Keep `sprintModelPrepare` unchanged:

```tsx
const sprintModelPrepare = {
  renderWarmup: "idle",
} satisfies NonNullable<WebGLModelProps["prepare"]>;
```

- [ ] **Step 4: Verify app tests pass**

Run:

```bash
npm test -- --run apps/example/test/ManagedModelAnimationExample.test.tsx apps/example/test/App.test.tsx apps/example/test/managedModelAssetContract.test.ts
```

Expected: all three app tests pass.

### Task 5: Update Documentation And Roadmap Truth

**Files:**
- Modify: `README.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/roadmap/managed-render-system.md`

- [ ] **Step 1: Add Phase 7C to roadmap status**

In `docs/roadmap/managed-render-system.md`, add a row after Phase 7B:

```md
| Phase 7C: Explicit Default Clips | `[planned]` | [2026-07-06-phase-7c-explicit-default-clips.md](../superpowers/plans/2026-07-06-phase-7c-explicit-default-clips.md) | Adds descriptor-driven `animation.defaultClips` for intentional multi-clip startup on scene-native models while preserving `defaultClip` and avoiding `playAllClips`, action graphs, or raw mixers. |
```

Update the phase dependency order:

```text
Phase 7C -> explicit multi-clip defaults
```

Update the recommended next step to say Phase 7C comes before Phase 8.

- [ ] **Step 2: Add a short Phase 7C roadmap section**

Add before Phase 8:

```md
### Phase 7C: Explicit Default Clips

- **Status:** `[planned]`
- **Focused plan:** [2026-07-06-phase-7c-explicit-default-clips.md](../superpowers/plans/2026-07-06-phase-7c-explicit-default-clips.md)
- **Depends on:** Phase 7B
- **Last updated:** 2026-07-06
- **Exit criteria:** `WebGLModel.animation.defaultClips` can start several explicitly named clips once, reports active clips and missing clip diagnostics, preserves `defaultClip`, and dogfoods Sprint's main skeleton, speed lines, and bag clips without exposing raw animation internals.

Rules:

- This is explicit multi-clip startup, not `playAllClips`.
- `defaultClip` remains the single-clip shorthand.
- Do not add action graphs, state machines, clip weights, retargeting, or raw `AnimationMixer` access.
```

- [ ] **Step 3: Update status/docs examples**

In `docs/STATUS.md`, add:

```md
Phase 7C is planned next and adds explicit `WebGLModel.animation.defaultClips`
for intentional multi-clip defaults while preserving `defaultClip`. It does not
add `playAllClips`, animation graphs, state machines, or raw mixer/action
access.
```

In `README.md`, `docs/examples/effect-authoring.md`, `docs/agent/package-onboarding.md`, and `docs/agent/package-usage.md`, update the `WebGLModel` examples to show:

```tsx
animation={{
  defaultClips: [
    { clip: "MainSkeleton.001", loop: "repeat", fadeInMs: 160 },
    { clip: "SpeedLines.001", loop: "repeat" },
    { clip: "BagArmature.001", loop: "repeat" },
  ],
}}
```

Also add:

```md
Use `defaultClips` only for clips the app intentionally wants to start
together. It is not a `playAllClips` shortcut, and the runtime does not infer
which exported GLB clips are meaningful.
```

- [ ] **Step 4: Verify docs text**

Run:

```bash
rg -n "defaultClips|playAllClips|Phase 7C|MainSkeleton\\.001|SpeedLines\\.001|BagArmature\\.001" README.md docs apps/example/src apps/example/test packages/dom-webgl-runtime/src packages/dom-webgl-runtime/test
```

Expected:

- `defaultClips` appears in types, tests, example dogfood, and docs.
- `playAllClips` appears only in non-goal or explanatory docs.
- All three dogfood clips appear in example descriptor/tests/docs.

### Task 6: Browser Verification And Full Closeout

**Files:**
- No new implementation files.
- Uses app runtime and browser verification.

- [ ] **Step 1: Run full validation**

Run:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Expected:

- All tests pass.
- Typecheck passes.
- Build passes. Existing Vite chunk-size warnings are acceptable if unchanged.
- `Example import boundary OK`.
- `git diff --check` reports no whitespace errors.

- [ ] **Step 2: Run the example app**

Run:

```bash
npm run dev -w @project/dom-webgl-example
```

Open the local URL printed by Vite.

- [ ] **Step 3: Verify multi-clip dogfood in browser**

Use Playwright to scroll to the Phase 7 model row and verify:

- Console errors: 0.
- The model viewport renders non-background pixels.
- `runtime.getDebugState().models` contains `example.managedModel.sprint`.
- The model debug record includes:
  - `resourceStatus: "ready"`;
  - `clips` containing `MainSkeleton.001`, `SpeedLines.001`, and `BagArmature.001`;
  - `activeClips` containing `MainSkeleton.001`, `SpeedLines.001`, and `BagArmature.001`;
  - `prepare.renderWarmup: "complete"`;
  - no `missing-clip` diagnostic for the three declared default clips.

Use two screenshots separated by at least 700 ms to confirm visible animation still changes pixels:

```ts
const before = await page.screenshot({
  path: "/tmp/phase7c-model-before.png",
});
await page.waitForTimeout(700);
const after = await page.screenshot({
  path: "/tmp/phase7c-model-after.png",
});
// Compare the cropped model viewport. Expected: changed pixels > 0.
```

- [ ] **Step 4: Commit after verification**

Only after all checks pass:

```bash
git add \
  README.md \
  docs/STATUS.md \
  docs/examples/effect-authoring.md \
  docs/agent/package-onboarding.md \
  docs/agent/package-usage.md \
  docs/roadmap/managed-render-system.md \
  docs/superpowers/plans/2026-07-06-phase-7c-explicit-default-clips.md \
  apps/example/src/ManagedModelAnimationExample.tsx \
  apps/example/test/ManagedModelAnimationExample.test.tsx \
  apps/example/test/App.test.tsx \
  apps/example/test/managedModelAssetContract.test.ts \
  packages/dom-webgl-runtime/src/lib/types.ts \
  packages/dom-webgl-runtime/src/lib/renderer/managedModelRegistry.ts \
  packages/dom-webgl-runtime/test/lib/renderer/managedModelRegistry.test.ts \
  packages/dom-webgl-runtime/test/lib/react/WebGLModel.test.tsx \
  packages/dom-webgl-runtime/test/publicExports.test.ts
git commit -m "feat: add explicit model default clips"
```

Expected: commit succeeds with only intentional files staged.

## Self-Review Checklist

- Spec coverage:
  - React mental model is preserved through descriptor props and scene nesting.
  - API is agent-first and explicit: `defaultClips`, not inferred all-clip playback.
  - Three-like naming stays close to existing `animation` and clip vocabulary.
  - Raw Three.js internals remain private.
  - Modules remain focused: public type, model registry normalization/playback, example dogfood, docs.
  - Scope does not include picking, physics, action graphs, or scene-native model effects.
- Placeholder scan:
  - No placeholder markers, deferred-fill instructions, or broad edge-case-only steps.
- Type consistency:
  - Public field is `animation.defaultClips`.
  - Element type is `WebGLModelClipPlaybackDeclaration`.
  - Existing `animation.defaultClip` remains valid.
  - Internal normalized field is `defaultClips`.
  - Dogfood clips are `MainSkeleton.001`, `SpeedLines.001`, and `BagArmature.001`.
