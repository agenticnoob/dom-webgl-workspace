import { createElement, useEffect, useRef } from "react";
import { useScrollEffectProgressStore } from "@project/dom-webgl-scroll-adapters/react";

type ImageSequenceScrubProps = {
  readonly className?: string;
  readonly frameCount: number;
  readonly framePathPrefix: string;
  readonly progressKey: string;
};

type DecodedFrame = {
  readonly close: () => void;
  readonly height: number;
  readonly image: CanvasImageSource;
  readonly width: number;
};

type FrameCacheEntry =
  | {
      readonly kind: "pending";
      readonly lastAccess: number;
      readonly promise: Promise<void>;
    }
  | {
      readonly frame: DecodedFrame;
      readonly kind: "ready";
      readonly lastAccess: number;
    }
  | {
      readonly kind: "failed";
      readonly lastAccess: number;
    };

type CanvasSize = {
  readonly height: number;
  readonly width: number;
};

const preloadBefore = 6;
const preloadAfter = 18;
const maxReadyFrames = 72;
const maxCanvasPixelRatio = 1.25;

export function ImageSequenceScrub({
  className,
  frameCount,
  framePathPrefix,
  progressKey,
}: ImageSequenceScrubProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const store = useScrollEffectProgressStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas ? getCanvasContext(canvas) : null;

    if (!canvas || !context || frameCount <= 0) {
      return;
    }

    let disposed = false;
    let frameHandle = 0;
    let accessCounter = 0;
    let lastDrawnIndex = -1;
    const cache = new Map<number, FrameCacheEntry>();

    const resizeObserver = createResizeObserver(canvas, () => {
      lastDrawnIndex = -1;
      resizeCanvas(canvas);
    });

    resizeCanvas(canvas);

    const tick = () => {
      const progress = clampProgress(store.source.get(progressKey));
      const frameIndex = Math.round(progress * (frameCount - 1));
      preloadWindow(cache, framePathPrefix, frameIndex, frameCount, () => ++accessCounter);
      const entry = cache.get(frameIndex);

      if (entry?.kind === "ready" && frameIndex !== lastDrawnIndex) {
        drawFrame(context, canvas, entry.frame);
        lastDrawnIndex = frameIndex;
      }

      pruneReadyFrames(cache);

      if (!disposed) {
        frameHandle = requestAnimationFrame(tick);
      }
    };

    frameHandle = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameHandle);
      resizeObserver?.disconnect();
      for (const entry of cache.values()) {
        if (entry.kind === "ready") {
          entry.frame.close();
        }
      }
      cache.clear();
    };
  }, [frameCount, framePathPrefix, progressKey, store]);

  return createElement("canvas", {
    "aria-hidden": true,
    className,
    ref: canvasRef,
  });
}

function createResizeObserver(
  element: HTMLElement,
  onResize: () => void,
): ResizeObserver | null {
  if (!("ResizeObserver" in window)) {
    return null;
  }

  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(element);
  return resizeObserver;
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}

function preloadWindow(
  cache: Map<number, FrameCacheEntry>,
  framePathPrefix: string,
  frameIndex: number,
  frameCount: number,
  nextAccess: () => number,
): void {
  const firstFrame = Math.max(0, frameIndex - preloadBefore);
  const lastFrame = Math.min(frameCount - 1, frameIndex + preloadAfter);

  for (let index = firstFrame; index <= lastFrame; index += 1) {
    const current = cache.get(index);
    const lastAccess = nextAccess();

    if (current) {
      cache.set(index, touchEntry(current, lastAccess));
      continue;
    }

    const promise = loadFrame(buildFrameSrc(framePathPrefix, index))
      .then((frame) => {
        cache.set(index, { frame, kind: "ready", lastAccess: nextAccess() });
      })
      .catch(() => {
        cache.set(index, { kind: "failed", lastAccess: nextAccess() });
      });

    cache.set(index, { kind: "pending", lastAccess, promise });
  }
}

function touchEntry(entry: FrameCacheEntry, lastAccess: number): FrameCacheEntry {
  switch (entry.kind) {
    case "failed":
      return { kind: "failed", lastAccess };
    case "pending":
      return { kind: "pending", lastAccess, promise: entry.promise };
    case "ready":
      return { frame: entry.frame, kind: "ready", lastAccess };
  }
}

function pruneReadyFrames(cache: Map<number, FrameCacheEntry>): void {
  const readyEntries = [...cache.entries()]
    .filter((entry): entry is [number, Extract<FrameCacheEntry, { kind: "ready" }>] => {
      return entry[1].kind === "ready";
    })
    .sort((left, right) => left[1].lastAccess - right[1].lastAccess);

  const pruneCount = readyEntries.length - maxReadyFrames;

  for (let index = 0; index < pruneCount; index += 1) {
    const [frameIndex, entry] = readyEntries[index];
    entry.frame.close();
    cache.delete(frameIndex);
  }
}

function resizeCanvas(canvas: HTMLCanvasElement): CanvasSize {
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, maxCanvasPixelRatio);
  const width = Math.max(1, Math.round(rect.width * pixelRatio));
  const height = Math.max(1, Math.round(rect.height * pixelRatio));

  if (canvas.width !== width) {
    canvas.width = width;
  }

  if (canvas.height !== height) {
    canvas.height = height;
  }

  return { height, width };
}

function drawFrame(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  frame: DecodedFrame,
): void {
  const size = resizeCanvas(canvas);
  const scale = Math.max(size.width / frame.width, size.height / frame.height);
  const width = frame.width * scale;
  const height = frame.height * scale;
  const x = (size.width - width) / 2;
  const y = (size.height - height) / 2;

  context.clearRect(0, 0, size.width, size.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(frame.image, x, y, width, height);
}

function buildFrameSrc(framePathPrefix: string, index: number): string {
  return `${framePathPrefix}/frame_${String(index + 1).padStart(4, "0")}.webp`;
}

function loadFrame(src: string): Promise<DecodedFrame> {
  if ("createImageBitmap" in window) {
    return fetch(src)
      .then((response) => response.blob())
      .then((blob) => createImageBitmap(blob))
      .then((bitmap) => ({
        close: () => bitmap.close(),
        height: bitmap.height,
        image: bitmap,
        width: bitmap.width,
      }));
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      resolve({
        close: () => {
          return;
        },
        height: image.naturalHeight,
        image,
        width: image.naturalWidth,
      });
    };
    image.onerror = () => reject(new Error(`Failed to load image sequence frame: ${src}`));
    image.src = src;
  });
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}
