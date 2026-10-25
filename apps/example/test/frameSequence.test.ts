import { describe, expect, test } from "vitest";

import { createFrameSequence } from "../src/frameSequence";

type Deferred<T> = {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
};

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function harness(count: number, radius = 1) {
  const fetches = new Map<string, Deferred<Blob>>();
  const decodes: Array<{ blob: Blob; result: Deferred<ImageBitmap> }> = [];
  const closed: ImageBitmap[] = [];
  const urls = Array.from({ length: count }, (_, index) => `frame-${index}`);
  const bitmapFor = (blob: Blob): ImageBitmap => ({
    width: 8,
    height: 8,
    close: () => closed.push(bitmapByBlob.get(blob)!),
  });
  const bitmapByBlob = new Map<Blob, ImageBitmap>();
  const sequence = createFrameSequence({
    urls,
    width: 8,
    height: 8,
    radius,
    fetchConcurrency: count,
    fetchBlob: (url) => {
      const result = deferred<Blob>();
      fetches.set(url, result);
      return result.promise;
    },
    decode: (blob) => {
      const result = deferred<ImageBitmap>();
      decodes.push({ blob, result });
      return result.promise;
    },
  });
  const blobs = urls.map((url) => new Blob([url]));
  const fetchAll = async () => {
    urls.forEach((url, index) => fetches.get(url)?.resolve(blobs[index]));
    await flush();
  };
  // Resolves every pending decode, in request order.
  const decodeAll = async () => {
    while (decodes.length > 0) {
      const { blob, result } = decodes.shift()!;
      const bitmap = bitmapFor(blob);
      bitmapByBlob.set(blob, bitmap);
      result.resolve(bitmap);
      await flush();
    }
  };
  return { sequence, fetches, decodes, closed, blobs, bitmapByBlob, fetchAll, decodeAll };
}

describe("frame sequence", () => {
  test("is ready once the first frame decodes and returns the nearest decoded frame", async () => {
    const { sequence, blobs, bitmapByBlob, fetchAll, decodeAll } = harness(5);
    let ready = false;
    void sequence.ready.then(() => {
      ready = true;
    });
    expect(sequence.frameNear(0)).toBeUndefined();
    await fetchAll();
    await decodeAll();
    expect(ready).toBe(true);
    expect(sequence.frameNear(0)).toBe(bitmapByBlob.get(blobs[0]));
    // Frame 3 is not decoded yet: the nearest decoded one is shown.
    expect(sequence.frameNear(3)).toBe(bitmapByBlob.get(blobs[1]));
    await decodeAll();
    expect(sequence.frameNear(3)).toBe(bitmapByBlob.get(blobs[3]));
  });

  test("decodes at most two frames at once, nearest to the requested frame first", async () => {
    const { sequence, decodes, blobs, fetchAll, decodeAll } = harness(9, 2);
    await fetchAll();
    const order = () => decodes.map(({ blob }) => blobs.indexOf(blob));
    expect(order()).toEqual([0, 1]);
    await decodeAll();
    decodes.length = 0;
    sequence.frameNear(6);
    expect(order()).toEqual([6, 5]);
  });

  test("closes frames that fall outside the window but keeps the shown frame", async () => {
    const { sequence, closed, blobs, bitmapByBlob, fetchAll, decodeAll } = harness(10, 1);
    await fetchAll();
    sequence.frameNear(0);
    await decodeAll();
    const first = sequence.frameNear(0);
    expect(first).toBe(bitmapByBlob.get(blobs[0]));
    // Far away and nothing decoded there yet: frame 0 stays shown and open.
    expect(sequence.frameNear(9)).toBe(first);
    expect(closed).not.toContain(first);
    expect(closed).toContain(bitmapByBlob.get(blobs[1]));
    await decodeAll();
    expect(sequence.frameNear(9)).toBe(bitmapByBlob.get(blobs[9]));
    sequence.frameNear(8);
    expect(closed).toContain(first);
  });

  test("closes every bitmap on dispose, including ones decoded afterwards", async () => {
    const { sequence, closed, decodes, blobs, bitmapByBlob, fetchAll, decodeAll } = harness(3);
    await fetchAll();
    sequence.frameNear(0);
    const pending = decodes.splice(1);
    await decodeAll();
    sequence.dispose();
    sequence.dispose();
    expect(closed).toEqual([bitmapByBlob.get(blobs[0])]);
    for (const { blob, result } of pending) {
      const late: ImageBitmap = { width: 8, height: 8, close: () => closed.push(late) };
      bitmapByBlob.set(blob, late);
      result.resolve(late);
    }
    await flush();
    expect(closed).toHaveLength(1 + pending.length);
    expect(sequence.frameNear(0)).toBeUndefined();
  });

  test("keeps going when a frame fails to fetch or decode", async () => {
    const { sequence, fetches, decodes, blobs, bitmapByBlob, decodeAll } = harness(3);
    fetches.get("frame-0")?.reject(new Error("offline"));
    fetches.get("frame-1")?.resolve(blobs[1]);
    fetches.get("frame-2")?.resolve(blobs[2]);
    await flush();
    sequence.frameNear(1);
    decodes.shift()?.result.reject(new Error("corrupt"));
    await flush();
    await decodeAll();
    // Frame 0 never arrived and frame 1 is corrupt: frame 2 is the nearest.
    expect(sequence.frameNear(0)).toBe(bitmapByBlob.get(blobs[2]));
    expect(decodes).toHaveLength(0);
  });
});
