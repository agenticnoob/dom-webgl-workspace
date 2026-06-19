# Phase 7 Effect Runtime Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed `material`/`motion` effect slots with a capability-driven effect runtime that can host built-in and future user-registered effects without coupling the core runtime to individual effect kinds.

**Architecture:** Keep DOM as the authoring source for layout, content, accessibility, and input, while effects become small WebGL runtime plugins that consume explicit source/capability context. Runtime owns registration, layout snapshots, frame input, and lifecycle; effect plugins own normalization, compatibility, target updates, and disposal. Existing Phase 6 declarations remain supported through a compatibility compiler, but the internal execution path becomes `declaration -> normalized effect entries -> registry plugins -> target capabilities`.

**Tech Stack:** TypeScript, Vitest, jsdom, Three.js internal renderable adapters, React/Vite demo app.

---

## Current Truth

- Current public API is `effects.material?: { kind: "solid" | "surface" }` plus `effects.motion?: { kind: "pointer-tilt" }`.
- Current `effectController.ts` normalizes effects, checks material/source compatibility, dispatches material target updates, and calls pointer motion.
- Current `effectTarget.ts` is method-shaped: `applySolidMaterial`, `applySurfaceMaterial`, `setRotation`, `disposeEffects`.
- Phase 6.2 intentionally stopped at a minimal `surface` with `color`, `opacity`, and `radius`; border, shadow, gradients, shader authoring, particles, picking, CSS paint cloning, and custom effect registry are not implemented.
- The product goal says effects consume target descriptors, layout/content snapshots, renderables, frame input, pointer/scroll state, and explicit source/render-role compatibility. Effects must not scan DOM, create separate renderers, or own independent asset pipelines.

## Design Decision

Do not keep expanding `material` into a general effect taxonomy. That name is a renderer implementation term, and it forces users to decide whether a behavior is a material, surface, motion, text effect, or media effect before the runtime has a stable model.

The next public mental model should be:

```ts
effects: [
  { kind: "surface.basic", color: 0x111111, opacity: 0.75, radius: 24 },
  { kind: "motion.pointerTilt", strength: 0.6, maxDegrees: 6 },
]
```

The current Phase 6 object form remains valid during the transition:

```ts
effects: {
  material: { kind: "surface", color: 0x111111, opacity: 0.75, radius: 24 },
  motion: { kind: "pointer-tilt", strength: 0.6, maxDegrees: 6 },
}
```

Internally both forms compile to the same normalized effect entries. This keeps user migration small while removing effect-kind branching from runtime lifecycle code.

## Non-Goals

- Do not implement ReactBits-style scrambled text in this phase. This plan creates the effect runtime primitive that would make it possible; text-specific mutation needs a separate source/target capability plan.
- Do not clone arbitrary CSS visual paint.
- Do not expose Three.js flags or objects in public declarations.
- Do not add a shader authoring API.
- Do not add particles, picking, multiple canvases, or a third-party scroll adapter.
- Do not add demo-specific runtime branches.

## Software Design Rules

- **Single Responsibility:** normalization, registry resolution, compatibility checks, plugin execution, and Three.js target adaptation live in separate modules.
- **Open/Closed:** new effects register plugins; runtime lifecycle code should not receive a new `if (kind === "...")` branch for every effect.
- **Dependency Inversion:** runtime depends on `WebGLEffectPlugin` and `WebGLEffectTarget`, not concrete surface or pointer-tilt modules.
- **Interface Segregation:** effects request explicit target capabilities such as `material.surface` or `transform.rotation`; they do not assume every target supports every method.
- **High Cohesion:** built-in effect normalization and execution live beside their plugin definitions.
- **Low Coupling:** pure effect modules do not import Three.js, React, demo code, or renderable implementation modules.
- **YAGNI:** support only existing built-ins plus custom registration primitives; postpone text mutation until the target capability is real.

## File Map

Effect declaration and compilation:

- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectDeclaration.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectDeclaration.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectNormalization.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectNormalization.test.ts`

Registry and plugin contracts:

- Create: `packages/dom-webgl-runtime/src/lib/effects/effectPlugin.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectRegistry.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectRegistry.test.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectCapabilities.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectCapabilities.test.ts`

Built-in effects:

- Create: `packages/dom-webgl-runtime/src/lib/effects/builtins/surfaceBasicEffect.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/builtins/surfaceBasicEffect.test.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/builtins/solidMaterialEffect.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/builtins/solidMaterialEffect.test.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/builtins/pointerTiltEffect.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/builtins/pointerTiltEffect.test.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/builtins/index.ts`

Controller and target capability boundary:

- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectTarget.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/effectTargets/elementPlaneEffectTarget.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

Public exports, docs, and demo:

- Modify: `packages/dom-webgl-runtime/src/index.ts`
- Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.test.ts`
- Modify: `apps/demo/src/App.tsx`
- Modify: `apps/demo/src/App.test.tsx`
- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`

## Target Public Contract

Add the array effect form while preserving the existing object form:

```ts
export type WebGLSurfaceBasicEffectDeclaration = {
  kind: "surface.basic";
  color?: number;
  opacity?: number;
  radius?: number;
};

export type WebGLSolidMaterialEffectDeclaration = {
  kind: "material.solid";
  color?: number;
  opacity?: number;
};

export type WebGLPointerTiltEffectDeclaration = {
  kind: "motion.pointerTilt";
  strength?: number;
  maxDegrees?: number;
};

export type WebGLBuiltInEffectDeclaration =
  | WebGLSurfaceBasicEffectDeclaration
  | WebGLSolidMaterialEffectDeclaration
  | WebGLPointerTiltEffectDeclaration;

export type WebGLCustomEffectDeclaration = {
  kind: string;
  [property: string]: unknown;
};

export type WebGLEffectDeclaration =
  | WebGLBuiltInEffectDeclaration
  | WebGLCustomEffectDeclaration;

export type WebGLLegacyEffectsDeclaration = {
  material?: WebGLMaterialDeclaration;
  motion?: WebGLMotionDeclaration;
};

export type WebGLEffectsDeclaration =
  | readonly WebGLEffectDeclaration[]
  | WebGLLegacyEffectsDeclaration;
```

The legacy compiler maps:

- `{ material: { kind: "solid" } }` to `{ kind: "material.solid" }`
- `{ material: { kind: "surface" } }` to `{ kind: "surface.basic" }`
- `{ motion: { kind: "pointer-tilt" } }` to `{ kind: "motion.pointerTilt" }`

## Target Plugin Contract

Create a plugin contract that is pure TypeScript and does not depend on Three.js:

```ts
export type WebGLEffectSourceKind =
  | "snapshot/element"
  | "snapshot/text"
  | "image"
  | "video"
  | "model/glb";

export type WebGLEffectTargetCapability =
  | "material.solid"
  | "material.surface"
  | "transform.rotation";

export type WebGLEffectTargetContext = {
  key: string;
  sourceKind: WebGLEffectSourceKind;
  layout: ElementLayoutSnapshot;
  input: WebGLFrameInput;
  target: WebGLEffectTarget | undefined;
};

export type WebGLEffectInstance = {
  update(context: WebGLEffectTargetContext): void;
  dispose?(): void;
};

export type WebGLEffectPlugin<
  TDeclaration extends WebGLEffectDeclaration,
  TState,
> = {
  readonly kind: TDeclaration["kind"];
  readonly appliesTo: readonly WebGLEffectSourceKind[];
  readonly capabilities: readonly WebGLEffectTargetCapability[];
  normalize(declaration: TDeclaration): TState;
  create(state: TState): WebGLEffectInstance;
};
```

## Phase 7.1 Tasks: Compile Declarations Into Effect Entries

### Task 1: Add Effect Declaration Tests

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectDeclaration.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectDeclaration.test.ts`

- [ ] **Step 1: Write failing tests for array and legacy forms**

Create `packages/dom-webgl-runtime/src/lib/effects/effectDeclaration.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { compileWebGLEffectDeclarations } from "./effectDeclaration";

describe("compileWebGLEffectDeclarations", () => {
  test("returns array declarations unchanged", () => {
    expect(
      compileWebGLEffectDeclarations([
        { kind: "surface.basic", color: 0x111111, opacity: 0.5, radius: 18 },
        { kind: "motion.pointerTilt", strength: 0.4, maxDegrees: 5 },
      ]),
    ).toEqual([
      { kind: "surface.basic", color: 0x111111, opacity: 0.5, radius: 18 },
      { kind: "motion.pointerTilt", strength: 0.4, maxDegrees: 5 },
    ]);
  });

  test("compiles legacy material and motion slots into ordered effect declarations", () => {
    expect(
      compileWebGLEffectDeclarations({
        material: { kind: "surface", color: 0x222222, opacity: 0.75, radius: 24 },
        motion: { kind: "pointer-tilt", strength: 0.8, maxDegrees: 9 },
      }),
    ).toEqual([
      { kind: "surface.basic", color: 0x222222, opacity: 0.75, radius: 24 },
      { kind: "motion.pointerTilt", strength: 0.8, maxDegrees: 9 },
    ]);
  });

  test("compiles legacy solid material into the explicit solid effect kind", () => {
    expect(
      compileWebGLEffectDeclarations({
        material: { kind: "solid", color: 0xffffff, opacity: 0.9 },
      }),
    ).toEqual([
      { kind: "material.solid", color: 0xffffff, opacity: 0.9 },
    ]);
  });

  test("returns an empty array when effects are not declared", () => {
    expect(compileWebGLEffectDeclarations(undefined)).toEqual([]);
  });
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- --run packages/dom-webgl-runtime/src/lib/effects/effectDeclaration.test.ts`

Expected: FAIL because `effectDeclaration.ts` does not exist.

- [ ] **Step 3: Add public types and compiler**

Modify `packages/dom-webgl-runtime/src/lib/types.ts` with the target public contract shown above. Keep the existing `WebGLMaterialDeclaration` and `WebGLMotionDeclaration` exports for the legacy object form.

Create `packages/dom-webgl-runtime/src/lib/effects/effectDeclaration.ts`:

```ts
import type {
  WebGLEffectDeclaration,
  WebGLEffectsDeclaration,
  WebGLLegacyEffectsDeclaration,
} from "../types";

export function compileWebGLEffectDeclarations(
  declaration: WebGLEffectsDeclaration | undefined,
): WebGLEffectDeclaration[] {
  if (!declaration) {
    return [];
  }

  if (Array.isArray(declaration)) {
    return [...declaration];
  }

  return compileLegacyEffectsDeclaration(declaration);
}

function compileLegacyEffectsDeclaration(
  declaration: WebGLLegacyEffectsDeclaration,
): WebGLEffectDeclaration[] {
  const effects: WebGLEffectDeclaration[] = [];

  if (declaration.material?.kind === "solid") {
    effects.push({
      kind: "material.solid",
      color: declaration.material.color,
      opacity: declaration.material.opacity,
    });
  }

  if (declaration.material?.kind === "surface") {
    effects.push({
      kind: "surface.basic",
      color: declaration.material.color,
      opacity: declaration.material.opacity,
      radius: declaration.material.radius,
    });
  }

  if (declaration.motion?.kind === "pointer-tilt") {
    effects.push({
      kind: "motion.pointerTilt",
      strength: declaration.motion.strength,
      maxDegrees: declaration.motion.maxDegrees,
    });
  }

  return effects;
}
```

- [ ] **Step 4: Verify declaration compilation passes**

Run: `npm test -- --run packages/dom-webgl-runtime/src/lib/effects/effectDeclaration.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/types.ts packages/dom-webgl-runtime/src/lib/effects/effectDeclaration.ts packages/dom-webgl-runtime/src/lib/effects/effectDeclaration.test.ts
git commit -m "feat: compile webgl effect declarations"
```

### Task 2: Add Registry and Capability Primitives

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectPlugin.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectRegistry.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectRegistry.test.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectCapabilities.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/effectCapabilities.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectTarget.ts`

- [ ] **Step 1: Write failing registry tests**

Create `packages/dom-webgl-runtime/src/lib/effects/effectRegistry.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { createWebGLEffectRegistry } from "./effectRegistry";
import type { WebGLEffectPlugin } from "./effectPlugin";

const testPlugin: WebGLEffectPlugin<{ kind: "test.effect"; value?: number }, { value: number }> = {
  kind: "test.effect",
  appliesTo: ["snapshot/element"],
  capabilities: ["material.surface"],
  normalize: (declaration) => ({ value: declaration.value ?? 1 }),
  create: () => ({ update: () => undefined }),
};

describe("createWebGLEffectRegistry", () => {
  test("registers and resolves plugins by kind", () => {
    const registry = createWebGLEffectRegistry();
    registry.register(testPlugin);

    expect(registry.resolve("test.effect")).toBe(testPlugin);
  });

  test("throws on duplicate plugin kinds", () => {
    const registry = createWebGLEffectRegistry();
    registry.register(testPlugin);

    expect(() => registry.register(testPlugin)).toThrow(
      'WebGL effect plugin "test.effect" is already registered.',
    );
  });

  test("returns undefined for unknown plugin kinds", () => {
    expect(createWebGLEffectRegistry().resolve("missing.effect")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Write failing capability tests**

Create `packages/dom-webgl-runtime/src/lib/effects/effectCapabilities.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { effectTargetSupports } from "./effectCapabilities";
import type { WebGLEffectTarget } from "./effectTarget";

describe("effectTargetSupports", () => {
  test("detects optional target capabilities", () => {
    const target: WebGLEffectTarget = {
      applySurfaceMaterial: () => undefined,
      setRotation: () => undefined,
    };

    expect(effectTargetSupports(target, "material.surface")).toBe(true);
    expect(effectTargetSupports(target, "transform.rotation")).toBe(true);
    expect(effectTargetSupports(target, "material.solid")).toBe(false);
  });

  test("returns false when no target is available", () => {
    expect(effectTargetSupports(undefined, "material.surface")).toBe(false);
  });
});
```

- [ ] **Step 3: Verify the tests fail**

Run: `npm test -- --run packages/dom-webgl-runtime/src/lib/effects/effectRegistry.test.ts packages/dom-webgl-runtime/src/lib/effects/effectCapabilities.test.ts`

Expected: FAIL because the registry and capability modules do not exist.

- [ ] **Step 4: Add plugin, registry, and capability modules**

Create `packages/dom-webgl-runtime/src/lib/effects/effectPlugin.ts`:

```ts
import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import type { WebGLFrameInput, WebGLEffectDeclaration } from "../types";
import type { WebGLEffectTarget } from "./effectTarget";

export type WebGLEffectSourceKind =
  | "snapshot/element"
  | "snapshot/text"
  | "image"
  | "video"
  | "model/glb";

export type WebGLEffectTargetCapability =
  | "material.solid"
  | "material.surface"
  | "transform.rotation";

export type WebGLEffectTargetContext = {
  key: string;
  sourceKind: WebGLEffectSourceKind;
  layout: ElementLayoutSnapshot;
  input: WebGLFrameInput;
  target: WebGLEffectTarget | undefined;
};

export type WebGLEffectInstance = {
  update(context: WebGLEffectTargetContext): void;
  dispose?(): void;
};

export type WebGLEffectPlugin<
  TDeclaration extends WebGLEffectDeclaration = WebGLEffectDeclaration,
  TState = unknown,
> = {
  readonly kind: TDeclaration["kind"];
  readonly appliesTo: readonly WebGLEffectSourceKind[];
  readonly capabilities: readonly WebGLEffectTargetCapability[];
  normalize(declaration: TDeclaration): TState;
  create(state: TState): WebGLEffectInstance;
};
```

Create `packages/dom-webgl-runtime/src/lib/effects/effectRegistry.ts`:

```ts
import type { WebGLEffectPlugin } from "./effectPlugin";

export type WebGLEffectRegistry = {
  register(plugin: WebGLEffectPlugin): void;
  resolve(kind: string): WebGLEffectPlugin | undefined;
  list(): readonly WebGLEffectPlugin[];
};

export function createWebGLEffectRegistry(
  plugins: readonly WebGLEffectPlugin[] = [],
): WebGLEffectRegistry {
  const byKind = new Map<string, WebGLEffectPlugin>();

  const registry: WebGLEffectRegistry = {
    register(plugin): void {
      if (byKind.has(plugin.kind)) {
        throw new Error(`WebGL effect plugin "${plugin.kind}" is already registered.`);
      }

      byKind.set(plugin.kind, plugin);
    },
    resolve(kind): WebGLEffectPlugin | undefined {
      return byKind.get(kind);
    },
    list(): readonly WebGLEffectPlugin[] {
      return [...byKind.values()];
    },
  };

  for (const plugin of plugins) {
    registry.register(plugin);
  }

  return registry;
}
```

Create `packages/dom-webgl-runtime/src/lib/effects/effectCapabilities.ts`:

```ts
import type { WebGLEffectTarget } from "./effectTarget";
import type { WebGLEffectTargetCapability } from "./effectPlugin";

export function effectTargetSupports(
  target: WebGLEffectTarget | undefined,
  capability: WebGLEffectTargetCapability,
): boolean {
  if (!target) {
    return false;
  }

  switch (capability) {
    case "material.solid":
      return !!target.applySolidMaterial;
    case "material.surface":
      return !!target.applySurfaceMaterial;
    case "transform.rotation":
      return !!target.setRotation;
  }
}
```

- [ ] **Step 5: Verify registry and capability tests pass**

Run: `npm test -- --run packages/dom-webgl-runtime/src/lib/effects/effectRegistry.test.ts packages/dom-webgl-runtime/src/lib/effects/effectCapabilities.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/effects/effectPlugin.ts packages/dom-webgl-runtime/src/lib/effects/effectRegistry.ts packages/dom-webgl-runtime/src/lib/effects/effectRegistry.test.ts packages/dom-webgl-runtime/src/lib/effects/effectCapabilities.ts packages/dom-webgl-runtime/src/lib/effects/effectCapabilities.test.ts packages/dom-webgl-runtime/src/lib/effects/effectTarget.ts
git commit -m "feat: add webgl effect registry primitives"
```

## Phase 7.2 Tasks: Migrate Existing Built-Ins Into Plugins

### Task 3: Move Solid and Surface Into Built-In Plugins

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/effects/builtins/solidMaterialEffect.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/builtins/solidMaterialEffect.test.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/builtins/surfaceBasicEffect.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/builtins/surfaceBasicEffect.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectNormalization.ts`

- [ ] **Step 1: Write failing built-in material tests**

Create `packages/dom-webgl-runtime/src/lib/effects/builtins/surfaceBasicEffect.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";

import { surfaceBasicEffect } from "./surfaceBasicEffect";
import type { WebGLEffectTargetContext } from "../effectPlugin";

describe("surfaceBasicEffect", () => {
  test("normalizes color opacity and radius", () => {
    expect(
      surfaceBasicEffect.normalize({
        kind: "surface.basic",
        color: 0x1ffffff,
        opacity: 2,
        radius: 120,
      }),
    ).toEqual({ color: 0xffffff, opacity: 1, radius: 96 });
  });

  test("applies surface material through target capability", () => {
    const applySurfaceMaterial = vi.fn();
    const instance = surfaceBasicEffect.create({
      color: 0x123456,
      opacity: 0.75,
      radius: 24,
    });

    instance.update({
      key: "hero",
      sourceKind: "snapshot/element",
      input: frameInput(),
      layout: layoutSnapshot(),
      target: { applySurfaceMaterial },
    });

    expect(applySurfaceMaterial).toHaveBeenCalledWith(
      { color: 0x123456, opacity: 0.75, radius: 24 },
      { width: 320, height: 180, devicePixelRatio: 2 },
    );
  });
});

function layoutSnapshot(): WebGLEffectTargetContext["layout"] {
  return {
    key: "hero",
    rect: new DOMRect(0, 0, 320, 180),
    width: 320,
    height: 180,
    viewportWidth: 1024,
    viewportHeight: 768,
    devicePixelRatio: 2,
    scrollY: 0,
    visible: true,
  };
}

function frameInput(): WebGLEffectTargetContext["input"] {
  return {
    time: 0,
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
    },
  };
}
```

- [ ] **Step 2: Create the surface plugin**

Create `packages/dom-webgl-runtime/src/lib/effects/builtins/surfaceBasicEffect.ts`:

```ts
import type { WebGLSurfaceBasicEffectDeclaration } from "../../types";
import type { WebGLEffectPlugin } from "../effectPlugin";

export type NormalizedSurfaceBasicEffect = {
  color: number;
  opacity: number;
  radius: number;
};

export const surfaceBasicEffect: WebGLEffectPlugin<
  WebGLSurfaceBasicEffectDeclaration,
  NormalizedSurfaceBasicEffect
> = {
  kind: "surface.basic",
  appliesTo: ["snapshot/element"],
  capabilities: ["material.surface"],
  normalize(declaration) {
    return {
      color: clampInteger(declaration.color, 0, 0xffffff, 0xffffff),
      opacity: clampNumber(declaration.opacity, 0, 1, 1),
      radius: clampNumber(declaration.radius, 0, 96, 0),
    };
  },
  create(state) {
    return {
      update(context): void {
        context.target?.applySurfaceMaterial?.(state, {
          width: context.layout.width,
          height: context.layout.height,
          devicePixelRatio: context.layout.devicePixelRatio,
        });
      },
    };
  },
};

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

Create `packages/dom-webgl-runtime/src/lib/effects/builtins/solidMaterialEffect.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";

import { solidMaterialEffect } from "./solidMaterialEffect";
import type { WebGLEffectTargetContext } from "../effectPlugin";

describe("solidMaterialEffect", () => {
  test("normalizes color and opacity", () => {
    expect(
      solidMaterialEffect.normalize({
        kind: "material.solid",
        color: 0x1ffffff,
        opacity: 2,
      }),
    ).toEqual({ color: 0xffffff, opacity: 1 });
  });

  test("applies solid material through target capability", () => {
    const applySolidMaterial = vi.fn();
    const instance = solidMaterialEffect.create({
      color: 0x123456,
      opacity: 0.75,
    });

    instance.update({
      key: "hero",
      sourceKind: "snapshot/element",
      input: frameInput(),
      layout: layoutSnapshot(),
      target: { applySolidMaterial },
    });

    expect(applySolidMaterial).toHaveBeenCalledWith({
      color: 0x123456,
      opacity: 0.75,
    });
  });
});

function layoutSnapshot(): WebGLEffectTargetContext["layout"] {
  return {
    key: "hero",
    rect: new DOMRect(0, 0, 320, 180),
    width: 320,
    height: 180,
    viewportWidth: 1024,
    viewportHeight: 768,
    devicePixelRatio: 2,
    scrollY: 0,
    visible: true,
  };
}

function frameInput(): WebGLEffectTargetContext["input"] {
  return {
    time: 0,
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
    },
  };
}
```

Create `packages/dom-webgl-runtime/src/lib/effects/builtins/solidMaterialEffect.ts`:

```ts
import type { WebGLSolidMaterialEffectDeclaration } from "../../types";
import type { WebGLEffectPlugin } from "../effectPlugin";

export type NormalizedSolidMaterialEffect = {
  color: number;
  opacity: number;
};

export const solidMaterialEffect: WebGLEffectPlugin<
  WebGLSolidMaterialEffectDeclaration,
  NormalizedSolidMaterialEffect
> = {
  kind: "material.solid",
  appliesTo: ["snapshot/element"],
  capabilities: ["material.solid"],
  normalize(declaration) {
    return {
      color: clampInteger(declaration.color, 0, 0xffffff, 0xffffff),
      opacity: clampNumber(declaration.opacity, 0, 1, 1),
    };
  },
  create(state) {
    return {
      update(context): void {
        context.target?.applySolidMaterial?.({
          color: state.color,
          opacity: state.opacity,
        });
      },
    };
  },
};

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

- [ ] **Step 3: Verify material plugin tests pass**

Run: `npm test -- --run packages/dom-webgl-runtime/src/lib/effects/builtins/surfaceBasicEffect.test.ts packages/dom-webgl-runtime/src/lib/effects/builtins/solidMaterialEffect.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/effects/builtins/solidMaterialEffect.ts packages/dom-webgl-runtime/src/lib/effects/builtins/solidMaterialEffect.test.ts packages/dom-webgl-runtime/src/lib/effects/builtins/surfaceBasicEffect.ts packages/dom-webgl-runtime/src/lib/effects/builtins/surfaceBasicEffect.test.ts packages/dom-webgl-runtime/src/lib/effects/effectNormalization.ts
git commit -m "feat: move webgl materials into effect plugins"
```

### Task 4: Move Pointer Tilt Into a Built-In Plugin

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/effects/builtins/pointerTiltEffect.ts`
- Create: `packages/dom-webgl-runtime/src/lib/effects/builtins/pointerTiltEffect.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/motions/pointerTilt.ts`

- [ ] **Step 1: Write failing pointer tilt plugin tests**

Create `packages/dom-webgl-runtime/src/lib/effects/builtins/pointerTiltEffect.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";

import { pointerTiltEffect } from "./pointerTiltEffect";
import type { WebGLEffectTargetContext } from "../effectPlugin";

describe("pointerTiltEffect", () => {
  test("normalizes strength and maxDegrees", () => {
    expect(
      pointerTiltEffect.normalize({
        kind: "motion.pointerTilt",
        strength: -1,
        maxDegrees: 90,
      }),
    ).toEqual({ kind: "pointer-tilt", strength: 0, maxDegrees: 30 });
  });

  test("updates rotation through target capability", () => {
    const setRotation = vi.fn();
    const instance = pointerTiltEffect.create({
      kind: "pointer-tilt",
      strength: 1,
      maxDegrees: 10,
    });

    instance.update({
      key: "hero",
      sourceKind: "snapshot/element",
      layout: layoutSnapshot(),
      input: {
        ...frameInput(),
        pointer: { ...frameInput().pointer, isInside: true, normalizedX: 1, normalizedY: -1 },
      },
      target: { setRotation },
    });

    expect(setRotation).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
  });
});

function layoutSnapshot(): WebGLEffectTargetContext["layout"] {
  return {
    key: "hero",
    rect: new DOMRect(0, 0, 320, 180),
    width: 320,
    height: 180,
    viewportWidth: 1024,
    viewportHeight: 768,
    devicePixelRatio: 2,
    scrollY: 0,
    visible: true,
  };
}

function frameInput(): WebGLEffectTargetContext["input"] {
  return {
    time: 0,
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
    },
  };
}
```

- [ ] **Step 2: Create the pointer tilt plugin**

Create `packages/dom-webgl-runtime/src/lib/effects/builtins/pointerTiltEffect.ts`:

```ts
import type { WebGLPointerTiltEffectDeclaration } from "../../types";
import type { WebGLEffectPlugin } from "../effectPlugin";
import { applyPointerTilt } from "../motions/pointerTilt";

export type NormalizedPointerTiltEffect = {
  kind: "pointer-tilt";
  strength: number;
  maxDegrees: number;
};

export const pointerTiltEffect: WebGLEffectPlugin<
  WebGLPointerTiltEffectDeclaration,
  NormalizedPointerTiltEffect
> = {
  kind: "motion.pointerTilt",
  appliesTo: ["snapshot/element", "snapshot/text", "image", "video", "model/glb"],
  capabilities: ["transform.rotation"],
  normalize(declaration) {
    return {
      kind: "pointer-tilt",
      strength: clampNumber(declaration.strength, 0, 1, 1),
      maxDegrees: clampNumber(declaration.maxDegrees, 0, 30, 8),
    };
  },
  create(state) {
    return {
      update(context): void {
        applyPointerTilt(context.target, context.input, state);
      },
    };
  },
};

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

- [ ] **Step 3: Verify pointer tilt plugin tests pass**

Run: `npm test -- --run packages/dom-webgl-runtime/src/lib/effects/builtins/pointerTiltEffect.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/effects/builtins/pointerTiltEffect.ts packages/dom-webgl-runtime/src/lib/effects/builtins/pointerTiltEffect.test.ts packages/dom-webgl-runtime/src/lib/effects/motions/pointerTilt.ts
git commit -m "feat: move pointer tilt into effect plugin"
```

### Task 5: Rewrite Effect Controller Around Registry Instances

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/effects/builtins/index.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.test.ts`

- [ ] **Step 1: Write failing controller tests for plugin execution**

Modify `packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts` to cover:

```ts
test("runs array effect declarations through registered plugins", () => {
  const applySurfaceMaterial = vi.fn();
  const controller = createWebGLEffectController({
    key: "hero",
    declaration: [{ kind: "surface.basic", color: 0x111111, opacity: 0.5, radius: 12 }],
    source: snapshotElementSource(),
    target: { applySurfaceMaterial },
  });

  controller.update(frameInput(), layoutSnapshot());

  expect(applySurfaceMaterial).toHaveBeenCalledWith(
    { color: 0x111111, opacity: 0.5, radius: 12 },
    { width: 320, height: 180, devicePixelRatio: 2 },
  );
});

test("keeps legacy effects working through the compiler", () => {
  const setRotation = vi.fn();
  const controller = createWebGLEffectController({
    key: "hero",
    declaration: { motion: { kind: "pointer-tilt", strength: 1, maxDegrees: 8 } },
    source: snapshotElementSource(),
    target: { setRotation },
  });

  controller.update(
    {
      ...frameInput(),
      pointer: { ...frameInput().pointer, isInside: true, normalizedX: 1, normalizedY: -1 },
    },
    layoutSnapshot(),
  );

  expect(setRotation).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
});

test("reports unknown effect kinds as configuration errors", () => {
  expect(() =>
    createWebGLEffectController({
      key: "hero",
      declaration: [{ kind: "missing.effect" }],
      source: snapshotElementSource(),
      target: {},
    }),
  ).toThrow('WebGL target "hero" references unknown effect "missing.effect".');
});
```

- [ ] **Step 2: Register built-ins**

Create `packages/dom-webgl-runtime/src/lib/effects/builtins/index.ts`:

```ts
import type { WebGLEffectPlugin } from "../effectPlugin";
import { pointerTiltEffect } from "./pointerTiltEffect";
import { solidMaterialEffect } from "./solidMaterialEffect";
import { surfaceBasicEffect } from "./surfaceBasicEffect";

export const builtInWebGLEffectPlugins: readonly WebGLEffectPlugin[] = [
  solidMaterialEffect,
  surfaceBasicEffect,
  pointerTiltEffect,
];
```

- [ ] **Step 3: Rewrite controller to compile, resolve, instantiate, and update plugins**

Modify `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`:

```ts
import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";
import type { WebGLEffectsDeclaration, WebGLFrameInput } from "../types";
import { builtInWebGLEffectPlugins } from "./builtins";
import { compileWebGLEffectDeclarations } from "./effectDeclaration";
import { assertEffectCompatibility } from "./effectCompatibility";
import type { WebGLEffectInstance, WebGLEffectSourceKind } from "./effectPlugin";
import { createWebGLEffectRegistry, type WebGLEffectRegistry } from "./effectRegistry";
import type { WebGLEffectTarget } from "./effectTarget";

export type WebGLEffectController = {
  readonly hasEffects: boolean;
  update(input: WebGLFrameInput, layout: ElementLayoutSnapshot): void;
  dispose(): void;
};

export type WebGLEffectControllerOptions = {
  key: string;
  declaration?: WebGLEffectsDeclaration;
  source: WebGLSourceDescriptor;
  target?: WebGLEffectTarget;
  getTarget?(): WebGLEffectTarget | undefined;
  registry?: WebGLEffectRegistry;
};

export function createWebGLEffectController(
  options: WebGLEffectControllerOptions,
): WebGLEffectController {
  const registry =
    options.registry ?? createWebGLEffectRegistry(builtInWebGLEffectPlugins);
  const sourceKind = readEffectSourceKind(options.source);
  const instances = compileWebGLEffectDeclarations(options.declaration).map(
    (declaration) => {
      const plugin = registry.resolve(declaration.kind);

      if (!plugin) {
        throw new Error(
          `WebGL target "${options.key}" references unknown effect "${declaration.kind}".`,
        );
      }

      assertEffectCompatibility(options.key, declaration.kind, plugin, sourceKind);

      return plugin.create(plugin.normalize(declaration));
    },
  );
  let disposed = false;

  return {
    get hasEffects() {
      return instances.length > 0;
    },
    update(input, layout): void {
      if (disposed) {
        return;
      }

      const target = options.getTarget?.() ?? options.target;

      for (const instance of instances) {
        instance.update({
          key: options.key,
          sourceKind,
          input,
          layout,
          target,
        });
      }
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      for (const instance of instances) {
        instance.dispose?.();
      }
      (options.getTarget?.() ?? options.target)?.disposeEffects?.();
    },
  };
}

function readEffectSourceKind(source: WebGLSourceDescriptor): WebGLEffectSourceKind {
  if (source.kind === "snapshot") {
    return source.mode === "text" ? "snapshot/text" : "snapshot/element";
  }

  if (source.kind === "model") {
    return "model/glb";
  }

  return source.kind;
}
```

- [ ] **Step 4: Replace material-specific compatibility with generic plugin compatibility**

Modify `packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.ts`:

```ts
import type { WebGLEffectPlugin, WebGLEffectSourceKind } from "./effectPlugin";

export function assertEffectCompatibility(
  key: string,
  effectKind: string,
  plugin: WebGLEffectPlugin,
  sourceKind: WebGLEffectSourceKind,
): void {
  if (plugin.appliesTo.includes(sourceKind)) {
    return;
  }

  throw new Error(
    `WebGL effect "${effectKind}" cannot be used with source "${sourceKind}" on target "${key}".`,
  );
}
```

- [ ] **Step 5: Verify controller and compatibility tests pass**

Run: `npm test -- --run packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/effects/builtins/index.ts packages/dom-webgl-runtime/src/lib/effects/effectController.ts packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.ts packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.test.ts
git commit -m "feat: run webgl effects through registry"
```

## Phase 7.3 Tasks: Expose Custom Registration Without Text Mutation

### Task 6: Add Runtime Option for Custom Effect Registry

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
- Modify: `packages/dom-webgl-runtime/src/index.ts`
- Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`

- [ ] **Step 1: Write failing runtime test for custom registry injection**

Modify `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts` with a test that creates a `WebGLEffectRegistry`, registers a custom effect using existing `material.surface` capability, passes it through `createWebGLRuntime({ container, effectRegistry })`, registers a snapshot target with `effects: [{ kind: "custom.surfacePulse", opacity: 0.4 }]`, and asserts the renderable target receives the plugin update.

Use the existing runtime pipeline test harness in this file. The expected behavior is that no runtime code branches on `"custom.surfacePulse"`; only the registry resolves it.

- [ ] **Step 2: Add runtime option type**

Modify `packages/dom-webgl-runtime/src/lib/types.ts`:

```ts
import type { WebGLEffectRegistry } from "./effects/effectRegistry";

export type WebGLRuntimeOptions = {
  container: HTMLElement;
  effectRegistry?: WebGLEffectRegistry;
  onDebugStateChange?: (state: WebGLDebugState) => void;
};
```

- [ ] **Step 3: Thread the registry into controller creation**

Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts` so the pipeline context carries the registry:

```ts
import type { WebGLEffectRegistry } from "../effects/effectRegistry";

type PipelineRenderableContext = RenderableFactoryContext & {
  effectRegistry?: WebGLEffectRegistry;
};
```

Change the renderable factory context construction:

```ts
const renderableFactoryContext: PipelineRenderableContext = {
  resourceManager,
  sceneAdapter: rendererHost.sceneAdapter,
  measureElement: internalOptions.measureElement ?? measureElement,
  getViewportSize: () => rendererHost.getViewportSize(),
  loadVideo: internalOptions.loadVideo,
  loadModel: internalOptions.loadModel,
  effectRegistry: internalOptions.effectRegistry,
};
```

Change the `createPipelineRenderable` signature:

```ts
function createPipelineRenderable(
  descriptor: TargetDescriptor,
  context: PipelineRenderableContext,
): {
  renderable: Renderable;
  effectController: WebGLEffectController;
  debugRecord: TargetDebugRecord;
} {
```

Pass the registry into the controller at the existing creation point:

```ts
const effectController = createWebGLEffectController({
  key: descriptor.key,
  declaration: descriptor.declaration.effects,
  source,
  getTarget: () => renderable.effectTarget,
  registry: context.effectRegistry,
});
```

The controller already falls back to built-ins, so existing consumers do not need to pass a registry.

- [ ] **Step 4: Export registry primitives**

Modify `packages/dom-webgl-runtime/src/index.ts`:

```ts
export {
  createWebGLEffectRegistry,
  type WebGLEffectRegistry,
} from "./lib/effects/effectRegistry";
export type {
  WebGLEffectInstance,
  WebGLEffectPlugin,
  WebGLEffectSourceKind,
  WebGLEffectTargetCapability,
  WebGLEffectTargetContext,
} from "./lib/effects/effectPlugin";
```

- [ ] **Step 5: Verify custom registry injection passes**

Run: `npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/dom-webgl-runtime/src/lib/types.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/index.ts packages/dom-webgl-runtime/src/publicExports.test.ts
git commit -m "feat: expose custom webgl effect registry"
```

### Task 7: Update Demo to Prefer Array Effects

**Files:**
- Modify: `apps/demo/src/App.tsx`
- Modify: `apps/demo/src/App.test.tsx`

- [ ] **Step 1: Change demo declarations to array effects**

Change the demo target that currently uses:

```ts
effects: {
  material: { kind: "surface", color: 0x111111, opacity: 0.75, radius: 24 },
  motion: { kind: "pointer-tilt", strength: 0.6, maxDegrees: 6 },
}
```

to:

```ts
effects: [
  { kind: "surface.basic", color: 0x111111, opacity: 0.75, radius: 24 },
  { kind: "motion.pointerTilt", strength: 0.6, maxDegrees: 6 },
]
```

- [ ] **Step 2: Update demo tests to assert the preferred array form**

Modify `apps/demo/src/App.test.tsx` so the public API example expects `surface.basic` and `motion.pointerTilt` array entries.

- [ ] **Step 3: Verify demo tests pass**

Run: `npm test -- --run apps/demo/src/App.test.tsx`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/demo/src/App.tsx apps/demo/src/App.test.tsx
git commit -m "docs: use array webgl effects in demo"
```

### Task 8: Document Text Effect Boundary Explicitly

**Files:**
- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`

- [ ] **Step 1: Document the effect model**

Add a short section to `README.md`:

````md
### Effect model

Effects are WebGL runtime plugins. They receive the target source kind, layout snapshot, frame input, pointer and scroll state, and an effect target capability surface. They do not scan DOM, mutate arbitrary DOM, create their own renderer, or own independent asset loading.

Preferred declaration form:

```ts
effects: [
  { kind: "surface.basic", color: 0x111111, opacity: 0.75, radius: 24 },
  { kind: "motion.pointerTilt", strength: 0.6, maxDegrees: 6 },
]
```

The legacy `{ material, motion }` object form remains supported for Phase 6 compatibility.
````

- [ ] **Step 2: Document why scrambled text is not automatic**

Add this boundary to `docs/00-goal.md`:

```md
Text animation effects such as scrambled text require an explicit text target capability. They should not run by mutating native DOM and waiting for snapshot refresh, because that couples effect timing to browser paint and snapshot cadence. They also should not edit a bitmap snapshot directly unless the target exposes that as a supported capability. The intended future path is a `snapshot/text` effect target that exposes controlled text-content or text-texture updates to registered effects.
```

- [ ] **Step 3: Update execution state**

Add the Phase 7 status to `docs/EXECUTION_STATE.md`:

```md
Phase 7 reframes effects as registry-driven runtime plugins. Built-in `solid`, `surface`, and `pointer-tilt` behavior is preserved, the preferred declaration shape becomes an ordered effects array, and custom registration can target existing runtime capabilities. Text mutation remains a future capability because the runtime does not yet expose a stable `snapshot/text` mutation target.
```

- [ ] **Step 4: Verify docs contain no stale “custom registry out of scope” statement for Phase 7**

Run: `rg "custom effect registry|custom registry|effects\\.material|effects\\.motion" README.md docs/00-goal.md docs/EXECUTION_STATE.md`

Expected: matches either describe Phase 6 legacy support or explicitly state Phase 7 registry support.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/00-goal.md docs/EXECUTION_STATE.md
git commit -m "docs: define webgl effect registry model"
```

## Final Verification

- [ ] **Step 1: Run focused effect tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/effects packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts apps/demo/src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm run test -- --run
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS. The existing Vite chunk-size warning is non-blocking unless a new warning appears.

- [ ] **Step 5: Run import boundary check**

Run:

```bash
npm run check:imports
```

Expected: PASS with `Demo import boundary OK`.

- [ ] **Step 6: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 7: Commit final verification note if docs changed during verification**

```bash
git status --short
git add README.md docs/00-goal.md docs/EXECUTION_STATE.md
git commit -m "docs: align phase 7 effect runtime status"
```

Skip this commit only when `git status --short` is empty after verification.

## Follow-On Plan

After Phase 7 is merged, create a separate plan for text mutation effects. That plan should add a `snapshot/text` target capability before attempting a scrambled-text effect. The recommended shape is:

```ts
export type WebGLTextEffectTargetState = {
  text: string;
};

export type WebGLEffectTarget = {
  applySolidMaterial?(material: WebGLSolidMaterialTargetState): void;
  applySurfaceMaterial?(
    material: WebGLSurfaceMaterialTargetState,
    layout: { width: number; height: number; devicePixelRatio: number },
  ): void;
  setRotation?(x: number, y: number): void;
  setTextContent?(state: WebGLTextEffectTargetState): void;
  disposeEffects?(): void;
};
```

That future text plan should decide whether `setTextContent` re-rasterizes a text texture, updates a glyph layout, or delegates to a specialized text renderable. It should not mutate native DOM as the primary effect mechanism.

## Self-Review

- Spec coverage: covers the user concern that `effect` was unclear by turning it into a registry-driven WebGL runtime plugin model; covers modularity through declaration compiler, registry, plugins, compatibility, and target capabilities; covers future custom effects without adding text mutation prematurely.
- Placeholder scan: no open placeholder sections remain; each implementation task has exact files, test intent, commands, and expected results.
- Type consistency: public declaration kinds, plugin kind strings, compatibility source kinds, and target capability names are consistent across tasks.
- Scope check: text mutation and ReactBits-style scrambled text are explicitly separated into a follow-on plan because they require a new target capability.
