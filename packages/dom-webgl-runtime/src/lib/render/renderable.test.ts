import { describe, expect, test, vi } from "vitest";

import { createTargetDescriptor } from "../dom/targetDescriptor";
import type { WebGLSceneObjectController } from "../renderer/sceneObject";
import type { WebGLSnapshotSourceDescriptor } from "../source/sourceDescriptor";
import { compileRenderPolicy } from "./renderPolicy";
import { createRenderable } from "./renderable";

describe("createRenderable", () => {
  test("creates a uniform renderable contract", async () => {
    const descriptor = createTargetDescriptor(
      document.createElement("section"),
      { key: "hero.surface" },
      0,
    );
    const source = createSnapshotDescriptor(descriptor.element);
    const policy = compileRenderPolicy("surface");
    const onUpdate = vi.fn();
    const onSetVisible = vi.fn();

    const renderable = createRenderable(
      {
        descriptor,
        source,
        role: "surface",
        policy,
      },
      {
        update: onUpdate,
        setVisible: onSetVisible,
      },
    );

    expect(renderable.key).toBe("hero.surface");
    expect(renderable.descriptor).toBe(descriptor);
    expect(renderable.role).toBe("surface");
    expect(renderable.policy).toBe(policy);
    expect(renderable.status).toBe("idle");

    renderable.setVisible(false);
    expect(onSetVisible).toHaveBeenCalledWith(false);

    const frameInput = createFrameInput();

    await renderable.update(frameInput);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), frameInput);
    expect(renderable.status).toBe("ready");
  });

  test("disposes idempotently", () => {
    const descriptor = createTargetDescriptor(
      document.createElement("section"),
      { key: "hero.surface" },
      0,
    );
    const onDispose = vi.fn();

    const renderable = createRenderable(
      {
        descriptor,
        source: createSnapshotDescriptor(descriptor.element),
        role: "surface",
        policy: compileRenderPolicy("surface"),
      },
      {
        dispose: onDispose,
      },
    );

    renderable.dispose();
    renderable.dispose();

    expect(onDispose).toHaveBeenCalledTimes(1);
    expect(renderable.status).toBe("disposed");
  });

  test("reports scene object ownership from an attached scene object controller", async () => {
    const descriptor = createTargetDescriptor(
      document.createElement("section"),
      { key: "hero.surface" },
      0,
    );
    const sceneObjectController = createSceneObjectControllerStub();
    const renderable = createRenderable(
      {
        descriptor,
        source: createSnapshotDescriptor(descriptor.element),
        role: "surface",
        policy: compileRenderPolicy("surface"),
      },
      {
        sceneObjectController: () => sceneObjectController,
      },
    );

    expect(renderable.hasSceneObject).toBe(false);

    sceneObjectController.attach();
    await renderable.update(createFrameInput());

    expect(renderable.hasSceneObject).toBe(true);
  });
});

function createSnapshotDescriptor(
  element: HTMLElement,
): WebGLSnapshotSourceDescriptor {
  return {
    kind: "snapshot",
    mode: "element",
    element,
  };
}

function createFrameInput() {
  return {
    time: 0,
    delta: 0,
    scroll: {
      mode: "page" as const,
      pageProgress: 0,
      direction: 0 as const,
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
    },
  };
}

function createSceneObjectControllerStub(): WebGLSceneObjectController {
  let attached = false;
  let disposed = false;
  let visible = true;

  return {
    get attached() {
      return attached;
    },
    get disposed() {
      return disposed;
    },
    get visible() {
      return visible;
    },
    attach() {
      attached = true;
    },
    setVisible: vi.fn((nextVisible: boolean) => {
      visible = nextVisible;
    }),
    updateLayout: vi.fn(),
    render: vi.fn(),
    dispose() {
      disposed = true;
      attached = false;
    },
  };
}
