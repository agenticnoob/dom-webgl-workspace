# Phase 6 Modular Effect Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Phase 6 in staged gates: first make the existing Phase 5 effect layer modular without behavior changes, then add the smallest useful `surface` built-in, and only then decide whether visual details such as border or shadow are necessary.

**Architecture:** DOM remains the source for layout, content, accessibility, and interaction state; effects remain declaration-owned WebGL visual or motion policy. Pure effect modules under `packages/dom-webgl-runtime/src/lib/effects/*` normalize, validate, and orchestrate declarations without importing Three.js, React, demo code, or renderable implementation modules. Three.js-specific capability adapters live under `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/*`, and `runtime.ts` stays limited to target registration, controller lifecycle, frame input, layout snapshots, and debug error reporting.

**Tech Stack:** TypeScript, Vitest, jsdom, Three.js internal renderable adapters, React/Vite demo app.

---

## Current Truth

- Phase 5 public API supports `effects.material: { kind: "solid" }` and `effects.motion: { kind: "pointer-tilt" }`.
- `effectController.ts` currently owns normalization, source compatibility checks, material dispatch, pointer motion math, and the internal effect target type.
- `sceneRenderableObject.ts` currently owns element-plane mesh creation, text/media/model helpers, and effect target helpers. It should not receive more effect-specific code.
- The next work must preserve these boundaries: no public Three.js flags, no custom effect registry, no shader authoring API, no particles, no picking, no multiple-canvas path, no third-party scroll adapter, no CSS paint cloning, and no demo-specific runtime branch.

## Phase Gates

Phase 6 is one roadmap item with three gates. Each gate must be independently verifiable and independently commit-ready.

### Phase 6.1: Core Boundary Refactor

Refactor only. Public API and visible behavior stay the same.

Success criteria:

- Existing `solid` material behavior is unchanged.
- Existing `pointer-tilt` motion behavior is unchanged.
- `effects/*` pure modules do not import Three.js, React, demo code, or renderable implementation modules.
- `sceneRenderableObject.ts` no longer owns element-plane effect capability details.
- Full verification passes before Phase 6.2 starts.

### Phase 6.2: Minimal Surface Material

Add one public material variant:

```ts
export type WebGLSurfaceMaterialDeclaration = {
  kind: "surface";
  color?: number;
  opacity?: number;
  radius?: number;
};
```

Success criteria:

- `surface` is explicit declaration-owned WebGL styling, not DOM CSS cloning.
- `surface` supports only `snapshot/element` sources.
- `surface` renders a visible rounded element-plane surface.
- `surface` has one small public union entry, one normalization path, one compatibility rule, one controller dispatch path, one target capability, and focused tests.
- Full verification passes before Phase 6.3 is considered.

### Phase 6.3: Surface Detail Decision Gate

Do not implement visual details automatically. After Phase 6.2 is verified, decide whether the minimal `surface` is enough.

Allowed candidates only if justified by demo or consumer needs:

- `border`
- `shadow`
- improved rounded-surface texture quality
- DPR/cache tuning for surface texture updates

Criteria to start Phase 6.3:

- The requested detail cannot be represented well by `color`, `opacity`, and `radius`.
- The implementation stays inside `effectNormalization.ts`, `effectCompatibility.ts`, `effectController.ts`, and `effectTargets/*`.
- The implementation does not add CSS paint cloning, public Three.js flags, or a custom registry.
- The detail can be deleted by removing its public fields, normalization, target adapter logic, tests, demo usage, and docs without touching runtime lifecycle code.

## Module Boundary Rules

- Public declarations live in `packages/dom-webgl-runtime/src/lib/types.ts`.
- Pure effect logic lives in `packages/dom-webgl-runtime/src/lib/effects/*`.
- Motion helpers live in `packages/dom-webgl-runtime/src/lib/effects/motions/*`.
- Three.js target capabilities live in `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/*`.
- `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts` must not branch on individual built-in implementation details.
- `apps/demo` remains a public API consumer and validation surface only.

## File Map

Phase 6.1 pure effect layer:

- Create: `packages/dom-webgl-runtime/src/lib/effects/effectTarget.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectNormalization.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectNormalization.test.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.test.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/motions/pointerTilt.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/motions/pointerTilt.test.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effect-boundary.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts`

Phase 6.1 renderable target adapter:

- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.test.ts`

Phase 6.2 public contract and surface target:

- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.test.ts`
- Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectNormalization.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectNormalization.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectTarget.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/surfaceTexture.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/surfaceTexture.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
- Modify: `apps/demo/src/App.tsx`
- Modify: `apps/demo/src/App.test.tsx`
- Modify: `apps/demo/src/demo.css`

Docs:

- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`
- Modify: `docs/superpowers/plans/2026-06-19-phase-6-modular-surface-materials.md`

## Phase 6.1 Tasks

### Task 1: Extract Effect Normalization

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectNormalization.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectNormalization.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts`

- [ ] **Step 1: Write the failing normalization tests**

Create `packages/dom-webgl-runtime/src/lib/effects/effectNormalization.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { normalizeWebGLEffectsDeclaration } from "./effectNormalization";

describe("normalizeWebGLEffectsDeclaration", () => {
  test("defaults solid material and pointer tilt values", () => {
    expect(
      normalizeWebGLEffectsDeclaration({
        material: { kind: "solid" },
        motion: { kind: "pointer-tilt" },
      }),
    ).toEqual({
      material: { kind: "solid", color: 0xffffff, opacity: 1 },
      motion: { kind: "pointer-tilt", strength: 1, maxDegrees: 8 },
    });
  });

  test("clamps existing Phase 5 effect values", () => {
    expect(
      normalizeWebGLEffectsDeclaration({
        material: { kind: "solid", color: 0x1ffffff, opacity: 2 },
        motion: { kind: "pointer-tilt", strength: -1, maxDegrees: 90 },
      }),
    ).toEqual({
      material: { kind: "solid", color: 0xffffff, opacity: 1 },
      motion: { kind: "pointer-tilt", strength: 0, maxDegrees: 30 },
    });
  });
});
```

- [ ] **Step 2: Verify the test fails before extraction**

Run: `npm test -- --run packages/dom-webgl-runtime/src/lib/effects/effectNormalization.test.ts`

Expected: FAIL because `effectNormalization.ts` does not exist.

- [ ] **Step 3: Create the normalization module**

Create `packages/dom-webgl-runtime/src/lib/effects/effectNormalization.ts`:

```ts
import type {
  WebGLEffectsDeclaration,
  WebGLMaterialDeclaration,
  WebGLMotionDeclaration,
} from "../types";

export type NormalizedWebGLMaterialDeclaration = {
  kind: "solid";
  color: number;
  opacity: number;
};

export type NormalizedWebGLMotionDeclaration = {
  kind: "pointer-tilt";
  strength: number;
  maxDegrees: number;
};

export type NormalizedWebGLEffectsDeclaration = {
  material?: NormalizedWebGLMaterialDeclaration;
  motion?: NormalizedWebGLMotionDeclaration;
};

const defaultMaterial = {
  color: 0xffffff,
  opacity: 1,
};

const defaultMotion = {
  strength: 1,
  maxDegrees: 8,
};

export function normalizeWebGLEffectsDeclaration(
  declaration: WebGLEffectsDeclaration | undefined,
): NormalizedWebGLEffectsDeclaration {
  if (!declaration) {
    return {};
  }

  return {
    material: declaration.material
      ? normalizeMaterialDeclaration(declaration.material)
      : undefined,
    motion: declaration.motion
      ? normalizeMotionDeclaration(declaration.motion)
      : undefined,
  };
}

function normalizeMaterialDeclaration(
  material: WebGLMaterialDeclaration,
): NormalizedWebGLMaterialDeclaration {
  return {
    kind: "solid",
    color: clampInteger(material.color, 0, 0xffffff, defaultMaterial.color),
    opacity: clampNumber(material.opacity, 0, 1, defaultMaterial.opacity),
  };
}

function normalizeMotionDeclaration(
  motion: WebGLMotionDeclaration,
): NormalizedWebGLMotionDeclaration {
  return {
    kind: "pointer-tilt",
    strength: clampNumber(motion.strength, 0, 1, defaultMotion.strength),
    maxDegrees: clampNumber(motion.maxDegrees, 0, 30, defaultMotion.maxDegrees),
  };
}

function clampInteger(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  return Math.round(clampNumber(value, min, max, fallback));
}

function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}
```

- [ ] **Step 4: Rewire `effectController.ts`**

Remove local normalized effect types and normalization helpers from `effectController.ts`. Import them:

```ts
import {
  normalizeWebGLEffectsDeclaration,
  type NormalizedWebGLMaterialDeclaration,
  type NormalizedWebGLMotionDeclaration,
} from "./effectNormalization";
```

- [ ] **Step 5: Verify normalization behavior is unchanged**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/effects/effectNormalization.test.ts packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/effects/effectNormalization.ts packages/dom-webgl-runtime/src/lib/effects/effectNormalization.test.ts packages/dom-webgl-runtime/src/lib/effects/effectController.ts packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts
git commit -m "refactor: extract effect normalization"
```

### Task 2: Extract Effect Compatibility Rules

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`

- [ ] **Step 1: Write compatibility tests**

Create `packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { assertMaterialSourceCompatibility } from "./effectCompatibility";
import type { NormalizedWebGLMaterialDeclaration } from "./effectNormalization";
import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";

describe("assertMaterialSourceCompatibility", () => {
  test("allows solid material on element snapshots", () => {
    expect(() =>
      assertMaterialSourceCompatibility(
        "card.surface",
        createSolidMaterial(),
        createElementSnapshotSource(),
      ),
    ).not.toThrow();
  });

  test("rejects solid material on image sources with the existing error contract", () => {
    expect(() =>
      assertMaterialSourceCompatibility(
        "card.image",
        createSolidMaterial(),
        createImageSource(),
      ),
    ).toThrow(
      'WebGL target "card.image" uses solid material on unsupported source "image". Solid material effects support only snapshot/element targets.',
    );
  });
});

function createSolidMaterial(): NormalizedWebGLMaterialDeclaration {
  return { kind: "solid", color: 0xffffff, opacity: 1 };
}

function createElementSnapshotSource(): WebGLSourceDescriptor {
  return {
    kind: "snapshot",
    mode: "element",
    element: document.createElement("section"),
  };
}

function createImageSource(): WebGLSourceDescriptor {
  return {
    kind: "image",
    element: document.createElement("img"),
    src: "/demo/image.png",
  };
}
```

- [ ] **Step 2: Verify the test fails before extraction**

Run: `npm test -- --run packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.test.ts`

Expected: FAIL because `effectCompatibility.ts` does not exist.

- [ ] **Step 3: Create compatibility module**

Create `packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.ts`:

```ts
import type { NormalizedWebGLMaterialDeclaration } from "./effectNormalization";
import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";

export function assertMaterialSourceCompatibility(
  key: string,
  material: NormalizedWebGLMaterialDeclaration,
  source: WebGLSourceDescriptor,
): void {
  if (source.kind === "snapshot" && source.mode === "element") {
    return;
  }

  throw new Error(
    `WebGL target "${key}" uses ${material.kind} material on unsupported source "${readSourceKind(
      source,
    )}". ${readMaterialLabel(material.kind)} material effects support only snapshot/element targets.`,
  );
}

function readMaterialLabel(kind: NormalizedWebGLMaterialDeclaration["kind"]) {
  return kind === "solid" ? "Solid" : "Surface";
}

function readSourceKind(source: WebGLSourceDescriptor): string {
  if (source.kind === "snapshot") {
    return `snapshot/${source.mode}`;
  }

  if (source.kind === "model") {
    return `model/${source.format}`;
  }

  return source.kind;
}
```

- [ ] **Step 4: Rewire `effectController.ts`**

Replace the local source assertion with:

```ts
if (effects.material) {
  assertMaterialSourceCompatibility(options.key, effects.material, options.source);
}
```

- [ ] **Step 5: Verify compatibility behavior is unchanged**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.test.ts packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.ts packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.test.ts packages/dom-webgl-runtime/src/lib/effects/effectController.ts
git commit -m "refactor: extract effect compatibility rules"
```

### Task 3: Extract Effect Target And Pointer Motion

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectTarget.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/motions/pointerTilt.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/motions/pointerTilt.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.ts`

- [ ] **Step 1: Write pointer motion tests**

Create `packages/dom-webgl-runtime/src/lib/effects/motions/pointerTilt.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";

import { applyPointerTilt } from "./pointerTilt";
import type { WebGLEffectTarget } from "../effectTarget";
import type { NormalizedWebGLMotionDeclaration } from "../effectNormalization";
import type { WebGLFrameInput } from "../../types";

describe("applyPointerTilt", () => {
  test("rotates from shared normalized pointer input", () => {
    const target = { setRotation: vi.fn() } satisfies WebGLEffectTarget;
    const motion: NormalizedWebGLMotionDeclaration = {
      kind: "pointer-tilt",
      strength: 0.5,
      maxDegrees: 10,
    };

    applyPointerTilt(
      target,
      createFrameInput({ isInside: true, normalizedX: 1, normalizedY: -0.5 }),
      motion,
    );

    expect(target.setRotation).toHaveBeenCalledWith(
      expect.closeTo(-0.0436332313),
      expect.closeTo(0.0872664626),
    );
  });

  test("resets when the pointer is outside", () => {
    const target = { setRotation: vi.fn() } satisfies WebGLEffectTarget;

    applyPointerTilt(target, createFrameInput({ isInside: false }), {
      kind: "pointer-tilt",
      strength: 1,
      maxDegrees: 8,
    });

    expect(target.setRotation).toHaveBeenCalledWith(0, 0);
  });
});

function createFrameInput(
  pointer: Partial<WebGLFrameInput["pointer"]> = {},
): WebGLFrameInput {
  return {
    time: 100,
    delta: 16,
    scroll: { mode: "page", pageProgress: 0, direction: 0, velocity: 0 },
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
```

- [ ] **Step 2: Verify the test fails before extraction**

Run: `npm test -- --run packages/dom-webgl-runtime/src/lib/effects/motions/pointerTilt.test.ts`

Expected: FAIL because `pointerTilt.ts` does not exist.

- [ ] **Step 3: Create `effectTarget.ts`**

Create `packages/dom-webgl-runtime/src/lib/effects/effectTarget.ts`:

```ts
export type WebGLSolidMaterialTargetState = {
  color: number;
  opacity: number;
};

export type WebGLEffectTarget = {
  applySolidMaterial?(material: WebGLSolidMaterialTargetState): void;
  setRotation?(x: number, y: number): void;
  disposeEffects?(): void;
};
```

- [ ] **Step 4: Create pointer motion module**

Create `packages/dom-webgl-runtime/src/lib/effects/motions/pointerTilt.ts`:

```ts
import type { WebGLEffectTarget } from "../effectTarget";
import type { NormalizedWebGLMotionDeclaration } from "../effectNormalization";
import type { WebGLFrameInput } from "../../types";

export function applyPointerTilt(
  target: WebGLEffectTarget | undefined,
  input: WebGLFrameInput,
  motion: NormalizedWebGLMotionDeclaration,
): void {
  if (!target?.setRotation) {
    return;
  }

  if (!input.pointer.isInside) {
    target.setRotation(0, 0);
    return;
  }

  const maxRadians = (motion.maxDegrees * motion.strength * Math.PI) / 180;

  target.setRotation(
    input.pointer.normalizedY * maxRadians,
    input.pointer.normalizedX * maxRadians,
  );
}
```

- [ ] **Step 5: Rewire imports**

Update `effectController.ts`:

```ts
import type { WebGLEffectTarget } from "./effectTarget";
import { applyPointerTilt } from "./motions/pointerTilt";
```

Update renderable files that import `WebGLEffectTarget` from `effectController.ts` to import it from:

```ts
import type { WebGLEffectTarget } from "../../effects/effectTarget";
```

- [ ] **Step 6: Verify target and motion extraction**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/effects/motions/pointerTilt.test.ts packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/effects packages/dom-webgl-runtime/src/lib/render/renderable.ts packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.ts
git commit -m "refactor: extract effect target and pointer motion"
```

### Task 4: Extract Element Plane Effect Target Adapter

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.test.ts`

- [ ] **Step 1: Write adapter tests**

Create `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { PlaneGeometry } from "three/src/geometries/PlaneGeometry.js";
import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { Mesh } from "three/src/objects/Mesh.js";

import { createElementPlaneEffectTarget } from "./elementPlaneEffectTarget";

describe("createElementPlaneEffectTarget", () => {
  test("applies solid material to an element plane", () => {
    const geometry = new PlaneGeometry(1, 1);
    const material = new MeshBasicMaterial({ transparent: true, opacity: 0 });
    const mesh = new Mesh(geometry, material);
    mesh.visible = false;

    const target = createElementPlaneEffectTarget(mesh, material);

    target.applySolidMaterial?.({ color: 0x112233, opacity: 0.42 });

    expect(mesh.visible).toBe(true);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(0.42);
    expect(material.color.getHex()).toBe(0x112233);

    geometry.dispose();
    material.dispose();
  });
});
```

- [ ] **Step 2: Verify the test fails before extraction**

Run: `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.test.ts`

Expected: FAIL because `elementPlaneEffectTarget.ts` does not exist.

- [ ] **Step 3: Create the adapter module**

Create `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.ts`:

```ts
import type { Object3D } from "three/src/core/Object3D.js";
import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { Mesh } from "three/src/objects/Mesh.js";

import type { WebGLEffectTarget } from "../../../effects/effectTarget";

export function createElementPlaneEffectTarget(
  mesh: Mesh,
  material: MeshBasicMaterial,
): WebGLEffectTarget {
  return {
    applySolidMaterial(nextMaterial) {
      material.color.setHex(nextMaterial.color);
      material.opacity = nextMaterial.opacity;
      material.transparent = true;
      mesh.visible = true;
    },
    setRotation(x, y) {
      setObject3DRotation(mesh, x, y);
    },
  };
}

export function createObject3DEffectTarget(
  object3D: unknown,
): WebGLEffectTarget | undefined {
  if (!object3D || typeof object3D !== "object") {
    return undefined;
  }

  return {
    setRotation(x, y) {
      setObject3DRotation(object3D, x, y);
    },
  };
}

function setObject3DRotation(object3D: unknown, x: number, y: number): void {
  const rotation = (object3D as Partial<Object3D> | undefined)?.rotation;

  if (rotation && typeof rotation === "object" && "set" in rotation) {
    const z = (rotation as { z?: number }).z ?? 0;
    rotation.set(x, y, z);
    return;
  }

  if (rotation && typeof rotation === "object") {
    Object.assign(rotation, { x, y });
  }
}
```

- [ ] **Step 4: Rewire `sceneRenderableObject.ts`**

Remove local `createElementPlaneEffectTarget`, `createObject3DEffectTarget`, and `setObject3DRotation` helpers from `sceneRenderableObject.ts`.

Import the adapter:

```ts
import {
  createElementPlaneEffectTarget,
  createObject3DEffectTarget,
} from "./effectTargets/elementPlaneEffectTarget";
```

- [ ] **Step 5: Verify scene behavior is unchanged**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.test.ts packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.ts packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.ts packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.test.ts
git commit -m "refactor: extract element plane effect target"
```

### Task 5: Add Effect Boundary Guard And Phase 6.1 Verification

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/effects/effect-boundary.test.ts`
- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`
- Modify: `docs/superpowers/plans/2026-06-19-phase-6-modular-surface-materials.md`

- [ ] **Step 1: Write pure effect boundary test**

Create `packages/dom-webgl-runtime/src/lib/effects/effect-boundary.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

describe("effect module boundaries", () => {
  test("pure effect modules do not import renderer, React, demo, or Three.js code", () => {
    const effectFiles = listFiles(new URL(".", import.meta.url).pathname)
      .filter((file) => file.endsWith(".ts"))
      .filter((file) => !file.endsWith(".test.ts"));

    for (const file of effectFiles) {
      const source = readFileSync(file, "utf8");

      expect(source, file).not.toMatch(/from ["']three/);
      expect(source, file).not.toMatch(/from ["']react/);
      expect(source, file).not.toMatch(/apps\/demo|@project\/dom-webgl-demo/);
      expect(source, file).not.toMatch(/render\/renderables/);
    }
  });
});

function listFiles(root: string): string[] {
  const entries = readdirSync(root);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(root, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...listFiles(path));
      continue;
    }

    files.push(path);
  }

  return files;
}
```

- [ ] **Step 2: Run the boundary test**

Run: `npm test -- --run packages/dom-webgl-runtime/src/lib/effects/effect-boundary.test.ts`

Expected: PASS.

- [ ] **Step 3: Run Phase 6.1 full verification**

Run:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Expected:

- Vitest PASS.
- TypeScript PASS.
- Build PASS, allowing the existing non-blocking Vite chunk-size warning if it still appears.
- Import boundary PASS with `Demo import boundary OK`.
- `git diff --check` produces no output.

- [ ] **Step 4: Update docs with Phase 6.1 status**

Add to `docs/EXECUTION_STATE.md`:

```md
Phase 6.1 effect core boundary refactor is implemented: pure effect normalization, compatibility, target capability types, and pointer motion helpers are separated from Three.js renderable target adapters. Public API and visible Phase 5 behavior remain unchanged.
```

Update README and `docs/00-goal.md` to say Phase 6.1 is a behavior-preserving modularization step and does not add `surface`.

- [ ] **Step 5: Mark Phase 6.1 tasks complete in this plan**

Check off Task 1 through Task 5 and add:

```md
## Phase 6.1 Completed Task Record

- Completed work: Extracted effect normalization, compatibility, target capability types, pointer tilt motion, and element-plane effect target adapter without changing public behavior.
- Verification: `npm run test -- --run`, `npm run typecheck`, `npm run build`, `npm run check:imports`, and `git diff --check` passed.
- Boundary notes: No public API expansion, custom registry, Three.js public flags, particles, picking, scroll adapter, CSS paint cloning, or demo-specific runtime branch was added.
```

- [ ] **Step 6: Commit**

```bash
git add README.md docs/00-goal.md docs/EXECUTION_STATE.md docs/superpowers/plans/2026-06-19-phase-6-modular-surface-materials.md packages/dom-webgl-runtime/src/lib/effects/effect-boundary.test.ts
git commit -m "docs: record phase 6.1 effect boundary refactor"
```

## Phase 6.2 Tasks

### Task 6: Add Minimal Public Surface Material Contract

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.test.ts`
- Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`

- [ ] **Step 1: Write public type tests**

Add to `packages/dom-webgl-runtime/src/lib/types.test.ts`:

```ts
test("accepts explicit minimal surface material declarations", () => {
  const declaration = {
    key: "card.surface",
    source: { kind: "snapshot", mode: "element" },
    effects: {
      material: {
        kind: "surface",
        color: 0x111827,
        opacity: 0.86,
        radius: 18,
      },
    },
  } satisfies WebGLDeclaration;

  expect(declaration.effects.material.kind).toBe("surface");
});

test("rejects CSS strings for surface material values", () => {
  const declaration = {
    key: "card.surface",
    effects: {
      material: {
        kind: "surface",
        // @ts-expect-error surface colors are declaration-owned numeric values
        color: "rgb(17, 24, 39)",
      },
    },
  } satisfies WebGLDeclaration;

  expect(declaration.key).toBe("card.surface");
});
```

- [ ] **Step 2: Verify the type test fails before implementation**

Run: `npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts`

Expected: FAIL because `WebGLMaterialDeclaration` only accepts `solid`.

- [ ] **Step 3: Update public material types**

In `packages/dom-webgl-runtime/src/lib/types.ts`, replace the current material type with:

```ts
export type WebGLSolidMaterialDeclaration = {
  kind: "solid";
  color?: number;
  opacity?: number;
};

export type WebGLSurfaceMaterialDeclaration = {
  kind: "surface";
  color?: number;
  opacity?: number;
  radius?: number;
};

export type WebGLMaterialDeclaration =
  | WebGLSolidMaterialDeclaration
  | WebGLSurfaceMaterialDeclaration;
```

Ensure `WebGLSurfaceMaterialDeclaration` is exported from the root public entrypoint if the public export tests require explicit type exports.

- [ ] **Step 4: Verify public contract**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/types.ts packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
git commit -m "feat: add minimal surface material type"
```

### Task 7: Normalize And Validate Surface Material

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectNormalization.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectNormalization.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.test.ts`

- [ ] **Step 1: Add normalization tests**

Add to `effectNormalization.test.ts`:

```ts
test("defaults and clamps minimal surface material values", () => {
  expect(
    normalizeWebGLEffectsDeclaration({
      material: {
        kind: "surface",
        color: 0x1ffffff,
        opacity: 2,
        radius: -4,
      },
    }),
  ).toEqual({
    material: {
      kind: "surface",
      color: 0xffffff,
      opacity: 1,
      radius: 0,
    },
  });
});
```

- [ ] **Step 2: Add compatibility tests**

Add to `effectCompatibility.test.ts`:

```ts
test("allows surface material on element snapshots", () => {
  expect(() =>
    assertMaterialSourceCompatibility(
      "card.surface",
      { kind: "surface", color: 0xffffff, opacity: 1, radius: 12 },
      createElementSnapshotSource(),
    ),
  ).not.toThrow();
});

test("rejects surface material on image sources", () => {
  expect(() =>
    assertMaterialSourceCompatibility(
      "card.image",
      { kind: "surface", color: 0xffffff, opacity: 1, radius: 12 },
      createImageSource(),
    ),
  ).toThrow(
    'WebGL target "card.image" uses surface material on unsupported source "image". Surface material effects support only snapshot/element targets.',
  );
});
```

- [ ] **Step 3: Verify tests fail before implementation**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/effects/effectNormalization.test.ts packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.test.ts
```

Expected: FAIL because normalization only handles `solid`.

- [ ] **Step 4: Update normalized material union**

In `effectNormalization.ts`, change `NormalizedWebGLMaterialDeclaration` to:

```ts
export type NormalizedWebGLMaterialDeclaration =
  | { kind: "solid"; color: number; opacity: number }
  | { kind: "surface"; color: number; opacity: number; radius: number };
```

Add:

```ts
const defaultSurface = {
  color: 0xffffff,
  opacity: 1,
  radius: 0,
};

const maxSurfaceRadius = 96;
```

Update `normalizeMaterialDeclaration()`:

```ts
function normalizeMaterialDeclaration(
  material: WebGLMaterialDeclaration,
): NormalizedWebGLMaterialDeclaration {
  if (material.kind === "surface") {
    return {
      kind: "surface",
      color: clampInteger(material.color, 0, 0xffffff, defaultSurface.color),
      opacity: clampNumber(material.opacity, 0, 1, defaultSurface.opacity),
      radius: clampNumber(material.radius, 0, maxSurfaceRadius, defaultSurface.radius),
    };
  }

  return {
    kind: "solid",
    color: clampInteger(material.color, 0, 0xffffff, defaultMaterial.color),
    opacity: clampNumber(material.opacity, 0, 1, defaultMaterial.opacity),
  };
}
```

- [ ] **Step 5: Verify normalization and compatibility**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/effects/effectNormalization.test.ts packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/effects/effectNormalization.ts packages/dom-webgl-runtime/src/lib/effects/effectNormalization.test.ts packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.ts packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.test.ts
git commit -m "feat: normalize minimal surface material"
```

### Task 8: Render Minimal Surface Material Through Element Plane Target

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectTarget.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/surfaceTexture.ts`
- Create: `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/surfaceTexture.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.test.ts`

- [ ] **Step 1: Add surface target capability type**

Update `effectTarget.ts`:

```ts
export type WebGLSurfaceMaterialTargetState = {
  color: number;
  opacity: number;
  radius: number;
};

export type WebGLEffectTarget = {
  applySolidMaterial?(material: WebGLSolidMaterialTargetState): void;
  applySurfaceMaterial?(
    material: WebGLSurfaceMaterialTargetState,
    layout: { width: number; height: number; devicePixelRatio: number },
  ): void;
  setRotation?(x: number, y: number): void;
  disposeEffects?(): void;
};
```

- [ ] **Step 2: Write surface texture tests**

Create `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/surfaceTexture.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { createSurfaceTextureController } from "./surfaceTexture";

describe("createSurfaceTextureController", () => {
  test("sizes the backing canvas from layout and capped DPR", () => {
    const canvas = document.createElement("canvas");
    const controller = createSurfaceTextureController(canvas);

    const texture = controller.update({
      material: { color: 0x111827, opacity: 0.8, radius: 12 },
      layout: { width: 200, height: 100, devicePixelRatio: 3 },
    });

    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(150);
    expect(texture.needsUpdate).toBe(true);
  });

  test("returns the same texture for unchanged input", () => {
    const canvas = document.createElement("canvas");
    const controller = createSurfaceTextureController(canvas);
    const input = {
      material: { color: 0x111827, opacity: 0.8, radius: 12 },
      layout: { width: 200, height: 100, devicePixelRatio: 1 },
    };

    const first = controller.update(input);
    const second = controller.update(input);

    expect(second).toBe(first);
  });
});
```

- [ ] **Step 3: Verify surface texture test fails before implementation**

Run: `npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/surfaceTexture.test.ts`

Expected: FAIL because `surfaceTexture.ts` does not exist.

- [ ] **Step 4: Implement minimal rounded surface texture**

Create `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/surfaceTexture.ts`:

```ts
import { CanvasTexture } from "three/src/textures/CanvasTexture.js";
import type { WebGLSurfaceMaterialTargetState } from "../../../effects/effectTarget";

export type SurfaceTextureInput = {
  material: WebGLSurfaceMaterialTargetState;
  layout: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
};

export type SurfaceTextureController = {
  readonly texture: CanvasTexture;
  update(input: SurfaceTextureInput): CanvasTexture;
  dispose(): void;
};

export function createSurfaceTextureController(
  canvas: HTMLCanvasElement,
): SurfaceTextureController {
  const texture = new CanvasTexture(canvas);
  let lastSignature = "";

  return {
    texture,
    update(input): CanvasTexture {
      const signature = JSON.stringify(input);

      if (signature === lastSignature) {
        return texture;
      }

      lastSignature = signature;
      resizeCanvas(canvas, input.layout);
      drawSurface(canvas, input.material, input.layout);
      texture.needsUpdate = true;
      return texture;
    },
    dispose(): void {
      texture.dispose();
    },
  };
}

function resizeCanvas(
  canvas: HTMLCanvasElement,
  layout: SurfaceTextureInput["layout"],
): void {
  const dpr = Math.min(Math.max(1, layout.devicePixelRatio), 1.5);

  canvas.width = Math.max(1, Math.ceil(layout.width * dpr));
  canvas.height = Math.max(1, Math.ceil(layout.height * dpr));
}

function drawSurface(
  canvas: HTMLCanvasElement,
  material: WebGLSurfaceMaterialTargetState,
  layout: SurfaceTextureInput["layout"],
): void {
  const context = canvas.getContext?.("2d");

  if (!context) {
    return;
  }

  const scale = canvas.width / Math.max(1, layout.width);
  const radius = Math.min(material.radius * scale, canvas.width / 2, canvas.height / 2);

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.globalAlpha = material.opacity;
  context.fillStyle = `#${material.color.toString(16).padStart(6, "0")}`;
  context.beginPath();
  context.moveTo(radius, 0);
  context.lineTo(canvas.width - radius, 0);
  context.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
  context.lineTo(canvas.width, canvas.height - radius);
  context.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height);
  context.lineTo(radius, canvas.height);
  context.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
  context.lineTo(0, radius);
  context.quadraticCurveTo(0, 0, radius, 0);
  context.closePath();
  context.fill();
}
```

- [ ] **Step 5: Add element plane surface target test**

Add to `elementPlaneEffectTarget.test.ts`:

```ts
test("applies minimal surface material through a canvas texture", () => {
  const geometry = new PlaneGeometry(1, 1);
  const material = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, material);
  mesh.visible = false;
  const target = createElementPlaneEffectTarget(mesh, material, document);

  target.applySurfaceMaterial?.(
    { color: 0x111827, opacity: 0.84, radius: 16 },
    { width: 240, height: 120, devicePixelRatio: 1 },
  );

  expect(mesh.visible).toBe(true);
  expect(material.transparent).toBe(true);
  expect(material.opacity).toBe(1);
  expect(material.map).toBeTruthy();

  target.disposeEffects?.();
  geometry.dispose();
  material.dispose();
});
```

- [ ] **Step 6: Update element plane effect target**

Update `createElementPlaneEffectTarget()` signature:

```ts
export function createElementPlaneEffectTarget(
  mesh: Mesh,
  material: MeshBasicMaterial,
  ownerDocument: Document,
): WebGLEffectTarget {
```

Inside the function, create a lazily allocated surface texture controller:

```ts
let surfaceTexture:
  | ReturnType<typeof createSurfaceTextureController>
  | undefined;
```

Add capability methods:

```ts
applySurfaceMaterial(nextMaterial, layout) {
  const canvas =
    surfaceTexture?.texture.image instanceof HTMLCanvasElement
      ? surfaceTexture.texture.image
      : ownerDocument.createElement("canvas");

  surfaceTexture ??= createSurfaceTextureController(canvas);
  material.map = surfaceTexture.update({ material: nextMaterial, layout });
  material.opacity = 1;
  material.transparent = true;
  material.needsUpdate = true;
  mesh.visible = true;
},
disposeEffects() {
  surfaceTexture?.dispose();
  surfaceTexture = undefined;
},
```

Update the call site in `sceneRenderableObject.ts`:

```ts
effectTarget: createElementPlaneEffectTarget(
  mesh,
  material,
  options.element.ownerDocument,
),
```

- [ ] **Step 7: Verify surface target rendering**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/surfaceTexture.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.test.ts packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/effects/effectTarget.ts packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableObject.ts
git commit -m "feat: add minimal surface material target"
```

### Task 9: Wire Surface Through Controller, Runtime Pipeline, And Demo

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
- Modify: `apps/demo/src/App.tsx`
- Modify: `apps/demo/src/App.test.tsx`
- Modify: `apps/demo/src/demo.css`

- [ ] **Step 1: Add controller surface test**

Add to `effectController.test.ts`:

```ts
test("applies surface material with the current layout snapshot", () => {
  const target = createEffectTarget();
  const controller = createWebGLEffectController({
    key: "card.surface",
    declaration: {
      material: { kind: "surface", color: 0x111827, opacity: 0.84, radius: 16 },
    },
    source: createElementSnapshotSource(),
    target,
  });
  const layout = createLayoutSnapshot();

  controller.update(createFrameInput(), layout);

  expect(target.applySurfaceMaterial).toHaveBeenCalledWith(
    { kind: "surface", color: 0x111827, opacity: 0.84, radius: 16 },
    {
      width: layout.width,
      height: layout.height,
      devicePixelRatio: layout.devicePixelRatio,
    },
  );
});
```

Update the local target helper to include `applySurfaceMaterial: vi.fn()`.

- [ ] **Step 2: Verify controller test fails before wiring**

Run: `npm test -- --run packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts -t "surface material"`

Expected: FAIL because controller does not call `applySurfaceMaterial`.

- [ ] **Step 3: Dispatch material by kind**

In `effectController.ts`, replace solid-only material application with:

```ts
if (effects.material) {
  applyMaterialEffect(target, effects.material, layout);
}
```

Add:

```ts
function applyMaterialEffect(
  target: WebGLEffectTarget | undefined,
  material: NormalizedWebGLMaterialDeclaration,
  layout: ElementLayoutSnapshot,
): void {
  if (material.kind === "solid") {
    target?.applySolidMaterial?.({
      color: material.color,
      opacity: material.opacity,
    });
    return;
  }

  target?.applySurfaceMaterial?.(material, {
    width: layout.width,
    height: layout.height,
    devicePixelRatio: layout.devicePixelRatio,
  });
}
```

- [ ] **Step 4: Add runtime pipeline regression**

Add a runtime pipeline test using this declaration:

```ts
effects: {
  material: {
    kind: "surface",
    color: 0x111827,
    opacity: 0.84,
    radius: 16,
  },
}
```

Assert that the target has no error and the scene object becomes visible:

```ts
expect(runtime.getDebugState().targets[0]?.error).toBeUndefined();
expect(createdRenderable.getSceneObject?.()?.visible).toBe(true);
```

Use the existing `runtimePipeline.test.ts` helper pattern for Phase 5 effects.

- [ ] **Step 5: Add demo public API harness test**

Add to `apps/demo/src/App.test.tsx`:

```ts
test("declares the Phase 6 surface material harness through public WebGLTarget props", async () => {
  await renderApp();

  expect(webglDeclarationFor("demo.effects.surface.phase6")).toMatchObject({
    key: "demo.effects.surface.phase6",
    source: { kind: "snapshot", mode: "element" },
    effects: {
      material: {
        kind: "surface",
        color: 0x111827,
        opacity: 0.86,
        radius: 18,
      },
      motion: { kind: "pointer-tilt", strength: 0.35, maxDegrees: 6 },
    },
  });
});
```

- [ ] **Step 6: Add demo target through public `WebGLTarget`**

In `apps/demo/src/App.tsx`, add one target near the existing Phase 5 effect harness:

```tsx
<WebGLTarget
  as="section"
  className="demo-effect-card demo-effect-card--phase6"
  webgl={{
    key: "demo.effects.surface.phase6",
    source: { kind: "snapshot", mode: "element" },
    lifecycle: { hideWhenReady: true, hideMode: "self" },
    effects: {
      material: {
        kind: "surface",
        color: 0x111827,
        opacity: 0.86,
        radius: 18,
      },
      motion: { kind: "pointer-tilt", strength: 0.35, maxDegrees: 6 },
    },
  }}
>
  <span>Phase 6 surface material</span>
</WebGLTarget>
```

Add layout-only CSS:

```css
.demo-effect-card--phase6 {
  min-height: 160px;
  padding: 24px;
}
```

- [ ] **Step 7: Verify controller, runtime, and demo**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts apps/demo/src/App.test.tsx -t "surface|Phase 6"
npm run check:imports
npm run typecheck
```

Expected:

- Focused tests PASS.
- `Demo import boundary OK`.
- TypeScript PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/effects/effectController.ts packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts apps/demo/src/App.tsx apps/demo/src/App.test.tsx apps/demo/src/demo.css
git commit -m "feat: wire minimal surface material"
```

### Task 10: Phase 6.2 Documentation Alignment And Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`
- Modify: `docs/superpowers/plans/2026-06-19-phase-6-modular-surface-materials.md`

- [ ] **Step 1: Update public docs**

Update README effect example:

```ts
type WebGLEffectsDeclaration = {
  material?:
    | { kind: "solid"; color?: number; opacity?: number }
    | { kind: "surface"; color?: number; opacity?: number; radius?: number };
  motion?: { kind: "pointer-tilt"; strength?: number; maxDegrees?: number };
};
```

Add status text:

```md
Phase 6.2 adds a minimal built-in `surface` material for explicit WebGL-owned element snapshot surfaces. It supports declaration-owned color, opacity, and radius only; border, shadow, gradients, and CSS paint cloning remain out of scope unless a separately approved Phase 6.3 gate explicitly includes them.
```

- [ ] **Step 2: Update execution state**

Add to `docs/EXECUTION_STATE.md`:

```md
Phase 6.2 minimal surface material is implemented: `effects.material.kind: "surface"` supports declaration-owned color, opacity, and radius on `snapshot/element` targets through the modular element-plane effect target adapter.
```

- [ ] **Step 3: Mark Phase 6.2 complete in this plan**

Check off Task 6 through Task 10 and add:

```md
## Phase 6.2 Completed Task Record

- Completed work: Added public minimal `surface` material declarations, normalization, compatibility checks, controller dispatch, element-plane surface texture rendering, demo harness, and documentation alignment.
- Verification: `npm run test -- --run`, `npm run typecheck`, `npm run build`, `npm run check:imports`, and `git diff --check` passed.
- Boundary notes: No custom registry, shader authoring API, particles, picking, multiple canvases, public Three.js render flags, third-party scroll adapter, CSS paint cloning, or demo-specific runtime branch was added.
```

- [ ] **Step 4: Run full verification**

Run:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Expected:

- Vitest PASS.
- TypeScript PASS.
- Build PASS, allowing the existing non-blocking Vite chunk-size warning if it still appears.
- Import boundary PASS with `Demo import boundary OK`.
- `git diff --check` produces no output.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/00-goal.md docs/EXECUTION_STATE.md docs/superpowers/plans/2026-06-19-phase-6-modular-surface-materials.md
git commit -m "docs: align phase 6.2 minimal surface material"
```

## Phase 6.3 Decision Gate

Stop after Phase 6.2 unless the user explicitly asks for a surface detail expansion. Do not begin these details as part of the default Phase 6 execution path.

If Phase 6.3 is approved, write a short follow-up implementation plan for exactly one detail at a time:

- `border`: add `border?: { color?: number; opacity?: number; width?: number }`.
- `shadow`: add `shadow?: { color?: number; opacity?: number; blur?: number; offsetX?: number; offsetY?: number }`.
- surface texture quality: improve only `surfaceTexture.ts` and its tests.
- cache tuning: improve only surface texture update signatures and tests.

Each Phase 6.3 detail must include:

- Public type test proving the declaration shape.
- Normalization test proving defaults and clamps.
- Compatibility test proving source limits remain unchanged.
- Target adapter test proving the rendered capability.
- Runtime pipeline or demo test only if the public behavior changes.
- Docs update naming the detail as explicit effect-owned styling, not CSS cloning.

## Final Review Checklist

- `effects/*` pure modules do not import Three.js, React, demo code, or renderable implementation modules.
- Renderable effect target adapters own Three.js resources and dispose texture/material resources deterministically.
- `runtime.ts` does not branch on `solid` or `surface`; it only owns controller lifecycle.
- `apps/demo` imports only public package entrypoints.
- The public API still rejects Three.js render flags.
- Surface values are declaration-owned numeric values, not CSS strings read from DOM computed styles.
- Existing `solid` and `pointer-tilt` behavior remains covered by tests.

## Out Of Scope

- Public custom effect registry.
- Shader authoring API.
- Particles.
- WebGL raycast picking.
- Multiple canvases.
- Lenis, GSAP, ScrollTrigger, or any third-party scroll adapter.
- Full CSS-to-WebGL fidelity or computed-style paint cloning.
- Demo key, class, asset, DOM structure, or copy branches inside runtime/package code.
