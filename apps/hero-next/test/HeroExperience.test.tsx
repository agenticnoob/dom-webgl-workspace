import { createElement, type PropsWithChildren } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@viselora/scroll-adapters/react", () => ({
  WebGLScrollRuntime: ({ children }: PropsWithChildren) =>
    createElement("div", null, children),
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
    effects?: readonly { kind: string; baseScale?: number }[];
  }) =>
    createElement("div", {
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
      "data-base-scale": effects?.[0]?.baseScale,
    }),
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
        color?: string;
        brightness?: number;
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
      "data-effect-color": webgl.effects?.[0]?.color,
      "data-effect-brightness": webgl.effects?.[0]?.brightness,
      "data-effect-depth": webgl.effects?.[0]?.depth,
      "data-effect-fov": webgl.effects?.[0]?.fov,
      "data-effect-overscan": webgl.effects?.[0]?.overscan,
    }),
}));

import { HeroExperience } from "../src/HeroExperience";

describe("HeroExperience", () => {
  test("declares one managed scene with the current background, mesh, and lights", () => {
    const html = renderToStaticMarkup(createElement(HeroExperience));

    expect(html.match(/data-scene=/g)).toHaveLength(1);
    expect(html).toContain('data-scene="hero.tetrahedron.scene"');
    expect(html).toContain('data-position="0,0,3.2"');
    expect(html).toContain('data-target-position="0,0.32,0"');
    expect(html).toContain('data-target="hero.ghost.background"');
    expect(html).toContain('data-effect="hero.ghost.background"');
    expect(html).toContain('data-effect-color="#3f3f3f"');
    expect(html).toContain('data-effect-brightness="0.72"');
    expect(html).toContain('data-depth="5"');
    expect(html).toContain('data-effect-depth="5"');
    expect(html).toContain('data-effect-fov="38"');
    expect(html).toContain('data-effect-overscan="1.06"');
    expect(html).toContain('data-mesh="hero.tetrahedron.mesh"');
    expect(html).toContain('data-geometry="tetrahedron"');
    expect(html).toContain('data-radius="0.52"');
    expect(html).toContain('data-material="standard"');
    expect(html).toContain('data-color="#5f5f5f"');
    expect(html).toContain('data-emissive="#0d0d0d"');
    expect(html).toContain('data-emissive-intensity="0.06"');
    expect(html).toContain('data-opacity="0.92"');
    expect(html).toContain('data-metalness="0.9"');
    expect(html).toContain('data-roughness="0.12"');
    expect(html).toContain('data-mesh-effect="hero.tetrahedron.motion"');
    expect(html).toContain('data-base-scale="1.12"');
    expect(html).not.toContain('data-target="hero.ghost.foreground"');
    expect(html).not.toContain('data-effect="hero.ghost.foreground"');
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
});
