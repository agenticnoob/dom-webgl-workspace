import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createTargetDescriptor, type TargetDescriptor } from "../dom/targetDescriptor";
import type { WebGLDeclaration, WebGLRuntime } from "../../index";

const roots: Root[] = [];

describe("WebGLTarget", () => {
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

  test("renders the requested element and registers the DOM target on mount", async () => {
    const { WebGLRuntimeProvider, WebGLTarget } = await import("../../react");
    const runtime = createRuntimeStub();
    const webgl: WebGLDeclaration = {
      key: "hero.title",
      source: { kind: "snapshot", mode: "text" },
    };
    const { root, host } = createTestRoot();

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(
            WebGLTarget,
            {
              as: "section",
              webgl,
              className: "hero-title",
              id: "target",
            },
            "Hero title",
          ),
        ),
      );
    });

    const target = host.querySelector("#target");
    expect(target?.tagName).toBe("SECTION");
    expect(target?.textContent).toBe("Hero title");
    expect(runtime.registerTarget).toHaveBeenCalledTimes(1);
    expect(runtime.registerTarget).toHaveBeenCalledWith(target, webgl);
  });

  test("unregisters the declaration key on unmount", async () => {
    const { WebGLRuntimeProvider, WebGLTarget } = await import("../../react");
    const runtime = createRuntimeStub();
    const { root } = createTestRoot();

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(WebGLTarget, {
            as: "article",
            webgl: { key: "story.card" },
          }),
        ),
      );
    });

    act(() => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);

    expect(runtime.unregisterTarget).toHaveBeenCalledTimes(1);
    expect(runtime.unregisterTarget).toHaveBeenCalledWith("story.card");
  });

  test("forwards gate scroll declarations through the public webgl prop", async () => {
    const { WebGLRuntimeProvider, WebGLTarget } = await import("../../react");
    const runtime = createRuntimeStub();
    const webgl: WebGLDeclaration = {
      key: "story.gate",
      scroll: {
        type: "gate",
        start: " top top ",
        duration: 1.5,
        release: "both-directions-complete",
      },
    };
    const { root, host } = createTestRoot();

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(WebGLTarget, {
            webgl,
            id: "story-gate",
          }),
        ),
      );
    });

    const target = host.querySelector("#story-gate");
    const descriptor = runtime.registerTarget.mock.results[0]?.value;

    expect(runtime.registerTarget).toHaveBeenCalledWith(target, webgl);
    expect(descriptor).toMatchObject({
      key: "story.gate",
      declaration: {
        scroll: {
          type: "gate",
          start: "top top",
          duration: 1.5,
          release: "both-directions-complete",
        },
      },
    });
  });

  test("forwards lifecycle fallback declarations through the public webgl prop", async () => {
    const { WebGLRuntimeProvider, WebGLTarget } = await import("../../react");
    const runtime = createRuntimeStub();
    const webgl: WebGLDeclaration = {
      key: "story.surface",
      source: { kind: "snapshot", mode: "element" },
      lifecycle: { hideWhenReady: true, hideMode: "self" },
    };
    const { root, host } = createTestRoot();

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(
            WebGLTarget,
            {
              webgl,
              id: "story-surface",
            },
            createElement("span", null, "Visible child"),
          ),
        ),
      );
    });

    const target = host.querySelector("#story-surface");
    const descriptor = runtime.registerTarget.mock.results[0]?.value;

    expect(runtime.registerTarget).toHaveBeenCalledWith(target, webgl);
    expect(descriptor).toMatchObject({
      key: "story.surface",
      declaration: {
        lifecycle: { hideWhenReady: true, hideMode: "self" },
      },
    });
  });

  test("does not re-register when an equivalent inline declaration is recreated", async () => {
    const { WebGLRuntimeProvider, WebGLTarget } = await import("../../react");
    const runtime = createRuntimeStub();
    const { root } = createTestRoot();
    let rerender!: () => void;

    function TargetHost() {
      const [, setRevision] = useState(0);
      rerender = () => setRevision((revision) => revision + 1);

      return createElement(WebGLTarget, {
        webgl: { key: "story.inline" },
        id: "story-inline",
      });
    }

    await act(async () => {
      root.render(
        createElement(
          WebGLRuntimeProvider,
          { runtime },
          createElement(TargetHost),
        ),
      );
    });

    await act(async () => {
      rerender();
    });

    expect(runtime.registerTarget).toHaveBeenCalledTimes(1);
    expect(runtime.unregisterTarget).not.toHaveBeenCalled();
  });

  test("keeps runtime internals out of the React public entrypoint", async () => {
    const reactEntrypoint = await import("../../react");

    expect(reactEntrypoint.WebGLTarget).toBeTypeOf("function");
    expect("createWebGLRuntime" in reactEntrypoint).toBe(false);
    expect("createTargetRegistry" in reactEntrypoint).toBe(false);
    expect("WebGLRuntimeContext" in reactEntrypoint).toBe(false);
  });
});

function createTestRoot(): { root: Root; host: HTMLElement } {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);

  return { root, host };
}

function createRuntimeStub(): WebGLRuntime & {
  registerTarget: ReturnType<typeof vi.fn>;
  unregisterTarget: ReturnType<typeof vi.fn>;
} {
  return {
    container: document.createElement("div"),
    registerTarget: vi.fn((element: HTMLElement, declaration: WebGLDeclaration) =>
      createTargetDescriptor(element, declaration, 0),
    ),
    unregisterTarget: vi.fn(),
    sync() {},
    getDebugState() {
      throw new Error("not implemented in test");
    },
    dispose() {},
  };
}
