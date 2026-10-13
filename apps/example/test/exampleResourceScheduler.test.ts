import { describe, expect, test, vi } from "vitest";

describe("example resource scheduler", () => {
  test("shares sequence decoding, caps concurrency and delegates other media to native loaders", async () => {
    vi.resetModules();
    const events: string[] = [];
    let activeSequenceLoads = 0;
    let maxSequenceLoads = 0;

    class TestImage {
      decoding = "";
      src = "";

      decode(): Promise<void> {
        events.push(this.src);
        if (this.src.includes("bg-sequence")) {
          activeSequenceLoads += 1;
          maxSequenceLoads = Math.max(maxSequenceLoads, activeSequenceLoads);
        }
        return Promise.resolve().then(() => {
          if (this.src.includes("bg-sequence")) {
            activeSequenceLoads -= 1;
          }
        });
      }
    }

    vi.stubGlobal("Image", TestImage);
    const createElement = vi.spyOn(document, "createElement");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    try {
      const { loadExampleResources } =
        await import("../src/exampleResourceScheduler");
      const load = loadExampleResources();
      expect(loadExampleResources()).toBe(load);
      const resources = await load;

      expect(events[0]).toBe("/example/bg-sequence/frame_0001.webp");
      expect(events).toHaveLength(454);
      expect(new Set(events).size).toBe(454);
      expect(
        events.every((src) => src.startsWith("/example/bg-sequence/")),
      ).toBe(true);
      expect(maxSequenceLoads).toBeLessThanOrEqual(6);
      expect(resources.imageSequenceFrames).toHaveLength(454);
      expect(resources.imageSequenceFrames[0].src).toBe(
        "/example/bg-sequence/frame_0001.webp",
      );
      expect(resources.imageSequenceFrames[453].src).toBe(
        "/example/bg-sequence/frame_0454.webp",
      );
      expect(fetch).not.toHaveBeenCalled();
      expect(createElement).not.toHaveBeenCalledWith("video");
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});
