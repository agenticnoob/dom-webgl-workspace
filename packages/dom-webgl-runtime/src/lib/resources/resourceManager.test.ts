import { describe, expect, test } from "vitest";

import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";
import { createResourceManager } from "./resourceManager";

describe("createResourceManager", () => {
  test("creates idle resource records keyed by descriptor", () => {
    const manager = createResourceManager();
    const snapshot = createSnapshotDescriptor("hero.surface");

    const handle = manager.acquire(snapshot);

    expect(handle.record).toMatchObject({
      key: "snapshot:element:hero.surface",
      kind: "snapshot",
      status: "idle",
      refCount: 1,
    });
    expect(manager.inspect("snapshot:element:hero.surface")).toBe(handle.record);
  });

  test("shares records by normalized resource key and reference counts handles", () => {
    const manager = createResourceManager();
    const first = manager.acquire(createImageDescriptor("/assets/hero.png"));
    const second = manager.acquire(createImageDescriptor("/assets/./hero.png"));

    expect(second.record).toBe(first.record);
    expect(first.record.refCount).toBe(2);

    first.dispose();
    expect(second.record.refCount).toBe(1);

    first.dispose();
    expect(second.record.refCount).toBe(1);

    second.dispose();
    expect(manager.inspect("image:/assets/hero.png")).toBeUndefined();
  });

  test("loads records through loading to ready", async () => {
    const manager = createResourceManager();
    const handle = manager.acquire(createImageDescriptor("/assets/hero.png"));
    let resolveLoad!: (value: { width: number }) => void;

    const load = handle.load(
      () =>
        new Promise<{ width: number }>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    expect(handle.record.status).toBe("loading");

    resolveLoad({ width: 1200 });
    await expect(load).resolves.toEqual({ width: 1200 });
    expect(handle.record).toMatchObject({
      status: "ready",
      value: { width: 1200 },
    });
  });

  test("moves failed loads into error state", async () => {
    const manager = createResourceManager();
    const handle = manager.acquire(createImageDescriptor("/assets/missing.png"));
    const error = new Error("missing image");

    await expect(handle.load(async () => Promise.reject(error))).rejects.toThrow(
      "missing image",
    );
    expect(handle.record).toMatchObject({
      status: "error",
      error,
    });
  });
});

function createSnapshotDescriptor(key: string): WebGLSourceDescriptor {
  const element = document.createElement("section");
  element.setAttribute("data-webgl-key", key);

  return {
    kind: "snapshot",
    mode: "element",
    element,
  };
}

function createImageDescriptor(src: string): WebGLSourceDescriptor {
  const element = document.createElement("img");
  element.src = src;

  return {
    kind: "image",
    element,
    src,
  };
}
