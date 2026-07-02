import type {
  WebGLEffectCanvasDrawer,
  WebGLEffectCanvasSurfaceHandle,
  WebGLEffectContentBoxShaderInput,
  WebGLEffectMediaShaderInputs,
  WebGLEffectMaterialLayerHost,
  WebGLEffectObjectFitShaderInput,
  WebGLEffectSourceTextureShaderInput,
  WebGLEffectTextLayerHandle,
  WebGLEffectTextureLayerHandle,
  WebGLEffectTextureTransform,
  WebGLEffectVideoLayerHandle,
  WebGLTextGlyph,
  WebGLTextGlyphRenderCommand,
  WebGLTextLayerStyle,
} from "../../effects/effectAuthoring";
import type { WebGLEffectMaterialFacade } from "../../effects/effectMaterial";
import { Texture } from "three/src/textures/Texture.js";

import { createManagedMaterialFacade } from "./managedMaterialControls";
import { createMaterialLayer } from "./materialLayer";
import { createObject3DControls } from "./object3DControls";
import type { TextureUploadDirtyReason } from "./textureUploadState";

const managedMaterialFacades = new WeakMap<object, WebGLEffectMaterialFacade>();

export type CanvasSurfaceCapabilityOptions = {
  object3D: unknown;
  mesh: unknown;
  material: unknown;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;
  texture: unknown;
  getSize(): { width: number; height: number; devicePixelRatio: number };
  getShaderInputs?(): WebGLEffectCanvasSurfaceHandle["shaderInputs"];
  markTextureDirty?(reason: TextureUploadDirtyReason): void;
  invalidate(): void;
};

export type TextLayerCapabilityOptions = Omit<
  CanvasSurfaceCapabilityOptions,
  "getShaderInputs"
> & {
  getText(): string;
  getStyle(): WebGLTextLayerStyle;
  getGlyphs(): readonly WebGLTextGlyph[];
  getShaderInputs?(): WebGLEffectTextLayerHandle["shaderInputs"];
  setText(text: string): void;
  setGlyphs?(
    transform: (
      glyphs: readonly WebGLTextGlyph[],
    ) => readonly WebGLTextGlyphRenderCommand[],
  ): void;
};

export type TextureLayerCapabilityOptions<
  TSource extends HTMLImageElement | HTMLVideoElement,
> = {
  object3D: unknown;
  mesh: unknown;
  material: unknown;
  texture: unknown;
  source: TSource;
  setTextureTransform?(transform: WebGLEffectTextureTransform): void;
  getShaderInputs?(): WebGLEffectMediaShaderInputs;
  markTextureDirty?(reason: TextureUploadDirtyReason): void;
  invalidate(): void;
};

export function createCanvasSurfaceCapabilityHandle(
  options: CanvasSurfaceCapabilityOptions,
): WebGLEffectCanvasSurfaceHandle {
  const layerHost = createSourceMaterialLayerHost(options);
  const handle: WebGLEffectCanvasSurfaceHandle = {
    ...createObject3DControls(options.object3D, {
      scaleZ: 1,
      opacity: { kind: "material", material: options.material },
    }),
    canvas: options.canvas,
    context: options.context,
    get shaderInputs() {
      return (
        options.getShaderInputs?.() ??
        createSurfaceShaderInputs(options.getSize(), options.texture)
      );
    },
    createMaterialLayer: layerHost.createMaterialLayer,
    clear() {
      clearCanvas(options);
      markTextureDirty(options, "effect-invalidate");
    },
    draw(drawer) {
      drawCanvas(options, drawer);
    },
    invalidate() {
      markTextureDirty(options, "effect-invalidate");
    },
    getSize() {
      return options.getSize();
    },
  };
  rememberManagedMaterialFacade(
    handle,
    createManagedMaterialFacade({
      material: options.material,
      layerHost,
    }),
  );
  return handle;
}

export function createTextLayerCapabilityHandle(
  options: TextLayerCapabilityOptions,
): WebGLEffectTextLayerHandle {
  const surfaceHandle = createCanvasSurfaceCapabilityHandle(options);
  const handle: WebGLEffectTextLayerHandle = {
    ...surfaceHandle,
    get text() {
      return options.getText();
    },
    get style() {
      return options.getStyle();
    },
    get shaderInputs() {
      return (
        options.getShaderInputs?.() ?? {
          ...createSurfaceShaderInputs(options.getSize(), options.texture),
          text: options.getText(),
          style: options.getStyle(),
          glyphs: options.getGlyphs(),
        }
      );
    },
    getGlyphs() {
      return options.getGlyphs();
    },
    setText(text) {
      options.setText(text);
    },
    setGlyphs(transform) {
      if (options.setGlyphs) {
        options.setGlyphs(transform);
        return;
      }

      drawTextGlyphCommands(options, transform(options.getGlyphs()));
    },
  };
  const materialFacade = readManagedMaterialFacade(surfaceHandle);
  if (materialFacade) {
    rememberManagedMaterialFacade(handle, materialFacade);
  }
  return handle;
}

export function createTextureLayerCapabilityHandle<
  TSource extends HTMLImageElement | HTMLVideoElement,
>(
  options: TextureLayerCapabilityOptions<TSource>,
): WebGLEffectTextureLayerHandle<TSource> {
  const layerHost = createSourceMaterialLayerHost(options);
  const handle: WebGLEffectTextureLayerHandle<TSource> = {
    ...createObject3DControls(options.object3D, {
      scaleZ: 1,
      opacity: { kind: "material", material: options.material },
    }),
    source: options.source,
    get shaderInputs() {
      return options.getShaderInputs?.() ?? createMediaShaderInputs(options);
    },
    createMaterialLayer: layerHost.createMaterialLayer,
    setTextureTransform(transform) {
      if (options.setTextureTransform) {
        options.setTextureTransform(transform);
        return;
      }

      applyTextureTransform(options.texture, transform);
      markTextureDirty(options, "texture-transform");
    },
    invalidate() {
      markTextureDirty(options, "effect-invalidate");
    },
  };
  rememberManagedMaterialFacade(
    handle,
    createManagedMaterialFacade({
      material: options.material,
      layerHost,
    }),
  );
  return handle;
}

export function createVideoLayerCapabilityHandle(
  options: TextureLayerCapabilityOptions<HTMLVideoElement>,
): WebGLEffectVideoLayerHandle {
  const textureHandle = createTextureLayerCapabilityHandle(options);

  const handle: WebGLEffectVideoLayerHandle = {
    ...textureHandle,
    source: options.source,
    get shaderInputs() {
      return textureHandle.shaderInputs;
    },
    play() {
      return options.source.play();
    },
    pause() {
      options.source.pause();
    },
    setMuted(muted) {
      options.source.muted = muted;
    },
    setPlaybackRate(rate) {
      options.source.playbackRate = rate;
    },
  };
  const materialFacade = readManagedMaterialFacade(textureHandle);
  if (materialFacade) {
    rememberManagedMaterialFacade(handle, materialFacade);
  }
  return handle;
}

export function readManagedMaterialFacade(
  handle: unknown,
): WebGLEffectMaterialFacade | undefined {
  if (!handle || typeof handle !== "object") {
    return undefined;
  }

  return managedMaterialFacades.get(handle);
}

function drawCanvas(
  options: CanvasSurfaceCapabilityOptions,
  drawer: WebGLEffectCanvasDrawer,
): void {
  const context = options.context;
  if (!context) {
    return;
  }

  const size = options.getSize();
  const dpr = Math.min(Math.max(1, size.devicePixelRatio), 1.5);
  context.setTransform?.(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, options.canvas.width, options.canvas.height);
  context.scale?.(dpr, dpr);
  drawer({
    canvas: options.canvas,
    context,
    width: size.width,
    height: size.height,
    devicePixelRatio: size.devicePixelRatio,
  });
  markTextureDirty(options, "effect-draw");
}

function clearCanvas(options: CanvasSurfaceCapabilityOptions): void {
  const context = options.context;
  if (!context) {
    return;
  }

  const size = options.getSize();
  const dpr = Math.min(Math.max(1, size.devicePixelRatio), 1.5);
  context.setTransform?.(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, options.canvas.width, options.canvas.height);
  context.scale?.(dpr, dpr);
}

export function drawTextGlyphCommands(
  options: TextLayerCapabilityOptions,
  commands: readonly WebGLTextGlyphRenderCommand[],
): void {
  const context = options.context;
  if (!context) {
    return;
  }

  const style = options.getStyle();
  const size = options.getSize();
  const dpr = Math.min(Math.max(1, size.devicePixelRatio), 1.5);
  context.setTransform?.(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, options.canvas.width, options.canvas.height);
  context.scale?.(dpr, dpr);
  context.font = style.font;
  context.textAlign = "left";
  context.textBaseline = "top";
  const glyphsByIndex = new Map(
    options.getGlyphs().map((glyph) => [glyph.index, glyph] as const),
  );

  for (const command of commands) {
    const glyph = glyphsByIndex.get(command.index);
    if (!glyph) {
      continue;
    }

    const char = command.char ?? glyph.char;
    const x = command.x ?? glyph.x;
    const y = command.y ?? glyph.y;
    const scaleX = command.scaleX ?? 1;
    const scaleY = command.scaleY ?? 1;

    context.save?.();
    context.globalAlpha = command.opacity ?? 1;
    context.fillStyle = command.color ?? style.color;
    context.translate?.(x, y);
    if (command.rotation) {
      context.rotate?.(command.rotation);
    }
    context.scale?.(scaleX, scaleY);
    context.fillText(char, 0, 0);
    context.restore?.();
  }

  context.globalAlpha = 1;
  markTextureDirty(options, "glyph-commands");
}

function applyTextureTransform(
  texture: unknown,
  transform: WebGLEffectTextureTransform,
): void {
  setVector2(
    (texture as { repeat?: unknown } | undefined)?.repeat,
    transform.repeatX ?? 1,
    transform.repeatY ?? 1,
  );
  setVector2(
    (texture as { offset?: unknown } | undefined)?.offset,
    transform.offsetX ?? 0,
    transform.offsetY ?? 0,
  );
}

function setVector2(vector: unknown, x: number, y: number): void {
  if (vector && typeof vector === "object" && "set" in vector) {
    (vector as { set: (x: number, y: number) => void }).set(x, y);
  }
}

function markTextureDirty(
  options: {
    texture: unknown;
    markTextureDirty?(reason: TextureUploadDirtyReason): void;
    invalidate(): void;
  },
  reason: TextureUploadDirtyReason,
): void {
  if (options.markTextureDirty) {
    options.markTextureDirty(reason);
  } else if (options.texture && typeof options.texture === "object") {
    (options.texture as { needsUpdate?: boolean }).needsUpdate = true;
  }
  options.invalidate();
}

function createMaterialTarget(
  mesh: unknown,
  material: unknown,
): { material: unknown } {
  if (mesh && typeof mesh === "object" && "material" in mesh) {
    return mesh as { material: unknown };
  }

  return { material };
}

function createSourceMaterialLayerHost(
  options: {
    mesh: unknown;
    material: unknown;
    texture: unknown;
  },
): WebGLEffectMaterialLayerHost {
  return {
    createMaterialLayer(layerOptions) {
      return createMaterialLayer({
        ...layerOptions,
        target: createMaterialTarget(options.mesh, options.material),
        sourceTexture: readSourceTexture(options.texture),
      });
    },
  };
}

function rememberManagedMaterialFacade(
  handle: object,
  material: WebGLEffectMaterialFacade,
): void {
  managedMaterialFacades.set(handle, material);
}

function readSourceTexture(texture: unknown): Texture | undefined {
  return texture instanceof Texture ? texture : undefined;
}

function createSurfaceShaderInputs(
  size: { width: number; height: number; devicePixelRatio: number },
  texture: unknown,
): WebGLEffectCanvasSurfaceHandle["shaderInputs"] {
  return {
    size,
    contentBox: createContentBox(size.width, size.height),
    sourceTexture: createSourceTextureShaderInput(
      readSourceTexture(texture) !== undefined,
      size.width,
      size.height,
      size.devicePixelRatio,
    ),
  };
}

function createMediaShaderInputs<
  TSource extends HTMLImageElement | HTMLVideoElement,
>(
  options: TextureLayerCapabilityOptions<TSource>,
): WebGLEffectMediaShaderInputs {
  const naturalSize = readNaturalSize(options.source);
  const style = options.source.style;

  return {
    naturalSize,
    contentBox: createContentBox(naturalSize.width, naturalSize.height),
    uvTransform: createObjectFitShaderInput(),
    objectFit: style.objectFit || "fill",
    objectPosition: style.objectPosition || "50% 50%",
    sourceTexture: createSourceTextureShaderInput(
      readSourceTexture(options.texture) !== undefined,
      naturalSize.width,
      naturalSize.height,
    ),
  };
}

function createContentBox(
  width: number,
  height: number,
): WebGLEffectContentBoxShaderInput {
  return { x: 0, y: 0, width, height };
}

function createObjectFitShaderInput(
  transform: WebGLEffectTextureTransform = {},
): WebGLEffectObjectFitShaderInput {
  return {
    repeatX: transform.repeatX ?? 1,
    repeatY: transform.repeatY ?? 1,
    offsetX: transform.offsetX ?? 0,
    offsetY: transform.offsetY ?? 0,
  };
}

function createSourceTextureShaderInput(
  available: boolean,
  width: number,
  height: number,
  devicePixelRatio?: number,
): WebGLEffectSourceTextureShaderInput {
  return {
    available,
    uniform: "source-texture",
    width,
    height,
    ...(devicePixelRatio === undefined ? {} : { devicePixelRatio }),
  };
}

function readNaturalSize(source: HTMLImageElement | HTMLVideoElement): {
  width: number;
  height: number;
} {
  if ("naturalWidth" in source && source.naturalWidth && source.naturalHeight) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }

  if ("videoWidth" in source && source.videoWidth && source.videoHeight) {
    return { width: source.videoWidth, height: source.videoHeight };
  }

  return {
    width: source.width || source.clientWidth || 1,
    height: source.height || source.clientHeight || 1,
  };
}
