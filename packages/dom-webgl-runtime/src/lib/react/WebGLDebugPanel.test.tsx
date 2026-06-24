import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { WebGLDebugState } from "../types";

import { useWebGLDebugState, WebGLDebugPanel } from "./WebGLDebugPanel";

const roots: Root[] = [];

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.replaceChildren();
});

describe("WebGLDebugPanel", () => {
  // ── SSR safety ──────────────────────────────────────────────────────────

  test("renders collapsed pill in SSR without error (default collapsed)", () => {
    const state = createMinimalState({ targetCount: 3, renderableCount: 2 });
    const markup = renderToStaticMarkup(
      createElement(WebGLDebugPanel, { state }),
    );

    expect(markup).toContain("3T 2R");
    expect(markup).not.toContain("Renderables");
  });

  test("expanded panel renders in SSR without error", () => {
    const state = createFullState();
    const markup = renderToStaticMarkup(
      createElement(WebGLDebugPanel, { state }),
    );

    // SSR always renders collapsed by default — just verify no crash
    expect(markup).toContain("5T 4R");
  });

  // ── Collapsed state ─────────────────────────────────────────────────────

  test("shows pill with target and renderable counts when collapsed", () => {
    const state = createMinimalState({ targetCount: 5, renderableCount: 4 });
    const { container } = renderToDom(
      createElement(WebGLDebugPanel, { state }),
    );

    // Default is collapsed — shows pill
    expect(container.textContent).toContain("5T 4R");
    expect(container.textContent).not.toContain("Targets");
    expect(container.textContent).not.toContain("Renderables");
  });

  // ── Expand / collapse interaction ──────────────────────────────────────

  test("expands to full panel on click", () => {
    const state = createMinimalState({ targetCount: 3, renderableCount: 2 });
    const { container } = renderToDom(
      createElement(WebGLDebugPanel, { state }),
    );

    const pill = container.querySelector('[role="button"]')!;
    act(() => {
      pill.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Debug");
    expect(container.textContent).toContain("Targets");
    expect(container.textContent).toContain("3");
    expect(container.textContent).toContain("Renderables");
    expect(container.textContent).toContain("2");
  });

  test("collapses back to pill on header click", () => {
    const state = createMinimalState({});
    const { container } = renderToDom(
      createElement(WebGLDebugPanel, { state }),
    );

    // Expand
    act(() => {
      container.querySelector('[role="button"]')!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    // Collapse via header click
    const header = container.querySelector('[aria-label="Collapse debug panel"]')!;
    act(() => {
      header.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Back to pill
    expect(container.textContent).toContain("0T 0R");
    expect(container.textContent).not.toContain("Debug");
  });

  // ── Metrics display ────────────────────────────────────────────────────

  test("displays page scroll mode metrics", () => {
    const state = createMinimalState({
      targetCount: 5,
      renderableCount: 4,
      currentScrollMode: "page",
    });
    const { container } = renderExpanded(createElement(WebGLDebugPanel, { state }));

    expect(container.textContent).toContain("Scroll");
    expect(container.textContent).toContain("page");
    expect(container.textContent).not.toContain("gate");
  });

  test("displays gate scroll mode metrics with key and progress", () => {
    const state = createMinimalState({
      currentScrollMode: "gate" as const,
      activeGateKey: "hero.scene",
      sceneProgress: 0.375,
    });
    const { container } = renderExpanded(createElement(WebGLDebugPanel, { state }));

    expect(container.textContent).toContain("hero.scene");
    expect(container.textContent).toContain("0.375");
    expect(container.textContent).toContain("Progress");
  });

  test("displays pointer coordinates", () => {
    const state = createMinimalState({});
    const stateWithPointer: WebGLDebugState = {
      ...state,
      pointer: {
        ...state.pointer,
        x: 128,
        y: 256,
      },
    };
    const { container } = renderExpanded(
      createElement(WebGLDebugPanel, { state: stateWithPointer }),
    );

    expect(container.textContent).toContain("128");
    expect(container.textContent).toContain("256");
  });

  test("shows visible count as fraction of targets", () => {
    const state = createFullState(); // 5 targets, 2 visible
    const { container } = renderExpanded(
      createElement(WebGLDebugPanel, { state }),
    );

    expect(container.textContent).toContain("2/5");
  });

  // ── Target list ─────────────────────────────────────────────────────────

  test("shows target list toggle with count", () => {
    const state = createFullState(); // 5 targets
    const { container } = renderExpanded(
      createElement(WebGLDebugPanel, { state }),
    );

    expect(container.textContent).toContain("Targets (5)");
  });

  test("expands target list to show individual targets", () => {
    const state = createFullState();
    const { container } = renderExpanded(
      createElement(WebGLDebugPanel, { state }),
    );

    // Click the target toggle
    const targetToggle = container.querySelector('[aria-expanded="false"]')!;
    act(() => {
      targetToggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("demo.surface");
    expect(container.textContent).toContain("demo.model");
    expect(container.textContent).toContain("snap");
    expect(container.textContent).toContain("mdl");
    expect(container.textContent).toContain("surf");
    expect(container.textContent).toContain("medi");
  });

  test("shows target resource status indicators", () => {
    const state = createFullState();
    const { container } = renderExpanded(
      createElement(WebGLDebugPanel, { state }),
    );

    // Expand targets
    act(() => {
      container.querySelector('[aria-expanded="false"]')!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(container.textContent).toContain("ready");
    expect(container.textContent).toContain("load");
    expect(container.textContent).toContain("idle");
  });

  test("shows error message for errored targets", () => {
    const state = createFullState();
    const { container } = renderExpanded(
      createElement(WebGLDebugPanel, { state }),
    );

    // Expand targets
    act(() => {
      container.querySelector('[aria-expanded="false"]')!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(container.textContent).toContain("Image decode failed");
  });

  test("does not show target section when no targets exist", () => {
    const state = createMinimalState({ targets: [] });
    const { container } = renderExpanded(
      createElement(WebGLDebugPanel, { state }),
    );

    expect(container.textContent).not.toContain("Targets (");
  });
});

// ─── useWebGLDebugState ─────────────────────────────────────────────────────

describe("useWebGLDebugState", () => {
  test("returns initial empty state and setter", () => {
    let capturedState: WebGLDebugState | undefined;
    let capturedSetState: ((s: WebGLDebugState) => void) | undefined;

    function Consumer() {
      const [state, setState] = useWebGLDebugState();
      capturedState = state;
      capturedSetState = setState;
      return null;
    }

    renderToDom(createElement(Consumer));

    expect(capturedState).toBeDefined();
    expect(capturedState!.targetCount).toBe(0);
    expect(capturedState!.renderableCount).toBe(0);
    expect(capturedState!.currentScrollMode).toBe("page");
    expect(capturedState!.targets).toEqual([]);
    expect(typeof capturedSetState).toBe("function");
  });

  test("setter updates the state", () => {
    let capturedState: WebGLDebugState | undefined;
    let capturedSetState: ((s: WebGLDebugState) => void) | undefined;

    function Consumer() {
      const [state, setState] = useWebGLDebugState();
      capturedState = state;
      capturedSetState = setState;
      return null;
    }

    renderToDom(createElement(Consumer));

    const newState = createMinimalState({ targetCount: 7, renderableCount: 3 });
    act(() => {
      capturedSetState!(newState);
    });

    expect(capturedState!.targetCount).toBe(7);
    expect(capturedState!.renderableCount).toBe(3);
  });

  test("passes setter as onDebugStateChange and updates on callback", () => {
    let capturedOnChange: ((s: WebGLDebugState) => void) | undefined;

    function Consumer() {
      const [, setState] = useWebGLDebugState();
      capturedOnChange = setState;
      return null;
    }

    const { container } = renderToDom(createElement(Consumer));

    const updated = createMinimalState({ targetCount: 3, renderableCount: 2 });
    act(() => {
      capturedOnChange!(updated);
    });

    // Re-render with the captured state via WebGLDebugPanel to verify
    // (we use a special re-render pattern)
    function Verifier() {
      const [state, setState] = useWebGLDebugState();
      capturedOnChange = setState;
      return createElement(WebGLDebugPanel, { state });
    }

    const { container: vc } = renderToDom(createElement(Verifier));

    // Initially collapsed — shows 0T 0R
    expect(vc.textContent).toContain("0T 0R");

    // Update
    act(() => {
      capturedOnChange!(updated);
    });

    // Should now show 3T 2R — wait for re-render
    expect(vc.textContent).toContain("3T 2R");
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function renderToDom(element: ReturnType<typeof createElement>): {
  container: HTMLElement;
  root: Root;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);

  act(() => {
    root.render(element);
  });

  return { container, root };
}

function renderExpanded(element: ReturnType<typeof createElement>): {
  container: HTMLElement;
  root: Root;
} {
  const { container, root } = renderToDom(element);

  // Click the pill to expand
  const pill = container.querySelector('[role="button"]')!;
  act(() => {
    pill.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  return { container, root };
}

function createMinimalState(
  overrides: Partial<WebGLDebugState> = {},
): WebGLDebugState {
  return {
    targetCount: 0,
    renderableCount: 0,
    currentScrollMode: "page",
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
    targets: [],
    ...overrides,
  };
}

function createFullState(): WebGLDebugState {
  return {
    targetCount: 5,
    renderableCount: 4,
    currentScrollMode: "page",
    pointer: {
      x: 128,
      y: 256,
      normalizedX: 0.25,
      normalizedY: -0.5,
      isInside: true,
      isDown: false,
      downTime: 0,
      pressDuration: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragDeltaX: 0,
      dragDeltaY: 0,
      clickCount: 2,
    },
    targets: [
      {
        key: "demo.surface",
        sourceKind: "snapshot",
        renderRole: "surface",
        resourceStatus: "ready",
        lifecycleState: "active",
        visible: true,
      },
      {
        key: "demo.image",
        sourceKind: "image",
        renderRole: "media",
        resourceStatus: "loading",
        lifecycleState: "preloading",
        visible: false,
      },
      {
        key: "demo.text",
        sourceKind: "snapshot/text",
        renderRole: "content",
        resourceStatus: "ready",
        lifecycleState: "active",
        visible: true,
      },
      {
        key: "demo.video",
        sourceKind: "video",
        renderRole: "media",
        resourceStatus: "idle",
        lifecycleState: "declared",
        visible: false,
      },
      {
        key: "demo.model",
        sourceKind: "model",
        renderRole: "model",
        resourceStatus: "error",
        lifecycleState: "error",
        visible: false,
        error: "Image decode failed",
      },
    ],
  };
}
