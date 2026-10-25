import { describe, expect, test, vi } from "vitest";

describe("example resource scheduler", () => {
  test("shares one sequence, fetches from the first frame and caps concurrency", async () => {
    vi.resetModules();
    const fetch = vi.fn((_url: string) => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetch);
    const createElement = vi.spyOn(document, "createElement");

    try {
      const { startExampleResourceLoad } =
        await import("../src/exampleResourceScheduler");
      const sequence = startExampleResourceLoad();
      expect(startExampleResourceLoad()).toBe(sequence);
      expect(sequence.count).toBe(454);
      expect(fetch).toHaveBeenCalledTimes(6);
      expect(fetch.mock.calls[0]).toEqual(["/example/bg-sequence/frame_0001.webp"]);
      expect(
        fetch.mock.calls.every(([url]) => String(url).startsWith("/example/bg-sequence/")),
      ).toBe(true);
      expect(createElement).not.toHaveBeenCalledWith("img");
      expect(createElement).not.toHaveBeenCalledWith("video");
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});
