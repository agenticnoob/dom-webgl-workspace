import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { ShaderMaterial } from "three/src/materials/ShaderMaterial.js";
import { Texture } from "three/src/textures/Texture.js";
import { describe, expect, test, vi } from "vitest";

import {
  createCanvasSurfaceCapabilityHandle,
  createTextLayerCapabilityHandle,
  createTextureLayerCapabilityHandle,
  createVideoLayerCapabilityHandle,
  readManagedMaterialFacade,
} from "../../../../src/lib/render/renderables/sourceCapabilityHandles";

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

    expect("texture" in handle).toBe(false);
    expect("mesh" in handle).toBe(false);
    expect("material" in handle).toBe(false);

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
    expect(handle.shaderInputs).toMatchObject({
      size: { width: 120, height: 40, devicePixelRatio: 1.5 },
      contentBox: { x: 0, y: 0, width: 120, height: 40 },
      sourceTexture: {
        available: false,
        uniform: "source-texture",
        width: 120,
        height: 40,
        devicePixelRatio: 1.5,
      },
    });
  });

  test("canvas surface material layer binds source texture and restores on dispose", () => {
    const context = createCanvasContextStub();
    const material = new MeshBasicMaterial();
    const mesh = { material };
    const texture = new Texture();
    const handle = createCanvasSurfaceCapabilityHandle({
      object3D: createObject3D(),
      mesh,
      material,
      canvas: createCanvasStub(context),
      context,
      texture,
      getSize: () => ({ width: 120, height: 40, devicePixelRatio: 1 }),
      invalidate: vi.fn(),
    });

    const layer = handle.createMaterialLayer({
      key: "surface.layer",
      sourceTextureUniform: "sourceMap",
      program: {
        fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
      },
    });

    expect(mesh.material).toBeInstanceOf(ShaderMaterial);
    expect(readShaderMaterial(mesh.material).uniforms.sourceMap?.value).toBe(texture);

    layer.dispose();
    layer.dispose();

    expect(mesh.material).toBe(material);
  });

  test("canvas surface exposes internal managed material facade without raw material", () => {
    const context = createCanvasContextStub();
    const material = {
      color: { set: vi.fn(), getHexString: () => "ffffff" },
      emissive: { set: vi.fn(), getHexString: () => "000000" },
      emissiveIntensity: 1,
      opacity: 1,
      metalness: 0,
      roughness: 1,
    };
    const handle = createCanvasSurfaceCapabilityHandle({
      object3D: createObject3D(),
      mesh: { material },
      material,
      canvas: createCanvasStub(context),
      context,
      texture: new Texture(),
      getSize: () => ({ width: 120, height: 40, devicePixelRatio: 1 }),
      invalidate: vi.fn(),
    });
    const facade = readManagedMaterialFacade(handle);

    facade?.color.set("#38bdf8");
    if (facade) {
      facade.opacity = 0.5;
      facade.metalness = 0.25;
      facade.roughness = 0.75;
    }

    expect(facade).toBeDefined();
    expect(material.color.set).toHaveBeenCalledWith("#38bdf8");
    expect(material.opacity).toBe(0.5);
    expect(material.transparent).toBe(true);
    expect(material.metalness).toBe(0.25);
    expect(material.roughness).toBe(0.75);
    expect("rawMaterial" in handle).toBe(false);
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
    expect(handle.shaderInputs).toMatchObject({
      text: "WebGL override",
      size: { width: 200, height: 80, devicePixelRatio: 1 },
      glyphs: [
        {
          index: 0,
          char: "V",
          x: 10,
          y: 20,
          width: 8,
          height: 20,
        },
      ],
    });
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

  test("text layer glyph commands lookup scrambled glyph indexes once and preserve command order", () => {
    const context = createCanvasContextStub();
    const canvas = createCanvasStub(context);
    const getGlyphs = vi.fn(() => [
      {
        index: 2,
        char: "C",
        line: 0,
        x: 30,
        y: 10,
        width: 10,
        height: 20,
        baseline: 30,
      },
      {
        index: 0,
        char: "A",
        line: 0,
        x: 10,
        y: 10,
        width: 10,
        height: 20,
        baseline: 30,
      },
    ]);
    const handle = createTextLayerCapabilityHandle({
      object3D: createObject3D(),
      mesh: createObject3D(),
      material: createMaterial(),
      canvas,
      context,
      texture: { needsUpdate: false },
      getSize: () => ({ width: 200, height: 80, devicePixelRatio: 1 }),
      getText: () => "AC",
      getStyle: () => ({
        font: "20px sans-serif",
        lineHeight: 24,
        letterSpacing: 0,
        wordSpacing: 0,
        textAlign: "left",
        color: "#111111",
      }),
      getGlyphs,
      setText: vi.fn(),
      invalidate: vi.fn(),
    });

    handle.setGlyphs(() => [
      { index: 2, char: "Z" },
      { index: 0, char: "X" },
    ]);

    expect(getGlyphs).toHaveBeenCalledTimes(2);
    expect(context.translate).toHaveBeenNthCalledWith(1, 30, 10);
    expect(context.translate).toHaveBeenNthCalledWith(2, 10, 10);
    expect(context.fillText).toHaveBeenNthCalledWith(1, "Z", 0, 0);
    expect(context.fillText).toHaveBeenNthCalledWith(2, "X", 0, 0);
  });

  test("texture layer handle updates texture transform", () => {
    const texture = {
      repeat: { set: vi.fn() },
      offset: { set: vi.fn() },
      needsUpdate: false,
    };
    const invalidate = vi.fn();
    const markTextureDirty = vi.fn();
    const image = document.createElement("img");
    const handle = createTextureLayerCapabilityHandle({
      object3D: createObject3D(),
      mesh: createObject3D(),
      material: createMaterial(),
      texture,
      source: image,
      invalidate,
      markTextureDirty,
    });

    expect("texture" in handle).toBe(false);
    expect("mesh" in handle).toBe(false);
    expect("material" in handle).toBe(false);

    handle.setTextureTransform({
      repeatX: 0.5,
      repeatY: 0.75,
      offsetX: 0.1,
      offsetY: 0.2,
    });

    expect(texture.repeat.set).toHaveBeenCalledWith(0.5, 0.75);
    expect(texture.offset.set).toHaveBeenCalledWith(0.1, 0.2);
    expect(markTextureDirty).toHaveBeenCalledWith("texture-transform");
    expect(texture.needsUpdate).toBe(false);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(handle.shaderInputs).toMatchObject({
      naturalSize: { width: 1, height: 1 },
      contentBox: { x: 0, y: 0, width: 1, height: 1 },
      uvTransform: {
        repeatX: 1,
        repeatY: 1,
        offsetX: 0,
        offsetY: 0,
      },
      sourceTexture: {
        available: false,
        uniform: "source-texture",
      },
    });
  });

  test("texture layer material layer preserves texture transform controls", () => {
    const texture = new Texture();
    const material = new MeshBasicMaterial({ map: texture });
    const mesh = { material };
    const image = document.createElement("img");
    const invalidate = vi.fn();
    const handle = createTextureLayerCapabilityHandle({
      object3D: createObject3D(),
      mesh,
      material,
      texture,
      source: image,
      invalidate,
    });

    const layer = handle.createMaterialLayer({
      key: "image.layer",
      sourceTextureUniform: "sourceMap",
      program: {
        fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
      },
    });

    handle.setTextureTransform({ repeatX: 0.5, repeatY: 0.25 });

    expect(mesh.material).toBeInstanceOf(ShaderMaterial);
    expect(readShaderMaterial(mesh.material).uniforms.sourceMap?.value).toBe(texture);
    expect(texture.repeat).toMatchObject({ x: 0.5, y: 0.25 });
    expect(invalidate).toHaveBeenCalledTimes(1);

    layer.clear();

    expect(mesh.material).toBe(material);
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

function readShaderMaterial(material: unknown): ShaderMaterial {
  if (!(material instanceof ShaderMaterial)) {
    throw new Error("Expected ShaderMaterial.");
  }

  return material;
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
