import { describe, expect, test, vi } from "vitest";

import {
  createImageSequenceFrameCache,
  formatImageSequenceFrameSrc,
} from "./imageSequenceFrameCache";

describe("formatImageSequenceFrameSrc", () => {
  test("formats padded and unpadded one-based frame numbers", () => {
    expect(formatImageSequenceFrameSrc("/frames/frame_{frame:0000}.webp", 12)).toBe(
      "/frames/frame_0012.webp",
    );
    expect(formatImageSequenceFrameSrc("/frames/{frame}.webp", 12)).toBe(
      "/frames/12.webp",
    );
  });
});

describe("createImageSequenceFrameCache", () => {
  test("loads the selected frame and preloads a bounded window", async () => {
    const loaded: string[] = [];
    const cache = createImageSequenceFrameCache({
      frameCount: 10,
      frameSrc: "/frames/frame_{frame:0000}.webp",
      preloadBefore: 1,
      preloadAfter: 2,
      maxCachedFrames: 4,
      loadFrame(src) {
        loaded.push(src);
        return Promise.resolve({
          close: vi.fn(),
          height: 900,
          image: document.createElement("img"),
          width: 1600,
        });
      },
    });

    await cache.preloadAround(5);

    expect(loaded).toEqual([
      "/frames/frame_0004.webp",
      "/frames/frame_0005.webp",
      "/frames/frame_0006.webp",
      "/frames/frame_0007.webp",
    ]);
    await expect(cache.read(5)).resolves.toMatchObject({ width: 1600, height: 900 });
  });

  test("prunes least recently used ready frames and closes them", async () => {
    const closed: number[] = [];
    const cache = createImageSequenceFrameCache({
      frameCount: 6,
      frameSrc(frame) {
        return `/frames/${frame}.webp`;
      },
      preloadBefore: 0,
      preloadAfter: 0,
      maxCachedFrames: 2,
      loadFrame(src) {
        const frame = Number(src.match(/\/(\d+)\.webp$/)?.[1] ?? 0);
        return Promise.resolve({
          close() {
            closed.push(frame);
          },
          height: 90,
          image: document.createElement("img"),
          width: 160,
        });
      },
    });

    await cache.read(1);
    await cache.read(2);
    await cache.read(3);

    expect(closed).toEqual([1]);

    cache.dispose();

    expect(closed).toEqual([1, 2, 3]);
  });
});
