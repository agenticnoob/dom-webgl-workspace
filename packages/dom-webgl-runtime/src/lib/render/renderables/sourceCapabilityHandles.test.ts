import { describe, expect, test, vi } from "vitest";

import {
  createCanvasSurfaceCapabilityHandle,
  createTextLayerCapabilityHandle,
  createTextureLayerCapabilityHandle,
  createVideoLayerCapabilityHandle,
} from "./sourceCapabilityHandles";

describe("source capability handles", () => {
  test("canvas surface handle draws and invalidates the existing texture", () => {
    const context = createCanvasContextStub();
    const canvas = createCanvasStub(context);
    canvas.width = 180;
    canvas.height = 60;
    const texture = { needsUpdate: false };
    const invalidate = vi.fn();
    const object3D = createObject3D();
    const material = createMaterial();
    const handle = createCanvasSurfaceCapabilityHandle({
      object3D,
      mesh: object3D,
      material,
      canvas,
      context,
      texture,
      getSize: () => ({ width: 120, height: 40, devicePixelRatio: 1.5 }),
      invalidate,
    });
    const drawer = vi.fn(({ context: drawingContext }) => {
      drawingContext.fillRect(1, 2, 3, 4);
    });

    handle.draw(drawer);
    handle.setVisible?.(false);
    handle.setRotation?.(1, 2, 3);
    handle.setScale?.(2, 3, 4);
    handle.setOpacity?.(0.5);

    expect(context.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 180, 60);
    expect(context.scale).toHaveBeenCalledWith(1.5, 1.5);
    expect(drawer).toHaveBeenCalledWith({
      canvas,
      context,
      width: 120,
      height: 40,
      devicePixelRatio: 1.5,
    });
    expect(context.fillRect).toHaveBeenCalledWith(1, 2, 3, 4);
    expect(texture.needsUpdate).toBe(true);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(object3D.visible).toBe(false);
    expect(object3D.rotation.set).toHaveBeenCalledWith(1, 2, 3);
    expect(object3D.scale.set).toHaveBeenCalledWith(2, 3, 4);
    expect(material).toMatchObject({
      opacity: 0.5,
      transparent: true,
      needsUpdate: true,
    });
  });

  test("text layer handle exposes glyph layout and draws glyph commands without mutating DOM text", () => {
    const context = createCanvasContextStub();
    const canvas = createCanvasStub(context);
    const element = document.createElement("p");
    element.textContent = "Accessible text";
    let text = "Visible text";
    const texture = { needsUpdate: false };
    const handle = createTextLayerCapabilityHandle({
      object3D: createObject3D(),
      mesh: createObject3D(),
      material: createMaterial(),
      canvas,
      context,
      texture,
      getSize: () => ({ width: 200, height: 80, devicePixelRatio: 1 }),
      getText: () => text,
      getStyle: () => ({
        font: "16px sans-serif",
        lineHeight: 20,
        letterSpacing: 0,
        wordSpacing: 0,
        textAlign: "left",
        color: "#111111",
      }),
      getGlyphs: () => [
        {
          index: 0,
          char: "V",
          line: 0,
          x: 10,
          y: 20,
          width: 8,
          height: 20,
          baseline: 40,
        },
      ],
      setText: (nextText) => {
        text = nextText;
      },
      invalidate: vi.fn(),
    });

    handle.setText("WebGL override");
    handle.setGlyphs((glyphs) =>
      glyphs.map((glyph) => ({
        index: glyph.index,
        char: "X",
        x: glyph.x + 2,
        y: glyph.y + 3,
        opacity: 0.6,
        scaleX: 1.2,
        scaleY: 0.8,
        color: "#ff0000",
      })),
    );

    expect(handle.text).toBe("WebGL override");
    expect(element.textContent).toBe("Accessible text");
    expect(context.fillStyle).toBe("#ff0000");
    expect(context.globalAlpha).toBe(1);
    expect(context.translate).toHaveBeenCalledWith(12, 23);
    expect(context.scale).toHaveBeenCalledWith(1.2, 0.8);
    expect(context.fillText).toHaveBeenCalledWith("X", 0, 0);
    expect(texture.needsUpdate).toBe(true);
  });

  test("text layer glyph commands clear the full DPR canvas and draw in CSS coordinates", () => {
    const context = createCanvasContextStub();
    const canvas = createCanvasStub(context);
    canvas.width = 300;
    canvas.height = 120;
    const handle = createTextLayerCapabilityHandle({
      object3D: createObject3D(),
      mesh: createObject3D(),
      material: createMaterial(),
      canvas,
      context,
      texture: { needsUpdate: false },
      getSize: () => ({ width: 200, height: 80, devicePixelRatio: 1.5 }),
      getText: () => "Hi",
      getStyle: () => ({
        font: "20px sans-serif",
        lineHeight: 24,
        letterSpacing: 0,
        wordSpacing: 0,
        textAlign: "left",
        color: "#111111",
      }),
      getGlyphs: () => [
        {
          index: 0,
          char: "H",
          line: 0,
          x: 30,
          y: 20,
          width: 12,
          height: 24,
          baseline: 44,
        },
      ],
      setText: vi.fn(),
      invalidate: vi.fn(),
    });

    handle.setGlyphs((glyphs) =>
      glyphs.map((glyph) => ({
        index: glyph.index,
        char: "X",
        x: glyph.x,
        y: glyph.y,
      })),
    );

    expect(context.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 300, 120);
    expect(context.scale).toHaveBeenCalledWith(1.5, 1.5);
    expect(context.translate).toHaveBeenCalledWith(30, 20);
    expect(context.fillText).toHaveBeenCalledWith("X", 0, 0);
  });

  test("texture layer handle updates texture transform", () => {
    const texture = {
      repeat: { set: vi.fn() },
      offset: { set: vi.fn() },
      needsUpdate: false,
    };
    const invalidate = vi.fn();
    const image = document.createElement("img");
    const handle = createTextureLayerCapabilityHandle({
      object3D: createObject3D(),
      mesh: createObject3D(),
      material: createMaterial(),
      texture,
      source: image,
      invalidate,
    });

    handle.setTextureTransform({
      repeatX: 0.5,
      repeatY: 0.75,
      offsetX: 0.1,
      offsetY: 0.2,
    });

    expect(texture.repeat.set).toHaveBeenCalledWith(0.5, 0.75);
    expect(texture.offset.set).toHaveBeenCalledWith(0.1, 0.2);
    expect(texture.needsUpdate).toBe(true);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  test("video layer handle controls playback state", () => {
    const video = document.createElement("video");
    const play = vi.spyOn(video, "play").mockImplementation(() => Promise.resolve());
    const pause = vi.spyOn(video, "pause").mockImplementation(() => undefined);
    const handle = createVideoLayerCapabilityHandle({
      object3D: createObject3D(),
      mesh: createObject3D(),
      material: createMaterial(),
      texture: { needsUpdate: false },
      source: video,
      invalidate: vi.fn(),
    });

    handle.play();
    handle.pause();
    handle.setMuted(true);
    handle.setPlaybackRate(1.5);

    expect(play).toHaveBeenCalledTimes(1);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(video.muted).toBe(true);
    expect(video.playbackRate).toBe(1.5);
  });
});

function createObject3D() {
  return {
    visible: true,
    rotation: { set: vi.fn() },
    scale: { set: vi.fn() },
  };
}

function createMaterial() {
  return {
    opacity: 1,
    transparent: false,
    needsUpdate: false,
  };
}

function createCanvasStub(context: CanvasRenderingContext2D): HTMLCanvasElement {
  return {
    width: 120,
    height: 40,
    getContext: vi.fn(() => context),
  } as unknown as HTMLCanvasElement;
}

function createCanvasContextStub(): CanvasRenderingContext2D & {
  clearRect: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  translate: ReturnType<typeof vi.fn>;
  rotate: ReturnType<typeof vi.fn>;
  scale: ReturnType<typeof vi.fn>;
  setTransform: ReturnType<typeof vi.fn>;
  fillStyle: string;
  font: string;
  globalAlpha: number;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
} {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    fillStyle: "",
    font: "",
    globalAlpha: 1,
    textAlign: "left",
    textBaseline: "alphabetic",
  } as unknown as CanvasRenderingContext2D & {
    clearRect: ReturnType<typeof vi.fn>;
    fillRect: ReturnType<typeof vi.fn>;
    fillText: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    translate: ReturnType<typeof vi.fn>;
    rotate: ReturnType<typeof vi.fn>;
    scale: ReturnType<typeof vi.fn>;
    setTransform: ReturnType<typeof vi.fn>;
    fillStyle: string;
    font: string;
    globalAlpha: number;
    textAlign: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
  };
}
