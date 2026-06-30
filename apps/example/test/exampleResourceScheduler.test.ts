import { describe, expect, test, vi } from "vitest";

describe("example resource scheduler", () => {
  test("loads resources in DOM order and limits image sequence concurrency", async () => {
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

    class TestVideo {
      preload = "";
      src = "";
      private listeners = new Map<string, () => void>();

      addEventListener(type: string, listener: () => void): void {
        this.listeners.set(type, listener);
      }

      load(): void {
        events.push(this.src);
        this.listeners.get("loadedmetadata")?.();
      }
    }

    vi.stubGlobal("Image", TestImage);
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "video") {
        return new TestVideo() as unknown as HTMLVideoElement;
      }
      return originalCreateElement(tagName);
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((src: string) => {
        events.push(src);
        return Promise.resolve({ ok: true });
      }),
    );

    try {
      const { loadExampleResources } = await import("../src/exampleResourceScheduler");
      const resources = await loadExampleResources();

      expect(events.slice(0, 4)).toEqual([
        "/example/image.png",
        "/example/bg.png",
        "/example/video.mp4",
        "/example/bg-sequence/frame_0001.webp",
      ]);
      expect(events.indexOf("/models/hero.glb")).toBeGreaterThan(
        events.indexOf("/example/bg-sequence/frame_0001.webp"),
      );
      expect(events.indexOf("/models/hero.glb")).toBeLessThan(
        events.indexOf("/example/bg-sequence/frame_0454.webp"),
      );
      expect(maxSequenceLoads).toBeLessThanOrEqual(6);
      expect(resources.imageSequenceFrames).toHaveLength(454);
      expect(resources.modelReady).toBe(true);
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});
