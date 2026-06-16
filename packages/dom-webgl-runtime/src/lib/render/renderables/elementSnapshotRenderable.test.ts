import { describe, expect, test, vi } from "vitest";

import { createTargetDescriptor } from "../../dom/targetDescriptor";
import type { WebGLSnapshotSourceDescriptor } from "../../source/sourceDescriptor";
import { compileRenderPolicy } from "../renderPolicy";
import { createElementSnapshotRenderable } from "./elementSnapshotRenderable";

describe("createElementSnapshotRenderable", () => {
  test("creates a surface renderable and measures the target element on update", async () => {
    const element = document.createElement("section");
    const descriptor = createTargetDescriptor(
      element,
      { key: "hero.surface" },
      3,
    );
    const source = createSnapshotDescriptor(element);
    const measureElement = vi.fn(() => ({
      x: 10,
      y: 20,
      width: 300,
      height: 180,
      top: 20,
      right: 310,
      bottom: 200,
      left: 10,
    }));

    const renderable = createElementSnapshotRenderable(
      {
        descriptor,
        source,
        role: "surface",
        policy: compileRenderPolicy("surface"),
      },
      { measureElement },
    );

    expect(renderable.key).toBe("hero.surface");
    expect(renderable.role).toBe("surface");
    expect(renderable.status).toBe("idle");

    await renderable.update();

    expect(measureElement).toHaveBeenCalledWith(element);
    expect(renderable.status).toBe("ready");
  });

  test("marks the renderable as disposed", () => {
    const element = document.createElement("section");
    const descriptor = createTargetDescriptor(
      element,
      { key: "hero.surface" },
      0,
    );

    const renderable = createElementSnapshotRenderable(
      {
        descriptor,
        source: createSnapshotDescriptor(element),
        role: "surface",
        policy: compileRenderPolicy("surface"),
      },
      {
        measureElement: () => ({
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          top: 0,
          right: 1,
          bottom: 1,
          left: 0,
        }),
      },
    );

    renderable.dispose();

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
