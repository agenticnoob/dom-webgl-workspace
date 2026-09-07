import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createProjectRoomTexture,
  drawProjectRoomEndpoint,
} from "../src/projects/artwork";
import { getHeroChapterContent } from "../src/chapters/content";

const originalGetContext = HTMLCanvasElement.prototype.getContext;
afterEach(() =>
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: originalGetContext,
    writable: true,
  }),
);

describe("project room text and endpoint projection", () => {
  test("fits both languages and copies only bounded source strips into the face atlas", () => {
    const ctx = {
      font: "",
      letterSpacing: "",
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      globalAlpha: 1,
      textBaseline: "alphabetic",
      scale: vi.fn(),
      translate: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      clip: vi.fn(),
      transform: vi.fn(),
      drawImage: vi.fn(),
      measureText(text: string) {
        const size = Number.parseFloat(
          ctx.font.match(/([\d.]+)px/)?.[1] ?? "16",
        );
        return {
          width: Array.from(text).reduce(
            (n, c) => n + size * (/\p{Script=Han}/u.test(c) ? 1 : 0.56),
            0,
          ),
        };
      },
    };
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => ctx),
      writable: true,
    });
    for (const locale of ["zh", "en"] as const) {
      ctx.fillText.mockClear();
      ctx.drawImage.mockClear();
      const texture = createProjectRoomTexture(
        getHeroChapterContent("builds", locale).body,
      );
      expect(texture.width).toBe(4096);
      expect(texture.height).toBe(2880);
      const drawn = ctx.fillText.mock.calls.map(([text]) => text).join("");
      for (const project of getHeroChapterContent("builds", locale).body
        .sections)
        expect(drawn).toContain(project.title);
      const target = document.createElement("canvas").getContext("2d");
      if (!target) throw new Error("Missing test canvas");
      drawProjectRoomEndpoint(target, { width: 1440, height: 900 }, texture);
      expect(ctx.drawImage).toHaveBeenCalled();
      for (const call of ctx.drawImage.mock.calls) {
        expect(call).toHaveLength(9);
        const [source, sx, sy, sw, sh] = call;
        expect(source).toBe(texture);
        expect(sx).toBeGreaterThanOrEqual(0);
        expect(sy).toBeGreaterThanOrEqual(0);
        expect(sw).toBeGreaterThan(0);
        expect(sh).toBeGreaterThan(0);
        expect(sx + sw).toBeLessThanOrEqual(texture.width + 1e-6);
        expect(sy + sh).toBeLessThanOrEqual(texture.height);
      }
    }
  });
});
