export type ImageSequenceTextureSource =
  | HTMLImageElement
  | HTMLCanvasElement
  | ImageBitmap;

export type ImageSequenceDecodedFrame = {
  readonly close: () => void;
  readonly height: number;
  readonly image: ImageSequenceTextureSource;
  readonly width: number;
};

export type ImageSequenceFrameCache = {
  preloadAround(frame: number): Promise<void>;
  read(frame: number): Promise<ImageSequenceDecodedFrame>;
  dispose(): void;
};

type ImageSequenceFrameCacheOptions = {
  readonly frameCount: number;
  readonly frameSrc: string | ((frame: number) => string);
  readonly preloadBefore: number;
  readonly preloadAfter: number;
  readonly maxCachedFrames: number;
  readonly loadFrame?: (src: string) => Promise<ImageSequenceDecodedFrame>;
};

type FrameCacheEntry =
  | {
      readonly kind: "pending";
      readonly promise: Promise<ImageSequenceDecodedFrame>;
      lastAccess: number;
    }
  | {
      readonly kind: "ready";
      readonly frame: ImageSequenceDecodedFrame;
      lastAccess: number;
    }
  | {
      readonly error: unknown;
      readonly kind: "failed";
      lastAccess: number;
    };

export function formatImageSequenceFrameSrc(
  frameSrc: string | ((frame: number) => string),
  frame: number,
): string {
  if (typeof frameSrc === "function") {
    return frameSrc(frame);
  }

  return frameSrc.replace(/\{frame(?::(0+))?\}/g, (_match, padding: string | undefined) =>
    padding ? String(frame).padStart(padding.length, "0") : String(frame),
  );
}

export function createImageSequenceFrameCache(
  options: ImageSequenceFrameCacheOptions,
): ImageSequenceFrameCache {
  const entries = new Map<number, FrameCacheEntry>();
  const loadFrame = options.loadFrame ?? loadDomImageFrame;
  let disposed = false;
  let accessCounter = 0;

  const touch = (): number => {
    accessCounter += 1;
    return accessCounter;
  };

  const load = (frame: number): Promise<ImageSequenceDecodedFrame> => {
    const entry = entries.get(frame);
    if (entry?.kind === "ready") {
      entry.lastAccess = touch();
      return Promise.resolve(entry.frame);
    }
    if (entry?.kind === "pending") {
      entry.lastAccess = touch();
      return entry.promise;
    }
    if (entry?.kind === "failed") {
      entry.lastAccess = touch();
      return Promise.reject(entry.error);
    }

    const promise = loadFrame(formatImageSequenceFrameSrc(options.frameSrc, frame))
      .then((decodedFrame) => {
        if (disposed) {
          decodedFrame.close();
          return decodedFrame;
        }

        entries.set(frame, {
          kind: "ready",
          frame: decodedFrame,
          lastAccess: touch(),
        });
        pruneReadyFrames(entries, options.maxCachedFrames);
        return decodedFrame;
      })
      .catch((error: unknown) => {
        if (!disposed) {
          entries.set(frame, {
            kind: "failed",
            error,
            lastAccess: touch(),
          });
        }
        throw error;
      });

    entries.set(frame, {
      kind: "pending",
      promise,
      lastAccess: touch(),
    });
    return promise;
  };

  return {
    preloadAround(frame): Promise<void> {
      if (disposed) {
        return Promise.resolve();
      }

      const firstFrame = Math.max(1, frame - options.preloadBefore);
      const lastFrame = Math.min(options.frameCount, frame + options.preloadAfter);
      const loads: Promise<ImageSequenceDecodedFrame>[] = [];

      for (let nextFrame = firstFrame; nextFrame <= lastFrame; nextFrame += 1) {
        loads.push(load(nextFrame));
      }

      return Promise.all(loads).then(() => undefined);
    },
    read(frame): Promise<ImageSequenceDecodedFrame> {
      if (disposed) {
        return Promise.reject(new Error("Image sequence frame cache is disposed."));
      }

      return load(clampFrame(frame, options.frameCount));
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      for (const entry of entries.values()) {
        if (entry.kind === "ready") {
          entry.frame.close();
        }
      }
      entries.clear();
    },
  };
}

function pruneReadyFrames(
  entries: Map<number, FrameCacheEntry>,
  maxCachedFrames: number,
): void {
  const readyEntries = [...entries.entries()]
    .filter((entry): entry is [number, Extract<FrameCacheEntry, { kind: "ready" }>] => {
      return entry[1].kind === "ready";
    })
    .sort((left, right) => left[1].lastAccess - right[1].lastAccess);

  while (readyEntries.length > maxCachedFrames) {
    const nextEntry = readyEntries.shift();
    if (!nextEntry) {
      return;
    }

    const [frame, entry] = nextEntry;
    entry.frame.close();
    entries.delete(frame);
  }
}

function clampFrame(frame: number, frameCount: number): number {
  return Math.min(frameCount, Math.max(1, frame));
}

function loadDomImageFrame(src: string): Promise<ImageSequenceDecodedFrame> {
  const image = new Image();
  image.decoding = "async";
  image.src = src;

  const decode =
    typeof image.decode === "function"
      ? image.decode()
      : new Promise<void>((resolve, reject) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => reject(new Error(`Image frame failed: ${src}`)), {
            once: true,
          });
        });

  return decode.then(() => ({
    close() {
      return;
    },
    height: image.naturalHeight || image.height || 1,
    image,
    width: image.naturalWidth || image.width || 1,
  }));
}
