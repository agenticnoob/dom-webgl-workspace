import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  PointerPreviewDirectory,
  type PointerPreviewItem,
} from "../../src/recipes/pointer-preview";
import {
  pointerPreviewQuery,
  resolvePointerPreviewPosition,
} from "../../src/recipes/pointer-preview/layout";

const items = [
  {
    id: "one",
    title: "One",
    description: "First full description",
    href: "/one",
    image: { src: "/one.png", alt: "First diagram", width: 100, height: 80 },
  },
  {
    id: "two",
    title: "Two",
    description: "Second full description",
    href: "/two",
  },
] satisfies readonly PointerPreviewItem[];

function pointer(
  element: Element,
  type: string,
  x: number,
  y: number,
  pointerType = "mouse",
) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  element.dispatchEvent(event);
}

function setMedia({ hover = true, reduced = false } = {}) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query === pointerPreviewQuery ? hover : reduced,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("pointer preview directory", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    setMedia();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.classList.contains("recipe-preview__floating"))
          return new DOMRect(0, 0, 300, 200);
        if (this.classList.contains("recipe-preview__row"))
          return new DOMRect(120, 240, 800, 100);
        return new DOMRect(100, 200, 1000, 600);
      },
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("clamps continuously at component bounds, including oversized previews", () => {
    const bounds = { width: 1000, height: 600 },
      size = { width: 300, height: 200 };
    expect(
      resolvePointerPreviewPosition({ x: 50, y: 100 }, bounds, size),
    ).toEqual({ x: 74, y: 16 });
    expect(
      resolvePointerPreviewPosition({ x: 990, y: 590 }, bounds, size),
    ).toEqual({ x: 684, y: 384 });
    expect(
      resolvePointerPreviewPosition({ x: -100, y: -100 }, bounds, size),
    ).toEqual({ x: 16, y: 16 });
    expect(
      resolvePointerPreviewPosition(
        { x: 100, y: 100 },
        { width: 200, height: 100 },
        size,
      ),
    ).toEqual({ x: 0, y: 0 });
    const a = resolvePointerPreviewPosition({ x: 658, y: 300 }, bounds, size);
    const b = resolvePointerPreviewPosition({ x: 662, y: 300 }, bounds, size);
    expect(b.x - a.x).toBe(2);
  });

  test("follows in local coordinates, coalesces pointer frames and supports focus/Escape", async () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(() =>
        root.render(
          createElement(PointerPreviewDirectory, { id: "directory", items }),
        ),
      );
      const rows = host.querySelectorAll<HTMLAnchorElement>(
        ".recipe-preview__row",
      );
      expect(Array.from(rows, (row) => row.getAttribute("href"))).toEqual([
        "/one",
        "/two",
      ]);
      expect(rows[0].getAttribute("aria-describedby")).toBe(
        "directory.description.0",
      );
      await act(() => pointer(rows[0], "pointerover", 300, 400));
      const preview = host.querySelector<HTMLElement>(
        ".recipe-preview__floating",
      );
      expect(preview?.style.transform).toBe("translate3d(224px, 100px, 0)");
      expect(preview?.getAttribute("aria-hidden")).toBe("true");
      await act(() => {
        pointer(rows[0], "pointermove", 450, 450);
        pointer(rows[0], "pointermove", 500, 480);
      });
      expect(callbacks).toHaveLength(1);
      await act(() => callbacks[0](16));
      expect(preview?.style.transform).toBe("translate3d(424px, 180px, 0)");
      await act(() => rows[1].focus());
      expect(
        host.querySelector(".recipe-preview__floating")?.textContent,
      ).toContain("Second full description");
      await act(() =>
        rows[1].dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        ),
      );
      expect(host.querySelector(".recipe-preview__floating")).toBeNull();
      await act(() => pointer(rows[0], "pointerover", 300, 400));
      await act(() => pointer(rows[0], "pointermove", 350, 450));
    } finally {
      await act(() => root.unmount());
      expect(cancel).toHaveBeenCalled();
      host.remove();
    }
  });

  test.each(["touch", "coarse", "narrow"])(
    "keeps complete linked content without hover on %s input",
    async (mode) => {
      if (mode === "coarse") setMedia({ hover: false });
      if (mode === "narrow")
        vi.spyOn(
          HTMLElement.prototype,
          "getBoundingClientRect",
        ).mockReturnValue(new DOMRect(0, 0, 390, 700));
      const host = document.createElement("div");
      const root = createRoot(host);
      try {
        await act(() =>
          root.render(createElement(PointerPreviewDirectory, { items })),
        );
        const row = host.querySelector<HTMLAnchorElement>(
          ".recipe-preview__row",
        );
        expect(row?.textContent).toContain("First full description");
        expect(row?.querySelector("img")?.getAttribute("alt")).toBe(
          "First diagram",
        );
        if (!row) throw new Error("Missing semantic row");
        await act(() =>
          pointer(
            row,
            "pointerover",
            200,
            300,
            mode === "touch" ? "touch" : "mouse",
          ),
        );
        expect(host.querySelector(".recipe-preview__floating")).toBeNull();
        expect(row.getAttribute("href")).toBe("/one");
      } finally {
        await act(() => root.unmount());
      }
    },
  );

  test("updates open content and cancels pending motion after synchronous repositioning", async () => {
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(77);
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
      await act(() =>
        root.render(createElement(PointerPreviewDirectory, { items })),
      );
      const row = host.querySelector(".recipe-preview__row");
      if (!row) throw new Error("Missing row");
      await act(() => pointer(row, "pointerover", 300, 400));
      await act(() => pointer(row, "pointermove", 400, 450));
      await act(() =>
        root.render(
          createElement(PointerPreviewDirectory, {
            items: [
              { ...items[0], description: "Updated while open" },
              items[1],
            ],
          }),
        ),
      );
      expect(
        host.querySelector(".recipe-preview__floating")?.textContent,
      ).toContain("Updated while open");
    } finally {
      await act(() => root.unmount());
    }
    expect(cancel).toHaveBeenCalledWith(77);
  });

  test("reduced motion opens a stationary preview without following pointer movement", async () => {
    setMedia({ reduced: true });
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
      await act(() =>
        root.render(createElement(PointerPreviewDirectory, { items })),
      );
      const row = host.querySelector(".recipe-preview__row");
      if (!row) throw new Error("Missing row");
      await act(() => pointer(row, "pointerover", 200, 300));
      const preview = host.querySelector<HTMLElement>(
        ".recipe-preview__floating",
      );
      const initialPosition = preview?.style.transform;
      await act(() => pointer(row, "pointermove", 800, 600));
      expect(preview?.style.transform).toBe(initialPosition);
      expect(preview?.dataset.following).toBeUndefined();
    } finally {
      await act(() => root.unmount());
    }
  });
});
