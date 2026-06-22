import type {
  WebGLEffectCanvasDrawer,
  WebGLEffectCanvasSurfaceHandle,
  WebGLEffectTextLayerHandle,
  WebGLEffectTextureLayerHandle,
  WebGLEffectTextureTransform,
  WebGLEffectVideoLayerHandle,
  WebGLTextGlyph,
  WebGLTextGlyphRenderCommand,
  WebGLTextLayerStyle,
} from "../../effects/effectAuthoring";

import { createObject3DControls } from "./object3DControls";

export type CanvasSurfaceCapabilityOptions = {
  object3D: unknown;
  mesh: unknown;
  material: unknown;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;
  texture: unknown;
  getSize(): { width: number; height: number; devicePixelRatio: number };
  invalidate(): void;
};

export type TextLayerCapabilityOptions = CanvasSurfaceCapabilityOptions & {
  getText(): string;
  getStyle(): WebGLTextLayerStyle;
  getGlyphs(): readonly WebGLTextGlyph[];
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
  invalidate(): void;
};

export function createCanvasSurfaceCapabilityHandle(
  options: CanvasSurfaceCapabilityOptions,
): WebGLEffectCanvasSurfaceHandle {
  return {
    ...createObject3DControls(options.object3D, {
      scaleZ: 1,
      opacity: { kind: "material", material: options.material },
    }),
    canvas: options.canvas,
    context: options.context,
    texture: options.texture,
    mesh: options.mesh,
    material: options.material,
    clear() {
      clearCanvas(options);
      markTextureDirty(options.texture, options.invalidate);
    },
    draw(drawer) {
      drawCanvas(options, drawer);
    },
    invalidate() {
      markTextureDirty(options.texture, options.invalidate);
    },
    getSize() {
      return options.getSize();
    },
  };
}

export function createTextLayerCapabilityHandle(
  options: TextLayerCapabilityOptions,
): WebGLEffectTextLayerHandle {
  return {
    ...createCanvasSurfaceCapabilityHandle(options),
    get text() {
      return options.getText();
    },
    get style() {
      return options.getStyle();
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
}

export function createTextureLayerCapabilityHandle<
  TSource extends HTMLImageElement | HTMLVideoElement,
>(
  options: TextureLayerCapabilityOptions<TSource>,
): WebGLEffectTextureLayerHandle<TSource> {
  return {
    ...createObject3DControls(options.object3D, {
      scaleZ: 1,
      opacity: { kind: "material", material: options.material },
    }),
    source: options.source,
    texture: options.texture,
    mesh: options.mesh,
    material: options.material,
    setTextureTransform(transform) {
      if (options.setTextureTransform) {
        options.setTextureTransform(transform);
        return;
      }

      applyTextureTransform(options.texture, transform);
      markTextureDirty(options.texture, options.invalidate);
    },
    invalidate() {
      markTextureDirty(options.texture, options.invalidate);
    },
  };
}

export function createVideoLayerCapabilityHandle(
  options: TextureLayerCapabilityOptions<HTMLVideoElement>,
): WebGLEffectVideoLayerHandle {
  return {
    ...createTextureLayerCapabilityHandle(options),
    source: options.source,
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
  markTextureDirty(options.texture, options.invalidate);
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
  markTextureDirty(options.texture, options.invalidate);
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

function markTextureDirty(texture: unknown, invalidate: () => void): void {
  if (texture && typeof texture === "object") {
    (texture as { needsUpdate?: boolean }).needsUpdate = true;
  }
  invalidate();
}
