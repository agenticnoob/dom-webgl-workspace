import { describe, expect, test, vi } from "vitest";

import { createTextureUploadState } from "./textureUploadState";

describe("texture upload state", () => {
  test("marks a texture dirty with telemetry and requests one frame", () => {
    const texture = { needsUpdate: false };
    const requestFrame = vi.fn();
    const source = document.createElement("canvas");
    source.width = 320;
    source.height = 180;
    const owner = createTextureUploadState({
      key: "hero.texture",
      texture,
      source,
      requestFrame,
    });

    owner.markDirty("canvas-raster");

    expect(texture.needsUpdate).toBe(true);
    expect(owner.inspect()).toMatchObject({
      key: "hero.texture",
      width: 320,
      height: 180,
      sourceKind: "canvas",
      dirty: true,
      dirtyReason: "canvas-raster",
    });
    expect(requestFrame).toHaveBeenCalledTimes(1);
  });

  test("keeps identical source signatures clean and marks new source identity dirty", () => {
    const texture = { needsUpdate: false };
    const requestFrame = vi.fn();
    const firstSource = document.createElement("canvas");
    firstSource.width = 120;
    firstSource.height = 80;
    const secondSource = document.createElement("canvas");
    secondSource.width = 120;
    secondSource.height = 80;
    const owner = createTextureUploadState({
      key: "gallery.frame",
      texture,
      source: firstSource,
      requestFrame,
    });

    owner.updateSource(firstSource);

    expect(texture.needsUpdate).toBe(false);
    expect(owner.inspect()).toMatchObject({
      key: "gallery.frame",
      width: 120,
      height: 80,
      sourceKind: "canvas",
      dirty: false,
    });
    expect(requestFrame).not.toHaveBeenCalled();

    owner.updateSource(secondSource);

    expect(texture.needsUpdate).toBe(true);
    expect(owner.inspect()).toMatchObject({
      key: "gallery.frame",
      width: 120,
      height: 80,
      sourceKind: "canvas",
      dirty: true,
      dirtyReason: "source-change",
    });
    expect(requestFrame).toHaveBeenCalledTimes(1);
  });

  test("tracks explicit logical size and ignores updates after dispose", () => {
    const texture = { needsUpdate: false };
    const requestFrame = vi.fn();
    const owner = createTextureUploadState({
      key: "text.layer",
      texture,
      requestFrame,
    });

    owner.updateSize({ width: 240, height: 90, devicePixelRatio: 2 });
    owner.dispose();
    owner.dispose();
    owner.markDirty("glyph-commands");

    expect(texture.needsUpdate).toBe(false);
    expect(owner.inspect()).toMatchObject({
      key: "text.layer",
      width: 240,
      height: 90,
      devicePixelRatio: 2,
      sourceKind: "unknown",
      dirty: false,
    });
    expect(requestFrame).not.toHaveBeenCalled();
  });
});
