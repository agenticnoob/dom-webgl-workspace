import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  act,
  createElement,
  type PropsWithChildren,
  type ReactElement,
} from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { heroTransitionConfig } from "../src/transition/transitionConfig";
import type { HeroTransitionSignalWriter } from "../src/transition/signals";

type CapturedScene = ReactElement<{
  theme: { store: { getSnapshot(): string } };
  locale: { store: { getSnapshot(): string } };
  projectRoom: unknown;
}>;
const scenes: CapturedScene[] = [];
const progressStore = {
  source: {
    get: vi.fn<(key: string) => number>(() => 0),
    subscribe: vi.fn(() => () => undefined),
  },
  set: vi.fn(),
  reset: vi.fn(),
  clear: vi.fn(),
};
const refreshHeroScrollLayout = vi.hoisted(() => vi.fn());
const runtimeAvailability = vi.hoisted(() => {
  let ready = false;
  const listeners = new Set<() => void>();
  return {
    runtime: {
      getDebugState: () => ({ ready }),
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    setReady: (next: boolean) => {
      ready = next;
      for (const listener of listeners) listener();
    },
    listeners,
  };
});

vi.mock("@viselora/scroll-adapters/react", () => ({
  useScrollEffectProgressStore: () => progressStore,
  WebGLScrollRuntime: ({
    children,
    scene,
    canvas,
  }: PropsWithChildren<{
    scene: CapturedScene;
    canvas: { gl: { antialias: boolean }; dpr: readonly number[] };
  }>) => {
    scenes.push(scene);
    return createElement(
      "div",
      {
        "data-runtime": "hero-scroll",
        "data-antialias": canvas.gl.antialias,
        "data-max-device-pixel-ratio": canvas.dpr[1],
      },
      children,
    );
  },
  WebGLScrollTimeline: ({
    children,
    id,
    start,
    end,
    pin,
    scrub,
    progressKey,
    className,
    as = "section",
  }: PropsWithChildren<{
    id: string;
    as?: string;
    className?: string;
    progressKey?: string;
    start?: string;
    end?: string;
    pin?: boolean;
    scrub?: boolean;
  }>) =>
    createElement(
      as,
      {
        className,
        "data-timeline": id,
        "data-progress-key": progressKey,
        "data-start": start,
        "data-end": end,
        "data-pin": pin,
        "data-scrub": scrub,
      },
      children,
    ),
}));

vi.mock("../src/experience/smoothScroll", () => ({
  heroSmoothScroll: false,
  refreshHeroScrollLayout,
}));

vi.mock("@viselora/dom-webgl/react", () => ({
  useWebGLRuntime: () => runtimeAvailability.runtime,
  WebGLTarget: ({ id, children }: { id: string; children: ReactElement }) =>
    createElement("div", { "data-target": id }, children),
}));

import {
  HeroExperience,
  heroCanvasOptions,
} from "../src/experience/HeroExperience";

beforeEach(() => {
  runtimeAvailability.setReady(false);
  scenes.length = 0;
  vi.clearAllMocks();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: { getItem: vi.fn(() => null), setItem: vi.fn() },
  });
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

describe("HeroExperience", () => {
  test("restores readable chapters when the Canvas becomes unavailable during a transition", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const styles = document.createElement("style");
    styles.textContent = readFileSync(
      resolve(process.cwd(), "apps/hero-next/app/globals.css"),
      "utf8",
    );
    document.head.append(styles);
    document.body.append(host);
    runtimeAvailability.setReady(true);
    try {
      act(() => root.render(createElement(HeroExperience)));
      const main = host.querySelector("main");
      const chapters = Array.from(host.querySelectorAll(".hero-chapter"));
      expect(chapters).toHaveLength(4);
      expect(main?.getAttribute("data-dom-active")).toBe("false");
      expect(main?.getAttribute("data-webgl-ready")).toBe("true");
      expect(
        chapters.every(
          (chapter) => getComputedStyle(chapter).visibility === "hidden",
        ),
      ).toBe(true);

      act(() => runtimeAvailability.setReady(false));

      expect(main?.getAttribute("data-webgl-ready")).toBe("false");
      for (const chapter of chapters) {
        expect(getComputedStyle(chapter).visibility).toBe("visible");
        expect(getComputedStyle(chapter).pointerEvents).toBe("auto");
        expect(getComputedStyle(chapter).background).toBe(
          "var(--hero-chapter-background)",
        );
      }
      const articles = host.querySelector(".hero-axioms__semantic");
      expect(articles).not.toBeNull();
      expect(getComputedStyle(articles!).position).toBe("static");
      expect(articles?.textContent).toContain("AI-native 必然走向 Agent-first");

      act(() => runtimeAvailability.setReady(true));

      expect(host.querySelector("main")).toBe(main);
      expect(main?.getAttribute("data-webgl-ready")).toBe("true");
      expect(
        chapters.every(
          (chapter) => getComputedStyle(chapter).visibility === "hidden",
        ),
      ).toBe(true);
      expect(getComputedStyle(articles!).position).toBe("absolute");
      expect(scenes).toHaveLength(1);
    } finally {
      act(() => root.unmount());
      host.remove();
      styles.remove();
    }
    expect(runtimeAvailability.listeners.size).toBe(0);
  });

  test("keeps the fixed profile bubble out of the axioms reader", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    progressStore.source.get.mockImplementation((key) =>
      key === "hero.chapter-2.entry" ? 1 : 0,
    );
    try {
      act(() => root.render(createElement(HeroExperience)));
      expect(
        host.querySelector<HTMLElement>("[data-profile-speech-bubble]")?.style
          .visibility,
      ).toBe("hidden");
      expect(
        host.querySelector(".hero-axioms__semantic")?.textContent,
      ).toContain("AI-native 必然走向 Agent-first");
    } finally {
      act(() => root.unmount());
      progressStore.source.get.mockImplementation(() => 0);
    }
  });
  test("retains the chapter timelines, semantic content and one R3F scene slot", () => {
    const html = renderToStaticMarkup(createElement(HeroExperience));

    expect(scenes).toHaveLength(1);
    expect(heroCanvasOptions.camera).toMatchObject({
      position: [0, 0, 3.2],
      fov: 38,
    });
    expect(heroCanvasOptions.orthographic).toBe(false);
    expect(html).toContain('data-runtime="hero-scroll"');
    expect(html).toContain('data-antialias="true"');
    expect(html).toContain('data-max-device-pixel-ratio="2"');
    expect(html.match(/data-timeline=/g)).toHaveLength(16);
    expect(html.match(/class="hero-chapter-cycle"/g)).toHaveLength(4);
    expect(html).toContain('class="hero-hub-runway hero-hub-runway--opening"');
    expect(html.match(/class="hero-portal-stage"/g)).toHaveLength(1);
    expect(html.match(/class="hero-portal-copy /g)).toHaveLength(2);
    expect(html).not.toContain("hero-transition-copy");
    expect(html).toContain('data-timeline="hero.chapter-1.content.timeline"');
    expect(html).toContain('data-progress-key="hero.chapter-1.content"');
    expect(html).toContain('data-start="top top"');
    expect(html).toContain('data-end="bottom top"');
    expect(html).toContain('data-timeline="hero.chapter-1.entry.timeline"');
    expect(html).toContain('data-progress-key="hero.chapter-1.entry"');
    expect(html).toContain('data-end="bottom top"');
    expect(html).toContain('data-timeline="hero.chapter-1.exit.timeline"');
    expect(html).toContain('data-progress-key="hero.chapter-1.exit"');
    expect(html).toContain('data-end="bottom bottom"');
    expect(html).toContain('data-start="top bottom"');
    expect(html).toContain('data-timeline="chapter-1-body-timeline"');
    expect(html).toContain('data-progress-key="hero.chapter-1.body"');
    expect(html).toContain('data-start="top top"');
    expect(html).toContain('data-timeline="hero.chapter-4.entry.timeline"');
    expect(html).toContain('data-progress-key="hero.chapter-4.entry"');
    expect(html).toContain('data-timeline="hero.chapter-4.exit.timeline"');
    expect(html).toContain('data-progress-key="hero.chapter-4.exit"');
    expect(html).toContain('data-timeline="hero.chapter-4.content.timeline"');
    expect(html).toContain('data-progress-key="hero.chapter-4.content"');
    expect(html).not.toContain("data-pin");
    expect(html).toContain('data-target="hero.portal.site.left.primary"');
    expect(html).toContain('data-target="hero.portal.site.left.secondary"');
    expect(html).toContain('data-target="hero.portal.site.right.primary"');
    expect(html).toContain('data-target="hero.portal.site.right.secondary"');
    expect(html).toContain('data-hero-theme="initial"');
    expect(html).toContain('data-hero-locale="zh"');
    expect(html).toContain('data-dom-active="false"');
    expect(html).not.toContain("data-active-chapter");
    expect(html).toContain('id="chapter-1"');
    expect(html).toContain('id="chapter-2"');
    expect(html).toContain('id="chapter-3"');
    expect(html).toContain('id="chapter-4"');
    expect(html).toContain("为智能体重新思考软件");
    expect(html).toContain("真正的颠覆，不只是更好的答案");
    expect(html).toContain("把想法，做成可以运行的东西。");
    expect(html).toContain("愿与同道者共研同进，或有所得，亦未可知");
    expect(html).not.toContain('class="hero-chapter__frame');
    expect(html).not.toContain("继续前往章节出口");
    expect(html).not.toContain('class="hero-final-hub"');
    expect(html).toContain('class="hero-final-links"');
    expect(html).toContain('class="hero-chapter hero-chapter--profile"');
    expect(html).toContain('class="hero-chapter__body hero-profile"');
    expect(html.match(/data-profile-wrap-text=""/g)).toHaveLength(24);
    expect(html.match(/data-profile-wrap-side="left"/g)).toHaveLength(15);
    expect(html.match(/data-profile-wrap-side="right"/g)).toHaveLength(9);
    expect(html).toContain('data-profile-model-exclusion=""');
    expect(html).toContain('data-profile-speech-bubble=""');
    expect(html).toContain('data-profile-facing="front"');
    expect(html).toContain('data-profile-speech-phase="holding"');
    expect(html).toContain('data-profile-speech-surface=""');
    expect(html).toContain('data-profile-speech-tail=""');
    expect(html).toContain('data-profile-speech-message="front"');
    expect(html).toContain('data-profile-speech-message="side"');
    expect(html).toContain('data-profile-speech-message="back"');
    expect(html).toContain('data-profile-speech-character=""');
    expect(html).toContain('href="https://github.com/agenticnoob"');
    expect(html).toContain('href="https://blog.zzzxc.com"');
    expect(html).toContain('data-hero-locale-option="zh"');
    expect(html).toContain('data-hero-locale-option="en"');
    expect(html).not.toContain("Boo!");

    const host = document.createElement("div");
    host.innerHTML = html;
    expect(
      host.querySelector('[data-profile-speech-message="front"]')?.textContent,
    ).toBe("这是我的正面");
    expect(
      host.querySelector('[data-profile-speech-message="side"]')?.textContent,
    ).toBe("这是我的侧面");
    expect(
      host.querySelector('[data-profile-speech-message="back"]')?.textContent,
    ).toBe("这是我的背面");
    const contentTimeline = host.querySelector(
      '[data-timeline="hero.chapter-1.content.timeline"]',
    );
    expect(
      contentTimeline?.querySelector(".hero-chapter__entry-frame"),
    ).toBeNull();
    expect(
      contentTimeline?.querySelector(
        '[data-timeline="chapter-1-body-timeline"]',
      ),
    ).not.toBeNull();
    expect(
      contentTimeline?.querySelector(
        '[data-timeline="hero.chapter-1.exit.timeline"]',
      ),
    ).toBeNull();
    expect(
      host.querySelectorAll(
        ".hero-chapter__content-cycle > .hero-chapter__body",
      ),
    ).toHaveLength(4);
    expect(host.querySelectorAll(".hero-chapter__entry-frame")).toHaveLength(0);
    expect(host.querySelectorAll(".hero-chapter__exit-frame")).toHaveLength(0);
    expect(host.querySelectorAll(".hero-exit-sticky")).toHaveLength(0);
    for (const exitTimeline of host.querySelectorAll(
      '[data-timeline$=".exit.timeline"]',
    )) {
      expect(exitTimeline.childElementCount).toBe(0);
    }
  });

  test("keeps shared theme, locale and project stores stable without frame state", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() => root.render(createElement(HeroExperience)));
    act(() => root.render(createElement(HeroExperience)));
    expect(scenes).toHaveLength(2);
    expect(scenes[1].props.theme.store).toBe(scenes[0].props.theme.store);
    expect(scenes[1].props.locale.store).toBe(scenes[0].props.locale.store);
    expect(scenes[1].props.projectRoom).toBe(scenes[0].props.projectRoom);
    expect(scenes[0].props.theme.store.getSnapshot()).toBe("initial");
    expect(scenes[0].props.locale.store.getSnapshot()).toBe("zh");
    expect(refreshHeroScrollLayout).toHaveBeenCalled();
    const renderCount = scenes.length;
    progressStore.set(heroTransitionConfig.signalKeys.coverage, 0.5);
    expect(scenes).toHaveLength(renderCount);
    act(() => root.unmount());
  });

  test("switches semantic content and persists locale while preserving the shared locale store", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => root.render(createElement(HeroExperience)));
    const initialLocaleStore = scenes.at(-1)?.props.locale.store;
    const initialPortalText = host.querySelector(
      '[data-target="hero.portal.site.right.primary"]',
    );
    const englishButton = host.querySelector<HTMLButtonElement>(
      '[data-hero-locale-option="en"]',
    );
    expect(englishButton).not.toBeNull();
    const refreshesBeforeLocaleChange =
      refreshHeroScrollLayout.mock.calls.length;

    act(() => englishButton?.click());

    expect(host.textContent).toContain("Rethinking software for agents");
    expect(
      host.querySelector('[data-target="hero.portal.site.right.primary"]'),
    ).not.toBe(initialPortalText);
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      "viselora.hero.locale.v1",
      "en",
    );
    expect(scenes.at(-1)?.props.locale.store).toBe(initialLocaleStore);
    expect(refreshHeroScrollLayout.mock.calls.length).toBeGreaterThan(
      refreshesBeforeLocaleChange,
    );

    act(() => root.unmount());
  });
});
