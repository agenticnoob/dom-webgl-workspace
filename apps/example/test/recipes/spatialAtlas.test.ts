import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createPortalAtlas } from "../../src/recipes/spatial/atlas";
import type { FourFaces, PortalChapter } from "../../src/recipes/spatial";

const fills: { text: string; y: number }[] = [];
const context = {
  font: "",
  textBaseline: "alphabetic",
  fillStyle: "",
  fillRect: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  beginPath: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
  scale: vi.fn(),
  fillText: (text: string, _x: number, y: number) => fills.push({ text, y }),
  measureText: (text: string) => ({
    width: text.length * 12,
    fontBoundingBoxAscent: 65,
    fontBoundingBoxDescent: 15,
    actualBoundingBoxAscent: 52,
    actualBoundingBoxDescent: 1,
    actualBoundingBoxLeft: 0,
    actualBoundingBoxRight: text.length * 12,
    alphabeticBaseline: 0,
    hangingBaseline: 52,
    ideographicBaseline: -15,
    emHeightAscent: 65,
    emHeightDescent: 15,
  }),
} satisfies Partial<CanvasRenderingContext2D>;
const originalContext = HTMLCanvasElement.prototype.getContext;
const chapters = [
  {
    id: "one",
    entry: { label: "01", title: "Title", description: "Description" },
  },
  {
    id: "two",
    entry: { label: "02", title: "Title", description: "Description" },
  },
  {
    id: "three",
    entry: { label: "03", title: "Title", description: "Description" },
  },
  {
    id: "four",
    entry: { label: "04", title: "Title", description: "Description" },
  },
] satisfies FourFaces<PortalChapter>;

beforeEach(() => {
  fills.length = 0;
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    writable: true,
    value: () => context,
  });
});
afterEach(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    writable: true,
    value: originalContext,
  });
});

test("matches CSS line-box leading instead of the canvas top baseline", () => {
  createPortalAtlas(
    {
      width: 1440,
      height: 900,
      left: 0,
      top: 0,
      windowWidth: 1440,
      windowHeight: 900,
    },
    chapters,
  );
  const titles = fills.filter(({ text }) => text === "Title");
  expect(titles).toHaveLength(8);
  // A 72px title in a 77.76px CSS line box: baseline is 63.88px below its top.
  for (const title of titles) expect(title.y).toBeCloseTo(243.88, 5);
  expect(context.textBaseline).toBe("alphabetic");
});

test("bounds all eight tiles together and keeps a sculpture's empty atlas tiny", () => {
  const viewport = {
    width: 3840,
    height: 2160,
    left: 0,
    top: 0,
    windowWidth: 3840,
    windowHeight: 2160,
  };
  const atlas = createPortalAtlas(viewport, chapters);
  expect(atlas.width).toBeLessThanOrEqual(4096);
  expect(atlas.height).toBeLessThanOrEqual(4096);
  expect(atlas.height).toBe(4096);
  expect(createPortalAtlas(viewport, undefined)).toMatchObject({
    width: 2,
    height: 4,
  });
});
