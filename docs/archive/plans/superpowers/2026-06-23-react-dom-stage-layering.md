# React DOM Stage Layering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Completed on 2026-06-23 by commit `a643476` (`fix: keep React DOM above runtime canvas`). Current truth: the React adapter owns a stable `data-dom-webgl-runtime-content` layer above the canvas, `apps/example` no longer carries an app-level `z-index` workaround, and the behavior is covered by `WebGLRuntime.test.tsx`.

**Goal:** Make the React adapter guarantee that DOM children render above the runtime canvas without requiring users to set `z-index`.

**Architecture:** Keep the fix inside `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`. Do not add new runtime options, renderer flags, MutationObserver logic, or app-level CSS requirements. The React adapter should own a stable DOM content layer whose inline layer styles are authored by React, so renderer-host cleanup cannot restore them away during runtime replacement.

**Tech Stack:** React 19, TypeScript, Vitest, jsdom.

---

## Root Cause

`createThreeRendererHost(...)` inserts the canvas and calls `configureDOMStageLayer(...)`, which applies `position: relative; z-index: 1` to current container children when those inline styles are absent. In the React adapter, runtime replacement can happen when `effects` or `scrollAdapter` references change. The old runtime is disposed asynchronously through `scheduleRuntimeDisposal(...)`; its `restoreDOMStageLayer()` can run after the new runtime has configured the DOM layer, restoring child styles back to their previous empty values.

The fix should not ask users to add `z-index`. That would leak an internal staging invariant into every app.

## Files

- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx`
- Modify: `apps/example/src/example.css`
- Modify: `README.md`
- Modify: `docs/EXECUTION_STATE.md`

## Task 1: Add A React-Owned Content Layer

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`
- Test: `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx`

- [x] **Step 1: Write the failing adapter test**

Add this test to `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx`:

```tsx
test("keeps React children above the canvas across runtime replacement", async () => {
  const effectsA = [] as const;
  const effectsB = [] as const;
  const { rerender } = render(
    <WebGLRuntime effects={effectsA}>
      <main data-testid="content">DOM content</main>
    </WebGLRuntime>,
  );

  const content = screen.getByTestId("content");
  const contentLayer = content.parentElement as HTMLElement;
  const root = contentLayer.parentElement as HTMLElement;
  const canvas = root.querySelector("canvas") as HTMLCanvasElement;

  expect(canvas.style.zIndex).toBe("0");
  expect(contentLayer.dataset.domWebglRuntimeContent).toBe("true");
  expect(contentLayer.style.position).toBe("relative");
  expect(contentLayer.style.zIndex).toBe("1");

  rerender(
    <WebGLRuntime effects={effectsB}>
      <main data-testid="content">DOM content</main>
    </WebGLRuntime>,
  );

  await new Promise((resolve) => setTimeout(resolve, 0));

  const nextContent = screen.getByTestId("content");
  const nextContentLayer = nextContent.parentElement as HTMLElement;
  const nextRoot = nextContentLayer.parentElement as HTMLElement;
  const nextCanvas = nextRoot.querySelector("canvas") as HTMLCanvasElement;

  expect(nextCanvas.style.zIndex).toBe("0");
  expect(nextContentLayer.dataset.domWebglRuntimeContent).toBe("true");
  expect(nextContentLayer.style.position).toBe("relative");
  expect(nextContentLayer.style.zIndex).toBe("1");
});
```

- [x] **Step 2: Run the failing test**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx -t "keeps React children above the canvas"
```

Expected: FAIL because the current React adapter has no stable content layer.

- [x] **Step 3: Implement the minimal adapter layer**

In `packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.tsx`, add a focused internal content wrapper:

```tsx
const runtimeContentLayerStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
};
```

Then replace the return block with:

```tsx
return createElement(
  "div",
  { ref: containerRef, className, style },
  createElement(
    "div",
    {
      "data-dom-webgl-runtime-content": "true",
      style: runtimeContentLayerStyle,
    },
    createElement(
      WebGLRuntimeProvider,
      { runtime: runtime ?? pendingRuntimeRef.current },
      children,
    ),
  ),
);
```

This keeps the ownership local to the React adapter. It does not add public props, does not modify `createWebGLRuntime(...)`, and does not require users to write CSS.

- [x] **Step 4: Run the adapter test**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx -t "keeps React children above the canvas"
```

Expected: PASS.

## Task 2: Remove The Example-Level Workaround

**Files:**
- Modify: `apps/example/src/example.css`
- Test: `apps/example/src/App.test.tsx`

- [x] **Step 1: Remove the temporary app CSS layer fix**

In `apps/example/src/example.css`, remove these declarations from `.example-shell`:

```css
position: relative;
z-index: 1;
```

Leave the rest of `.example-shell` unchanged.

- [x] **Step 2: Run the example smoke test**

Run:

```bash
npm test -- --run apps/example/src/App.test.tsx apps/example/src/exampleEffects.test.ts
```

Expected: PASS.

## Task 3: Sync Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/EXECUTION_STATE.md`

- [x] **Step 1: Update README current example behavior**

In `README.md`, keep the current example surface notes but remove any implication that app authors must set stage `z-index`. Add one sentence under current example behavior:

```markdown
- The React runtime adapter owns the DOM content layer, so app children remain above the runtime canvas without app-authored `z-index` rules.
```

- [x] **Step 2: Update execution state**

In `docs/EXECUTION_STATE.md`, update the `apps/example` paragraph to include:

```markdown
The React adapter owns the DOM content layer above the canvas, so the example does not rely on app CSS to keep real DOM children above WebGL surfaces.
```

## Task 4: Verify The Full Fix

**Files:**
- Verify only.

- [x] **Step 1: Run targeted tests**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/react/WebGLRuntime.test.tsx apps/example/src/App.test.tsx apps/example/src/exampleEffects.test.ts
```

Expected: PASS.

- [x] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [x] **Step 3: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output and exit code 0.

- [x] **Step 4: Optional visual smoke**

Run the example app:

```bash
npm run dev --workspace @project/dom-webgl-example -- --host 127.0.0.1 --port 5174
```

Open `http://127.0.0.1:5174/`, scroll to `表面脉冲`, and verify that the orange WebGL pulse is visible behind the real DOM text.

## Self-Review

- Spec coverage: The plan removes user-authored `z-index` from the contract, keeps the change inside the React adapter, and leaves renderer/runtime core APIs unchanged.
- Placeholder scan: No placeholders remain.
- Type consistency: The test uses the exact `data-dom-webgl-runtime-content` attribute and `CSSProperties` import already available in `WebGLRuntime.tsx`.
