import {
  act,
  createElement,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { heroTransitionConfig } from "../src/transition/transitionConfig";
import type { HeroTransitionSignalWriter } from "../src/transition/signals";

type CapturedMeshEffect = {
  readonly kind: string;
  readonly signals?: HeroTransitionSignalWriter;
  readonly theme?: { getSnapshot(): string };
  readonly locale?: { getSnapshot(): string };
};

const progressStore = {
  source: {
    get: vi.fn(() => 0),
    subscribe: vi.fn(() => () => undefined),
  },
  set: vi.fn(),
  reset: vi.fn(),
  clear: vi.fn(),
};
const capturedEffects: (readonly CapturedMeshEffect[] | undefined)[] = [];
let meshRenderCount = 0;
const refreshHeroScrollLayout = vi.hoisted(() => vi.fn());

vi.mock("@viselora/scroll-adapters/react", () => ({
  useScrollEffectProgressStore: () => progressStore,
  WebGLScrollRuntime: ({
    children,
    renderQuality,
  }: PropsWithChildren<{
    renderQuality?: {
      antialias?: boolean;
      maxDevicePixelRatio?: number;
    };
  }>) =>
    createElement(
      "div",
      {
        "data-runtime": "hero-scroll",
        "data-antialias": renderQuality?.antialias,
        "data-max-device-pixel-ratio": renderQuality?.maxDevicePixelRatio,
      },
      children,
    ),
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
  WebGLScene: ({ id, children }: PropsWithChildren<{ id: string }>) =>
    createElement("div", { "data-scene": id }, children),
  WebGLCamera: ({
    id,
    position,
    target,
  }: {
    id: string;
    position?: readonly number[];
    target?: readonly number[];
  }) =>
    createElement("div", {
      "data-camera": id,
      "data-position": position?.join(","),
      "data-target-position": target?.join(","),
    }),
  WebGLMesh: ({
    id,
    geometry,
    material,
    effects,
    interaction,
  }: {
    id: string;
    geometry: { kind: string; radius?: number };
    material?: {
      kind?: string;
      color?: string;
      emissive?: string;
      emissiveIntensity?: number;
      opacity?: number;
      metalness?: number;
      roughness?: number;
    };
    effects?: readonly CapturedMeshEffect[];
    interaction?: {
      pickable?: { hitTest?: string; pointer?: { press?: boolean } };
    };
  }) => {
    meshRenderCount += 1;
    capturedEffects.push(effects);
    return createElement("div", {
      "data-mesh": id,
      "data-geometry": geometry.kind,
      "data-radius": geometry.radius,
      "data-material": material?.kind,
      "data-color": material?.color,
      "data-emissive": material?.emissive,
      "data-emissive-intensity": material?.emissiveIntensity,
      "data-opacity": material?.opacity,
      "data-metalness": material?.metalness,
      "data-roughness": material?.roughness,
      "data-mesh-effect": effects?.[0]?.kind,
      "data-hit-test": interaction?.pickable?.hitTest,
      "data-press": interaction?.pickable?.pointer?.press,
    });
  },
  WebGLLight: ({
    id,
    kind,
    color,
    intensity,
    position,
    target,
  }: {
    id: string;
    kind: string;
    color?: string;
    intensity?: number;
    position?: readonly number[];
    target?: readonly number[];
  }) =>
    createElement("div", {
      "data-light": id,
      "data-light-kind": kind,
      "data-light-color": color,
      "data-light-intensity": intensity,
      "data-light-position": position?.join(","),
      "data-light-target": target?.join(","),
    }),
  WebGLTarget: ({
    webgl,
    className,
    children,
    as = "div",
  }: {
    webgl: {
      key: string;
      placement?: { mode?: string; depth?: number };
      renderRole?: string;
      effects?: readonly {
        kind: string;
        contentId?: string;
        side?: string;
        depth?: number;
        fov?: number;
        overscan?: number;
      }[];
    };
    className?: string;
    children?: ReactNode;
    as?: string;
  }) =>
    createElement(
      as,
      {
        className,
        "data-target": webgl.key,
        "data-placement": webgl.placement?.mode,
        "data-depth": webgl.placement?.depth,
        "data-render-role": webgl.renderRole,
        "data-effect": webgl.effects?.[0]?.kind,
        "data-effect-content": webgl.effects?.[0]?.contentId,
        "data-effect-side": webgl.effects?.[0]?.side,
        "data-effect-depth": webgl.effects?.[0]?.depth,
        "data-effect-fov": webgl.effects?.[0]?.fov,
        "data-effect-overscan": webgl.effects?.[0]?.overscan,
      },
      children,
    ),
  WebGLPassViewport: ({
    children,
    id,
    as = "div",
    className,
  }: PropsWithChildren<{
    id: string;
    as?: "div" | "figure";
    className?: string;
  }>) => createElement(as, { className, "data-pass-viewport": id }, children),
}));

import { HeroExperience } from "../src/experience/HeroExperience";

beforeEach(() => {
  capturedEffects.length = 0;
  meshRenderCount = 0;
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
  test("declares one scene with an initial site portal and four chapter timelines", () => {
    const html = renderToStaticMarkup(createElement(HeroExperience));

    expect(html.match(/data-scene=/g)).toHaveLength(1);
    expect(html).toContain('data-runtime="hero-scroll"');
    expect(html).toContain('data-antialias="true"');
    expect(html).toContain('data-max-device-pixel-ratio="2"');
    expect(html.match(/data-timeline=/g)).toHaveLength(8);
    expect(html.match(/class="hero-chapter-cycle"/g)).toHaveLength(4);
    expect(html).toContain('class="hero-hub-runway hero-hub-runway--opening"');
    expect(html.match(/class="hero-portal-stage"/g)).toHaveLength(1);
    expect(html.match(/class="hero-portal-copy /g)).toHaveLength(2);
    expect(html).not.toContain("hero-transition-copy");
    expect(html).toContain('data-timeline="hero.chapter-1.entry.timeline"');
    expect(html).toContain('data-progress-key="hero.chapter-1.entry"');
    expect(html).toContain('data-end="bottom top"');
    expect(html).toContain('data-timeline="hero.chapter-1.exit.timeline"');
    expect(html).toContain('data-progress-key="hero.chapter-1.exit"');
    expect(html).toContain('data-end="bottom bottom"');
    expect(html).toContain('data-timeline="hero.chapter-4.entry.timeline"');
    expect(html).toContain('data-progress-key="hero.chapter-4.entry"');
    expect(html).toContain('data-timeline="hero.chapter-4.exit.timeline"');
    expect(html).toContain('data-progress-key="hero.chapter-4.exit"');
    expect(html).not.toContain("data-pin");
    expect(html).toContain('data-scene="hero.tetrahedron.scene"');
    expect(html).toContain('data-position="0,0,3.2"');
    expect(html).toContain('data-target-position="0,0.32,0"');
    expect(html).toContain('data-target="hero.ghost.background"');
    expect(html).toContain('data-effect="hero.ghost.background"');
    expect(html).toContain('data-depth="5"');
    expect(html).toContain('data-effect-depth="5"');
    expect(html).toContain('data-effect-fov="38"');
    expect(html).toContain('data-effect-overscan="1.06"');
    expect(html).toContain('data-target="hero.portal.site.left.primary"');
    expect(html).toContain('data-target="hero.portal.site.left.secondary"');
    expect(html).toContain('data-target="hero.portal.site.right.primary"');
    expect(html).toContain('data-target="hero.portal.site.right.secondary"');
    expect(html).toContain('data-effect="hero.portal.motion"');
    expect(html).toContain('data-effect-content="site"');
    expect(html).toContain('data-effect-side="left"');
    expect(html).toContain('data-effect-side="right"');
    expect(html).not.toContain('data-target="hero.portal.self.left.primary"');
    expect(html).toContain('data-mesh="hero.tetrahedron.mesh"');
    expect(html).toContain('data-geometry="tetrahedron"');
    expect(html).toContain('data-radius="0.52"');
    expect(html).toContain('data-material="standard"');
    expect(html).toContain('data-color="#5F5F5F"');
    expect(html).toContain('data-emissive="#5F5F5F"');
    expect(html).toContain('data-emissive-intensity="0.035"');
    expect(html).toContain('data-opacity="0.92"');
    expect(html).toContain('data-metalness="0.62"');
    expect(html).toContain('data-roughness="0.28"');
    expect(html).toContain('data-mesh-effect="hero.tetrahedron.motion"');
    expect(html).toContain('data-hit-test="mesh"');
    expect(html).toContain('data-press="true"');
    expect(html).not.toContain('data-target="hero.ghost.foreground"');
    expect(html.match(/data-placement="screen-depth"/g)).toHaveLength(5);
    expect(html.match(/data-render-role="model"/g)).toHaveLength(5);
    expect(html).toContain('data-light="hero.tetrahedron.key"');
    expect(html).toContain('data-light="hero.tetrahedron.rim"');
    expect(html).toContain('data-light-color="#f2f2f2"');
    expect(html).toContain('data-light-color="#b8b8b8"');
    expect(html).toContain('data-light-intensity="5.4"');
    expect(html).toContain('data-light-intensity="1.35"');
    expect(html).toContain('data-light-position="1.6,2.2,2.6"');
    expect(html).toContain('data-light-position="-2.2,-1.2,0.8"');
    expect(html).not.toContain('data-light="hero.tetrahedron.fill"');
    expect(html.match(/data-light=/g)).toHaveLength(2);
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
    expect(html).toContain("Agent 一定要会用");
    expect(html).toContain("持续校正");
    expect(html).toContain("保留怀疑");
    expect(html).toContain("交给真实使用");
    expect(html).toContain("保持连接");
    expect(html).toContain("愿与同道者共研同进，或有所得，亦未可知");
    expect(html).not.toContain('class="hero-final-hub"');
    expect(html).toContain('class="hero-final-links"');
    expect(html).not.toContain("hero.profile");
    expect(html).not.toContain("data-model=");
    expect(html).toContain('href="https://github.com/agenticnoob"');
    expect(html).toContain('href="https://blog.zzzxc.com"');
    expect(html).toContain('data-hero-locale-option="zh"');
    expect(html).toContain('data-hero-locale-option="en"');
    expect(html).not.toContain("Boo!");
  });

  test("keeps the injected writer and mesh effects stable without React frame state", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => root.render(createElement(HeroExperience)));
    act(() => root.render(createElement(HeroExperience)));

    expect(capturedEffects).toHaveLength(2);
    expect(capturedEffects[1]).toBe(capturedEffects[0]);
    const capturedWriter = capturedEffects[0]?.[0]?.signals;
    const capturedTheme = capturedEffects[0]?.[0]?.theme;
    const capturedLocale = capturedEffects[0]?.[0]?.locale;
    expect(capturedWriter).toBeDefined();
    expect(capturedTheme?.getSnapshot()).toBe("initial");
    expect(capturedLocale?.getSnapshot()).toBe("zh");
    expect(capturedEffects[1]?.[0]?.signals).toBe(capturedWriter);
    expect(capturedEffects[1]?.[0]?.theme).toBe(capturedTheme);
    expect(capturedEffects[1]?.[0]?.locale).toBe(capturedLocale);
    expect(refreshHeroScrollLayout).toHaveBeenCalled();

    const rendersBeforeSignalWrite = meshRenderCount;
    capturedWriter?.set(heroTransitionConfig.signalKeys.coverage, 0.5);
    expect(meshRenderCount).toBe(rendersBeforeSignalWrite);
    expect(progressStore.set).toHaveBeenCalledWith(
      heroTransitionConfig.signalKeys.coverage,
      0.5,
    );

    act(() => root.unmount());
  });

  test("switches semantic content and persists locale without replacing effect declarations", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => root.render(createElement(HeroExperience)));
    const initialEffects = capturedEffects.at(-1);
    const englishButton = host.querySelector<HTMLButtonElement>(
      '[data-hero-locale-option="en"]',
    );
    expect(englishButton).not.toBeNull();

    act(() => englishButton?.click());

    expect(host.textContent).toContain("Rethinking software for agents");
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      "viselora.hero.locale.v1",
      "en",
    );
    expect(capturedEffects.at(-1)).toBe(initialEffects);

    act(() => root.unmount());
  });
});
