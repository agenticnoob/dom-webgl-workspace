# Nested WebGL Layer Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make nested `WebGLTarget` children behave like a DOM-first WebGL layer tree, while preserving fallback ownership and keeping the public API small.

**Architecture:** Derive an internal target tree from registered DOM elements, then compile scoped scene ordering from that tree plus local `renderRole` hints. Keep fallback ownership in the fallback module, scene ordering in render modules, and React marking in the React adapter. Do not add public `zIndex`, `renderOrder`, parent handles, or Three.js layer controls.

**Tech Stack:** TypeScript, React adapter, Three.js scene objects, existing runtime registry/renderable pipeline, Vitest/jsdom tests, `apps/example` downstream dogfood.

---

## Current Runtime Truth

- `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.tsx` renders `children` as native React DOM and registers only the target element with `runtime.registerTarget(...)`.
- `packages/dom-webgl-runtime/src/lib/dom/targetDescriptor.ts` stores `key`, `element`, `scanOrder`, and declaration. It has no parent or layer metadata.
- `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts` reads `listTargetsInScanOrder(registry)` and syncs targets as a flat list.
- `packages/dom-webgl-runtime/src/lib/render/renderPolicy.ts` maps global `renderRole` bands to `renderOrder = band * 100`.
- `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.ts` applies ordering only when the scene object first attaches.
- `packages/dom-webgl-runtime/src/lib/renderer/threeRenderer.ts` adds each scene object directly to the global Three scene.
- `packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.ts` has partial protection for managed child fallbacks, but only after a child controller has already hidden itself.
- `packages/dom-webgl-runtime/src/lib/debug/debugState.ts` and public `WebGLDebugState` expose a flat target list without parent/depth/order diagnostics.
- `apps/example/src/App.tsx` has a self-closing `media/image-sequence` target that can dogfood a nested card without using an image-sequence effect workaround.

## DOM-First Nested Target Contract

The implementation must define target ownership from real DOM ancestry:

```ts
type TargetLayerRecord = {
  key: string;
  parentKey: string | undefined;
  depth: number;
  siblingIndex: number;
  paintIndex: number;
};
```

Rules:

- A target's parent is the nearest registered ancestor target in the same runtime.
- A target with no registered ancestor is a root layer.
- Root layers and sibling layers are ordered by actual DOM order, with `scanOrder` only as a deterministic fallback for disconnected test fixtures.
- A parent target's own scene object paints before its child target subtree.
- Child target geometry still comes from the child DOM element's own measured rect. This slice does not make child transforms inherit parent effect transforms.
- A later DOM sibling target paints above an earlier sibling target and the earlier sibling's nested subtree.
- A nested target is managed by the same runtime, not by a nested runtime.

## Fallback Boundary Contract

Fallback ownership must be target-scoped:

- Every `WebGLTarget` root is marked as a managed fallback root before effects run.
- Imperative `runtime.registerTarget(...)` also marks the target root while it is registered.
- Parent fallback controllers do not snapshot or restore nested target subtrees.
- Parent `hideMode: "self"` hides the parent target's fallback paint and preserves child DOM visibility.
- Parent `hideMode: "subtree"` hides ordinary non-target descendants, but nested `WebGLTarget` roots remain independent fallback boundaries.
- If a nested child target is not visually ready, parent fallback hiding must not make the child fallback disappear.
- If a nested child target is visually ready and its own fallback is hidden, parent restore must not reveal that child fallback.
- Loading, error, offscreen disposal, unregister, and runtime dispose continue to restore only the owning target's fallback state.

## Scoped WebGL Stacking Contract

`renderRole` stays public, but it becomes a local semantic hint. It must not replace DOM-like target order.

Use this internal order model:

```ts
const TARGET_LAYER_STRIDE = 100;

const LOCAL_ROLE_OFFSETS = {
  surface: 0,
  media: 10,
  model: 20,
  content: 30,
  overlay: 40,
} satisfies Record<WebGLRenderRole, number>;
```

For a target scene object:

```ts
renderOrder = targetLayer.paintIndex * TARGET_LAYER_STRIDE + LOCAL_ROLE_OFFSETS[role];
```

Rules:

- DOM target tree order decides cross-target ordering.
- Local role offset decides only the target's own sublayer ordering.
- `surface` is below local `content`; `overlay` is above both.
- `model` can keep `depthWrite: true` for model-local 3D depth, but its `renderOrder` still stays inside the owning target scope.
- Effect-managed objects added through `ctx.target.addObject3D(...)` must stay inside the owning target's scope. They should default to the owning target's local `overlay` offset unless a narrower internal option already exists.
- Public declarations still reject low-level `band`, `renderOrder`, `transparent`, `depthWrite`, `zIndex`, and `layer` fields.

## Minimal Public API

No new public author API is required in this slice.

Keep:

```ts
type WebGLDeclaration = {
  key: string;
  source?: WebGLSourceDeclaration;
  renderRole?: WebGLRenderRole;
  scroll?: WebGLScrollBehavior;
  pointer?: WebGLPointerDeclaration;
  lifecycle?: WebGLLifecycleDeclaration;
  effects?: WebGLEffectsDeclaration;
};
```

Additive debug fields are acceptable because they expose runtime truth without requiring authors to configure layers:

```ts
type WebGLDebugTargetState = {
  key: string;
  sourceKind: string;
  renderRole: WebGLRenderRole;
  resourceStatus: WebGLResourceStatus;
  lifecycleState: WebGLLifecycleState;
  visible: boolean;
  parentKey?: string;
  layerDepth: number;
  siblingIndex: number;
  computedRenderOrder?: number;
  error?: string;
};
```

## File Structure

- Create: `packages/dom-webgl-runtime/src/lib/dom/targetTree.ts`
  - Owns DOM ancestry, sibling order, depth, and paint index derivation.
- Test: `packages/dom-webgl-runtime/src/lib/dom/targetTree.test.ts`
  - Covers roots, children, grandchildren, siblings, disconnected fallback order, unregister/remount inputs.
- Create: `packages/dom-webgl-runtime/src/lib/dom/fallbackBoundary.ts`
  - Owns managed target root marking and fallback hidden-state bookkeeping.
- Modify: `packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.ts`
  - Uses fallback boundaries to hide/restore only owned fallback surfaces.
- Test: `packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts`
  - Adds nested boundary tests for parent/child readiness order.
- Create: `packages/dom-webgl-runtime/src/lib/render/layerOrdering.ts`
  - Compiles scoped ordering from `RenderPolicy` plus `TargetLayerRecord`.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderPolicy.ts`
  - Keeps role policy fields; removes the assumption that band alone is global order.
- Test: `packages/dom-webgl-runtime/src/lib/render/layerOrdering.test.ts`
  - Proves DOM tree order wins over role band.
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.ts`
  - Adds `setOrdering(...)` so attached objects can be reordered.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderable.ts`
  - Adds `getOrdering()` to `RenderableContext`.
- Modify renderables under `packages/dom-webgl-runtime/src/lib/render/renderables/`
  - Replace one-time `toSceneObjectOrdering(context.policy)` calls with `context.getOrdering()`.
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/targetRuntimeState.ts`
  - Tracks current `TargetLayerRecord` and `WebGLSceneObjectOrdering` by target key.
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
  - Builds target tree each frame, stores ordering before update, applies ordering to attached scene objects, emits debug fields.
- Test: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
  - Adds integration coverage for nested render order and fallback lifecycle.
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
  - Copies target layer diagnostics into public debug state.
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
  - Adds additive debug target fields only.
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.tsx`
  - Marks target roots through fallback boundary helpers before runtime effects run.
- Test: `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx`
  - Proves nested children still render as DOM and target roots are marked.
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts`
  - Updates old global-band assertions to local-role assertions.
- Modify: `publicExports.test.ts`
  - Ensures no layer control fields leak into `WebGLDeclaration`.
- Modify: `apps/example/src/App.tsx`
  - Nests a WebGL-owned text/card target inside the image-sequence target.
- Modify: `apps/example/src/mediaEffects.ts` or create `apps/example/src/sequenceCardEffects.ts`
  - Adds an app-owned card slide effect that controls the nested card target, not the image-sequence target.
- Modify: `apps/example/src/exampleEffects.ts`
  - Registers the card effect in the module-level stable `exampleEffects` array.
- Modify: `apps/example/src/App.test.tsx`
  - Asserts image-sequence target has nested WebGLTarget children and no image-sequence workaround effect.
- Modify docs:
  - `README.md`
  - `docs/00-goal.md`
  - `docs/agent/package-onboarding.md`
  - `docs/agent/package-usage.md`
  - `docs/examples/effect-authoring.md`
  - `docs/agent/effect-authoring-example-report.md`

---

### Task 1: Target Tree Derivation

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/dom/targetTree.ts`
- Test: `packages/dom-webgl-runtime/src/lib/dom/targetTree.test.ts`

- [ ] **Step 1: Write failing target tree tests**

Create `packages/dom-webgl-runtime/src/lib/dom/targetTree.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { createTargetDescriptor } from "./targetDescriptor";
import { createTargetLayerTree } from "./targetTree";

describe("createTargetLayerTree", () => {
  test("derives parent, depth, sibling index, and paint index from DOM ancestry", () => {
    const root = document.createElement("section");
    const media = document.createElement("div");
    const card = document.createElement("aside");
    const copy = document.createElement("p");
    root.append(media);
    media.append(card);
    card.append(copy);

    const descriptors = [
      createTargetDescriptor(media, { key: "sequence" }, 0),
      createTargetDescriptor(card, { key: "card" }, 1),
      createTargetDescriptor(copy, { key: "card.copy" }, 2),
    ];

    const tree = createTargetLayerTree(descriptors);

    expect(tree.recordsByKey.get("sequence")).toMatchObject({
      key: "sequence",
      parentKey: undefined,
      depth: 0,
      siblingIndex: 0,
      paintIndex: 0,
    });
    expect(tree.recordsByKey.get("card")).toMatchObject({
      key: "card",
      parentKey: "sequence",
      depth: 1,
      siblingIndex: 0,
      paintIndex: 1,
    });
    expect(tree.recordsByKey.get("card.copy")).toMatchObject({
      key: "card.copy",
      parentKey: "card",
      depth: 2,
      siblingIndex: 0,
      paintIndex: 2,
    });
  });

  test("orders sibling targets by DOM order instead of registration order", () => {
    const parent = document.createElement("section");
    const first = document.createElement("div");
    const second = document.createElement("div");
    parent.append(first, second);

    const descriptors = [
      createTargetDescriptor(second, { key: "second" }, 0),
      createTargetDescriptor(first, { key: "first" }, 1),
    ];

    const orderedKeys = createTargetLayerTree(descriptors).orderedRecords.map(
      (record) => record.key,
    );

    expect(orderedKeys).toEqual(["first", "second"]);
  });

  test("uses scan order as a deterministic fallback for disconnected nodes", () => {
    const first = document.createElement("div");
    const second = document.createElement("div");

    const descriptors = [
      createTargetDescriptor(second, { key: "second" }, 1),
      createTargetDescriptor(first, { key: "first" }, 0),
    ];

    const orderedKeys = createTargetLayerTree(descriptors).orderedRecords.map(
      (record) => record.key,
    );

    expect(orderedKeys).toEqual(["first", "second"]);
  });
});
```

- [ ] **Step 2: Run the target tree tests and verify failure**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/dom/targetTree.test.ts
```

Expected: FAIL because `./targetTree` does not exist.

- [ ] **Step 3: Implement target tree derivation**

Create `packages/dom-webgl-runtime/src/lib/dom/targetTree.ts`:

```ts
import type { TargetDescriptor } from "./targetDescriptor";

export type TargetLayerRecord = {
  key: string;
  parentKey: string | undefined;
  depth: number;
  siblingIndex: number;
  paintIndex: number;
};

export type TargetLayerTree = {
  recordsByKey: Map<string, TargetLayerRecord>;
  orderedRecords: TargetLayerRecord[];
};

export function createTargetLayerTree(
  descriptors: readonly TargetDescriptor[],
): TargetLayerTree {
  const descriptorsByElement = new Map<HTMLElement, TargetDescriptor>();
  const childrenByParentKey = new Map<string | undefined, TargetDescriptor[]>();

  for (const descriptor of descriptors) {
    descriptorsByElement.set(descriptor.element, descriptor);
  }

  for (const descriptor of descriptors) {
    const parentKey = findParentKey(descriptor, descriptorsByElement);
    const children = childrenByParentKey.get(parentKey) ?? [];
    children.push(descriptor);
    childrenByParentKey.set(parentKey, children);
  }

  for (const children of childrenByParentKey.values()) {
    children.sort(compareDescriptorDOMOrder);
  }

  const recordsByKey = new Map<string, TargetLayerRecord>();
  const orderedRecords: TargetLayerRecord[] = [];
  let paintIndex = 0;

  visitChildren(undefined, 0);

  return { recordsByKey, orderedRecords };

  function visitChildren(parentKey: string | undefined, depth: number): void {
    const children = childrenByParentKey.get(parentKey) ?? [];

    children.forEach((descriptor, siblingIndex) => {
      const record: TargetLayerRecord = {
        key: descriptor.key,
        parentKey,
        depth,
        siblingIndex,
        paintIndex,
      };

      paintIndex += 1;
      recordsByKey.set(record.key, record);
      orderedRecords.push(record);
      visitChildren(record.key, depth + 1);
    });
  }
}

function findParentKey(
  descriptor: TargetDescriptor,
  descriptorsByElement: ReadonlyMap<HTMLElement, TargetDescriptor>,
): string | undefined {
  let parent = descriptor.element.parentElement;

  while (parent) {
    const parentDescriptor = descriptorsByElement.get(parent);
    if (parentDescriptor) {
      return parentDescriptor.key;
    }
    parent = parent.parentElement;
  }

  return undefined;
}

function compareDescriptorDOMOrder(
  left: TargetDescriptor,
  right: TargetDescriptor,
): number {
  if (left.element === right.element) {
    return left.scanOrder - right.scanOrder;
  }

  const position = left.element.compareDocumentPosition(right.element);

  if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
    return -1;
  }

  if (position & Node.DOCUMENT_POSITION_PRECEDING) {
    return 1;
  }

  return left.scanOrder - right.scanOrder;
}
```

- [ ] **Step 4: Run target tree tests and verify pass**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/dom/targetTree.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit target tree derivation**

Run:

```bash
git add packages/dom-webgl-runtime/src/lib/dom/targetTree.ts packages/dom-webgl-runtime/src/lib/dom/targetTree.test.ts
git commit -m "feat: derive nested webgl target tree"
```

---

### Task 2: Fallback Boundary Ownership

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/dom/fallbackBoundary.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.tsx`
- Test: `packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx`

- [ ] **Step 1: Write failing fallback boundary tests**

Append to `packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts`:

```ts
import { markManagedFallbackRoot } from "./fallbackBoundary";
```

Add these tests inside the existing `describe(...)` block:

```ts
test("parent self mode keeps nested target fallback visible before the child is ready", () => {
  const parent = document.createElement("section");
  const childRoot = document.createElement("aside");
  const childCopy = document.createElement("p");
  childCopy.textContent = "Nested card";
  childRoot.append(childCopy);
  parent.append(childRoot);
  const unmarkChild = markManagedFallbackRoot(childRoot, "card");

  const parentController = createFallbackVisibilityController(parent, {
    hideWhenReady: true,
    hideMode: "self",
  });

  parentController.hide();

  expect(parent.style.visibility).toBe("hidden");
  expect(childRoot.style.visibility).toBe("visible");
  expect(childCopy.getAttribute("style")).toBeNull();

  parentController.restore();
  unmarkChild();
});

test("parent restore does not reveal a nested target hidden by its own controller", () => {
  const parent = document.createElement("section");
  const childRoot = document.createElement("aside");
  parent.append(childRoot);
  const unmarkChild = markManagedFallbackRoot(childRoot, "card");

  const parentController = createFallbackVisibilityController(parent, {
    hideWhenReady: true,
    hideMode: "self",
  });
  const childController = createFallbackVisibilityController(childRoot, {
    hideWhenReady: true,
    hideMode: "self",
  });

  childController.hide();
  parentController.hide();
  parentController.restore();

  expect(childRoot.style.visibility).toBe("hidden");

  childController.restore();
  expect(childRoot.getAttribute("style")).toBeNull();
  unmarkChild();
});

test("parent subtree mode hides ordinary descendants without owning nested target descendants", () => {
  const parent = document.createElement("section");
  const ordinary = document.createElement("span");
  const childRoot = document.createElement("aside");
  const childCopy = document.createElement("p");
  childRoot.append(childCopy);
  parent.append(ordinary, childRoot);
  const unmarkChild = markManagedFallbackRoot(childRoot, "card");

  const parentController = createFallbackVisibilityController(parent, {
    hideWhenReady: true,
    hideMode: "subtree",
  });

  parentController.hide();

  expect(parent.style.visibility).toBe("hidden");
  expect(ordinary.style.visibility).toBe("hidden");
  expect(childRoot.style.visibility).toBe("visible");
  expect(childCopy.getAttribute("style")).toBeNull();

  parentController.restore();
  unmarkChild();
});
```

- [ ] **Step 2: Run fallback tests and verify failure**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts
```

Expected: FAIL because `fallbackBoundary.ts` and boundary-aware hiding do not exist.

- [ ] **Step 3: Add managed fallback root helpers**

Create `packages/dom-webgl-runtime/src/lib/dom/fallbackBoundary.ts`:

```ts
const managedRootKeys = new WeakMap<HTMLElement, Set<string>>();
const hiddenRootKeys = new WeakMap<HTMLElement, Set<string>>();

export function markManagedFallbackRoot(
  element: HTMLElement,
  key: string,
): () => void {
  const normalizedKey = key.trim();
  const keys = managedRootKeys.get(element) ?? new Set<string>();
  keys.add(normalizedKey);
  managedRootKeys.set(element, keys);

  return () => {
    const current = managedRootKeys.get(element);
    current?.delete(normalizedKey);
    if (current?.size === 0) {
      managedRootKeys.delete(element);
    }
    markManagedFallbackRootVisible(element, normalizedKey);
  };
}

export function isManagedFallbackRoot(element: Element): element is HTMLElement {
  return element instanceof HTMLElement && managedRootKeys.has(element);
}

export function markManagedFallbackRootHidden(
  element: HTMLElement,
  key: string,
): void {
  const keys = hiddenRootKeys.get(element) ?? new Set<string>();
  keys.add(key.trim());
  hiddenRootKeys.set(element, keys);
}

export function markManagedFallbackRootVisible(
  element: HTMLElement,
  key: string,
): void {
  const keys = hiddenRootKeys.get(element);
  keys?.delete(key.trim());
  if (keys?.size === 0) {
    hiddenRootKeys.delete(element);
  }
}

export function isManagedFallbackRootHidden(element: Element): boolean {
  return element instanceof HTMLElement && hiddenRootKeys.has(element);
}
```

- [ ] **Step 4: Make fallback visibility boundary-aware**

Modify `packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.ts`:

```ts
import {
  isManagedFallbackRoot,
  isManagedFallbackRootHidden,
  markManagedFallbackRootHidden,
  markManagedFallbackRootVisible,
} from "./fallbackBoundary";
```

Add a key to the returned controller by deriving it from a new optional option:

```ts
type FallbackVisibilityOptions = {
  defaultHideWhenReady?: boolean;
  defaultHideMode?: FallbackHideMode;
  key?: string;
};
```

Inside `createFallbackVisibilityController(...)`, define:

```ts
const ownerKey = options.key ?? "";
```

When the owner root is hidden, mark it:

```ts
if (ownerKey) {
  markManagedFallbackRootHidden(element, ownerKey);
}
```

When the owner root is restored, mark it visible:

```ts
if (ownerKey) {
  markManagedFallbackRootVisible(element, ownerKey);
}
```

Replace descendant snapshot and style loops with boundary-aware traversal:

```ts
function snapshotElements(
  element: HTMLElement,
  hideMode: FallbackHideMode,
): ElementSnapshot[] {
  const elements: Element[] = [element];

  for (const child of element.querySelectorAll("*")) {
    if (child !== element && isNestedManagedRoot(element, child)) {
      elements.push(child);
      continue;
    }

    if (hasManagedRootAncestorBetween(element, child)) {
      continue;
    }

    elements.push(child);
  }

  return elements.map((target) => ({
    element: target,
    className: target.getAttribute("class"),
    style: target.getAttribute("style"),
  }));
}

function applyHiddenStyle(
  owner: HTMLElement,
  target: Element,
  hideMode: FallbackHideMode,
): void {
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target === owner) {
    target.style.visibility = "hidden";
    return;
  }

  if (isNestedManagedRoot(owner, target)) {
    if (!isManagedFallbackRootHidden(target)) {
      target.style.visibility = "visible";
    }
    return;
  }

  target.style.visibility = hideMode === "self" ? "visible" : "hidden";
}

function isNestedManagedRoot(owner: HTMLElement, target: Element): boolean {
  return target !== owner && isManagedFallbackRoot(target);
}

function hasManagedRootAncestorBetween(
  owner: HTMLElement,
  target: Element,
): boolean {
  let parent = target.parentElement;

  while (parent && parent !== owner) {
    if (isManagedFallbackRoot(parent)) {
      return true;
    }
    parent = parent.parentElement;
  }

  return false;
}
```

Update the existing `hide()` loop to call `applyHiddenStyle(element, snapshot.element, hideMode)` for each snapshot.

Update `restore()` so it skips nested roots that are currently hidden by their own controller:

```ts
if (
  snapshot.element !== element &&
  isManagedFallbackRoot(snapshot.element) &&
  isManagedFallbackRootHidden(snapshot.element)
) {
  continue;
}
```

- [ ] **Step 5: Pass the target key when creating fallback controllers**

Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts` where `createFallbackVisibilityController(...)` is called:

```ts
createFallbackVisibilityController(
  descriptor.element,
  descriptor.declaration.lifecycle ?? {},
  {
    defaultHideWhenReady: true,
    defaultHideMode: "self",
    key: descriptor.key,
  },
);
```

- [ ] **Step 6: Mark React target roots before runtime effects**

Modify `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.tsx`:

```tsx
import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { markManagedFallbackRoot } from "../dom/fallbackBoundary";
```

Replace the plain ref with a callback ref:

```tsx
const unmarkFallbackRootRef = useRef<(() => void) | undefined>(undefined);
const setElementRef = useCallback(
  (element: HTMLElement | null) => {
    unmarkFallbackRootRef.current?.();
    unmarkFallbackRootRef.current = undefined;
    elementRef.current = element;

    if (element) {
      unmarkFallbackRootRef.current = markManagedFallbackRoot(
        element,
        webgl.key,
      );
    }
  },
  [webgl.key],
);
```

Use `ref: setElementRef` in the returned element.

In the effect cleanup, unmark after unregister:

```tsx
return () => {
  runtime.unregisterTarget(webgl.key);
  unmarkFallbackRootRef.current?.();
  unmarkFallbackRootRef.current = undefined;
};
```

- [ ] **Step 7: Add React fallback root marking coverage**

Add to `packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx`:

```ts
test("marks nested target roots before fallback controllers run", async () => {
  const { isManagedFallbackRoot } = await import("../dom/fallbackBoundary");
  const { WebGLRuntimeProvider, WebGLTarget } = await import("../../react");
  const runtime = createRuntimeStub();
  const { root, host } = createTestRoot();

  await act(async () => {
    root.render(
      createElement(
        WebGLRuntimeProvider,
        { runtime },
        createElement(
          WebGLTarget,
          { webgl: { key: "parent" }, id: "parent" },
          createElement(WebGLTarget, {
            webgl: { key: "child" },
            id: "child",
          }),
        ),
      ),
    );
  });

  expect(isManagedFallbackRoot(host.querySelector("#parent")!)).toBe(true);
  expect(isManagedFallbackRoot(host.querySelector("#child")!)).toBe(true);
});
```

- [ ] **Step 8: Run fallback and React target tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit fallback boundary ownership**

Run:

```bash
git add packages/dom-webgl-runtime/src/lib/dom/fallbackBoundary.ts packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.ts packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts packages/dom-webgl-runtime/src/lib/react/WebGLTarget.tsx packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx packages/dom-webgl-runtime/src/lib/renderer/runtime.ts
git commit -m "fix: preserve nested webgl fallback boundaries"
```

---

### Task 3: Scoped Layer Ordering

**Files:**
- Create: `packages/dom-webgl-runtime/src/lib/render/layerOrdering.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderPolicy.ts`
- Test: `packages/dom-webgl-runtime/src/lib/render/layerOrdering.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts`

- [ ] **Step 1: Write failing scoped ordering tests**

Create `packages/dom-webgl-runtime/src/lib/render/layerOrdering.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import type { TargetLayerRecord } from "../dom/targetTree";
import { compileRenderPolicy } from "./renderPolicy";
import { toScopedSceneObjectOrdering } from "./layerOrdering";

describe("toScopedSceneObjectOrdering", () => {
  const parent = {
    key: "sequence",
    parentKey: undefined,
    depth: 0,
    siblingIndex: 0,
    paintIndex: 0,
  } satisfies TargetLayerRecord;

  const child = {
    key: "card.copy",
    parentKey: "sequence",
    depth: 1,
    siblingIndex: 0,
    paintIndex: 1,
  } satisfies TargetLayerRecord;

  test("keeps nested content above parent media because DOM scope wins", () => {
    const parentOrdering = toScopedSceneObjectOrdering(
      compileRenderPolicy("media"),
      parent,
    );
    const childOrdering = toScopedSceneObjectOrdering(
      compileRenderPolicy("content"),
      child,
    );

    expect(childOrdering.renderOrder).toBeGreaterThan(parentOrdering.renderOrder);
  });

  test("keeps local overlay above local surface within one target scope", () => {
    const surface = toScopedSceneObjectOrdering(
      compileRenderPolicy("surface"),
      parent,
    );
    const overlay = toScopedSceneObjectOrdering(
      compileRenderPolicy("overlay"),
      parent,
    );

    expect(overlay.renderOrder).toBeGreaterThan(surface.renderOrder);
  });

  test("keeps model depth write while scoping model order to the target", () => {
    const ordering = toScopedSceneObjectOrdering(
      compileRenderPolicy("model"),
      child,
    );

    expect(ordering).toMatchObject({
      depthWrite: true,
      transparent: true,
    });
    expect(ordering.renderOrder).toBeGreaterThanOrEqual(100);
    expect(ordering.renderOrder).toBeLessThan(200);
  });
});
```

- [ ] **Step 2: Run scoped ordering tests and verify failure**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/layerOrdering.test.ts
```

Expected: FAIL because `layerOrdering.ts` does not exist.

- [ ] **Step 3: Add scoped ordering compiler**

Create `packages/dom-webgl-runtime/src/lib/render/layerOrdering.ts`:

```ts
import type { TargetLayerRecord } from "../dom/targetTree";
import type { WebGLRenderRole } from "../types";
import type { RenderPolicy, SceneObjectOrdering } from "./renderPolicy";

const TARGET_LAYER_STRIDE = 100;

const LOCAL_ROLE_OFFSETS = {
  surface: 0,
  media: 10,
  model: 20,
  content: 30,
  overlay: 40,
} satisfies Record<WebGLRenderRole, number>;

export function toScopedSceneObjectOrdering(
  policy: RenderPolicy,
  layer: TargetLayerRecord,
): SceneObjectOrdering {
  return {
    renderOrder:
      layer.paintIndex * TARGET_LAYER_STRIDE + LOCAL_ROLE_OFFSETS[policy.role],
    transparent: policy.opacityMode !== "opaque",
    depthWrite: policy.depthMode === "model",
  };
}

export function toScopedManagedObjectOrdering(
  layer: TargetLayerRecord,
): SceneObjectOrdering {
  return {
    renderOrder: layer.paintIndex * TARGET_LAYER_STRIDE + LOCAL_ROLE_OFFSETS.overlay,
    transparent: true,
    depthWrite: false,
  };
}
```

- [ ] **Step 4: Update render policy tests to treat band as local**

Modify `packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts`:

- Keep tests that `compileRenderPolicy(...)` returns stable semantic fields.
- Remove assertions that `toSceneObjectOrdering(compileRenderPolicy(...))` is the global ordering authority.
- Add a public type rejection for `layer`:

```ts
({
  key: "hero.surface",
  // @ts-expect-error layer is not a public WebGL declaration field.
  layer: 1,
} satisfies WebGLDeclaration);
```

- [ ] **Step 5: Run render ordering tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/layerOrdering.test.ts packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit scoped ordering compiler**

Run:

```bash
git add packages/dom-webgl-runtime/src/lib/render/layerOrdering.ts packages/dom-webgl-runtime/src/lib/render/layerOrdering.test.ts packages/dom-webgl-runtime/src/lib/render/renderPolicy.ts packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts
git commit -m "feat: compile scoped webgl layer ordering"
```

---

### Task 4: Runtime Ordering Integration

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderable.ts`
- Modify renderables:
  - `packages/dom-webgl-runtime/src/lib/render/renderables/elementSnapshotRenderable.ts`
  - `packages/dom-webgl-runtime/src/lib/render/renderables/textSnapshotRenderable.ts`
  - `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts`
  - `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts`
  - `packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.ts`
  - `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`
  - `packages/dom-webgl-runtime/src/lib/render/renderables/sceneRenderableController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/targetRuntimeState.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
- Test: existing renderable tests touched by changed renderables.

- [ ] **Step 1: Write failing runtime pipeline test for nested order**

Add to `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts` using the file's existing renderer host stubs:

```ts
test("orders nested child target scene objects above parent media scene object", async () => {
  const container = document.createElement("div");
  const parent = document.createElement("section");
  const child = document.createElement("p");
  parent.append(child);
  container.append(parent);
  document.body.append(container);
  const createdObjects: Array<{ key: string; ordering?: { renderOrder: number } }> = [];

  const runtime = createWebGLRuntime({
    container,
    rendererHostFactory: createRendererHostFactory({
      onAddObject(object) {
        createdObjects.push(object as { key: string; ordering?: { renderOrder: number } });
      },
    }),
  } as never);

  runtime.registerTarget(parent, {
    key: "sequence",
    source: {
      kind: "media",
      type: "image-sequence",
      frameCount: 1,
      frames: [document.createElement("canvas")],
    },
  });
  runtime.registerTarget(child, {
    key: "sequence.copy",
    source: { kind: "dom", type: "text" },
  });

  await runtime.sync();

  const parentOrder = createdObjects.find((object) => object.key === "sequence")
    ?.ordering?.renderOrder;
  const childOrder = createdObjects.find((object) => object.key === "sequence.copy")
    ?.ordering?.renderOrder;

  expect(parentOrder).toBeTypeOf("number");
  expect(childOrder).toBeTypeOf("number");
  expect(childOrder!).toBeGreaterThan(parentOrder!);

  runtime.dispose();
});
```

Expected support functions may already differ in this test file. Use the existing local stub names in `runtimePipeline.test.ts`, but preserve this assertion shape.

- [ ] **Step 2: Run runtime pipeline test and verify failure**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
```

Expected: FAIL because runtime still uses global role-band ordering.

- [ ] **Step 3: Add mutable scene object ordering**

Modify `packages/dom-webgl-runtime/src/lib/renderer/sceneObject.ts`:

```ts
export type WebGLSceneObjectController = {
  readonly attached: boolean;
  readonly disposed: boolean;
  readonly visible: boolean;
  attach(): void;
  setVisible(visible: boolean): void;
  setOrdering(ordering: WebGLSceneObjectOrdering): void;
  updateLayout(layout: ProjectedDOMRect): void;
  render(): void;
  dispose(): void;
};
```

In `createSceneObjectController(...)`, store mutable ordering:

```ts
let currentOrdering = ordering;
```

Add the method:

```ts
setOrdering(nextOrdering): void {
  if (disposed) {
    return;
  }

  currentOrdering = nextOrdering;
  applySceneObjectOrdering(object, currentOrdering);
},
```

Update `attach()`:

```ts
applySceneObjectOrdering(object, currentOrdering);
```

- [ ] **Step 4: Make renderables read ordering from context**

Modify `packages/dom-webgl-runtime/src/lib/render/renderable.ts`:

```ts
import type { WebGLSceneObjectOrdering } from "../renderer/sceneObject";

export type RenderableContext = {
  descriptor: TargetDescriptor;
  source: WebGLSourceDescriptor;
  role: WebGLRenderRole;
  policy: RenderPolicy;
  getOrdering(): WebGLSceneObjectOrdering;
  getManagedObjectOrdering(): WebGLSceneObjectOrdering;
};
```

Update each renderable that creates a scene controller:

```ts
ordering: context.getOrdering(),
```

Update `createManagedObject3DFactory(...)` in `sceneRenderableController.ts` to accept a managed ordering reader and apply it when adding objects:

```ts
getManagedObjectOrdering?: () => WebGLSceneObjectOrdering;
```

Inside the managed object factory, before `options.sceneAdapter.addObject(sceneObject)`:

```ts
const ordering = options.getManagedObjectOrdering?.();
if (ordering) {
  sceneObject.ordering = ordering;
}
```

- [ ] **Step 5: Store current ordering in target runtime state**

Modify `packages/dom-webgl-runtime/src/lib/renderer/targetRuntimeState.ts`:

```ts
import type { TargetLayerRecord } from "../dom/targetTree";
import type { WebGLSceneObjectOrdering } from "./sceneObject";
```

Extend `TargetRuntimeState`:

```ts
targetLayersByTargetKey: Map<string, TargetLayerRecord>;
orderingsByTargetKey: Map<string, WebGLSceneObjectOrdering>;
managedOrderingsByTargetKey: Map<string, WebGLSceneObjectOrdering>;
```

Initialize and clear these maps wherever the other target-key maps are initialized or cleared.

- [ ] **Step 6: Build target tree and orderings during sync**

Modify `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`:

```ts
import { createTargetLayerTree } from "../dom/targetTree";
import {
  toScopedManagedObjectOrdering,
  toScopedSceneObjectOrdering,
} from "../render/layerOrdering";
```

At the beginning of `syncFrame()` after descriptors are listed:

```ts
const targetTree = createTargetLayerTree(descriptors);
```

Before each target update, compute and store ordering:

```ts
const layerRecord = targetTree.recordsByKey.get(descriptor.key);
if (layerRecord) {
  const source = inferSourceDescriptor(descriptor);
  const role = inferRenderRole(source, descriptor.declaration);
  const policy = compileRenderPolicy(role);
  const ordering = toScopedSceneObjectOrdering(policy, layerRecord);
  const managedOrdering = toScopedManagedObjectOrdering(layerRecord);
  targetState.targetLayersByTargetKey.set(descriptor.key, layerRecord);
  targetState.orderingsByTargetKey.set(descriptor.key, ordering);
  targetState.managedOrderingsByTargetKey.set(descriptor.key, managedOrdering);
}
```

After a renderable exists and before/after `renderable.update(...)`, apply current ordering:

```ts
const ordering = targetState.orderingsByTargetKey.get(descriptor.key);
if (ordering) {
  renderable.sceneObjectController?.setOrdering(ordering);
}
```

In `createPipelineRenderable(...)`, pass ordering readers to `createRenderable(...)`:

```ts
getOrdering: () =>
  targetState.orderingsByTargetKey.get(descriptor.key) ??
  toSceneObjectOrdering(policy),
getManagedObjectOrdering: () =>
  targetState.managedOrderingsByTargetKey.get(descriptor.key) ??
  toSceneObjectOrdering(compileRenderPolicy("overlay")),
```

The fallback to `toSceneObjectOrdering(...)` keeps construction deterministic if a direct unit test creates a renderable without a runtime-computed tree.

- [ ] **Step 7: Run runtime and renderable tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/render/renderables
```

Expected: PASS.

- [ ] **Step 8: Commit runtime ordering integration**

Run:

```bash
git add packages/dom-webgl-runtime/src/lib/renderer/sceneObject.ts packages/dom-webgl-runtime/src/lib/render/renderable.ts packages/dom-webgl-runtime/src/lib/render/renderables packages/dom-webgl-runtime/src/lib/renderer/targetRuntimeState.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
git commit -m "feat: apply scoped ordering to webgl targets"
```

---

### Task 5: Debug State For Layer Semantics

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtime.ts`
- Test: `packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`
- Test: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`

- [ ] **Step 1: Write failing debug state tests**

Add to `packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts`:

```ts
test("copies target layer diagnostics into public debug state", () => {
  const state = createDebugState({
    targetCount: 2,
    renderableCount: 2,
    currentScrollMode: "page",
    pointer: createPointerState(),
    targets: [
      {
        key: "sequence",
        sourceKind: "media/image-sequence",
        renderRole: "media",
        resourceStatus: "ready",
        lifecycleState: "active",
        visible: true,
        layerDepth: 0,
        siblingIndex: 0,
        computedRenderOrder: 10,
      },
      {
        key: "sequence.copy",
        sourceKind: "dom/text",
        renderRole: "content",
        resourceStatus: "ready",
        lifecycleState: "active",
        visible: true,
        parentKey: "sequence",
        layerDepth: 1,
        siblingIndex: 0,
        computedRenderOrder: 130,
      },
    ],
  });

  expect(state.targets).toEqual([
    expect.objectContaining({
      key: "sequence",
      layerDepth: 0,
      siblingIndex: 0,
      computedRenderOrder: 10,
    }),
    expect.objectContaining({
      key: "sequence.copy",
      parentKey: "sequence",
      layerDepth: 1,
      siblingIndex: 0,
      computedRenderOrder: 130,
    }),
  ]);
});
```

Use the existing helper for pointer state if the file already defines one; otherwise add a local `createPointerState()` matching `WebGLPointerState`.

- [ ] **Step 2: Run debug tests and verify failure**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts
```

Expected: FAIL because debug target states do not include layer fields.

- [ ] **Step 3: Add additive public debug fields**

Modify `packages/dom-webgl-runtime/src/lib/types.ts` target debug entries:

```ts
targets: Array<{
  key: string;
  sourceKind: string;
  renderRole: WebGLRenderRole;
  resourceStatus: WebGLResourceStatus;
  lifecycleState: WebGLLifecycleState;
  visible: boolean;
  parentKey?: string;
  layerDepth: number;
  siblingIndex: number;
  computedRenderOrder?: number;
  error?: string;
}>;
```

Modify `packages/dom-webgl-runtime/src/lib/debug/debugState.ts`:

```ts
export type DebugTargetState = {
  key: string;
  sourceKind: string;
  renderRole: WebGLRenderRole;
  resourceStatus: WebGLResourceStatus;
  lifecycleState: WebGLLifecycleState;
  visible: boolean;
  parentKey?: string;
  layerDepth: number;
  siblingIndex: number;
  computedRenderOrder?: number;
  error?: unknown;
};
```

Copy these fields into `summary`.

- [ ] **Step 4: Populate layer diagnostics from runtime**

Modify `readTargetDebugRecord(...)` and `createPipelineRenderable(...)` initial records in `runtime.ts`:

```ts
layerDepth: 0,
siblingIndex: 0,
```

When building the current debug state, merge current layer state:

```ts
const layer = targetState.targetLayersByTargetKey.get(descriptor.key);
const ordering = targetState.orderingsByTargetKey.get(descriptor.key);

return {
  key: descriptor.key,
  ...readTargetDebugRecord(descriptor, targetState),
  parentKey: layer?.parentKey,
  layerDepth: layer?.depth ?? 0,
  siblingIndex: layer?.siblingIndex ?? 0,
  computedRenderOrder: ordering?.renderOrder,
};
```

- [ ] **Step 5: Run debug and runtime tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit debug layer diagnostics**

Run:

```bash
git add packages/dom-webgl-runtime/src/lib/debug/debugState.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/lib/types.ts packages/dom-webgl-runtime/src/lib/renderer/runtime.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts
git commit -m "feat: expose webgl target layer debug state"
```

---

### Task 6: Example Dogfood Without Workaround

**Files:**
- Modify: `apps/example/src/App.tsx`
- Create: `apps/example/src/sequenceCardEffects.ts`
- Modify: `apps/example/src/exampleEffects.ts`
- Modify: `apps/example/src/App.test.tsx`
- Modify: `apps/example/src/exampleEffectDeclarations.ts`
- Test: `apps/example/src/App.test.tsx`
- Test: `apps/example/src/exampleEffects.test.ts`

- [ ] **Step 1: Write failing app test for nested image-sequence card**

Add or update assertions in `apps/example/src/App.test.tsx`:

```ts
test("dogfoods nested targets inside the image sequence target", async () => {
  renderExampleAppWithReadyResources();

  const sequenceTarget = targetProps.find(
    (entry) => entry.webgl.key === "example.image-sequence.scrub",
  );
  const cardTarget = targetProps.find(
    (entry) => entry.webgl.key === "example.image-sequence.card",
  );
  const copyTarget = targetProps.find(
    (entry) => entry.webgl.key === "example.image-sequence.card.copy",
  );

  expect(sequenceTarget?.webgl.source).toMatchObject({
    kind: "media",
    type: "image-sequence",
  });
  expect(sequenceTarget?.webgl.effects).toBeUndefined();
  expect(cardTarget?.webgl).toMatchObject({
    key: "example.image-sequence.card",
    source: { kind: "dom", type: "element" },
    lifecycle: { hideWhenReady: true, hideMode: "self" },
    effects: [
      {
        kind: "example.sequenceCardSlide",
        progressKey: "example.video.scrub",
      },
    ],
  });
  expect(copyTarget?.webgl).toMatchObject({
    key: "example.image-sequence.card.copy",
    source: { kind: "dom", type: "text" },
    lifecycle: { hideWhenReady: true, hideMode: "self" },
  });
});
```

Use the existing resource-ready helper names in `App.test.tsx`; keep the assertion that `example.image-sequence.scrub` remains a `media/image-sequence` target.

- [ ] **Step 2: Run app test and verify failure**

Run:

```bash
npm test -- --run apps/example/src/App.test.tsx
```

Expected: FAIL because the image-sequence target has no nested card targets.

- [ ] **Step 3: Add card slide effect**

Create `apps/example/src/sequenceCardEffects.ts`:

```ts
import { defineWebGLEffect } from "@project/dom-webgl-runtime";

import { clampNumber } from "./effectMath";

type SequenceCardSlideParams = {
  kind: "example.sequenceCardSlide";
  progressKey: string;
  travel?: number;
};

export const exampleSequenceCardSlideEffect =
  defineWebGLEffect<SequenceCardSlideParams>({
    kind: "example.sequenceCardSlide",
    source: "dom/element",
    update(ctx, _state, params) {
      const progress = clampNumber(
        ctx.progress.get(params.progressKey),
        0,
        1,
        0,
      );
      const travel = clampNumber(params.travel, 24, 220, 120);
      const enter = smoothstep(0.16, 0.34, progress);
      const exit = 1 - smoothstep(0.72, 0.9, progress);
      const visibility = enter * exit;
      const x = (1 - enter) * -travel + (1 - exit) * travel;

      ctx.target?.setPosition(ctx.layout.x + x, ctx.layout.y, 0);
      ctx.target?.setOpacity(visibility);
      ctx.target?.setVisible(visibility > 0.02);
    },
  });

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clampNumber((value - edge0) / (edge1 - edge0), 0, 1, 0);
  return t * t * (3 - 2 * t);
}
```

- [ ] **Step 4: Register the card effect**

Modify `apps/example/src/exampleEffects.ts`:

```ts
export { exampleSequenceCardSlideEffect } from "./sequenceCardEffects";
```

Import it in the lower import block:

```ts
import { exampleSequenceCardSlideEffect } from "./sequenceCardEffects";
```

Add it to `exampleEffects` after the media effects and before model effects:

```ts
exampleSequenceCardSlideEffect,
```

- [ ] **Step 5: Add declaration typing for the new effect**

Modify `apps/example/src/exampleEffectDeclarations.ts` to include:

```ts
| {
    kind: "example.sequenceCardSlide";
    progressKey: string;
    travel?: number;
  }
```

inside the app's `ExampleEffectParams` union.

- [ ] **Step 6: Nest the card inside the image-sequence target**

Modify the ready branch in `apps/example/src/App.tsx`:

```tsx
<WebGLTarget
  as="section"
  className="example-media example-media-video-bg example-media-sequence"
  webgl={{
    key: "example.image-sequence.scrub",
    source: {
      kind: "media",
      type: "image-sequence",
      frameCount: exampleResources.imageSequenceFrames.length,
      frames: exampleResources.imageSequenceFrames,
      progressKey: videoScrubProgressKey,
    },
    lifecycle: { hideWhenReady: true, hideMode: "self" },
  }}
>
  <WebGLTarget
    as="aside"
    className="example-sequence-card"
    webgl={{
      key: "example.image-sequence.card",
      source: { kind: "dom", type: "element" },
      lifecycle: { hideWhenReady: true, hideMode: "self" },
      effects: [
        {
          kind: "example.sequenceCardSlide",
          progressKey: videoScrubProgressKey,
        },
      ],
    }}
  >
    <WebGLTarget
      as="p"
      className="example-sequence-card-copy"
      webgl={{
        key: "example.image-sequence.card.copy",
        source: { kind: "dom", type: "text" },
        lifecycle: { hideWhenReady: true, hideMode: "self" },
      }}
    >
      嵌套 WebGLTarget 卡片由图片序列父层管理排序，滚动进度驱动侧向进出。
    </WebGLTarget>
  </WebGLTarget>
</WebGLTarget>
```

Do not add an effect to `example.image-sequence.scrub` for the card. The parent image-sequence target remains a source layer only.

- [ ] **Step 7: Add CSS for native fallback layout**

Modify the existing example CSS file that owns `.example-media-sequence` styles:

```css
.example-media-sequence {
  position: relative;
  overflow: hidden;
}

.example-sequence-card {
  position: absolute;
  left: clamp(24px, 8vw, 96px);
  bottom: clamp(24px, 10vh, 96px);
  width: min(360px, calc(100% - 48px));
  padding: 18px 20px;
  border: 1px solid rgba(244, 244, 245, 0.22);
  background: rgba(18, 24, 27, 0.58);
  color: #f4f4f5;
  backdrop-filter: blur(10px);
}

.example-sequence-card-copy {
  margin: 0;
  font-size: 18px;
  line-height: 1.45;
}
```

Use the actual stylesheet path in `apps/example/src` after checking where `.example-media-sequence` is defined.

- [ ] **Step 8: Run example tests**

Run:

```bash
npm test -- --run apps/example/src/App.test.tsx apps/example/src/exampleEffects.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit example dogfood**

Run:

```bash
git add apps/example/src/App.tsx apps/example/src/sequenceCardEffects.ts apps/example/src/exampleEffects.ts apps/example/src/exampleEffectDeclarations.ts apps/example/src/App.test.tsx apps/example/src/exampleEffects.test.ts apps/example/src
git commit -m "feat: dogfood nested webgl target layers"
```

---

### Task 7: Documentation Alignment

**Files:**
- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: `docs/agent/effect-authoring-example-report.md`

- [ ] **Step 1: Update README nested semantics**

In `README.md`, replace fallback-only nested language with:

```md
- Nested `WebGLTarget` elements form an internal DOM-derived WebGL layer tree.
  A child target's nearest registered ancestor target becomes its parent layer.
  Parent targets paint before their child target subtrees, and sibling target
  order follows DOM order.
- `renderRole` remains a semantic hint for local source policy. It no longer
  acts as a global ordering band that can override DOM parent/child or sibling
  order.
- Parent fallback hiding does not own nested target fallback lifecycle. Nested
  targets keep their own loading, ready, error, offscreen, unregister, and
  restore behavior.
```

- [ ] **Step 2: Update architecture goal document**

In `docs/00-goal.md`, replace the statement that ordering comes from global `renderRole` with:

```md
Ordering comes from the DOM-derived target layer tree first. `renderRole`
compiles to local source policy inside that target scope. Public page code
does not set Three.js ordering flags, public `zIndex`, or public layer numbers.
```

Add this target nesting rule near the React examples:

```md
Nested `WebGLTarget` children are valid. The child target remains a normal DOM
child for content, accessibility, and fallback, while runtime maps it to a
managed WebGL child layer for scene ordering.
```

- [ ] **Step 3: Update package onboarding**

In `docs/agent/package-onboarding.md`, add:

````md
For WebGL-owned panels, prefer natural nesting:

```tsx
<WebGLTarget webgl={{ key: "panel", source: { kind: "dom", type: "element" } }}>
  <WebGLTarget webgl={{ key: "panel.copy", source: { kind: "dom", type: "text" } }}>
    Copy owned by the same WebGL layer tree.
  </WebGLTarget>
</WebGLTarget>
```

The runtime derives parent/child layer order from DOM ancestry. Do not add
public layer numbers or call `addObject3D` on a parent effect to simulate a
child target.
````

- [ ] **Step 4: Update package usage**

In `docs/agent/package-usage.md`, replace the previous "one visual ownership layer" workaround wording with:

```md
Use nested `WebGLTarget` elements when a panel, card, or marker has WebGL-owned
children. The parent target owns its own source layer; child targets own their
own source layers; runtime orders them from the DOM tree. This keeps the author
model aligned with JSX structure and avoids app effects that manually inject
child Object3D layers into a parent.
```

- [ ] **Step 5: Update effect authoring example docs**

In `docs/examples/effect-authoring.md`, update the pinned image-sequence section:

```md
The pinned scrub row also dogfoods nested target semantics: the
`media/image-sequence` target contains a WebGL-owned card target and a nested
text target. The card slides from app-owned scroll progress through its own
effect. The image-sequence effect does not create card objects manually.
```

- [ ] **Step 6: Update example report**

In `docs/agent/effect-authoring-example-report.md`, add a current note:

```md
Nested target dogfood now covers `media/image-sequence` parent + WebGL-owned
card + `dom/text` child. This validates fallback boundaries and scoped stacking
without using `addObject3D` as a workaround.
```

- [ ] **Step 7: Run docs diff check**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 8: Commit documentation alignment**

Run:

```bash
git add README.md docs/00-goal.md docs/agent/package-onboarding.md docs/agent/package-usage.md docs/examples/effect-authoring.md docs/agent/effect-authoring-example-report.md
git commit -m "docs: document nested webgl layer semantics"
```

---

### Task 8: Full Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/dom/targetTree.test.ts packages/dom-webgl-runtime/src/lib/dom/fallbackVisibility.test.ts packages/dom-webgl-runtime/src/lib/render/layerOrdering.test.ts packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/lib/debug/debugState.test.ts packages/dom-webgl-runtime/src/lib/react/WebGLTarget.test.tsx apps/example/src/App.test.tsx apps/example/src/exampleEffects.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run package checks**

Run:

```bash
npm run test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Expected:

- Vitest passes.
- TypeScript passes.
- Workspace build passes.
- Import guard prints `Example import boundaries OK`.
- `git diff --check` prints no errors.

- [ ] **Step 3: Inspect public API boundary**

Run:

```bash
npm test -- --run publicExports.test.ts packages/dom-webgl-runtime/src/lib/render/renderPolicy.test.ts
```

Expected: PASS with public declarations rejecting low-level ordering fields.

- [ ] **Step 4: Inspect worktree for generated or private files**

Run:

```bash
git status --short
git diff --stat
```

Expected: only planned runtime, tests, example, and docs files are changed. No private config, generated cache, or asset bulk changes are present.

- [ ] **Step 5: Final commit**

If the previous tasks were committed separately and all verification passes, create a final no-op summary is not needed. If implementation was batched without task commits, run:

```bash
git add packages/dom-webgl-runtime apps/example README.md docs
git commit -m "feat: support nested webgl layer semantics"
```

Expected: commit succeeds on `codex/nested-webgl-layer-semantics`.

## Self-Review

- Spec coverage: current runtime truth, nested target semantics, fallback boundary rules, scoped stacking order, `renderRole` local role, minimal public API, tests, example dogfood, no image-sequence workaround, docs, and phased implementation are covered.
- Scope check: this is one runtime semantics change with one example dogfood path. It does not add a generic CSS stacking context model, public layer controls, nested runtimes, parent transform inheritance, or new visual presets.
- Type consistency: `TargetLayerRecord`, `TargetLayerTree`, `toScopedSceneObjectOrdering`, `toScopedManagedObjectOrdering`, additive debug fields, and fallback boundary helper names are consistent across tasks.
- Verification path: targeted tests come before full `npm run test -- --run`, `npm run typecheck`, `npm run build`, `npm run check:imports`, and `git diff --check`.
