import { describe, expect, test, vi } from "vitest";

import { createTargetDescriptor } from "../dom/targetDescriptor";
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

    await renderable.update();
    expect(onUpdate).toHaveBeenCalledTimes(1);
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
