/**
 * A scroll-scrubbed image sequence that keeps encoded frames in memory and
 * decodes only a window around the current frame into flipped `ImageBitmap`s.
 *
 * Re-uploading `HTMLImageElement` frames costs tens to hundreds of
 * milliseconds per frame on integrated GPUs; pre-flipped bitmaps upload within
 * the frame budget. Decoding every frame would hold hundreds of megabytes, so
 * bitmaps outside the window are closed. Use the bitmaps with
 * `texture.flipY = false`.
 */
export type FrameSequence = {
  readonly count: number;
  /** Resolves once the first frame is decoded. */
  readonly ready: Promise<void>;
  /**
   * The decoded frame closest to `index`, if any, and requests the frames
   * around it. The returned bitmap stays open until another one is returned.
   */
  frameNear(index: number): ImageBitmap | undefined;
  dispose(): void;
};

export type FrameSequenceOptions = {
  readonly urls: readonly string[];
  /** Decoded size; match the size the frames are drawn at. */
  readonly width: number;
  readonly height: number;
  /** Frames decoded on each side of the requested one. */
  readonly radius?: number;
  readonly fetchConcurrency?: number;
  readonly fetchBlob?: (url: string) => Promise<Blob>;
  readonly decode?: (
    blob: Blob,
    width: number,
    height: number,
  ) => Promise<ImageBitmap>;
};

const decodeConcurrency = 2;

export function createFrameSequence({
  urls,
  width,
  height,
  radius = 4,
  fetchConcurrency = 6,
  fetchBlob = (url) => fetch(url).then((response) => response.blob()),
  decode = (blob, decodeWidth, decodeHeight) =>
    createImageBitmap(blob, {
      imageOrientation: "flipY",
      resizeWidth: decodeWidth,
      resizeHeight: decodeHeight,
      resizeQuality: "high",
    }),
}: FrameSequenceOptions): FrameSequence {
  const count = urls.length;
  const blobs = new Array<Blob | undefined>(count);
  const fetching = new Set<number>();
  const bitmaps = new Map<number, ImageBitmap>();
  const decoding = new Set<number>();
  // Frames that failed to decode are not retried.
  const failed = new Set<number>();
  // Bitmaps further than this from the requested frame are closed.
  const keep = radius * 2;
  let center = 0;
  let shown: ImageBitmap | undefined;
  let disposed = false;
  let markReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });

  // Fetch the unfetched frame closest to the requested one.
  const nextFetch = () => {
    let best: number | undefined;
    for (let index = 0; index < count; index += 1) {
      if (blobs[index] || fetching.has(index)) continue;
      if (best === undefined || Math.abs(index - center) < Math.abs(best - center))
        best = index;
    }
    return best;
  };

  const fetchNext = (): Promise<void> => {
    const index = disposed ? undefined : nextFetch();
    if (index === undefined) return Promise.resolve();
    fetching.add(index);
    return fetchBlob(urls[index])
      .then(
        (blob) => {
          blobs[index] = blob;
          requestDecodes();
        },
        () => undefined,
      )
      .then(fetchNext);
  };

  const requestDecodes = () => {
    if (disposed) return;
    for (let offset = 0; offset <= radius; offset += 1) {
      for (const index of offset === 0 ? [center] : [center - offset, center + offset]) {
        if (decoding.size >= decodeConcurrency) return;
        const blob = blobs[index];
        if (!blob || bitmaps.has(index) || decoding.has(index) || failed.has(index))
          continue;
        decoding.add(index);
        decode(blob, width, height).then(
          (bitmap) => {
            decoding.delete(index);
            if (disposed || Math.abs(index - center) > keep) {
              bitmap.close();
            } else {
              bitmaps.set(index, bitmap);
              markReady();
            }
            requestDecodes();
          },
          () => {
            decoding.delete(index);
            failed.add(index);
            requestDecodes();
          },
        );
      }
    }
  };

  const evict = () => {
    for (const [index, bitmap] of bitmaps) {
      if (Math.abs(index - center) <= keep || bitmap === shown) continue;
      bitmap.close();
      bitmaps.delete(index);
    }
  };

  for (let worker = 0; worker < Math.min(fetchConcurrency, count); worker += 1)
    void fetchNext();

  return {
    count,
    ready,
    frameNear(index) {
      const requested = Math.min(count - 1, Math.max(0, Math.round(index)));
      if (requested !== center) {
        center = requested;
        evict();
      }
      requestDecodes();
      let nearest: ImageBitmap | undefined;
      for (let offset = 0; offset < count && !nearest; offset += 1) {
        nearest = bitmaps.get(requested - offset) ?? bitmaps.get(requested + offset);
      }
      // The previous `shown` stays in `bitmaps`; the next eviction closes it.
      if (nearest) shown = nearest;
      return shown;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const bitmap of bitmaps.values()) bitmap.close();
      bitmaps.clear();
      shown = undefined;
    },
  };
}
