import { describe, expect, test } from "vitest";

import { createTargetDescriptor } from "../../dom/targetDescriptor";
import type { WebGLSnapshotSourceDescriptor } from "../../source/sourceDescriptor";
import { compileRenderPolicy } from "../renderPolicy";
import { createTextSnapshotRenderable } from "./textSnapshotRenderable";

describe("createTextSnapshotRenderable", () => {
  test("creates a content renderable and captures target text on update", async () => {
    const element = document.createElement("h1");
    element.textContent = "Hello WebGL text";
    const descriptor = createTargetDescriptor(element, { key: "hero.title" }, 1);

    const renderable = createTextSnapshotRenderable({
      descriptor,
      source: createTextSnapshotDescriptor(element),
      role: "content",
      policy: compileRenderPolicy("content"),
    });

    expect(renderable.key).toBe("hero.title");
    expect(renderable.role).toBe("content");
    expect(renderable.policy).toEqual(compileRenderPolicy("content"));
    expect(renderable.status).toBe("idle");

    await renderable.update();

    expect(renderable.textContent).toBe("Hello WebGL text");
    expect(renderable.status).toBe("ready");
  });

  test("disposes idempotently", async () => {
    const element = document.createElement("p");
    element.textContent = "Disposable copy";
    const descriptor = createTargetDescriptor(element, { key: "body.copy" }, 2);
    const renderable = createTextSnapshotRenderable({
      descriptor,
      source: createTextSnapshotDescriptor(element),
      role: "content",
      policy: compileRenderPolicy("content"),
    });

    await renderable.update();
    expect(renderable.textContent).toBe("Disposable copy");

    renderable.dispose();
    renderable.dispose();

    expect(renderable.status).toBe("disposed");
    expect(renderable.textContent).toBe("");
  });
});

function createTextSnapshotDescriptor(
  element: HTMLElement,
): WebGLSnapshotSourceDescriptor {
  return {
    kind: "snapshot",
    mode: "text",
    element,
  };
}
