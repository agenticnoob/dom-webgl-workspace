import { describe, expect, test, vi } from "vitest";
import type { WebGLEffectMaterialLayerHandle } from "@viselora/dom-webgl";
import { createEffectContext } from "../effectContext";
import { createPaperReaderArtwork } from "../../src/recipes/paper-reader/artwork";
import {
  createPaperReaderEffect,
  type PaperReaderEffectParams,
} from "../../src/recipes/paper-reader/effect";
import { defaultPaperReaderPalette } from "../../src/recipes/paper-reader/model";
import { resolvePaperReaderTextureLayout } from "../../src/recipes/paper-reader/texture";

function createFixture(id = "notes") {
  const layers: WebGLEffectMaterialLayerHandle[] = [];
  const createMaterialLayer = vi.fn(() => {
    const layer = {
      setProgram: vi.fn(),
      setUniforms: vi.fn(),
      clear: vi.fn(),
      dispose: vi.fn(),
    };
    layers.push(layer);
    return layer;
  });
  const progress = vi.fn(() => 0.25);
  const context = createEffectContext({
    key: `${id}.surface`,
    layout: {
      width: 640,
      height: 720,
      viewport: { width: 1600, height: 1000 },
    },
    progress: { get: progress },
    source: {
      kind: "dom",
      type: "element",
      element: document.createElement("div"),
      surface: { createMaterialLayer },
    },
  });
  const params = {
    kind: "recipe.paper-reader",
    progressKey: `${id}.progress`,
    eyebrow: "READING ROOM",
    content: {
      title: "Field notes",
      intro: "A collection.",
      sections: [
        {
          id: "one",
          label: "01",
          title: "Observe",
          body: "Begin with an observation.",
        },
        {
          id: "two",
          label: "02",
          title: "Make",
          body: "Make a small experiment.",
        },
      ],
    },
    palette: defaultPaperReaderPalette,
    onReady: vi.fn(),
    onError: vi.fn(),
  } satisfies PaperReaderEffectParams;
  const createArtwork = vi.fn((viewport, content, eyebrow) =>
    createPaperReaderArtwork(
      {
        font: "",
        letterSpacing: "",
        measureText: (text) => ({ width: text.length * 8 }),
      },
      viewport,
      content,
      eyebrow,
    ),
  );
  const createTexture = vi.fn((artwork) => ({
    ...resolvePaperReaderTextureLayout([
      artwork.header,
      ...artwork.fans,
      ...artwork.papers,
    ]),
    canvas: document.createElement("canvas"),
  }));
  const effect = createPaperReaderEffect({ createArtwork, createTexture });
  const state = effect.setup?.(context, params);
  if (!state) throw new Error("Missing paper reader effect state.");
  return {
    effect,
    state,
    context,
    params,
    layers,
    createMaterialLayer,
    createArtwork,
    createTexture,
    progress,
  };
}

describe("paper reader managed effect", () => {
  test("uses its own target dimensions and updates keyed progress without rebuilding textures", () => {
    const fixture = createFixture();
    const { effect, state, context, params } = fixture;
    effect.update(context, state, params);
    expect(fixture.createArtwork).toHaveBeenCalledWith(
      { width: 640, height: 720 },
      params.content,
      params.eyebrow,
    );
    expect(fixture.progress).toHaveBeenCalledWith("notes.progress");
    expect(context.object.position.x).toBe(800);
    expect(context.object.position.y).toBe(500);
    expect(context.object.scale.x).toBe(1600);
    expect(context.object.scale.y).toBe(1000);
    expect(fixture.createMaterialLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "notes.surface.material",
        mode: "replace-source",
      }),
    );
    expect(params.onReady).toHaveBeenCalledWith(true);
    effect.update(context, state, params);
    expect(fixture.layers[0].setUniforms).toHaveBeenCalledTimes(1);
    fixture.progress.mockReturnValue(0.75);
    effect.update(context, state, params);
    expect(fixture.layers[0].setUniforms).toHaveBeenCalledTimes(2);
    expect(fixture.createTexture).toHaveBeenCalledTimes(1);
  });

  test("releases the old material on resize and disposes exactly once on unmount", () => {
    const { effect, state, context, params, layers, createTexture } =
      createFixture();
    effect.update(context, state, params);
    effect.update(
      { ...context, layout: { ...context.layout, width: 900 } },
      state,
      params,
    );
    expect(layers).toHaveLength(2);
    expect(layers[0].dispose).toHaveBeenCalledOnce();
    expect(createTexture).toHaveBeenCalledTimes(2);
    effect.dispose?.(context, state, params);
    effect.dispose?.(context, state, params);
    effect.update(context, state, params);
    expect(layers[1].dispose).toHaveBeenCalledOnce();
    expect(layers).toHaveLength(2);
    expect(params.onReady).toHaveBeenLastCalledWith(false);
  });

  test("isolates independent instances' state, keys and disposal", () => {
    const first = createFixture("one");
    const second = createFixture("two");
    first.effect.update(first.context, first.state, first.params);
    second.effect.update(second.context, second.state, second.params);
    first.effect.dispose?.(first.context, first.state, first.params);
    expect(second.layers[0].dispose).not.toHaveBeenCalled();
    expect(second.progress).toHaveBeenCalledWith("two.progress");
    expect(second.createMaterialLayer).toHaveBeenCalledWith(
      expect.objectContaining({ key: "two.surface.material" }),
    );
    expect(second.params.onReady).toHaveBeenLastCalledWith(true);
  });

  test("reports texture failures, restores DOM and stops retrying the failing allocation", () => {
    const { context, params } = createFixture();
    const failure = new Error("Texture unavailable");
    const createArtwork = vi.fn(() => {
      throw failure;
    });
    const effect = createPaperReaderEffect({ createArtwork });
    const state = effect.setup?.(context, params);
    if (!state) throw new Error("Missing effect state.");
    effect.update(context, state, params);
    effect.update(context, state, params);
    expect(createArtwork).toHaveBeenCalledOnce();
    expect(context.object.visible).toBe(false);
    expect(params.onReady).toHaveBeenCalledWith(false);
    expect(params.onError).toHaveBeenCalledWith(failure);
  });

  test("recovers from an undersized stage when the container grows", () => {
    const fixture = createFixture();
    const { effect, state, context, params } = fixture;
    const tooShort = { ...context, layout: { ...context.layout, height: 180 } };
    effect.update(tooShort, state, params);
    expect(params.onError).toHaveBeenCalledOnce();
    expect(context.object.visible).toBe(false);
    expect(fixture.layers).toHaveLength(0);
    effect.update(context, state, params);
    expect(context.object.visible).toBe(true);
    expect(fixture.layers).toHaveLength(1);
    expect(params.onReady).toHaveBeenLastCalledWith(true);
  });
});
