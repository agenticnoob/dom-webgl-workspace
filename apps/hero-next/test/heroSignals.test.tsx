import React, {
  act,
  createElement,
  type PropsWithChildren,
  type HTMLAttributes,
} from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { HeroSignalsChapterBody } from "../src/signals/HeroSignalsChapterBody";
import {
  resolveSignalPreviewPosition,
  resolveSignalsLayout,
  signalsHoverQuery,
} from "../src/signals/layout";
import {
  getHeroChapterContent,
  heroPublicLinks,
} from "../src/chapters/content";
import { heroChapterDefinitions } from "../src/chapters/definitions";

vi.mock("@viselora/scroll-adapters/react", () => ({
  WebGLScrollTimeline: ({
    children,
    className,
  }: PropsWithChildren<HTMLAttributes<HTMLElement>>) =>
    createElement("section", { className }, children),
}));

function pointer(
  element: Element,
  type: string,
  x = 100,
  y = 100,
  relatedTarget: Element | null = null,
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    relatedTarget,
  });
  Object.defineProperty(event, "pointerType", { value: "mouse" });
  element.dispatchEvent(event);
}

describe("chapter four public directory", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({ matches: query === signalsHoverQuery })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  test("keeps five rows and their previews within narrow and desktop viewports", () => {
    expect(
      resolveSignalPreviewPosition(
        { x: 100, y: 100 },
        { width: 1280, height: 720 },
        { width: 340, height: 300 },
      ),
    ).toEqual({ x: 124, y: 16 });
    expect(
      resolveSignalPreviewPosition(
        { x: 1270, y: 710 },
        { width: 1280, height: 720 },
        { width: 340, height: 300 },
      ),
    ).toEqual({ x: 924, y: 404 });
    expect(
      resolveSignalPreviewPosition(
        { x: 10, y: 10 },
        { width: 320, height: 480 },
        { width: 288, height: 448 },
      ),
    ).toEqual({ x: 16, y: 16 });
    const beforeEdge = resolveSignalPreviewPosition(
      { x: 898, y: 400 },
      { width: 1280, height: 720 },
      { width: 340, height: 300 },
    );
    const afterEdge = resolveSignalPreviewPosition(
      { x: 902, y: 400 },
      { width: 1280, height: 720 },
      { width: 340, height: 300 },
    );
    expect(afterEdge.x - beforeEdge.x).toBe(2);
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
      { width: 844, height: 390 },
    ]) {
      const layout = resolveSignalsLayout(viewport);
      expect(layout.top + layout.rowHeight * 5).toBeLessThan(
        viewport.height * 0.88,
      );
      expect(layout.fontSize * 4).toBeLessThan(
        viewport.width - 2 * layout.inset,
      );
    }
  });

  test("follows the entire row and preserves one preview across channel changes", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(() =>
        root.render(
          createElement(HeroSignalsChapterBody, {
            definition: heroChapterDefinitions.signals,
            content: getHeroChapterContent("signals", "zh"),
            locale: "zh",
          }),
        ),
      );
      const rows =
        host.querySelectorAll<HTMLAnchorElement>(".hero-signals__row");
      expect(Array.from(rows, (r) => r.getAttribute("aria-label"))).toEqual([
        "抖音",
        "小红书",
        "哔哩哔哩",
        "博客",
        "GitHub",
      ]);
      expect(Array.from(rows, (r) => r.getAttribute("href"))).toEqual([
        heroPublicLinks.douyin,
        heroPublicLinks.xiaohongshu,
        heroPublicLinks.bilibili,
        heroPublicLinks.blog,
        heroPublicLinks.githubProfile,
      ]);
      for (const row of rows) {
        expect(row.hasAttribute("aria-disabled")).toBe(false);
        expect(row.target).toBe("_blank");
      }
      await act(() => pointer(rows[3], "pointerover"));
      const preview = host.querySelector<HTMLElement>(".hero-signals__preview");
      expect(preview).not.toBeNull();
      expect(preview?.closest("a")).toBeNull();
      expect(preview?.dataset.following).toBeUndefined();
      await act(() =>
        pointer(
          rows[3].querySelector(".hero-signals__label")!,
          "pointermove",
          240,
          280,
        ),
      );
      expect(preview?.style.transform).toBe("translate3d(264px, 280px, 0)");
      expect(preview?.dataset.following).toBe("true");
      // Empty row space and the arrow must keep driving the same preview.
      await act(() => pointer(rows[3], "pointermove", 320, 290));
      expect(preview?.style.transform).toBe("translate3d(344px, 290px, 0)");
      await act(() =>
        pointer(
          rows[3].querySelector(".hero-signals__arrow")!,
          "pointermove",
          420,
          300,
        ),
      );
      expect(preview?.style.transform).toBe("translate3d(444px, 300px, 0)");
      await act(() => pointer(rows[3], "pointerout", 420, 400, rows[4]));
      expect(host.querySelector(".hero-signals__preview")).toBe(preview);
      expect(preview?.textContent).toContain("GitHub");
      expect(rows[4].dataset.selected).toBe("true");
      expect(rows[3].dataset.selected).toBe("false");
      let navigationAllowed = false;
      // Observe the default link action, then stop jsdom from navigating externally.
      const observeClick = (event: MouseEvent) => {
        navigationAllowed = !event.defaultPrevented;
        event.preventDefault();
      };
      document.addEventListener("click", observeClick, { once: true });
      await act(() => rows[4].click());
      expect(navigationAllowed).toBe(true);
      expect(host.querySelector(".hero-signals__preview")).toBeNull();
      expect(
        host.querySelector("button, [data-pinned], [aria-expanded]"),
      ).toBeNull();
      await act(() => rows[4].focus());
      expect(
        host.querySelector(".hero-signals__preview")?.textContent,
      ).toContain("GitHub");
      await act(() =>
        rows[4].dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
        ),
      );
      expect(host.querySelector(".hero-signals__preview")).toBeNull();
      await act(() => pointer(rows[0], "pointerover"));
      expect(
        host.querySelector(".hero-signals__preview")?.textContent,
      ).toContain("Cognition_hub");
      const firstPreview = host.querySelector(".hero-signals__preview");
      const hitTest = vi.fn((): Element | null =>
        rows[0].querySelector(".hero-signals__title"),
      );
      const originalHitTest = Object.getOwnPropertyDescriptor(
        document,
        "elementFromPoint",
      );
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: hitTest,
      });
      try {
        // Chapter entry can emit another scroll event after the first reveal.
        await act(() => window.dispatchEvent(new Event("scroll")));
        expect(host.querySelector(".hero-signals__preview")).toBe(firstPreview);
        expect(hitTest).toHaveBeenCalledWith(100, 100);
        await act(() => pointer(rows[0], "pointermove", 220, 260));
        expect(firstPreview).toHaveProperty(
          "style.transform",
          "translate3d(244px, 260px, 0)",
        );
        hitTest.mockReturnValue(document.body);
        await act(() => window.dispatchEvent(new Event("scroll")));
        expect(host.querySelector(".hero-signals__preview")).toBeNull();
      } finally {
        if (originalHitTest) {
          Object.defineProperty(document, "elementFromPoint", originalHitTest);
        } else {
          Reflect.deleteProperty(document, "elementFromPoint");
        }
      }
      await act(() => rows[4].blur());
      await act(() => rows[4].focus());
      expect(host.querySelector(".hero-signals__preview")).not.toBeNull();
      await act(() => window.dispatchEvent(new Event("scroll")));
      expect(host.querySelector(".hero-signals__preview")).toBeNull();
      await act(() => pointer(rows[0], "pointerover"));
      await act(() => pointer(rows[0], "pointerout", 0, 0, document.body));
      expect(host.querySelector(".hero-signals__preview")).toBeNull();
    } finally {
      await act(() => root.unmount());
      host.remove();
    }
  });

  test("keeps English destinations and original QR previews aligned", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
      await act(() =>
        root.render(
          createElement(HeroSignalsChapterBody, {
            definition: heroChapterDefinitions.signals,
            content: getHeroChapterContent("signals", "en"),
            locale: "en",
          }),
        ),
      );
      const rows =
        host.querySelectorAll<HTMLAnchorElement>(".hero-signals__row");
      expect(Array.from(rows, (r) => r.getAttribute("aria-label"))).toEqual([
        "Douyin",
        "Xiaohongshu",
        "Bilibili",
        "Blog",
        "GitHub",
      ]);
      const click = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      await act(() => rows[0].dispatchEvent(click));
      expect(click.defaultPrevented).toBe(false);
      expect(host.querySelector(".hero-signals__preview")).toBeNull();
      const channels = ["douyin", "xiaohongshu", "bilibili"] as const;
      for (const [index, channel] of channels.entries()) {
        expect(rows[index].getAttribute("href")).toBe(heroPublicLinks[channel]);
        await act(() => pointer(rows[index], "pointerover"));
        const image = host.querySelector(".hero-signals__preview img");
        expect(image?.getAttribute("src")).toBe(`/channels/${channel}.jpg`);
        expect(image?.getAttribute("alt")).toContain("AXMORF");
        expect(image?.getAttribute("alt")).toContain("Scan with");
        expect(image?.closest("a")).toBeNull();
        expect(image?.hasAttribute("srcset")).toBe(false);
        await act(() => window.dispatchEvent(new Event("resize")));
        expect(host.querySelector(".hero-signals__preview")).toBeNull();
      }
      expect(rows[3].getAttribute("href")).toBe(heroPublicLinks.blog);
      expect(rows[4].getAttribute("href")).toBe(heroPublicLinks.githubProfile);
    } finally {
      await act(() => root.unmount());
    }
  });
  test("shows complete linked content and never opens previews without a hover pointer", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(() =>
        root.render(
          createElement(HeroSignalsChapterBody, {
            definition: heroChapterDefinitions.signals,
            content: getHeroChapterContent("signals", "zh"),
            locale: "zh",
          }),
        ),
      );
      const rows =
        host.querySelectorAll<HTMLAnchorElement>(".hero-signals__row");
      expect(host.querySelectorAll(".hero-signals__inline-image")).toHaveLength(
        3,
      );
      expect(host.querySelectorAll(".hero-signals__inline-copy")).toHaveLength(
        2,
      );
      expect(rows[0].textContent).toContain("AXMORF");
      expect(rows[0].textContent).toContain("@Cognition_hub");
      expect(rows[2].textContent).toContain("UID 269573670");
      expect(rows[0].querySelector("img")?.closest("a")).toBe(rows[0]);
      await act(() => pointer(rows[0], "pointerover"));
      await act(() => pointer(rows[0], "pointermove", 200, 300));
      await act(() => rows[0].focus());
      expect(host.querySelector(".hero-signals__preview")).toBeNull();
      expect(rows[0].dataset.selected).toBe("false");
      const click = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      await act(() => rows[0].dispatchEvent(click));
      expect(click.defaultPrevented).toBe(false);
      expect(rows[0].href).toBe(heroPublicLinks.douyin);
    } finally {
      await act(() => root.unmount());
      host.remove();
    }
  });
});
