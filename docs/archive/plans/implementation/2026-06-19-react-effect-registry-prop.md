# React Effect Registry Prop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the existing custom WebGL effect registry through the public React `<WebGLRuntime />` adapter.

**Architecture:** Keep the effect runtime boundary in `packages/dom-webgl-runtime/src/lib/effects` and the renderer boundary in `createWebGLRuntime`. The React adapter only accepts a registry object and forwards it into `createWebGLRuntime`; it does not inspect, normalize, or execute effect plugins.

**Tech Stack:** React, TypeScript, Vitest, existing `@project/dom-webgl-runtime` public React and root entrypoints.

---

## File Structure

- Modify `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`
  - Add `effectRegistry?: WebGLRuntimeOptions["effectRegistry"]` to `WebGLRuntimeProps`.
  - Pass `effectRegistry` to `createWebGLRuntime`.
  - Recreate and dispose the runtime if the registry reference changes.
- Modify `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx`
  - Add behavior coverage for forwarding `effectRegistry`.
  - Add behavior coverage that a registry reference change disposes the old runtime and creates a new runtime.
- Modify `packages/dom-webgl-runtime/src/publicExports.test.ts`
  - Extend the React entrypoint type fixture so public React consumers can pass a registry created by the root entrypoint.
- Modify `README.md`, `docs/00-goal.md`, and `docs/EXECUTION_STATE.md`
  - Align public usage docs so custom effects are described as available from both vanilla runtime creation and React runtime props.

## Task 1: Add React Runtime RED Tests

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx`

- [ ] **Step 1: Add a failing test for initial registry forwarding**

Add this helper near `createRuntimeStub`:

```tsx
function createTestEffectRegistry() {
  return {
    register: vi.fn(),
    resolve: vi.fn(),
    list: vi.fn(() => []),
  };
}
```

Add this test after `creates a runtime after mount and passes runtime events`:

```tsx
  test("passes the effect registry to the runtime on mount", async () => {
    const { WebGLRuntime } = await import("../../react");
    const { root } = createTestRoot();
    const effectRegistry = createTestEffectRegistry();

    await act(async () => {
      root.render(createElement(WebGLRuntime, { effectRegistry }));
    });

    expect(runtimeMocks.createWebGLRuntime).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.createWebGLRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        effectRegistry,
      }),
    );
  });
```

- [ ] **Step 2: Add a failing test for registry reference changes**

Add this test after the initial registry forwarding test:

```tsx
  test("recreates the runtime when the effect registry changes", async () => {
    const { WebGLRuntime } = await import("../../react");
    const { root } = createTestRoot();
    const firstRegistry = createTestEffectRegistry();
    const secondRegistry = createTestEffectRegistry();

    await act(async () => {
      root.render(createElement(WebGLRuntime, { effectRegistry: firstRegistry }));
    });

    const firstRuntime = runtimeMocks.createWebGLRuntime.mock.results[0]
      .value as RuntimeInstance;

    await act(async () => {
      root.render(createElement(WebGLRuntime, { effectRegistry: secondRegistry }));
    });

    expect(runtimeMocks.createWebGLRuntime).toHaveBeenCalledTimes(2);
    expect(firstRuntime.dispose).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.createWebGLRuntime.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        effectRegistry: secondRegistry,
      }),
    );
  });
```

- [ ] **Step 3: Run RED verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx
```

Expected: FAIL because `effectRegistry` is not accepted by `WebGLRuntimeProps` and is not forwarded to `createWebGLRuntime`.

## Task 2: Implement Minimal React Prop Forwarding

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`

- [ ] **Step 1: Import the runtime options type**

Extend the existing public runtime type import:

```tsx
import type {
  WebGLDebugState,
  WebGLDeclaration,
  WebGLRuntime as RuntimeInstance,
  WebGLRuntimeOptions,
} from "../types";
```

- [ ] **Step 2: Add the prop and forward it**

Update the component shape:

```tsx
export type WebGLRuntimeProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  effectRegistry?: WebGLRuntimeOptions["effectRegistry"];
  onDebugStateChange?: (state: WebGLDebugState) => void;
};

export function WebGLRuntime({
  children,
  className,
  style,
  effectRegistry,
  onDebugStateChange,
}: WebGLRuntimeProps) {
```

Update runtime creation:

```tsx
    const nextRuntime = createWebGLRuntime({
      container,
      effectRegistry,
      onDebugStateChange(state) {
        onDebugStateChangeRef.current?.(state);
      },
    });
```

Update the effect dependency list:

```tsx
  }, [effectRegistry]);
```

- [ ] **Step 3: Run GREEN verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx
```

Expected: PASS.

## Task 3: Add Public React Type Coverage

**Files:**
- Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`

- [ ] **Step 1: Extend the React type fixture**

In the `React entrypoint type-checks public gate declarations only` fixture, update imports and add a registry prop example:

```tsx
        import { WebGLRuntime, WebGLTarget } from "${importPath}";
        import type { WebGLRuntimeProps, WebGLTargetProps } from "${importPath}";
```

Add:

```tsx
        declare const effectRegistry: WebGLRuntimeProps["effectRegistry"];

        const runtimeProps = {
          effectRegistry,
        } satisfies WebGLRuntimeProps;
```

- [ ] **Step 2: Run public export RED/GREEN verification**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected after implementation: PASS with no diagnostics.

## Task 4: Align Public Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/00-goal.md`
- Modify: `docs/EXECUTION_STATE.md`

- [ ] **Step 1: Update README effect model**

Add one concise sentence to the existing Phase 7/effect model section:

```md
React consumers can pass the same registry through `<WebGLRuntime effectRegistry={registry}>`.
```

- [ ] **Step 2: Update goal and execution state**

Add the same truth in the Phase 7 delivered behavior/status sections:

```md
The React adapter forwards `effectRegistry` through `<WebGLRuntime />`, so custom effect registries can be used without dropping to the vanilla runtime constructor.
```

- [ ] **Step 3: Verify there are no active stale docs**

Run:

```bash
rg -n "effectRegistry|custom effect registry|custom registry|WebGLRuntime effectRegistry" README.md docs/00-goal.md docs/EXECUTION_STATE.md
```

Expected: Active docs describe Phase 7 registry support and React prop forwarding; historical notes may still mention older scope constraints.

## Task 5: Final Verification And Commit

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full project verification**

Run:

```bash
npm test -- --run
npm run typecheck
npm run build
npm run check:imports
git diff --check
```

Expected: all pass. The Vite build may retain the existing chunk-size warning.

- [ ] **Step 3: Review git diff**

Run:

```bash
git diff --stat
git status --short
```

Expected: only React adapter, tests, docs, and this plan file changed.

- [ ] **Step 4: Commit**

Run:

```bash
git add docs/superpowers/plans/2026-06-19-react-effect-registry-prop.md README.md docs/00-goal.md docs/EXECUTION_STATE.md packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx packages/dom-webgl-runtime/src/publicExports.test.ts
git commit -m "feat: expose effect registry through react runtime"
```

Expected: commit succeeds on `codex/react-effect-registry-prop`.

---

## Plan Self-Review

- Spec coverage: Covers branch-local React prop forwarding, runtime recreation on registry reference changes, public React type coverage, docs alignment, and verification.
- Placeholder scan: No `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: Uses `WebGLRuntimeOptions["effectRegistry"]` so the React adapter stays coupled only to the public runtime option object.
