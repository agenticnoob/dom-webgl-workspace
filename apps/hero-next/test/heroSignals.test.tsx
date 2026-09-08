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
  beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
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
    ).toEqual({ x: 906, y: 404 });
    expect(
      resolveSignalPreviewPosition(
        { x: 10, y: 10 },
        { width: 320, height: 480 },
        { width: 288, height: 448 },
      ),
    ).toEqual({ x: 16, y: 16 });
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

  test("shares a direct link between each row and its hover preview without pinning", async () => {
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
        null,
        null,
        null,
        heroPublicLinks.blog,
        heroPublicLinks.githubProfile,
      ]);
      for (const row of Array.from(rows).slice(0, 3))
        expect(row.getAttribute("aria-disabled")).toBe("true");
      await act(() => pointer(rows[3], "pointerover"));
      const preview = host.querySelector<HTMLElement>(".hero-signals__preview");
      expect(preview).not.toBeNull();
      expect(preview?.closest("a")).toBe(rows[3]);
      await act(() =>
        pointer(
          rows[3].querySelector(".hero-signals__label")!,
          "pointermove",
          240,
          280,
        ),
      );
      expect(preview?.style.left).toBe("264px");
      expect(preview?.style.top).toBe("280px");
      await act(() => pointer(rows[3], "pointerout", 300, 280, preview));
      expect(host.querySelector(".hero-signals__preview")).toBe(preview);
      await act(() => pointer(preview!, "pointermove", 320, 290));
      expect(preview?.style.left).toBe("264px");
      let navigationAllowed = false;
      // Observe the default link action, then stop jsdom from navigating externally.
      const observeClick = (event: MouseEvent) => {
        navigationAllowed = !event.defaultPrevented;
        event.preventDefault();
      };
      document.addEventListener("click", observeClick, { once: true });
      await act(() => preview?.click());
      expect(navigationAllowed).toBe(true);
      expect(host.querySelector(".hero-signals__preview")).toBeNull();
      expect(
        host.querySelector("button, [data-pinned], [aria-expanded]"),
      ).toBeNull();
      await act(() => rows[4].focus());
      expect(host.querySelector(".hero-signals__preview")?.closest("a")).toBe(
        rows[4],
      );
      await act(() =>
        rows[4].dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
        ),
      );
      expect(host.querySelector(".hero-signals__preview")).toBeNull();
      await act(() => pointer(rows[0], "pointerover"));
      expect(
        host.querySelector(".hero-signals__preview")?.textContent,
      ).toContain("链接待补充");
      await act(() => window.dispatchEvent(new Event("scroll")));
      expect(host.querySelector(".hero-signals__preview")).toBeNull();
    } finally {
      await act(() => root.unmount());
      host.remove();
    }
  });

  test("keeps pending channel clicks inert and English destinations aligned", async () => {
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
      expect(click.defaultPrevented).toBe(true);
      expect(host.querySelector(".hero-signals__preview")).toBeNull();
      expect(rows[3].getAttribute("href")).toBe(heroPublicLinks.blog);
      expect(rows[4].getAttribute("href")).toBe(heroPublicLinks.githubProfile);
    } finally {
      await act(() => root.unmount());
    }
  });
});
