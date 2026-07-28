# Target-Scoped Pointer Contract Implementation Plan

**Status:** Completed on 2026-07-01.

**Completion note:** Implemented with Superpowers `executing-plans` in Task 1 through Task 7 order. The original per-task commit steps were folded into one final docs-aligned closeout commit after the user explicitly requested commit.

**Verification:** `npm run test -- --run`, `npm run typecheck`, `npm run build`, `npm run check:imports`, and `git diff --check` passed. `npm run build` still emits the existing non-blocking Vite chunk-size warning.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking; completed steps are checked below.

**Goal:** Define a real target-scoped pointer contract so effects can read `ctx.targetPointer` instead of hand-writing `ctx.pointer.x - ctx.layout.left`.

**Architecture:** Keep document-level pointer ownership in the runtime input layer. Add a pure target-local derivation helper that consumes frame input plus an already measured target layout; effect context, runtime scheduling, and debug state read that helper without installing new listeners or adding React state. React remains declarative: `WebGLTarget` forwards a stable `webgl.pointer` declaration and does not derive pointer state.

**Tech Stack:** TypeScript strict mode, Vitest with jsdom, React adapter type surface, existing WebGL runtime/effect controller/debug state modules.

---

## Scope And Public Contract

This is a breaking cleanup of the unfinished pointer declaration semantics. Do not preserve `pointer.move` as a public contract. The new public declaration is target-semantic, not event-semantic:

```ts
export type WebGLPointerDeclaration = {
  hover?: boolean;
  press?: boolean;
  click?: boolean;
  drag?: boolean;
};
```

Do not add `longPress` to `WebGLPointerDeclaration` in this iteration. Runtime exposes live `pressDuration`; effects that need long-press behavior define their own threshold in effect params.

New target-local effect context:

```ts
export type WebGLTargetPointerState = {
  localX: number;
  localY: number;
  normalizedX: number;
  normalizedY: number;
  isInside: boolean;
  isPressed: boolean;
  pressDuration: number;
  isDragging: boolean;
  dragStartLocalX: number;
  dragStartLocalY: number;
  dragDeltaX: number;
  dragDeltaY: number;
  lastClickTime?: number;
  clickCount: number;
};
```

`ctx.pointer` remains runtime/canvas coordinate state. `ctx.targetPointer` is layout-local for the current target. It is not inverse-transformed picking for rotated targets, transformed subtrees, models, or custom meshes.

## File Structure

- `packages/dom-webgl-runtime/src/lib/types.ts`
  - Owns public runtime declaration and debug state types.
  - Add `WebGLTargetPointerState`.
  - Replace `WebGLPointerDeclaration` fields with `hover`, `press`, `click`, `drag`.
  - Add optional target debug pointer field.
- `packages/dom-webgl-runtime/src/lib/input/targetPointer.ts`
  - New pure helper. Single responsibility: derive target-local pointer state from `WebGLFrameInput` and `ElementLayoutSnapshot`.
  - No DOM reads, no event listeners, no renderer imports.
- `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
  - Add `targetPointer` to `WebGLEffectContext`.
- `packages/dom-webgl-runtime/src/lib/effects/effectContext.ts`
  - Create initial `targetPointer` when an effect context is first built.
- `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`
  - Refresh reusable context `targetPointer` on each update.
- `packages/dom-webgl-runtime/src/lib/input/pointerController.ts`
  - Add an optional state-change callback. Keep listener ownership centralized.
- `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Request `"pointer"` frames only when a registered target declares pointer semantics.
  - Use pointer declarations as dirty reasons, not as a permanent continuous-render switch.
  - Store target-local pointer debug snapshots in existing target debug records.
- `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
  - Copy optional target pointer debug state into public debug snapshots.
- Tests stay outside `src/`:
  - `packages/dom-webgl-runtime/test/lib/input/targetPointer.test.ts`
  - `packages/dom-webgl-runtime/test/lib/input/pointerController.test.ts`
  - `packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts`
  - `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`
  - `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`
  - `packages/dom-webgl-runtime/test/publicExports.test.ts`
- Docs:
  - `README.md`
  - `docs/agent/package-usage.md`
  - `docs/agent/package-onboarding.md`
  - `docs/examples/effect-authoring.md`
  - `docs/agent/effect-authoring-example-report.md`

---

### Task 1: Public Pointer Types

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
- Modify: `packages/dom-webgl-runtime/src/index.ts`
- Test: `packages/dom-webgl-runtime/test/publicExports.test.ts`

- [x] **Step 1: Write the failing public type test**

In `packages/dom-webgl-runtime/test/publicExports.test.ts`, update the generated fixture inside the `root entrypoint type-checks public types and hides internal types` test so the pointer block reads:

```ts
        const pointerDeclaration = {
          hover: true,
          press: true,
          click: true,
          drag: true,
        } satisfies WebGLPointerDeclaration;

        const targetPointer = {
          localX: 24,
          localY: 16,
          normalizedX: -0.2,
          normalizedY: 0.5,
          isInside: true,
          isPressed: true,
          pressDuration: 320,
          isDragging: true,
          dragStartLocalX: 8,
          dragStartLocalY: 10,
          dragDeltaX: 16,
          dragDeltaY: 6,
          lastClickTime: 1000,
          clickCount: 1,
        } satisfies WebGLTargetPointerState;

        targetPointer satisfies WebGLTargetPointerState;

        // @ts-expect-error pointer.move is an event-level name, not the public target pointer contract.
        ({ move: true } satisfies WebGLPointerDeclaration);
        // @ts-expect-error long-press thresholds belong to effect params, not runtime pointer declarations.
        ({ longPress: true } satisfies WebGLPointerDeclaration);
```

Add `WebGLTargetPointerState` to the fixture import list next to `WebGLPointerState`.

- [x] **Step 2: Run the public type test and verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: FAIL because `WebGLTargetPointerState` is not exported and `WebGLPointerDeclaration` still accepts `move`.

- [x] **Step 3: Add the public types**

In `packages/dom-webgl-runtime/src/lib/types.ts`, replace `WebGLPointerDeclaration` and add `WebGLTargetPointerState`:

```ts
export type WebGLPointerDeclaration = {
  hover?: boolean;
  press?: boolean;
  click?: boolean;
  drag?: boolean;
};

export type WebGLTargetPointerState = {
  localX: number;
  localY: number;
  normalizedX: number;
  normalizedY: number;
  isInside: boolean;
  isPressed: boolean;
  pressDuration: number;
  isDragging: boolean;
  dragStartLocalX: number;
  dragStartLocalY: number;
  dragDeltaX: number;
  dragDeltaY: number;
  lastClickTime?: number;
  clickCount: number;
};
```

In `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`, add the type import and context field:

```ts
import type {
  WebGLFrameInput,
  WebGLProgressSignalSource,
  WebGLTargetPointerState,
} from "../types";

export type WebGLEffectContext = {
  key: string;
  sourceKind: WebGLEffectSourceKind;
  layout: ElementLayoutSnapshot;
  input: WebGLFrameInput;
  pointer: WebGLFrameInput["pointer"];
  targetPointer: WebGLTargetPointerState;
  scroll: WebGLFrameInput["scroll"];
  scrollProgress: number;
  progress: WebGLProgressSignalSource;
  visual: WebGLEffectVisualContext;
  time: number;
  delta: number;
  source: WebGLEffectSourceHandle;
  target: WebGLEffectTargetHandle | undefined;
  resources: WebGLEffectResourceScope;
};
```

If `effectAuthoring.ts` currently imports these public types from `../types` in a different grouping, keep the local import style and add only `WebGLTargetPointerState`.

In `packages/dom-webgl-runtime/src/index.ts`, add:

```ts
  WebGLTargetPointerState,
```

to the type export list from `./lib/types`.

- [x] **Step 4: Run the public type test and verify it passes**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/publicExports.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/types.ts packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts packages/dom-webgl-runtime/src/index.ts packages/dom-webgl-runtime/test/publicExports.test.ts
git commit -m "feat: define target pointer public contract"
```

---

### Task 2: Target Pointer Derivation Helper

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/input/targetPointer.ts`
- Test: `packages/dom-webgl-runtime/test/lib/input/targetPointer.test.ts`

- [x] **Step 1: Write failing helper tests**

Create `packages/dom-webgl-runtime/test/lib/input/targetPointer.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { createTargetPointerState } from "../../../src/lib/input/targetPointer";
import type { WebGLFrameInput, WebGLPointerState } from "../../../src/lib/types";
import type { ElementLayoutSnapshot } from "../../../src/lib/renderer/layoutPass";

describe("createTargetPointerState", () => {
  test("maps runtime pointer coordinates into target-local coordinates", () => {
    const input = createFrameInput({
      x: 150,
      y: 90,
      normalizedX: -0.25,
      normalizedY: 0.4,
      isInside: true,
    });
    const layout = createLayoutSnapshot({
      left: 100,
      top: 50,
      width: 200,
      height: 100,
    });

    expect(createTargetPointerState(input, layout)).toMatchObject({
      localX: 50,
      localY: 40,
      normalizedX: -0.5,
      normalizedY: 0.2,
      isInside: true,
      isPressed: false,
    });
  });

  test("reports outside target even when the pointer is inside the runtime stage", () => {
    const input = createFrameInput({
      x: 350,
      y: 90,
      isInside: true,
    });
    const layout = createLayoutSnapshot({
      left: 100,
      top: 50,
      width: 200,
      height: 100,
    });

    expect(createTargetPointerState(input, layout)).toMatchObject({
      localX: 250,
      localY: 40,
      normalizedX: 1.5,
      normalizedY: 0.2,
      isInside: false,
    });
  });

  test("computes live press duration from frame time while pressed", () => {
    const input = createFrameInput({
      time: 900,
      x: 150,
      y: 90,
      isInside: true,
      isDown: true,
      downTime: 250,
      pressDuration: 0,
    });
    const layout = createLayoutSnapshot({
      left: 100,
      top: 50,
      width: 200,
      height: 100,
    });

    expect(createTargetPointerState(input, layout)).toMatchObject({
      isPressed: true,
      pressDuration: 650,
    });
  });

  test("maps drag start into target-local coordinates", () => {
    const input = createFrameInput({
      x: 160,
      y: 95,
      isInside: true,
      isDown: true,
      isDragging: true,
      dragStartX: 120,
      dragStartY: 70,
      dragDeltaX: 40,
      dragDeltaY: 25,
    });
    const layout = createLayoutSnapshot({
      left: 100,
      top: 50,
      width: 200,
      height: 100,
    });

    expect(createTargetPointerState(input, layout)).toMatchObject({
      dragStartLocalX: 20,
      dragStartLocalY: 20,
      dragDeltaX: 40,
      dragDeltaY: 25,
      isDragging: true,
    });
  });
});

function createFrameInput(
  pointer: Partial<WebGLPointerState> & { time?: number } = {},
): WebGLFrameInput {
  return {
    time: pointer.time ?? 100,
    delta: 16,
    scroll: {
      mode: "page",
      pageProgress: 0,
      direction: 0,
      velocity: 0,
    },
    pointer: {
      x: 0,
      y: 0,
      normalizedX: 0,
      normalizedY: 0,
      isInside: false,
      isDown: false,
      downTime: 0,
      pressDuration: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragDeltaX: 0,
      dragDeltaY: 0,
      clickCount: 0,
      ...pointer,
    },
  };
}

function createLayoutSnapshot(
  rect: Pick<ElementLayoutSnapshot, "left" | "top" | "width" | "height">,
): ElementLayoutSnapshot {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    width: rect.width,
    height: rect.height,
    viewport: { width: 800, height: 600, devicePixelRatio: 1 },
    layoutSignature: `${rect.left}:${rect.top}:${rect.width}:${rect.height}`,
  };
}
```

- [x] **Step 2: Run the helper test and verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/input/targetPointer.test.ts
```

Expected: FAIL because `src/lib/input/targetPointer.ts` does not exist.

- [x] **Step 3: Implement the pure helper**

Create `packages/dom-webgl-runtime/src/lib/input/targetPointer.ts`:

```ts
import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import type { WebGLFrameInput, WebGLTargetPointerState } from "../types";

export function createTargetPointerState(
  input: WebGLFrameInput,
  layout: ElementLayoutSnapshot,
): WebGLTargetPointerState {
  const pointer = input.pointer;
  const localX = pointer.x - layout.left;
  const localY = pointer.y - layout.top;
  const dragStartLocalX = pointer.dragStartX - layout.left;
  const dragStartLocalY = pointer.dragStartY - layout.top;
  const pressDuration = pointer.isDown
    ? Math.max(0, input.time - pointer.downTime)
    : pointer.pressDuration;

  return {
    localX,
    localY,
    normalizedX: normalizeAxis(localX, layout.width),
    normalizedY: -normalizeAxis(localY, layout.height),
    isInside:
      pointer.isInside &&
      localX >= 0 &&
      localX <= layout.width &&
      localY >= 0 &&
      localY <= layout.height,
    isPressed: pointer.isDown,
    pressDuration,
    isDragging: pointer.isDragging,
    dragStartLocalX,
    dragStartLocalY,
    dragDeltaX: pointer.dragDeltaX,
    dragDeltaY: pointer.dragDeltaY,
    ...(pointer.lastClickTime !== undefined
      ? { lastClickTime: pointer.lastClickTime }
      : {}),
    clickCount: pointer.clickCount,
  };
}

function normalizeAxis(value: number, size: number): number {
  if (size <= 0) {
    return 0;
  }

  return (value / size) * 2 - 1;
}
```

- [x] **Step 4: Run the helper test and verify it passes**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/input/targetPointer.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/input/targetPointer.ts packages/dom-webgl-runtime/test/lib/input/targetPointer.test.ts
git commit -m "feat: derive target-local pointer state"
```

---

### Task 3: Effect Context Target Pointer

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectContext.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`
- Test: `packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts`

- [x] **Step 1: Write the failing effect context test**

In `packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts`, update the existing `passes frame, layout, source, target, and resources to user effects` test. Change the `input` and expected context assertion:

```ts
    const input = createFrameInput({
      x: 140,
      y: 90,
      normalizedX: 0.5,
      isInside: true,
      isDown: true,
      downTime: 50,
    });
    const layout = createLayoutSnapshot({
      left: 100,
      top: 50,
      width: 200,
      height: 100,
    });

    controller.update(input, layout);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "custom.surface",
        sourceKind: "dom/element",
        input,
        layout,
        pointer: input.pointer,
        targetPointer: expect.objectContaining({
          localX: 40,
          localY: 40,
          normalizedX: -0.6,
          normalizedY: 0.2,
          isInside: true,
          isPressed: true,
          pressDuration: 50,
        }),
        scroll: input.scroll,
        scrollProgress: 0,
        time: 100,
        delta: 16,
        source,
        resources: expect.objectContaining({
          addDisposable: expect.any(Function),
        }),
      }),
    );
```

If the existing helper `createLayoutSnapshot` does not accept rect overrides, update it in the same test file to accept:

```ts
function createLayoutSnapshot(
  rect: Partial<Pick<ElementLayoutSnapshot, "left" | "top" | "width" | "height">> = {},
): ElementLayoutSnapshot {
  const left = rect.left ?? 0;
  const top = rect.top ?? 0;
  const width = rect.width ?? 100;
  const height = rect.height ?? 100;

  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    viewport: { width: 800, height: 600, devicePixelRatio: 1 },
    layoutSignature: `${left}:${top}:${width}:${height}`,
  };
}
```

- [x] **Step 2: Run the effect controller test and verify it fails**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts
```

Expected: FAIL because `ctx.targetPointer` is not populated.

- [x] **Step 3: Populate targetPointer in effect contexts**

In `packages/dom-webgl-runtime/src/lib/effects/effectContext.ts`, import the helper:

```ts
import { createTargetPointerState } from "../input/targetPointer";
```

Add `targetPointer` inside `createWebGLEffectContext`:

```ts
    pointer: options.input.pointer,
    targetPointer: createTargetPointerState(options.input, options.layout),
    scroll: options.input.scroll,
```

In `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`, import the helper:

```ts
import { createTargetPointerState } from "../input/targetPointer";
```

Refresh reusable contexts:

```ts
          context.pointer = input.pointer;
          context.targetPointer = createTargetPointerState(input, layout);
          context.scroll = input.scroll;
```

- [x] **Step 4: Run the effect controller test and verify it passes**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/effects/effectContext.ts packages/dom-webgl-runtime/src/lib/effects/effectController.ts packages/dom-webgl-runtime/test/lib/effects/effectController.test.ts
git commit -m "feat: expose target pointer to effects"
```

---

### Task 4: Pointer-Driven Runtime Scheduling

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/input/pointerController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Test: `packages/dom-webgl-runtime/test/lib/input/pointerController.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`

- [x] **Step 1: Write failing pointer controller callback tests**

In `packages/dom-webgl-runtime/test/lib/input/pointerController.test.ts`, add:

```ts
  test("notifies when pointer input changes and stops after dispose", () => {
    const target = createTargetElement({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
    const onPointerInput = vi.fn();
    const pointer = createPointerController({
      coordinateElement: target,
      onPointerInput,
    });

    dispatchPointer(target, "pointermove", { clientX: 10, clientY: 10 });
    dispatchPointer(target, "pointerdown", { clientX: 10, clientY: 10 });
    dispatchPointer(target, "pointerup", { clientX: 10, clientY: 10 });

    expect(onPointerInput).toHaveBeenCalledTimes(3);

    pointer.dispose();
    dispatchPointer(target, "pointermove", { clientX: 30, clientY: 30 });

    expect(onPointerInput).toHaveBeenCalledTimes(3);
  });
```

Add `vi` to the import:

```ts
import { describe, expect, test, vi } from "vitest";
```

- [x] **Step 2: Write the failing runtime scheduling test**

In `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`, replace the pointer section of `active effects gates videos and pointer targets keep the loop continuous` with a separate test:

```ts
  test("pointer declarations wake on-demand targets without forcing continuous rendering", async () => {
    const pointerLoopHost = createLoopRecordingHost();
    const container = document.createElement("div");
    const runtime = await createPipelineRuntime({
      container,
      rendererHostFactory: pointerLoopHost.createHost,
      effects: [
        defineWebGLEffect({
          kind: "test.pointerReactive",
          schedule: "reactive",
          update(ctx) {
            ctx.target?.setRotation(0, ctx.targetPointer.normalizedX, 0);
          },
        }),
      ],
    });
    const target = document.createElement("section");
    runtime.registerTarget(target, {
      key: "pointer.hero",
      pointer: { hover: true },
      effects: [{ kind: "test.pointerReactive" }],
    });

    pointerLoopHost.tick(16);
    pointerLoopHost.tick(32);

    expect(pointerLoopHost.sceneAdapter.render).toHaveBeenCalledTimes(1);

    document.dispatchEvent(
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: 120,
        clientY: 80,
      }),
    );
    pointerLoopHost.tick(48);

    expect(pointerLoopHost.sceneAdapter.render).toHaveBeenCalledTimes(2);
    runtime.dispose();
  });
```

Keep the existing continuous-render assertions for active frame effects, gate targets, and videos. Remove the old expectation that any pointer target stays continuous.

- [x] **Step 3: Run the targeted tests and verify they fail**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/input/pointerController.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected: FAIL because `onPointerInput` is not supported and pointer declarations still force continuous rendering.

- [x] **Step 4: Implement event-driven pointer invalidation**

In `packages/dom-webgl-runtime/src/lib/input/pointerController.ts`, extend options:

```ts
export type PointerControllerOptions = {
  coordinateElement: HTMLElement;
  eventTarget?: PointerControllerEventTarget;
  onPointerInput?(): void;
};
```

After each state update in `handlePointerMove`, `handlePointerDown`, and `handlePointerUp`, call:

```ts
    onPointerInput?.();
```

Declare it after `pointerEventTarget`:

```ts
  const onPointerInput = isPointerControllerOptions(input)
    ? input.onPointerInput
    : undefined;
```

In `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`, pass the callback:

```ts
    createPointerController({
      coordinateElement: rendererHost.canvas,
      eventTarget: ownerDocument,
      onPointerInput() {
        if (hasPointerDrivenTarget()) {
          rendererLoopRequestFrame("pointer");
        }
      },
    });
```

Add this helper inside `createWebGLRuntime` near `hasPointerDeclaration`:

```ts
  function hasPointerDrivenTarget(): boolean {
    return listTargetsInScanOrder(registry).some((descriptor) =>
      hasPointerDeclaration(descriptor.declaration.pointer),
    );
  }
```

Replace `hasPointerDeclaration` with:

```ts
  function hasPointerDeclaration(
    pointer: WebGLDeclaration["pointer"],
  ): boolean {
    return (
      pointer?.hover === true ||
      pointer?.press === true ||
      pointer?.click === true ||
      pointer?.drag === true
    );
  }
```

Remove this branch from `shouldKeepTargetContinuous`:

```ts
    if (hasPointerDeclaration(descriptor.declaration.pointer)) {
      return true;
    }
```

Keep `readTargetEffectDirtyReasons` adding `"pointer"` when a target declares pointer semantics. That makes pointer-declared reactive effects update when a pointer frame is requested, without making the entire target continuous.

- [x] **Step 5: Run targeted tests and commit**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/input/pointerController.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected: PASS.

Commit:

```bash
git add packages/dom-webgl-runtime/src/lib/input/pointerController.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.ts packages/dom-webgl-runtime/test/lib/input/pointerController.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
git commit -m "feat: wake pointer targets on pointer input"
```

---

### Task 5: Target Pointer Debug State

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Test: `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`
- Test: `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`

- [x] **Step 1: Write failing debug snapshot tests**

In `packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts`, update `creates a lightweight immutable debug snapshot` so the target contains a pointer field:

```ts
          pointer: {
            localX: 12,
            localY: 8,
            normalizedX: -0.76,
            normalizedY: 0.84,
            isInside: true,
            isPressed: false,
            pressDuration: 0,
            isDragging: false,
            dragStartLocalX: -10,
            dragStartLocalY: -20,
            dragDeltaX: 0,
            dragDeltaY: 0,
            clickCount: 0,
          },
```

Extend the expected snapshot target with:

```ts
          pointer: {
            localX: 12,
            localY: 8,
            normalizedX: -0.76,
            normalizedY: 0.84,
            isInside: true,
            isPressed: false,
            pressDuration: 0,
            isDragging: false,
            dragStartLocalX: -10,
            dragStartLocalY: -20,
            dragDeltaX: 0,
            dragDeltaY: 0,
            clickCount: 0,
          },
```

In `packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts`, add:

```ts
  test("debug state exposes target-local pointer only for pointer-declared targets", async () => {
    const runtime = await createPipelineRuntime();
    const pointerTarget = document.createElement("section");
    const staticTarget = document.createElement("section");

    runtime.registerTarget(pointerTarget, {
      key: "pointer.debug",
      pointer: { hover: true },
    });
    runtime.registerTarget(staticTarget, {
      key: "static.debug",
    });

    document.dispatchEvent(
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: 40,
        clientY: 30,
      }),
    );
    await runtime.sync();

    const state = runtime.getDebugState();
    expect(state.targets.find((target) => target.key === "pointer.debug")).toEqual(
      expect.objectContaining({
        pointer: expect.objectContaining({
          isInside: expect.any(Boolean),
          localX: expect.any(Number),
          localY: expect.any(Number),
        }),
      }),
    );
    expect(state.targets.find((target) => target.key === "static.debug")).not.toHaveProperty(
      "pointer",
    );

    runtime.dispose();
  });
```

- [x] **Step 2: Run debug tests and verify they fail**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected: FAIL because debug targets do not copy or store target pointer state.

- [x] **Step 3: Implement target pointer debug copying**

In `packages/dom-webgl-runtime/src/lib/types.ts`, add optional target debug pointer:

```ts
  targets: Array<{
    key: string;
    sourceKind: string;
    renderRole: WebGLRenderRole;
    resourceStatus: WebGLResourceStatus;
    lifecycleState: WebGLLifecycleState;
    visible: boolean;
    pointer?: WebGLTargetPointerState;
    parentKey?: string;
    layerDepth: number;
    siblingIndex: number;
    computedRenderOrder?: number;
    error?: string;
  }>;
```

In `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`, add `WebGLTargetPointerState` to imports and `DebugTargetState`:

```ts
  WebGLTargetPointerState,
```

```ts
  pointer?: WebGLTargetPointerState;
```

Copy the snapshot in `createDebugState`:

```ts
      if (target.pointer) {
        summary.pointer = { ...target.pointer };
      }
```

In `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`, import:

```ts
import { createTargetPointerState } from "../input/targetPointer";
```

After `effectDirtyReasons` is computed for an active measured target, store or clear debug pointer:

```ts
      if (hasPointerDeclaration(descriptor.declaration.pointer)) {
        debugRecord.pointer = createTargetPointerState(frameInput, layoutMeasurement);
      } else {
        delete debugRecord.pointer;
      }
```

Inside branches that reconcile a target without a measured layout, clear it before continuing:

```ts
        delete readTargetDebugRecord(descriptor, targetState).pointer;
```

- [x] **Step 4: Run debug tests and verify they pass**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/types.ts packages/dom-webgl-runtime/src/lib/debug/debugState.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.ts packages/dom-webgl-runtime/test/lib/debug/debugState.test.ts packages/dom-webgl-runtime/test/lib/renderer/runtimePipeline.test.ts
git commit -m "feat: expose target pointer debug state"
```

---

### Task 6: Documentation And Example Contract Cleanup

**Files:**
- Modify: `README.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: `docs/agent/effect-authoring-example-report.md`
- Search/update as needed: `apps/example/src`
- Search/update as needed: `apps/example/test`

- [x] **Step 1: Search for old pointer-local math and declaration language**

Run:

```bash
rg -n "pointer\\.move|move: true|ctx\\.pointer\\.x - ctx\\.layout|ctx\\.pointer\\.isInside|target-local pointer|targetPointer|longPress|pointer declaration" README.md docs apps/example packages/dom-webgl-runtime/test
```

Expected: output includes docs and example effect code that still describe manual target-local pointer math or old pointer declaration fields.

- [x] **Step 2: Update docs to state the contract**

Update docs with these exact rules:

```md
- `ctx.pointer` is runtime/canvas pointer state.
- `ctx.targetPointer` is current-target layout-local pointer state.
- `ctx.targetPointer.isInside` is the hover check for the current target.
- `ctx.targetPointer.localX/localY` replace repeated `ctx.pointer.x - ctx.layout.left/top` math in effects.
- `ctx.targetPointer.normalizedX/Y` are target-local values in the same -1..1 convention as runtime pointer coordinates.
- `pointer: { hover, press, click, drag }` declares which target-level pointer semantics should wake reactive effects.
- `longPress` is effect-level behavior built from `ctx.targetPointer.pressDuration`; runtime does not own a global threshold.
- Target pointer is layout-local only. It does not perform inverse-transformed picking for rotated groups, models, or custom meshes.
```

Remove docs that teach `pointer.move` as public contract.

- [x] **Step 3: Update example effects to read targetPointer where local pointer math is repeated**

For example effect code that currently computes:

```ts
const localX = ctx.pointer.x - ctx.layout.left;
const localY = ctx.pointer.y - ctx.layout.top;
const active = ctx.pointer.isInside && localX >= 0 && localX <= ctx.layout.width;
```

Replace with:

```ts
const { localX, localY, isInside } = ctx.targetPointer;
```

Keep shared helper functions such as `readTargetLocalPointer` only if they still add behavior beyond `ctx.targetPointer`, such as effect-specific radius, clamping, or transformed-progress offsets.

- [x] **Step 4: Run docs and example-focused checks**

Run:

```bash
npm test -- --run apps/example/test
npm run check:imports
git diff --check
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add README.md docs/agent/package-usage.md docs/agent/package-onboarding.md docs/examples/effect-authoring.md docs/agent/effect-authoring-example-report.md apps/example/src apps/example/test
git commit -m "docs: align pointer contract guidance"
```

---

### Task 7: Full Verification

**Files:**
- Verify entire repository.

- [x] **Step 1: Run package tests**

Run:

```bash
npm run test -- --run
```

Expected: PASS.

- [x] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [x] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [x] **Step 4: Run import boundary and whitespace checks**

Run:

```bash
npm run check:imports
git diff --check
```

Expected: PASS.

- [x] **Step 5: Commit verification-only fixes if needed**

If Step 1 through Step 4 found small test/doc/type fixes, commit only those fixes:

```bash
git add packages/dom-webgl-runtime apps/example docs README.md
git commit -m "chore: finish pointer contract verification"
```

If no files changed after verification, do not create an empty commit.

---

## Self-Review

- Spec coverage: The plan covers target-local context, declaration semantics, event-driven scheduling, optional debug exposure, docs, example cleanup, and full verification.
- Coupling check: `targetPointer.ts` is pure and depends only on frame input plus measured layout. React does not own listeners or derived pointer state. Runtime remains the single pointer listener owner.
- YAGNI check: `longPress` is not a runtime declaration. No public raw DOM event, raycast, matrix, scene graph, or Three.js object is exposed.
- React check: React adapter remains declarative and forwards stable `webgl` declarations. No component-level pointer listeners, mutable refs for pointer state, or render-time side effects are introduced.
