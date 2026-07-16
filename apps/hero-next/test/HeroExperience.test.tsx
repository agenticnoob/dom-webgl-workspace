import { act, createElement, type PropsWithChildren } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { heroTransitionConfig } from "../src/heroTransitionConfig";
import type { HeroTransitionSignalWriter } from "../src/heroTransitionSignals";

type CapturedMeshEffect = {
  readonly kind: string;
  readonly signals?: HeroTransitionSignalWriter;
};

const progressStore = {
  source: { get: vi.fn(() => 0) },
  set: vi.fn(),
  reset: vi.fn(),
  clear: vi.fn(),
};
const capturedEffects: (readonly CapturedMeshEffect[] | undefined)[] = [];
let meshRenderCount = 0;

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
  }: PropsWithChildren<{
    id: string;
    start?: string;
    end?: string;
    pin?: boolean;
    scrub?: boolean;
  }>) =>
    createElement(
      "section",
      {
        "data-timeline": id,
        "data-start": start,
        "data-end": end,
        "data-pin": pin,
        "data-scrub": scrub,
      },
      children,
    ),
}));

vi.mock("../src/heroScroll", () => ({
  heroSmoothScroll: false,
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
  }: {
    webgl: {
      key: string;
      placement?: { mode?: string; depth?: number };
      renderRole?: string;
      effects?: readonly {
        kind: string;
        depth?: number;
        fov?: number;
        overscan?: number;
      }[];
    };
    className?: string;
  }) =>
    createElement("div", {
      className,
      "data-target": webgl.key,
      "data-placement": webgl.placement?.mode,
      "data-depth": webgl.placement?.depth,
      "data-render-role": webgl.renderRole,
      "data-effect": webgl.effects?.[0]?.kind,
      "data-effect-depth": webgl.effects?.[0]?.depth,
      "data-effect-fov": webgl.effects?.[0]?.fov,
      "data-effect-overscan": webgl.effects?.[0]?.overscan,
    }),
}));

import { HeroExperience } from "../src/HeroExperience";

beforeEach(() => {
  capturedEffects.length = 0;
  meshRenderCount = 0;
  vi.clearAllMocks();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
});

describe("HeroExperience", () => {
  test("declares one stable managed scene with real mesh press interaction", () => {
    const html = renderToStaticMarkup(createElement(HeroExperience));

    expect(html.match(/data-scene=/g)).toHaveLength(1);
    expect(html).toContain('data-runtime="hero-scroll"');
    expect(html).toContain('data-antialias="true"');
    expect(html).toContain('data-max-device-pixel-ratio="2"');
    expect(html).not.toContain("data-timeline");
    expect(html).not.toContain("+=300%");
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
    expect(html).toContain('data-mesh="hero.tetrahedron.mesh"');
    expect(html).toContain('data-geometry="tetrahedron"');
    expect(html).toContain('data-radius="0.52"');
    expect(html).toContain('data-material="standard"');
    expect(html).toContain('data-color="#5F5F5F"');
    expect(html).toContain('data-emissive="#5F5F5F"');
    expect(html).toContain('data-emissive-intensity="0.06"');
    expect(html).toContain('data-opacity="0.92"');
    expect(html).toContain('data-metalness="0.9"');
    expect(html).toContain('data-roughness="0.12"');
    expect(html).toContain('data-mesh-effect="hero.tetrahedron.motion"');
    expect(html).toContain('data-hit-test="mesh"');
    expect(html).toContain('data-press="true"');
    expect(html).not.toContain('data-target="hero.ghost.foreground"');
    expect(html.match(/data-placement="screen-depth"/g)).toHaveLength(1);
    expect(html.match(/data-render-role="model"/g)).toHaveLength(1);
    expect(html).toContain('data-light="hero.tetrahedron.key"');
    expect(html).toContain('data-light="hero.tetrahedron.rim"');
    expect(html).toContain('data-light-color="#f2f2f2"');
    expect(html).toContain('data-light-color="#b8b8b8"');
    expect(html).toContain('data-light-intensity="4.8"');
    expect(html).toContain('data-light-intensity="2.2"');
    expect(html).toContain('data-light-position="1.2,1.2,2"');
    expect(html).toContain('data-light-position="1.8,-1.4,2"');
    expect(html).not.toContain('data-light="hero.tetrahedron.fill"');
    expect(html.match(/data-light=/g)).toHaveLength(2);
    expect(html).not.toContain("Boo!");
    expect(html).not.toMatch(/<h[1-6]|<p|<button|<nav|<a /);
  });

  test("keeps the injected writer and mesh effects stable without React frame state", () => {
    const host = document.createElement("div");
    const root = createRoot(host);

    act(() => root.render(createElement(HeroExperience)));
    act(() => root.render(createElement(HeroExperience)));

    expect(capturedEffects).toHaveLength(2);
    expect(capturedEffects[1]).toBe(capturedEffects[0]);
    const capturedWriter = capturedEffects[0]?.[0]?.signals;
    expect(capturedWriter).toBeDefined();
    expect(capturedEffects[1]?.[0]?.signals).toBe(capturedWriter);

    const rendersBeforeSignalWrite = meshRenderCount;
    capturedWriter?.set(heroTransitionConfig.signalKeys.coverage, 0.5);
    expect(meshRenderCount).toBe(rendersBeforeSignalWrite);
    expect(progressStore.set).toHaveBeenCalledWith(
      heroTransitionConfig.signalKeys.coverage,
      0.5,
    );

    act(() => root.unmount());
  });
});
